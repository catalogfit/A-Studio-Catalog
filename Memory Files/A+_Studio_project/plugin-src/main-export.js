// ===== sandbox handlers: Export — OWNED BY THE EXPORT PANEL =====
// UI counterpart: plugin-src/ui/export.js.
// Hooks from main.js (core): onUiMessage, onInit, replyTo/replyError, idsFromNode, nearbyLabelIds.
// All of these are request/reply (bridge.request in the UI):
//   export-scan        {scope:'selection'|'page'} -> { pageId, frames:[{id,name,w,h,ids,category,gender,source}], other }
//   export-select-all  {}                         -> { count }   selects every A+ frame on the page
//   export-clear       {}                         -> { count:0 }
//   export-thumb       {frameId}                  -> { bytes }   tiny PNG for the list
//   export-frame       {frameId, format, scale?, width?} -> { bytes, width, height, name }
//   save-export-config {config}                   (fire-and-forget) panel settings
// Init contribution: init.exportConfig.
//
// Only rendering happens here (exportAsync). Compositing the GIF/MP4, the ZIP and the Drive
// upload all run in the UI iframe — on the user's machine, never on the backend.

onInit(async function (init) {
  init.exportConfig = (await figma.clientStorage.getAsync('exportConfig')) || null;
});
onUiMessage('save-export-config', async function (msg) { await figma.clientStorage.setAsync('exportConfig', msg.config || null); });

// ---------- which frames are A+ frames, and what category each is ----------
// Category, in order of trust:
//   1. plugin data "aplus" written by the Automate build (exact)
//   2. the template's hero word sitting in the frame as its own text ("RUN" -> running,
//      "TRAIN" -> training), taken from the registry so no category is named here
//   3. unknown — the UI lets the user pick
function exHeroIndex() {
  var idx = {};
  var reg = (typeof FALLBACK_REGISTRY !== 'undefined' && FALLBACK_REGISTRY) || {};
  (reg.categories || []).forEach(function (c) {
    (c.genders || []).forEach(function (g) {
      var w = g.hero && g.hero[0] ? String(g.hero[0]).trim().toUpperCase() : '';
      if (w && !idx[w]) idx[w] = { category: c.id, gender: g.id };
    });
  });
  return idx;
}
function exReadTag(node) {
  try {
    var raw = node.getPluginData('aplus');
    if (!raw) return null;
    var t = JSON.parse(raw);
    return t && t.category ? t : null;
  } catch (e) { return null; }
}
function exDescribe(node, heroes) {
  var ids = idsFromNode(node);
  if (!ids.length) ids = nearbyLabelIds(node);
  var tag = exReadTag(node);
  if (tag && tag.styleIds && tag.styleIds.length) ids = tag.styleIds.concat(ids);
  var seen = {}, uniq = [];
  ids.forEach(function (i) { i = String(i); if (!seen[i]) { seen[i] = 1; uniq.push(i); } });
  var category = tag ? tag.category : null, gender = tag ? (tag.gender || null) : null, source = tag ? 'tag' : null;
  if (!category && 'findAllWithCriteria' in node) {
    var texts = node.findAllWithCriteria({ types: ['TEXT'] });
    for (var i = 0; i < texts.length && i < 400; i++) {
      var hit = heroes[String(texts[i].characters || '').trim().toUpperCase()];
      if (hit) { category = hit.category; gender = hit.gender; source = 'hero'; break; }
    }
  }
  return { id: node.id, name: node.name, w: Math.round(node.width), h: Math.round(node.height),
           ids: uniq, category: category, gender: gender, source: source };
}
// An A+ frame on the page: a top-level FRAME (or one parked in a SECTION/GROUP) that carries a
// style ID or the Automate tag. Its children are parts of that A+, never separate exports.
function exPageFrames() {
  var out = [];
  function visit(n, depth) {
    if (n.type === 'FRAME') {
      if (exReadTag(n) || idsFromNode(n).length || nearbyLabelIds(n).length) out.push(n);
      return;
    }
    if ((n.type === 'SECTION' || n.type === 'GROUP') && depth < 3) n.children.forEach(function (c) { visit(c, depth + 1); });
  }
  figma.currentPage.children.forEach(function (n) { visit(n, 0); });
  return out;
}

onUiMessage('export-scan', async function (msg) {
  try {
    var heroes = exHeroIndex();
    var sel = figma.currentPage.selection;
    var nodes = msg.scope === 'page' ? exPageFrames() : sel.filter(function (n) { return n.type === 'FRAME'; });
    replyTo(msg, {
      pageId: figma.currentPage.id,
      frames: nodes.map(function (n) { return exDescribe(n, heroes); }),
      other: msg.scope === 'page' ? 0 : sel.length - nodes.length
    });
  } catch (e) { replyError(msg, e); }
});

onUiMessage('export-select-all', async function (msg) {
  try {
    var frames = exPageFrames();
    figma.currentPage.selection = frames;
    if (frames.length) figma.viewport.scrollAndZoomIntoView(frames);
    replyTo(msg, { count: frames.length });
  } catch (e) { replyError(msg, e); }
});

onUiMessage('export-clear', async function (msg) {
  figma.currentPage.selection = [];
  replyTo(msg, { count: 0 });
});

async function exNode(id) {
  var n = await figma.getNodeByIdAsync(String(id || ''));
  if (!n || n.removed) throw new Error('That frame is no longer on the canvas. Select the frames again.');
  if (!('exportAsync' in n)) throw new Error('"' + n.name + '" cannot be exported.');
  return n;
}

onUiMessage('export-thumb', async function (msg) {
  try {
    var n = await exNode(msg.frameId);
    var bytes = await n.exportAsync({ format: 'PNG', constraint: { type: 'WIDTH', value: 76 } });
    replyTo(msg, { bytes: bytes });
  } catch (e) { replyError(msg, e); }
});

// width (pixels) wins over scale: the animated export asks for an exact output width so Figma
// renders the A+ at the final size itself — sharper than resizing a bitmap afterwards.
onUiMessage('export-frame', async function (msg) {
  try {
    var n = await exNode(msg.frameId);
    var fmt = String(msg.format || 'PNG').toUpperCase();
    if (['PNG', 'JPG', 'SVG', 'PDF'].indexOf(fmt) < 0) throw new Error('Figma cannot export "' + fmt + '".');
    var settings = { format: fmt }, w = n.width, h = n.height;
    if (fmt === 'PNG' || fmt === 'JPG') {
      if (msg.width) {
        var tw = Math.max(16, Math.round(Number(msg.width)));
        settings.constraint = { type: 'WIDTH', value: tw };
        h = n.height * tw / n.width; w = tw;
      } else {
        var s = Math.max(0.1, Math.min(4, Number(msg.scale) || 1));
        settings.constraint = { type: 'SCALE', value: s };
        w = n.width * s; h = n.height * s;
      }
    }
    var bytes = await n.exportAsync(settings);
    replyTo(msg, { bytes: bytes, width: Math.round(w), height: Math.round(h), name: n.name });
  } catch (e) { replyError(msg, e); }
});
