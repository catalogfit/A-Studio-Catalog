
// ===== plugin main: resolve a template manifest, build one A+ per sheet row =====
// Network (fetching manifests from the backend) happens in ui.html; this side renders.
// If the UI could not reach the backend, we fall back to the manifest bundled in this file.
figma.showUI(__html__, { width: 460, height: 760, themeColors: true });

function fallbackManifest(key) { return FALLBACK_MANIFESTS[key] || null; }

// ---------- what is selected right now ----------
// Used by the "build from the selected frame" flow: pick an A+ on the canvas and the
// plugin reads its style IDs, so the designer can rebuild that style on another template.
// The IDs come from the frame name (that is how the renderer names them) and, failing that,
// from any six-digit number in the frame or in a text label sitting just outside it.
function idsFromNode(node) {
  var found = (String(node.name).match(/\d{6}/g) || []);
  if (!found.length && 'findAllWithCriteria' in node) {
    var texts = node.findAllWithCriteria({ types: ['TEXT'] });
    for (var i = 0; i < texts.length && found.length < 6; i++) {
      var m = String(texts[i].characters).match(/\d{6}/g);
      if (m) found = found.concat(m);
    }
  }
  return found;
}
function nearbyLabelIds(node) {
  // the style-ID label the renderer drops to the right of each frame
  var p = node.parent;
  if (!p || !('children' in p)) return [];
  var out = [];
  for (var i = 0; i < p.children.length; i++) {
    var n = p.children[i];
    if (n.type !== 'TEXT') continue;
    if (n.x < node.x + node.width - 10 || n.x > node.x + node.width + 600) continue;
    if (n.y < node.y - 200 || n.y > node.y + 400) continue;
    var m = String(n.characters).match(/\d{6}/g);
    if (m) out = out.concat(m);
  }
  return out;
}
function describeSelection() {
  var sel = figma.currentPage.selection.filter(function (n) { return n.type === 'FRAME'; });
  var frames = sel.map(function (n) {
    var ids = idsFromNode(n);
    if (!ids.length) ids = nearbyLabelIds(n);
    var seen = {}, uniq = [];
    ids.forEach(function (i) { if (!seen[i]) { seen[i] = 1; uniq.push(i); } });
    return { id: n.id, name: n.name, w: Math.round(n.width), h: Math.round(n.height), ids: uniq };
  });
  var all = {}, ids = [];
  frames.forEach(function (f) { f.ids.forEach(function (i) { if (!all[i]) { all[i] = 1; ids.push(i); } }); });
  // pageId travels with every selection message so the UI can drop stale ones: the sender
  // guarantees the matching 'page' arrived first, but the UI still gets to check.
  return {
    type: 'selection',
    pageId: figma.currentPage.id,
    frames: frames,
    ids: ids,
    other: figma.currentPage.selection.length - sel.length
  };
}

// ---------- which page are we on right now ----------
// frameCount is "frames sitting on this page": the outermost frames, wherever they sit.
// We walk into SECTIONs and GROUPs (designers routinely park A+ frames in those) but stop
// at the first FRAME — its children are the parts of that A+, not frames "on the page" —
// so the walk never descends into an A+ subtree and stays cheap on a crowded page.
function countFrames(node) {
  var n = 0;
  for (var i = 0; i < node.children.length; i++) {
    var c = node.children[i];
    if (c.type === 'FRAME') n++;
    else if (c.type === 'SECTION' || c.type === 'GROUP') n += countFrames(c);
  }
  return n;
}
function describePage() {
  return {
    type: 'page',
    id: figma.currentPage.id,
    name: figma.currentPage.name,
    frameCount: countFrames(figma.currentPage)
  };
}

// ---------- keeping the UI's view of page + selection consistent ----------
// Two invariants, both enforced here rather than assumed:
//   1. nothing is posted before 'init' — the listeners below are registered while the async
//      startup block is still suspended on clientStorage, so a user action in that window
//      would otherwise post a selection stamped with a pageId the UI has never seen.
//   2. a 'selection' never reaches the UI before the 'page' it belongs to. postSelection
//      posts the page itself whenever the current page differs from the last one we sent,
//      so the order holds no matter which of the two Figma events fires first.
var ready = false;          // flipped on once init + the first page/selection pair are out
var lastPageId = null;      // id of the most recent 'page' message
var lastSelectionKey = null; // pageId + selected node ids of the most recent 'selection'

function selectionKey() {
  var sel = figma.currentPage.selection, ids = [];
  for (var i = 0; i < sel.length; i++) ids.push(sel[i].id);
  return figma.currentPage.id + '|' + ids.join(',');
}
function postPage() {
  lastPageId = figma.currentPage.id;
  figma.ui.postMessage(describePage());
}
function postSelection(force) {
  if (figma.currentPage.id !== lastPageId) postPage();   // invariant 2
  var key = selectionKey();
  // describeSelection() walks every selected frame's text subtree, so skip the repeat:
  // a page switch fires both 'selectionchange' and 'currentpagechange' and we land here twice.
  if (!force && key === lastSelectionKey) return;
  lastSelectionKey = key;
  figma.ui.postMessage(describeSelection());
}
// one handler for both events: whichever fires first does the work, the other is a no-op
function syncToUi() {
  if (!ready) return;      // invariant 1
  postSelection(false);
}

(async function () {
  var saved = await figma.clientStorage.getAsync('sheetLink');
  var backend = await figma.clientStorage.getAsync('backendUrl');
  var session = await figma.clientStorage.getAsync('googleSession');
  var exportConfig = await figma.clientStorage.getAsync('exportConfig');
  // Templates captured from a frame live in clientStorage. They are folded into the same
  // registry and manifest map the bundled Running templates use, so they show up in the
  // category → gender → template picker and route from the sheet with no special casing.
  var captured = { index: [], manifests: {} };
  try { captured = await capLoadTemplates(); }
  catch (e) { figma.notify('A+: saved templates could not be read (' + (e && e.message) + ')'); }
  Object.keys(captured.manifests).forEach(function (k) { FALLBACK_MANIFESTS[k] = captured.manifests[k]; });
  capMergeIntoRegistry(FALLBACK_REGISTRY, captured.index);
  figma.ui.postMessage({
    type: 'init',
    sheetLink: saved || '',
    backendUrl: backend || '',
    session: session || '',
    exportConfig: exportConfig || null,  // GIF folder + category→GIF rules from the Export tab
    registry: FALLBACK_REGISTRY,
    manifests: FALLBACK_MANIFESTS,   // so the UI can draw template previews with no backend
    captured: captured.index,        // which of the above came from a captured frame
    page: figma.currentPage.name
  });
  postPage();                // same shape the UI gets on every later page change
  postSelection(true);
  ready = true;              // only now may the listeners below post anything
})();

// ---------- follow the user across pages and selections ----------
figma.on('selectionchange', syncToUi);
figma.on('currentpagechange', syncToUi);

// ---------- export ----------
// Finds the A+ frame for a style ID on the current page and exports it with exportAsync.
// Figma can only emit PNG/JPG/SVG/PDF; when the user asked for an animated composite the UI
// receives the PNG here and sends it to the backend's /api/compose with the matched Drive GIF.
function styleFrameCandidates() {
  var pool = [];
  figma.currentPage.children.forEach(function (n) {
    if (n.type === 'FRAME') pool.push(n);
    else if (n.type === 'SECTION') n.children.forEach(function (c) { if (c.type === 'FRAME') pool.push(c); });
  });
  return pool;
}
function findStyleFrames(styleId) {
  // a selected frame wins, so "select the A+ and press Export" always exports what you selected
  var sel = figma.currentPage.selection.filter(function (n) { return n.type === 'FRAME'; });
  var pool = sel.concat(styleFrameCandidates().filter(function (n) { return sel.indexOf(n) < 0; }));
  var byName = pool.filter(function (n) { return (String(n.name).match(/\d{6}/g) || []).indexOf(styleId) >= 0; });
  if (byName.length) return byName;
  return pool.filter(function (n) {
    var ids = idsFromNode(n);
    if (!ids.length) ids = nearbyLabelIds(n);
    return ids.indexOf(styleId) >= 0;
  });
}
async function handleExportStyle(msg) {
  var reqId = msg.reqId;
  try {
    if (msg.pageId && msg.pageId !== figma.currentPage.id) {
      throw new Error('You changed pages after this list was drawn. Go back to the page holding style ' + msg.styleId + ', or refresh the Export tab.');
    }
    var hits = findStyleFrames(String(msg.styleId || ''));
    if (!hits.length) throw new Error('No frame for style ' + msg.styleId + ' on this page. Build it on the Automate tab first, or select its frame.');
    var frame = hits[0];
    var fmt = String(msg.format || 'PNG').toUpperCase();
    if (['PNG', 'JPG', 'SVG', 'PDF'].indexOf(fmt) < 0) throw new Error('Figma cannot export "' + fmt + '".');
    var scale = Math.max(1, Math.min(4, Number(msg.scale) || 1));
    var settings = (fmt === 'PNG' || fmt === 'JPG') ? { format: fmt, constraint: { type: 'SCALE', value: scale } } : { format: fmt };
    var bytes = await frame.exportAsync(settings);
    figma.ui.postMessage({
      type: 'export-bytes', reqId: reqId, styleId: msg.styleId, format: fmt, composite: msg.composite || null,
      frameName: frame.name, frameId: frame.id, matches: hits.length,
      width: Math.round(frame.width * (settings.constraint ? scale : 1)),
      height: Math.round(frame.height * (settings.constraint ? scale : 1)),
      bytes: bytes
    });
  } catch (e) {
    figma.ui.postMessage({ type: 'export-error', reqId: reqId, styleId: msg.styleId, message: String((e && e.message) || e) });
  }
}

// a page rename with no page switch is not pushed. The hook that would catch it,
// figma.on('documentchange'), requires figma.loadAllPagesAsync() first under
// "documentAccess": "dynamic-page", which loads every page of the file just to watch a
// title. Instead the UI refreshes the name itself with a 'ping-page' message, which is
// cheap and handled below — so a stale name only lasts until the UI next pings.

figma.ui.onmessage = async function (msg) {
  if (msg.type === 'save-link') { await figma.clientStorage.setAsync('sheetLink', msg.link || ''); return; }
  if (msg.type === 'save-backend') { await figma.clientStorage.setAsync('backendUrl', msg.url || ''); return; }
  if (msg.type === 'save-session') { await figma.clientStorage.setAsync('googleSession', msg.session || ''); return; }
  if (msg.type === 'save-export-config') { await figma.clientStorage.setAsync('exportConfig', msg.config || null); return; }

  // ---------- export one style's A+ frame (the UI composites a GIF onto it if asked) ----------
  if (msg.type === 'export-style') { await handleExportStyle(msg); return; }
  // the pings answer unconditionally — the UI asked, so the de-dup above must not swallow it
  if (msg.type === 'ping-selection') { postSelection(true); return; }
  if (msg.type === 'ping-page') { postPage(); return; }

  // ---------- capture the selected frame as a reusable template ----------
  if (msg.type === 'capture-template') { await capHandleCaptureTemplate(msg); return; }

  // ---------- add the fit comparison card to the frames that are selected ----------
  if (msg.type === 'add-comparison') {
    var Mc = (msg.manifests && msg.manifests[msg.key]) || fallbackManifest(msg.key);
    if (!Mc) { figma.ui.postMessage({ type: 'error', message: 'No template loaded for "' + msg.key + '".' }); return; }
    if (!Mc.comparison) { figma.ui.postMessage({ type: 'error', message: 'This template has no fit comparison block.' }); return; }
    var targets = figma.currentPage.selection.filter(function (n) { return n.type === 'FRAME'; });
    if (!targets.length) { figma.ui.postMessage({ type: 'error', message: 'Select the A+ frame(s) first.' }); return; }
    try {
      var fc = await loadFontsFromManifest(Mc);
      var labels = [
        (msg.labels && msg.labels[0]) || Mc.content.comparison.defaults[0],
        (msg.labels && msg.labels[1]) || Mc.content.comparison.defaults[1]
      ];
      var rep = [];
      for (var t = 0; t < targets.length; t++) {
        try { addComparisonToFrame(Mc, fc.F, targets[t], labels); rep.push({ name: targets[t].name, ok: true, warnings: [] }); }
        catch (e) { rep.push({ name: targets[t].name, ok: false, warnings: [String((e && e.message) || e)] }); }
      }
      figma.commitUndo();
      figma.ui.postMessage({ type: 'done', report: rep, missingFonts: fc.missing, source: msg.source || 'bundled', template: Mc.meta.label });
      figma.notify('A+: fit comparison added to ' + rep.filter(function (r) { return r.ok; }).length + ' frame(s)');
    } catch (e) {
      figma.ui.postMessage({ type: 'error', message: String((e && e.message) || e) });
    }
    return;
  }

  if (msg.type !== 'run') return;

  // Per-row routing: the UI has already resolved each row's category (column B) and gender
  // (column C) to a manifest key ("running/women/template-1") in msg.keys[i], or an error
  // string in msg.errors[i] for rows it could not route. Backend manifests arrive in msg.manifests.
  var keys = msg.keys || [];
  var errors = msg.errors || [];
  var manifests = msg.manifests || {};
  // A manifest is buildable if one of the two renderers in this bundle understands it:
  // 'aplus-standard-v1' is the hand-built A+ layout, 'aplus-capture-v1' is a frame captured
  // from the canvas. Anything else is a manifest written for a renderer we do not have.
  function manifestFor(key) {
    if (!key) return null;
    var m = manifests[key] || fallbackManifest(key);
    if (m && m.renderer && m.renderer !== 'aplus-standard-v1' && m.renderer !== CAP_RENDERER) return null;
    return m;
  }
  if (!msg.rows || !msg.rows.length) {
    figma.ui.postMessage({ type: 'error', message: 'No rows to build.' });
    return;
  }

  try {
    var icons = buildIconIndex();
    var maxX = 0, minY = Infinity;
    figma.currentPage.children.forEach(function (n) { maxX = Math.max(maxX, n.x + n.width); minY = Math.min(minY, n.y); });
    var x = maxX + 600, y = isFinite(minY) ? minY : 0;
    var created = [], report = [], missingFonts = {}, lastLabel = '';
    for (var i = 0; i < msg.rows.length; i++) {
      var key = keys[i];
      var manifest = manifestFor(key);
      var row = manifest ? rowFromManifest(manifest, msg.rows[i]) : null;
      // only used to name a row we could not route (no manifest, so no schema to ask).
      // the live sheet keeps style IDs in column B and the older one in column A, so look at
      // both rather than hardcoding either — a routed row gets its ids from the manifest above.
      var ids = (String(msg.rows[i][1] || '').match(/\d{6}/g)
        || String(msg.rows[i][0] || '').match(/\d{6}/g) || []);
      var name = (row && row.ids.length ? row.ids.join(', ') : (ids.join(', ') || ('Row ' + (i + 1))));
      if (errors[i]) {
        report.push({ name: name, ok: false, warnings: [errors[i]] });
      } else if (!manifest) {
        report.push({ name: name, ok: false, warnings: ['No active template for "' + (key || 'unknown category/gender') + '" — check columns B and C.'] });
      } else {
        try {
          var fonts = await loadFontsFromManifest(manifest);
          fonts.missing.forEach(function (f) { missingFonts[f] = 1; });
          var res = manifest.renderer === CAP_RENDERER
            ? await capBuildFromManifest(manifest, row, { x: x, y: y })
            : await buildFromManifest(manifest, row, { F: fonts.F, icons: icons, x: x, y: y });
          created.push(res.frame, res.label);
          report.push({ name: name + '  ·  ' + manifest.meta.label, ok: true, warnings: res.warnings });
          lastLabel = manifest.meta.label;
          x += ((manifest.meta && manifest.meta.width) || 1572) + 600;
        } catch (e) {
          report.push({ name: name, ok: false, warnings: [String(e && e.message || e)] });
        }
      }
      figma.ui.postMessage({ type: 'progress', done: i + 1, total: msg.rows.length });
      await new Promise(function (r) { setTimeout(r, 0); });
    }
    if (created.length) {
      figma.currentPage.selection = created.filter(function (n) { return n.type === 'FRAME'; });
      figma.viewport.scrollAndZoomIntoView(created);
    }
    figma.commitUndo();
    figma.ui.postMessage({
      type: 'done', report: report, missingFonts: Object.keys(missingFonts),
      source: msg.source || 'bundled', template: lastLabel
    });
    figma.notify('A+: ' + report.filter(function (r) { return r.ok; }).length + ' design(s) created');
  } catch (e) {
    figma.ui.postMessage({ type: 'error', message: String(e && e.message || e) });
  }
};
