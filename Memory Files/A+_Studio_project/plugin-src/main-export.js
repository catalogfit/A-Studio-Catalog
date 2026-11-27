// ===== sandbox handlers: Export — OWNED BY THE EXPORT PANEL =====
// UI counterpart: plugin-src/ui/export.js.
// Hooks from main.js (core): onUiMessage, onInit, replyTo/replyError, idsFromNode, nearbyLabelIds.
// Messages handled:  export-style {reqId, styleId, pageId, format, composite, scale} · save-export-config {config}
// Messages posted:   export-bytes {reqId, styleId, format, composite, frameName, frameId, matches, width, height, bytes}
//                    export-error {reqId, styleId, message}
// Init contribution: init.exportConfig — the GIF folder + category→GIF rules saved from the Export tab.

onInit(async function (init) {
  init.exportConfig = (await figma.clientStorage.getAsync('exportConfig')) || null;
});

onUiMessage('save-export-config', async function (msg) { await figma.clientStorage.setAsync('exportConfig', msg.config || null); });

// ---------- export ----------
// Finds the A+ frame for a style ID on the current page and exports it with exportAsync.
// Figma can only emit PNG/JPG/SVG/PDF; animated output is composited from these bytes in the UI.
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
onUiMessage('export-style', handleExportStyle);
