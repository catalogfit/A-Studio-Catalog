// ===== plugin main (CORE) — OWNED BY THE PLATFORM =====
// The Figma-sandbox half of the platform: shows the UI, keeps the UI's view of page + selection
// consistent, owns figma.clientStorage, and routes UI messages to the panel handlers registered in
// main-automate.js / main-design.js / main-export.js (concatenated after this file by build.js).
//
// Panel files use exactly three hooks from here:
//   onUiMessage(type, async function (msg) { ... })      handle one UI message type
//   onInit(async function (initMsg) { initMsg.x = ... })  add fields to the 'init' message
//   replyTo(msg, result) / replyError(msg, err)           answer a bridge.request() from the UI
// plus the shared helpers idsFromNode(), nearbyLabelIds(), fallbackManifest().
figma.showUI(__html__, { width: 460, height: 760, themeColors: true });

function fallbackManifest(key) { return FALLBACK_MANIFESTS[key] || null; }

// ---------- message router ----------
var UI_HANDLERS = {};
function onUiMessage(type, fn) {
  if (UI_HANDLERS[type]) throw new Error('Two handlers registered for UI message "' + type + '"');
  UI_HANDLERS[type] = fn;
}
var INIT_CONTRIBUTORS = [];
function onInit(fn) { INIT_CONTRIBUTORS.push(fn); }
// Replies to the UI's bridge.request(type, payload): the UI waits for { type:'reply', reqId }.
function replyTo(msg, result) { if (msg && msg.reqId) figma.ui.postMessage({ type: 'reply', reqId: msg.reqId, ok: true, result: result === undefined ? null : result }); }
function replyError(msg, e, code) {
  if (msg && msg.reqId) figma.ui.postMessage({ type: 'reply', reqId: msg.reqId, ok: false, code: code || (e && e.code) || 'sandbox-error', error: String((e && e.message) || e) });
}

figma.ui.onmessage = async function (msg) {
  if (!msg || !msg.type) return;
  var fn = UI_HANDLERS[msg.type];
  if (!fn) {
    if (msg.reqId) replyError(msg, 'No handler for "' + msg.type + '" in this code.js — rebuild the plugin.', 'no-handler');
    return;
  }
  try { await fn(msg); }
  catch (e) {
    if (msg.reqId) replyError(msg, e);
    else figma.ui.postMessage({ type: 'error', message: String((e && e.message) || e) });
  }
};

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

// ---------- startup ----------
// Runs on a microtask, i.e. after this whole file (and the main-*.js files concatenated after it)
// has executed, so every onInit() contributor and onUiMessage() handler is registered first.
async function bootPlugin() {
  var backendOverride = await figma.clientStorage.getAsync('backendUrl');
  var session = await figma.clientStorage.getAsync('googleSession');
  var init = {
    type: 'init',
    backendUrl: backendOverride || '',   // developer override only; empty = the built-in constant
    session: session || '',
    registry: FALLBACK_REGISTRY,
    manifests: FALLBACK_MANIFESTS,       // so the UI can draw template previews with no backend
    page: figma.currentPage.name
  };
  for (var i = 0; i < INIT_CONTRIBUTORS.length; i++) {
    try { await INIT_CONTRIBUTORS[i](init); }
    catch (e) { figma.notify('A+: startup step failed (' + ((e && e.message) || e) + ')'); }
  }
  // contributors may have folded more templates into the FALLBACK_* maps
  init.registry = FALLBACK_REGISTRY;
  init.manifests = FALLBACK_MANIFESTS;
  figma.ui.postMessage(init);
  postPage();                // same shape the UI gets on every later page change
  postSelection(true);
  ready = true;              // only now may the listeners below post anything
}
Promise.resolve().then(bootPlugin).catch(function (e) { figma.notify('A+: could not start (' + ((e && e.message) || e) + ')'); });

// ---------- follow the user across pages and selections ----------
figma.on('selectionchange', syncToUi);
figma.on('currentpagechange', syncToUi);

// a page rename with no page switch is not pushed. The hook that would catch it,
// figma.on('documentchange'), requires figma.loadAllPagesAsync() first under
// "documentAccess": "dynamic-page", which loads every page of the file just to watch a
// title. Instead the UI refreshes the name itself with a 'ping-page' message, which is
// cheap and handled below — so a stale name only lasts until the UI next pings.

// ---------- core messages ----------
onUiMessage('save-session', async function (msg) { await figma.clientStorage.setAsync('googleSession', msg.session || ''); });
// developer override of the backend URL (no UI field; from the plugin console: aplusDev.setBackend(url))
onUiMessage('save-backend', async function (msg) { await figma.clientStorage.setAsync('backendUrl', msg.url || ''); });
// the pings answer unconditionally — the UI asked, so the de-dup above must not swallow it
onUiMessage('ping-selection', async function () { postSelection(true); });
onUiMessage('ping-page', async function () { postPage(); });
onUiMessage('notify', async function (msg) { figma.notify(String(msg.text || '').slice(0, 300), msg.error ? { error: true } : undefined); });

// Small per-user prefs for panels — always namespaced "ui:" so a panel can never overwrite the
// session, the backend override or the template cache. Values must be small (clientStorage quota).
var STORAGE_VALUE_MAX = 64 * 1024;
onUiMessage('storage-get', async function (msg) {
  replyTo(msg, await figma.clientStorage.getAsync('ui:' + String(msg.key || '')));
});
onUiMessage('storage-set', async function (msg) {
  var v = msg.value === undefined ? null : msg.value;
  if (JSON.stringify(v === null ? '' : v).length > STORAGE_VALUE_MAX) return replyError(msg, 'Value too large for clientStorage (max 64 KB). Store big things in Drive.', 'too-large');
  if (v === null) await figma.clientStorage.deleteAsync('ui:' + String(msg.key || ''));
  else await figma.clientStorage.setAsync('ui:' + String(msg.key || ''), v);
  replyTo(msg, true);
});

// ---------- template cache (clientStorage) ----------
// A CACHE of the user's Drive template library (templateStore in platform.js). Drive is the
// source of truth; this only makes the picker work offline and instantly. Manifests only — never
// image bytes — and bounded: one entry <= TPLCACHE_ENTRY_MAX, all entries <= TPLCACHE_TOTAL_MAX,
// oldest evicted first. An entry too big to cache keeps its index row (no body).
var TPLCACHE_INDEX = 'tplcache:index';
var TPLCACHE_ENTRY_MAX = 400 * 1024;
var TPLCACHE_TOTAL_MAX = 2 * 1024 * 1024;
function tplBodyKey(key) { return 'tplcache:m:' + key; }
async function tplIndex() { return (await figma.clientStorage.getAsync(TPLCACHE_INDEX)) || []; }
async function tplPut(key, entry, manifest) {
  var idx = (await tplIndex()).filter(function (e) { return e && e.key !== key; });
  var size = 0, body = null;
  if (manifest) { body = JSON.stringify(manifest); size = body.length; }
  var row = { key: key, entry: entry || null, cachedAt: Date.now(), bytes: body && size <= TPLCACHE_ENTRY_MAX ? size : 0 };
  if (row.bytes) await figma.clientStorage.setAsync(tplBodyKey(key), manifest);
  else await figma.clientStorage.deleteAsync(tplBodyKey(key));
  idx.push(row);
  // evict oldest bodies until the total fits
  idx.sort(function (a, b) { return a.cachedAt - b.cachedAt; });
  var total = idx.reduce(function (n, e) { return n + (e.bytes || 0); }, 0);
  for (var i = 0; i < idx.length && total > TPLCACHE_TOTAL_MAX; i++) {
    if (!idx[i].bytes || idx[i].key === key) continue;
    total -= idx[i].bytes; idx[i].bytes = 0;
    await figma.clientStorage.deleteAsync(tplBodyKey(idx[i].key));
  }
  await figma.clientStorage.setAsync(TPLCACHE_INDEX, idx);
  return { cached: !!row.bytes, bytes: size };
}
onUiMessage('tplcache-put', async function (msg) { replyTo(msg, await tplPut(String(msg.key), msg.entry, msg.manifest)); });
onUiMessage('tplcache-remove', async function (msg) {
  var key = String(msg.key);
  await figma.clientStorage.setAsync(TPLCACHE_INDEX, (await tplIndex()).filter(function (e) { return e && e.key !== key; }));
  await figma.clientStorage.deleteAsync(tplBodyKey(key));
  replyTo(msg, true);
});
// keep exactly the keys Drive reported; refresh their index rows, drop the rest
onUiMessage('tplcache-sync', async function (msg) {
  var keep = {}; (msg.keys || []).forEach(function (k) { keep[k] = 1; });
  var entries = {}; (msg.entries || []).forEach(function (e) { if (e && e.key) entries[e.key] = e; });
  var idx = await tplIndex(), out = [];
  for (var i = 0; i < idx.length; i++) {
    var e = idx[i];
    if (!e || !keep[e.key]) { if (e) await figma.clientStorage.deleteAsync(tplBodyKey(e.key)); continue; }
    if (entries[e.key]) e.entry = entries[e.key];
    out.push(e); delete entries[e.key];
  }
  Object.keys(entries).forEach(function (k) { out.push({ key: k, entry: entries[k], cachedAt: Date.now(), bytes: 0 }); });
  await figma.clientStorage.setAsync(TPLCACHE_INDEX, out);
  replyTo(msg, { count: out.length });
});
onUiMessage('tplcache-list', async function (msg) {
  var idx = await tplIndex(), manifests = {};
  for (var i = 0; i < idx.length; i++) {
    if (!idx[i] || !idx[i].bytes) continue;
    var m = await figma.clientStorage.getAsync(tplBodyKey(idx[i].key));
    if (m) manifests[idx[i].key] = m;
  }
  replyTo(msg, { index: idx.map(function (e) { return { key: e.key, entry: e.entry, cachedAt: e.cachedAt, hasManifest: !!manifests[e.key] }; }), manifests: manifests });
});
onUiMessage('tplcache-clear', async function (msg) {
  var idx = await tplIndex();
  for (var i = 0; i < idx.length; i++) if (idx[i]) await figma.clientStorage.deleteAsync(tplBodyKey(idx[i].key));
  await figma.clientStorage.deleteAsync(TPLCACHE_INDEX);
  replyTo(msg, true);
});
