// Photo-slot detection on frames that are not 1572 px wide (frame 708612, "xtended", 396 x 1469).
// Runs the real built plugin/code.js in a vm against mocked Figma nodes. No network, no Figma.
//   node --test capture-slots.test.js
//
// The bug: every photo of 708612 came out as "kept as a graphic, not a photo slot — its image fill
// is art direction (opacity 1, scalingFactor 0.5)". Two causes, both covered here:
//   1. scalingFactor was treated as art direction on any image paint. It only has a visual effect
//      in TILE mode; on FILL / FIT / CROP it is a leftover (0.5 is routine for a pasted @2x image).
//   2. the "big enough to be a photo" floor was 150 px absolute, tuned on 1572-wide frames.
const test = require('node:test'), assert = require('node:assert/strict');
const path = require('path'), fs = require('fs'), vm = require('vm');
const code = fs.readFileSync(path.join(__dirname, '..', '..', 'plugin', 'code.js'), 'utf8');

let uid = 0;
const IMAGES = {};   // hash -> bytes, i.e. the images "in this file"
function addImage(hash) { IMAGES[hash] = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0, 0, 13, uid & 255]); return hash; }

// Minimal Figma node: plain enumerable props (capture reads them with for…in), a relativeTransform
// derived from x/y, and an absoluteBoundingBox that walks up the parents.
function node(type, props, kids) {
  const n = Object.assign({
    type, id: '1:' + (++uid), name: type, visible: true, locked: false, opacity: 1,
    blendMode: 'PASS_THROUGH', isMask: false, effects: [], x: 0, y: 0, width: 100, height: 100,
    fills: [], strokes: [], strokeWeight: 1
  }, props || {});
  if (kids || type === 'FRAME') { n.children = kids || []; n.children.forEach(c => { c.parent = n; }); }
  Object.defineProperty(n, 'relativeTransform', {
    enumerable: true, configurable: true,
    get() { return [[1, 0, n.x], [0, 1, n.y]]; },
    set(m) { n.x = m[0][2]; n.y = m[1][2]; }
  });
  Object.defineProperty(n, 'absoluteBoundingBox', {
    enumerable: false, configurable: true,
    get() { let x = n.x, y = n.y, p = n.parent; while (p && p.type !== 'PAGE') { x += p.x; y += p.y; p = p.parent; } return { x, y, width: n.width, height: n.height }; }
  });
  n.resize = (w, h) => { n.width = w; n.height = h; };
  n.appendChild = c => { if (c.parent && c.parent.children) c.parent.children.splice(c.parent.children.indexOf(c), 1); c.parent = n; (n.children = n.children || []).push(c); };
  n.remove = () => { if (n.parent && n.parent.children) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; };
  return n;
}
function img(hash, extra) { return Object.assign({ type: 'IMAGE', visible: true, opacity: 1, blendMode: 'NORMAL', scaleMode: 'FILL', imageHash: addImage(hash), scalingFactor: 0.5, rotation: 0, filters: { exposure: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0 } }, extra || {}); }
const CROP_T = [[0.62, 0, 0.19], [0, 0.48, 0.21]];

const page = { type: 'PAGE', id: '0:1', name: 'Page 1', children: [], selection: [], loadAsync: async () => {} };
page.appendChild = c => { c.parent = page; page.children.push(c); };

function mockFigma() {
  return {
    showUI() {}, notify() {}, on() {}, commitUndo() {},
    ui: { postMessage() {}, onmessage: null, resize() {} },
    clientStorage: { getAsync: async () => null, setAsync: async () => {}, deleteAsync: async () => {}, keysAsync: async () => [] },
    currentPage: page, root: { name: 'xtended.fig', children: [page] }, viewport: { scrollAndZoomIntoView() {} },
    getNodeByIdAsync: async () => null, loadAllPagesAsync: async () => {}, mixed: Symbol('mixed'),
    getImageByHash: h => IMAGES[h] ? { hash: h, getBytesAsync: async () => IMAGES[h], getSizeAsync: async () => ({ width: 800, height: 800 }) } : null,
    createImage: bytes => { const h = Object.keys(IMAGES).find(k => IMAGES[k] === bytes) || addImage('new' + (++uid)); return { hash: h }; },
    listAvailableFontsAsync: async () => [{ fontName: { family: 'Inter', style: 'Regular' } }],
    loadFontAsync: async () => {},
    createFrame: () => node('FRAME'), createRectangle: () => node('RECTANGLE'), createEllipse: () => node('ELLIPSE'),
    createText: () => node('TEXT', { characters: '', fontName: { family: 'Inter', style: 'Regular' }, fontSize: 12 }),
    createVector: () => node('VECTOR'),
  };
}
const figma = mockFigma();
const ctx = vm.createContext({ figma, console, setTimeout, clearTimeout, Promise, JSON, Math, Date, Uint8Array, __html__: '' });
vm.runInContext(code, ctx);
const plain = x => JSON.parse(JSON.stringify(x));

async function capture(frame) {
  frame.parent = page; page.children.push(frame);
  const M = await ctx.capCaptureFrame(frame, { template: { categoryId: 'xtended', genderId: 'unisex', id: 't1', label: 'T' } }, () => {});
  return plain(M);
}
const slotNames = M => M.slots.map(s => s.label).sort();
const graphicNotes = M => (M.warnings || []).filter(w => /kept as a graphic/.test(w));

test('396-wide frame (708612): FILL / CROP photos at scalingFactor 0.5 become photo slots', async () => {
  const f = node('FRAME', { name: '708612', width: 396, height: 1469, fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }] }, [
    node('RECTANGLE', { name: '704768_L', x: 0, y: 0, width: 396, height: 420, fills: [img('h-704768')] }),
    node('RECTANGLE', { name: 'png (12) 3guy', x: 20, y: 470, width: 180, height: 160, fills: [img('h-3guy')] }),
    node('RECTANGLE', { name: '705649_D 2', x: 210, y: 470, width: 120, height: 90, fills: [img('h-705649', { scaleMode: 'CROP', imageTransform: CROP_T })] }),
    node('RECTANGLE', { name: 'texture', x: 0, y: 700, width: 396, height: 600, fills: [img('h-tile', { scaleMode: 'TILE' })] }),
    node('RECTANGLE', { name: 'fade', x: 0, y: 1300, width: 396, height: 160, fills: [img('h-fade', { opacity: 0.07, scalingFactor: 1 })] }),
    node('RECTANGLE', { name: 'logo', x: 10, y: 10, width: 60, height: 30, fills: [img('h-logo', { scalingFactor: 1 })] }),
  ]);
  const M = await capture(f);
  assert.deepEqual(slotNames(M), ['704768_L', '705649_D 2', 'png (12) 3guy'], 'the three photos are slots');
  const notes = graphicNotes(M);
  assert.equal(notes.length, 2, notes.join('\n'));
  assert.match(notes.find(n => /"texture"/.test(n)), /tiled pattern at scalingFactor 0\.5/, 'TILE texture stays a graphic');
  assert.match(notes.find(n => /"fade"/.test(n)), /opacity 0\.07/, 'translucent wash stays a graphic');
  assert.ok(!notes.some(n => /704768_L|3guy|705649/.test(n)), 'no photo is reported as art direction');
  assert.ok(!M.slots.some(s => s.label === 'logo'), 'a 60 px logo is below the scaled size floor');
  // CROP framing survives capture untouched (it is what places the product inside the box)
  const crop = M.root.children.find(c => c.props.name === '705649_D 2').props.fills[0];
  assert.equal(crop.scaleMode, 'CROP');
  assert.deepEqual(crop.imageTransform, CROP_T);
});

test('CROP photo with imageTransform rebuilds with the same paint (fidelity build)', async () => {
  const f = node('FRAME', { name: '708612 crop', width: 396, height: 500 }, [
    node('RECTANGLE', { name: 'material_14575863', x: 30, y: 40, width: 200, height: 150, fills: [img('h-material', { scaleMode: 'CROP', imageTransform: CROP_T })] }),
  ]);
  const M = await capture(f);
  assert.deepEqual(slotNames(M), ['material_14575863']);
  const built = await ctx.capBuildTree(M, { parent: page, fidelity: true, x: 0, y: 3000, name: 'probe' });
  const rect = built.node.children[0];
  const want = plain(f.children[0].fills), got = plain(rect.fills);
  assert.deepEqual(got, want, 'scaleMode, imageTransform, scalingFactor, filters all come back');
  assert.deepEqual([rect.x, rect.y, rect.width, rect.height], [30, 40, 200, 150]);
  built.node.remove();
});

test('1572-wide frame: thresholds unchanged (w >= 25% of frame, h >= 150), TILE / translucent stay graphics', async () => {
  const f = node('FRAME', { name: '706524', width: 1572, height: 5000 }, [
    node('RECTANGLE', { name: 'hero photo', x: 0, y: 0, width: 1572, height: 1200, fills: [img('w-hero', { scalingFactor: 1 })] }),
    node('RECTANGLE', { name: 'at the floor', x: 0, y: 1300, width: 393, height: 150, fills: [img('w-floor')] }),
    node('RECTANGLE', { name: 'too short', x: 500, y: 1300, width: 800, height: 149, fills: [img('w-short')] }),
    node('RECTANGLE', { name: 'too narrow', x: 0, y: 1500, width: 392, height: 600, fills: [img('w-narrow')] }),
    node('RECTANGLE', { name: 'dots', x: 0, y: 2200, width: 1572, height: 900, fills: [img('w-dots', { scaleMode: 'TILE', scalingFactor: 0.5 })] }),
    node('RECTANGLE', { name: 'wash', x: 0, y: 3200, width: 1572, height: 900, fills: [img('w-wash', { opacity: 0.5 })] }),
  ]);
  const M = await capture(f);
  assert.deepEqual(slotNames(M), ['at the floor', 'hero photo']);
  const notes = graphicNotes(M);
  assert.equal(notes.length, 2, notes.join('\n'));
  assert.ok(notes.some(n => /"dots".*tiled pattern/.test(n)));
  assert.ok(notes.some(n => /"wash".*opacity 0\.5/.test(n)));
});

test('capPaintIsTexture: scalingFactor matters only in TILE mode', () => {
  const t = p => ctx.capPaintIsTexture(Object.assign({ type: 'IMAGE', imageHash: 'x', opacity: 1, blendMode: 'NORMAL' }, p));
  assert.equal(t({ scaleMode: 'FILL', scalingFactor: 0.5 }), false);
  assert.equal(t({ scaleMode: 'FIT', scalingFactor: 0.5 }), false);
  assert.equal(t({ scaleMode: 'CROP', scalingFactor: 0.5, imageTransform: CROP_T }), false);
  assert.equal(t({ scaleMode: 'TILE', scalingFactor: 0.5 }), true);
  assert.equal(t({ scaleMode: 'TILE', scalingFactor: 1 }), true);
  assert.equal(t({ scaleMode: 'FILL', opacity: 0.5 }), true);
  assert.equal(t({ scaleMode: 'FILL', filters: { exposure: -1 } }), true);
  assert.equal(t({ scaleMode: 'FILL', filters: { exposure: 0, contrast: 0 } }), false);
  assert.equal(t({ scaleMode: 'FILL', blendMode: 'MULTIPLY' }), true);
});
