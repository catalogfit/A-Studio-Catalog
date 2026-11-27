// A small, honest mock of the Figma plugin sandbox — enough to run the REAL plugin/code.js for the
// capture -> save -> build flows. Works in Node (require) and in a browser page (window.FigmaMock),
// so the headless UI test can put the real code.js behind the real ui.html.
//
// What it models faithfully (because the user-template code depends on it):
//   * clientStorage: values are copies, Uint8Array survives as bytes, total capped (default 5 MB,
//     Figma's documented per-plugin quota) — setAsync rejects above it.
//   * images are per FILE: getImageByHash only resolves hashes of images in this file;
//     createImage(bytes) adds one and returns its content hash.
//   * nodes: transforms, absoluteBoundingBox, children, groups, text segments, plugin data.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FigmaMock = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function clone(v) {
    if (v instanceof Uint8Array) return new Uint8Array(v);
    if (v === undefined) return undefined;
    return typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v));
  }
  function jsonLen(v) {
    var s = JSON.stringify(v === undefined ? null : v);
    return typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(s).length : s.length;
  }
  function makeStorage(limit) {
    var m = new Map();
    function size(k, v) { return k.length + (v instanceof Uint8Array ? v.length : jsonLen(v)); }
    var st = {
      map: m, writes: 0, failNext: 0, limit: limit || 5000000,
      total: function () { var n = 0; m.forEach(function (v, k) { n += size(k, v); }); return n; },
      getAsync: async function (k) { return clone(m.get(k)); },
      setAsync: async function (k, v) {
        st.writes++;
        if (st.failNext > 0) { st.failNext--; throw new Error('simulated storage failure'); }
        var before = m.get(k); m.set(k, clone(v));
        if (st.total() > st.limit) { if (before === undefined) m.delete(k); else m.set(k, before); throw new Error('Quota exceeded'); }
      },
      deleteAsync: async function (k) { m.delete(k); },
      keysAsync: async function () { return Array.from(m.keys()); }
    };
    return st;
  }

  // FNV-1a x5, hex — a stable content hash for createImage (Figma uses SHA-1; any content hash will do)
  function contentHash(bytes) {
    var out = '';
    for (var seed = 0; seed < 5; seed++) {
      var h = (0x811c9dc5 ^ (seed * 0x9e3779b1)) >>> 0;
      for (var i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193) >>> 0; }
      out += ('00000000' + h.toString(16)).slice(-8);
    }
    return out;
  }

  var uid = 0;
  var CONTAINERS = { FRAME: 1, GROUP: 1, PAGE: 1, COMPONENT: 1, SECTION: 1 };
  function Node(type, props) {
    this.id = (type[0] + (++uid)) + ':1'; this.type = type; this.name = type.toLowerCase();
    this.visible = true; this.locked = false; this.opacity = 1; this.blendMode = 'PASS_THROUGH';
    this.fills = []; this.strokes = []; this.effects = []; this.strokeWeight = 0;
    this.relativeTransform = [[1, 0, 0], [0, 1, 0]]; this.width = 100; this.height = 100;
    this.parent = null; this._pd = {};
    if (CONTAINERS[type]) this.children = [];
    if (type === 'TEXT') { this.characters = ''; this.fontName = { family: 'Inter', style: 'Regular' }; this.fontSize = 12; this.textAlignHorizontal = 'LEFT'; this.textAutoResize = 'NONE'; }
    if (props) for (var k in props) this[k] = props[k];
  }
  Object.defineProperty(Node.prototype, 'x', {
    get: function () { return this.relativeTransform[0][2]; },
    set: function (v) { var t = this.relativeTransform; this.relativeTransform = [[t[0][0], t[0][1], v], [t[1][0], t[1][1], t[1][2]]]; }
  });
  Object.defineProperty(Node.prototype, 'y', {
    get: function () { return this.relativeTransform[1][2]; },
    set: function (v) { var t = this.relativeTransform; this.relativeTransform = [[t[0][0], t[0][1], t[0][2]], [t[1][0], t[1][1], v]]; }
  });
  Object.defineProperty(Node.prototype, 'absoluteBoundingBox', {
    get: function () {
      var x = 0, y = 0, n = this;
      while (n && n.type !== 'PAGE') { x += n.x; y += n.y; n = n.parent; }
      return { x: x, y: y, width: this.width, height: this.height };
    }
  });
  Node.prototype.appendChild = function (c) { if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1); this.children.push(c); c.parent = this; };
  Node.prototype.resize = function (w, h) { this.width = w; this.height = h; };
  Node.prototype.remove = function () { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); this.parent = null; this.removed = true; };
  Node.prototype.setPluginData = function (k, v) { this._pd[k] = v; };
  Node.prototype.getPluginData = function (k) { return this._pd[k] || ''; };
  Node.prototype.loadAsync = async function () {};
  Node.prototype.findAllWithCriteria = function (o) { var out = []; (function walk(n) { (n.children || []).forEach(function (c) { if (o.types.indexOf(c.type) >= 0) out.push(c); walk(c); }); })(this); return out; };
  Node.prototype.getStyledTextSegments = function () { return [{ start: 0, end: this.characters.length, fontName: this.fontName, fontSize: this.fontSize, fills: this.fills }]; };
  Node.prototype.setRangeFontName = function () {}; Node.prototype.setRangeFontSize = function () {}; Node.prototype.setRangeFills = function () {};
  Node.prototype.exportAsync = async function () { return new Uint8Array([137, 80, 78, 71]); };

  function walk(n, fn) { fn(n); (n.children || []).forEach(function (c) { walk(c, fn); }); }

  // One Figma FILE: its own page and its own image table. `post` receives figma.ui.postMessage.
  function makeFigma(storage, images, post) {
    var page = new Node('PAGE', { name: 'Page 1' }); page.selection = [];
    var figma = {
      mixed: typeof Symbol === 'function' ? Symbol('mixed') : {}, currentPage: page, root: { name: 'File', children: [page] },
      showUI: function () {}, notify: function () {}, on: function () {}, commitUndo: function () {},
      ui: { postMessage: post || function () {}, onmessage: null, resize: function () {} },
      clientStorage: storage, viewport: { scrollAndZoomIntoView: function () {} },
      listAvailableFontsAsync: async function () { return [{ fontName: { family: 'Inter', style: 'Regular' } }, { fontName: { family: 'Inter', style: 'Bold' } }]; },
      loadFontAsync: async function () {}, loadAllPagesAsync: async function () {},
      getNodeByIdAsync: async function (id) { var hit = null; walk(page, function (n) { if (n.id === id) hit = n; }); return hit; },
      createRectangle: function () { return new Node('RECTANGLE'); }, createEllipse: function () { return new Node('ELLIPSE'); },
      createLine: function () { return new Node('LINE'); }, createPolygon: function () { return new Node('POLYGON'); },
      createStar: function () { return new Node('STAR'); }, createVector: function () { return new Node('VECTOR'); },
      createText: function () { return new Node('TEXT'); }, createFrame: function () { return new Node('FRAME'); },
      createSlice: function () { return new Node('SLICE'); },
      group: function (nodes, parent) { var g = new Node('GROUP'); parent.appendChild(g); nodes.forEach(function (n) { g.appendChild(n); }); return g; },
      getImageByHash: function (h) {
        var b = images.get(h);
        return b ? { hash: h, getBytesAsync: async function () { return new Uint8Array(b); }, getSizeAsync: async function () { return { width: 640, height: 480 }; } } : null;
      },
      createImage: function (bytes) { var h = contentHash(bytes); images.set(h, new Uint8Array(bytes)); figma._created.push(h); return { hash: h }; },
      _created: []
    };
    return { figma: figma, page: page };
  }

  // fake image bytes with a real PNG signature, so the type sniffer has something to read
  function png(n, seed) { var b = new Uint8Array(n); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); for (var i = 8; i < n; i++) b[i] = (i * 31 + seed) & 255; return b; }

  // The A+ frame a designer would select: a texture, a big photo, a hero word and a tagline.
  function buildDesign(page, photoHash, textureHash, name) {
    var f = new Node('FRAME', { name: name || 'A+ · 706524', width: 1572, height: 3000 });
    page.appendChild(f);
    var bg = new Node('RECTANGLE', { name: 'Texture', width: 1572, height: 3000, fills: [{ type: 'IMAGE', imageHash: textureHash, scaleMode: 'FILL', opacity: 0.07, visible: true }] });
    var photo = new Node('RECTANGLE', { name: 'Photo · hero', width: 1572, height: 1200, fills: [{ type: 'IMAGE', imageHash: photoHash, scaleMode: 'FILL', visible: true }] });
    var word = new Node('TEXT', { name: '@hero.word', characters: 'RUN', fontSize: 200, width: 600, height: 220 });
    word.relativeTransform = [[1, 0, 80], [0, 1, 1300]];
    var tag = new Node('TEXT', { name: '@hero.tagline', characters: 'Built for distance', fontSize: 40, width: 600, height: 50 });
    tag.relativeTransform = [[1, 0, 80], [0, 1, 1560]];
    [bg, photo, word, tag].forEach(function (n) { f.appendChild(n); });
    return f;
  }
  // One row of the live sheet (registry.sheet): B style ID, C category, G headline, H subtext, T gender.
  function sheetRow(id, cat, headline, sub, gender) { var r = new Array(20).fill(''); r[1] = id; r[2] = cat; r[6] = headline; r[7] = sub; r[19] = gender; return r; }

  return { makeStorage: makeStorage, makeFigma: makeFigma, Node: Node, walk: walk, png: png, contentHash: contentHash, buildDesign: buildDesign, sheetRow: sheetRow };
});
