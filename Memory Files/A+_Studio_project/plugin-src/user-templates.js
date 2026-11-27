// ===== user templates — per-user storage of captured templates (sandbox side) =====
// A template the user captures belongs to THAT USER, never to the backend. It lives in up to three
// places, all of them the user's own (docs/user-templates.md):
//
//   1. This computer — figma.clientStorage (this file). The index, every manifest that fits, and
//      image bytes while the whole store stays under UT_SAFE_TOTAL. Survives plugin restarts and
//      works in every Figma file on this machine.
//   2. Their Google Drive — "Cult A+ Design Lab/Templates/<cat>__<gender>__<id>/" (platform.js
//      templateStore, run from the UI iframe with the user's own token). Durable across machines.
//   3. A file on their disk — "<key>.aplus-template.json" (Export / Import in the Add design panel).
//
// Image fills are captured as BYTES, not only as hashes. An imageHash resolves only inside the
// Figma file that holds the image, so at build time every hash in the manifest is re-created with
// figma.createImage(bytes) and remapped (utMaterializeImages) — that is what lets a template render
// its photos in any file. A hash with no bytes anywhere becomes a labelled grey placeholder.
//
// clientStorage quota (Figma plugin docs, figma.clientStorage): "Each plugin gets a total of 5MB of
// storage", a key/value pair costs roughly key length + JSON size of the value, and a Uint8Array
// costs its byte length. setAsync rejects when storage fails. The budget below keeps ~12% headroom
// under the smaller (decimal) reading of 5 MB, and counts what OTHER features store too.

var UT_INDEX_KEY = 'capturedTemplateIndex';          // same key as the v1 store — old saves still load
var UT_MANIFEST_PREFIX = 'capturedTemplate:';         // + key [+ '#' + rev]
var UT_ASSET_PREFIX = 'capturedAsset:';               // + image hash (shared by every template using it)
var UT_QUOTA = 5000000;                               // Figma's documented per-plugin total
var UT_SAFE_TOTAL = 4400000;                          // everything in clientStorage stays below this
var UT_MANIFEST_MAX = 1500000;                        // one template's manifest, so one cannot crowd out the rest
var UT_KEY_RE = /^[a-z0-9][a-z0-9-]{0,59}\/[a-z0-9][a-z0-9-]{0,39}\/[a-z0-9][a-z0-9-]{0,59}$/;
var UT_HASH_RE = /^[A-Za-z0-9_-]{6,128}$/;

// Session memory: key -> { manifest, assets: { hash: Uint8Array } }. Holds a fresh capture (so the
// UI can upload it to Drive even when it was too big for this computer) and assets the UI staged
// from Drive for a build. Gone when the plugin closes, by design.
var UT_MEM = {};
var UT_MAT_CACHE = {};   // key|rev -> { manifest, warnings } — images recreated once per session

function utCanStore() { return typeof figma !== 'undefined' && figma.clientStorage; }
function utUtf8Len(s) {
  var n = 0;
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i);
    if (c < 0x80) n += 1; else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; } else n += 3;
  }
  return n;
}
// what clientStorage charges for one value (docs: JSON size; a Uint8Array its byte length)
function utSizeOf(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v.byteLength === 'number') return v.byteLength;
  try { var s = JSON.stringify(v); return s === undefined ? 0 : utUtf8Len(s); } catch (e) { return 0; }
}
function utIsOwnKey(k) {
  return k === UT_INDEX_KEY || k.indexOf(UT_MANIFEST_PREFIX) === 0 || k.indexOf(UT_ASSET_PREFIX) === 0;
}
function utManifestStoreKey(e) { return e.manifestKey || (UT_MANIFEST_PREFIX + e.key); }
function utAssetStoreKey(hash) { return UT_ASSET_PREFIX + hash; }
function utFmt(n) { return n >= 1000000 ? (n / 1000000).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1000)) + ' KB'; }

async function utReadIndex() {
  var idx = null;
  try { idx = await figma.clientStorage.getAsync(UT_INDEX_KEY); } catch (e) { idx = null; }
  return Array.isArray(idx) ? idx.filter(function (e) { return e && e.key; }) : [];
}

// Bytes in clientStorage right now. Our own keys are costed from the index (no need to read every
// image back); every other key (session, prefs, export config, template cache…) is measured.
async function utUsage(idx) {
  idx = idx || await utReadIndex();
  var keys = [];
  try { keys = await figma.clientStorage.keysAsync(); } catch (e) { keys = []; }
  var foreign = 0;
  for (var i = 0; i < keys.length; i++) {
    if (utIsOwnKey(keys[i])) continue;
    var v = null;
    try { v = await figma.clientStorage.getAsync(keys[i]); } catch (e) {}
    foreign += keys[i].length + utSizeOf(v);
  }
  var own = UT_INDEX_KEY.length + utSizeOf(idx), seen = {};
  for (var j = 0; j < idx.length; j++) {
    if (idx[j].local) continue;   // a v1 row from the old store: its size was never recorded — measure it
    var lm = null;
    try { lm = await figma.clientStorage.getAsync(utManifestStoreKey(idx[j])); } catch (e) {}
    own += utManifestStoreKey(idx[j]).length + utSizeOf(lm);
  }
  idx.forEach(function (e) {
    if (e.local && e.local.manifest) own += utManifestStoreKey(e).length + (e.local.manifestBytes || 0);
    (e.assets || []).forEach(function (a) {
      if (!a.local || seen[a.hash]) return;
      seen[a.hash] = 1;
      own += utAssetStoreKey(a.hash).length + (a.bytes || 0);
    });
  });
  return { foreign: foreign, own: own, total: foreign + own, budget: UT_SAFE_TOTAL, quota: UT_QUOTA };
}

// PNG / JPEG / GIF / WEBP from the first bytes — Figma only accepts these four.
function utSniffMime(u8) {
  if (!u8 || u8.length < 12) return 'application/octet-stream';
  if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) return 'image/png';
  if (u8[0] === 0xff && u8[1] === 0xd8) return 'image/jpeg';
  if (u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46) return 'image/gif';
  if (u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 && u8[8] === 0x57 && u8[9] === 0x45) return 'image/webp';
  return 'application/octet-stream';
}
function utExt(mime) {
  return ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' })[mime] || 'bin';
}

// ---------------------------------------------------------------------------
// Capture side: image bytes out of the current file
// ---------------------------------------------------------------------------

// For every hash the capture saw: the bytes, their size and type. A hash Figma cannot give bytes
// for (rare: an image still loading) is reported, not fatal — the template keeps the hash and
// renders a placeholder wherever the hash does not resolve.
async function utExtractAssets(hashes, post, notes) {
  var assets = [], failed = [];
  for (var i = 0; i < hashes.length; i++) {
    var h = hashes[i];
    if (post) post('images', i, hashes.length);
    try {
      var img = figma.getImageByHash(h);
      if (!img) throw new Error('not in this file');
      var bytes = await img.getBytesAsync();
      if (!bytes || !bytes.length) throw new Error('no bytes');
      var size = null;
      try { size = await img.getSizeAsync(); } catch (e) {}
      var mime = utSniffMime(bytes);
      assets.push({ hash: h, mime: mime, name: h + '.' + utExt(mime), width: size ? size.width : null,
        height: size ? size.height : null, bytes: bytes.length, data: bytes });
    } catch (e) { failed.push(h); }
  }
  if (post) post('images', hashes.length, hashes.length);
  if (failed.length && notes) {
    notes.push(failed.length + ' image(s) could not be read from this file (' + failed.map(function (h) { return h.slice(0, 8); }).join(', ') +
      '). They are kept as references and render as labelled placeholders in other files.');
  }
  return assets;
}
// The asset catalogue that travels inside the manifest (no bytes): what the template needs.
function utCatalogue(assets) {
  return assets.map(function (a) {
    return { hash: a.hash, name: a.name || (a.hash + '.' + utExt(a.mime)), mime: a.mime, width: a.width || null, height: a.height || null, bytes: a.bytes || (a.data ? a.data.length : 0) };
  });
}

// ---------------------------------------------------------------------------
// Build side: recreate images, remap hashes
// ---------------------------------------------------------------------------

function utPaintLists(spec) {
  var out = [];
  var p = spec.props || {};
  if (Array.isArray(p.fills)) out.push(p.fills);
  if (Array.isArray(p.strokes)) out.push(p.strokes);
  (spec.segments || []).forEach(function (sg) { if (Array.isArray(sg.fills)) out.push(sg.fills); });
  return out;
}
function utHashesIn(root) {
  var seen = {}, out = [];
  (function walk(s) {
    if (!s) return;
    utPaintLists(s).forEach(function (arr) {
      arr.forEach(function (paint) {
        if (paint && paint.type === 'IMAGE' && paint.imageHash && !seen[paint.imageHash]) { seen[paint.imageHash] = 1; out.push(paint.imageHash); }
      });
    });
    (s.children || []).forEach(walk);
  })(root);
  return out;
}

// Bytes for one hash: session memory first, then this computer's store.
async function utAssetBytes(key, hash) {
  var mem = UT_MEM[key];
  if (mem && mem.assets && mem.assets[hash]) return mem.assets[hash];
  for (var k in UT_MEM) { if (UT_MEM[k].assets && UT_MEM[k].assets[hash]) return UT_MEM[k].assets[hash]; }
  if (!utCanStore()) return null;
  try {
    var v = await figma.clientStorage.getAsync(utAssetStoreKey(hash));
    return v && v.length ? v : null;
  } catch (e) { return null; }
}

// Returns a copy of M whose every imageHash resolves in THIS file. Never throws for a missing image:
// the paint becomes the slot grey, the layer is renamed "[image missing] …", and one warning lists them.
async function utMaterializeImages(M, warn, opts) {
  if (!M || !M.root) return M;
  var hashes = utHashesIn(M.root);
  if (!hashes.length) return M;
  var key = (M.meta && M.meta.key) || '';
  var memoKey = key + '|' + ((M.meta && (M.meta.savedAt || M.meta.capturedAt)) || '');
  var memo = UT_MAT_CACHE[memoKey];
  if (memo && !(opts && opts.fresh)) { memo.warnings.forEach(function (w) { warn.push(w); }); return memo.manifest; }

  var map = {}, missing = {}, notes = [];
  for (var i = 0; i < hashes.length; i++) {
    var h = hashes[i];
    var bytes = await utAssetBytes(key, h);
    if (bytes) {
      try { map[h] = figma.createImage(bytes).hash; continue; }
      catch (e) { notes.push('An image (' + h.slice(0, 8) + ') could not be recreated: ' + ((e && e.message) || e)); }
    }
    var here = null;
    try { here = figma.getImageByHash(h); } catch (e) {}
    if (here) { map[h] = h; continue; }      // same file as the capture: the hash still resolves
    missing[h] = 1;
  }

  var copy = JSON.parse(JSON.stringify(M));
  var c = (copy.palette && copy.palette.slotFill) || [205, 209, 214];
  var grey = { r: c[0] / 255, g: c[1] / 255, b: c[2] / 255 };
  var lost = [];
  (function walk(s) {
    var hit = false;
    utPaintLists(s).forEach(function (arr) {
      for (var j = 0; j < arr.length; j++) {
        var p = arr[j];
        if (!p || p.type !== 'IMAGE' || !p.imageHash) continue;
        if (map[p.imageHash]) { p.imageHash = map[p.imageHash]; continue; }
        if (!missing[p.imageHash]) continue;
        arr[j] = { type: 'SOLID', color: grey, opacity: p.opacity === undefined ? 1 : p.opacity, visible: p.visible !== false };
        hit = true;
      }
    });
    if (hit) {
      var isSlotPhoto = s.slot && s.slot.photoPath === s.path;   // production mode blanks these anyway
      if (s.props) s.props.name = '[image missing] ' + (s.props.name || s.type);
      if (!isSlotPhoto) lost.push(String((s.props && s.props.name) || s.path).replace(/^\[image missing\] /, ''));
    }
    (s.children || []).forEach(walk);
  })(copy.root);
  if (Object.keys(missing).length) {
    notes.push(Object.keys(missing).length + ' image(s) of this template are not on this computer and not in this file, ' +
      'so ' + (lost.length ? lost.length + ' layer(s) (' + lost.slice(0, 6).join(', ') + (lost.length > 6 ? '…' : '') + ')' : 'their layers') +
      ' show a grey placeholder named "[image missing]". Sign in to Google (the Drive copy has the images) or re-import the template file.');
  }
  UT_MAT_CACHE[memoKey] = { manifest: copy, warnings: notes };
  notes.forEach(function (w) { warn.push(w); });
  return copy;
}

// ---------------------------------------------------------------------------
// This computer: save / load / remove
// ---------------------------------------------------------------------------

function utEntryFor(M, prev) {
  var m = M.meta || {};
  return {
    v: 2, key: m.key, category: m.category, categoryLabel: m.categoryLabel, gender: m.gender, id: m.id,
    label: m.label, sub: m.sub, status: m.status || 'active', version: m.version || 1,
    capturedAt: m.capturedAt || null, savedAt: m.savedAt || new Date().toISOString(),
    source: m.source || null, width: m.width || null, height: m.height || null,
    drive: (prev && prev.drive) || null
  };
}

// utSave(M, assets, opts) -> { entry, local: { manifest, assetsStored, assetsTotal, bytes, reason } }
// assets: [{ hash, mime, name, width, height, data: Uint8Array }]. Never throws for "does not fit":
// what does not fit is left out and said so; the template is still kept in session memory.
// Atomic per template: new keys are written first, the index swap commits, stale keys go last.
// A failure before the index swap deletes only what this call wrote — no other template is touched.
async function utSave(M, assets, opts) {
  opts = opts || {};
  if (!M || !M.meta || !UT_KEY_RE.test(String(M.meta.key || ''))) throw new Error('Template key must be "category/gender/id" in lower-case letters, digits and dashes.');
  var key = M.meta.key;
  assets = (assets || []).filter(function (a) { return a && a.hash && a.data && a.data.length && UT_HASH_RE.test(a.hash); });
  M.meta.savedAt = M.meta.savedAt || new Date().toISOString();
  if (!Array.isArray(M.meta.assets) || !M.meta.assets.length) M.meta.assets = utCatalogue(assets);

  var mem = UT_MEM[key] = UT_MEM[key] || { manifest: null, assets: {} };
  mem.manifest = M;
  assets.forEach(function (a) { mem.assets[a.hash] = a.data; });
  Object.keys(UT_MAT_CACHE).forEach(function (k) { if (k.indexOf(key + '|') === 0) delete UT_MAT_CACHE[k]; });

  var idx = await utReadIndex();
  var prev = null;
  idx.forEach(function (e) { if (e.key === key) prev = e; });
  var others = idx.filter(function (e) { return e.key !== key; });
  var entry = utEntryFor(M, prev);
  if (opts.drive !== undefined) entry.drive = opts.drive;
  var rev = Date.now().toString(36);
  entry.manifestKey = UT_MANIFEST_PREFIX + key + '#' + rev;
  var manifestBytes = utSizeOf(M);
  var local = { manifest: false, assetsStored: 0, assetsTotal: (M.meta.assets || []).length, bytes: 0, reason: '' };

  // room = budget minus everything except this template's own previous copy
  var usage = await utUsage(others);
  var sharedByOthers = {};
  others.forEach(function (e) { (e.assets || []).forEach(function (a) { if (a.local) sharedByOthers[a.hash] = 1; }); });
  var room = UT_SAFE_TOTAL - usage.total - 4000;   // 4 KB for this template's index row

  var catalogue = (M.meta.assets || []).map(function (a) { return { hash: a.hash, name: a.name, mime: a.mime, width: a.width, height: a.height, bytes: a.bytes, local: false }; });
  entry.assets = catalogue;
  var manifestCost = entry.manifestKey.length + manifestBytes;
  if (manifestBytes > UT_MANIFEST_MAX) {
    local.reason = 'The template is ' + utFmt(manifestBytes) + ', over the ' + utFmt(UT_MANIFEST_MAX) + ' a single template may use on this computer.';
  } else if (manifestCost > room) {
    local.reason = 'This computer has ' + utFmt(Math.max(0, room)) + ' of template space left and the template needs ' + utFmt(manifestCost) +
      '. Delete or export a template from My templates to free space.';
  }

  var written = [];
  try {
    if (!local.reason) {
      room -= manifestCost;
      var byHash = {};
      assets.forEach(function (a) { byHash[a.hash] = a; });
      for (var i = 0; i < catalogue.length; i++) {
        var a = catalogue[i], src = byHash[a.hash];
        if (sharedByOthers[a.hash]) { a.local = true; local.assetsStored++; continue; }   // already stored once
        if (!src) {
          // an asset this call did not bring: keep it if the previous copy had it stored
          var had = prev && (prev.assets || []).some(function (p) { return p.hash === a.hash && p.local; });
          if (had) { a.local = true; local.assetsStored++; room -= utAssetStoreKey(a.hash).length + (a.bytes || 0); }
          continue;
        }
        var cost = utAssetStoreKey(a.hash).length + src.data.length;
        if (cost > room) continue;
        await figma.clientStorage.setAsync(utAssetStoreKey(a.hash), src.data);
        written.push(utAssetStoreKey(a.hash));
        a.local = true; a.bytes = src.data.length; local.assetsStored++; local.bytes += src.data.length;
        room -= cost;
      }
      await figma.clientStorage.setAsync(entry.manifestKey, M);
      written.push(entry.manifestKey);
      local.manifest = true; local.bytes += manifestBytes;
      if (local.assetsStored < local.assetsTotal) {
        local.reason = (local.assetsTotal - local.assetsStored) + ' of ' + local.assetsTotal + ' image(s) did not fit on this computer (' +
          utFmt(Math.max(0, room)) + ' left). They stay in your Drive copy and in an exported file.';
      }
    }
    entry.local = { manifest: local.manifest, manifestBytes: local.manifest ? manifestBytes : 0 };
    entry.totalBytes = manifestBytes + catalogue.reduce(function (n, a) { return n + (a.bytes || 0); }, 0);
    if (local.manifest || opts.keepIndexRow) {
      others.push(entry);
      await figma.clientStorage.setAsync(UT_INDEX_KEY, others);   // commit
    } else if (prev) {
      await figma.clientStorage.setAsync(UT_INDEX_KEY, others);   // the old local copy is replaced by "not on this computer"
    }
  } catch (e) {
    for (var w = 0; w < written.length; w++) { try { await figma.clientStorage.deleteAsync(written[w]); } catch (e2) {} }
    local.manifest = false; local.assetsStored = 0; local.bytes = 0;
    local.reason = 'Figma refused to store the template on this computer (' + ((e && e.message) || e) + '). Nothing else was changed.';
    entry.local = { manifest: false, manifestBytes: 0 };
    entry.assets = catalogue.map(function (a) { a.local = !!sharedByOthers[a.hash]; return a; });
    return { entry: entry, local: local };
  }
  // stale keys of the previous version (never an image another template still uses)
  if (prev) await utDropKeys(prev, others);
  return { entry: entry, local: local };
}

// Delete a superseded/removed entry's keys, keeping images still referenced by `remaining`.
async function utDropKeys(e, remaining) {
  var keep = {};
  remaining.forEach(function (r) {
    (r.assets || []).forEach(function (a) { if (a.local) keep[a.hash] = 1; });
    keep['m:' + utManifestStoreKey(r)] = 1;
  });
  if (!keep['m:' + utManifestStoreKey(e)]) { try { await figma.clientStorage.deleteAsync(utManifestStoreKey(e)); } catch (x) {} }
  var assets = e.assets || [];
  for (var i = 0; i < assets.length; i++) {
    if (!assets[i].local || keep[assets[i].hash]) continue;
    try { await figma.clientStorage.deleteAsync(utAssetStoreKey(assets[i].hash)); } catch (x) {}
  }
}

async function utRemove(key) {
  var idx = await utReadIndex();
  var e = null;
  idx.forEach(function (x) { if (x.key === key) e = x; });
  var rest = idx.filter(function (x) { return x.key !== key; });
  if (e) {
    await figma.clientStorage.setAsync(UT_INDEX_KEY, rest);
    await utDropKeys(e, rest);
  }
  delete UT_MEM[key];
  Object.keys(UT_MAT_CACHE).forEach(function (k) { if (k.indexOf(key + '|') === 0) delete UT_MAT_CACHE[k]; });
  return { removed: !!e };
}

async function utManifest(key) {
  if (UT_MEM[key] && UT_MEM[key].manifest) return UT_MEM[key].manifest;
  var idx = await utReadIndex();
  for (var i = 0; i < idx.length; i++) {
    if (idx[i].key !== key) continue;
    if (idx[i].local && idx[i].local.manifest === false) return null;
    try { return (await figma.clientStorage.getAsync(utManifestStoreKey(idx[i]))) || null; } catch (e) { return null; }
  }
  return null;
}

// utLoad(key, { assets: true }) -> { manifest, assets: [{hash, mime, name, width, height, data}], missing: [hash] }
async function utLoad(key, opts) {
  var M = await utManifest(key);
  if (!M) return null;
  var out = { manifest: M, assets: [], missing: [] };
  var catalogue = (M.meta && M.meta.assets) || utHashesIn(M.root).map(function (h) { return { hash: h }; });
  for (var i = 0; i < catalogue.length; i++) {
    var a = catalogue[i];
    var bytes = await utAssetBytes(key, a.hash);
    if (!bytes) { out.missing.push(a.hash); continue; }
    if (opts && opts.assets) out.assets.push({ hash: a.hash, mime: a.mime || utSniffMime(bytes), name: a.name || (a.hash + '.' + utExt(utSniffMime(bytes))), width: a.width || null, height: a.height || null, bytes: bytes.length, data: bytes });
  }
  return out;
}

// Index rows for the UI (v1 rows from the old store are normalised on the way out).
async function utList() {
  var idx = await utReadIndex();
  var usage = await utUsage(idx);
  var rows = idx.map(function (e) {
    var assets = e.assets || [];
    return {
      key: e.key, label: e.label, category: e.category, categoryLabel: e.categoryLabel, gender: e.gender, id: e.id,
      status: e.v === 2 ? (e.status || 'active') : 'active', version: e.version || 1, sub: e.sub || '',
      capturedAt: e.capturedAt || null, savedAt: e.savedAt || e.capturedAt || null,
      local: { manifest: !(e.local && e.local.manifest === false), assetsStored: assets.filter(function (a) { return a.local; }).length, assetsTotal: assets.length, legacy: e.v !== 2 },
      bytes: e.totalBytes || (e.local && e.local.manifestBytes) || 0,
      drive: e.drive || null
    };
  });
  return { index: rows, usage: usage };
}

async function utMarkDrive(key, drive) {
  var idx = await utReadIndex();
  var hit = false;
  idx.forEach(function (e) { if (e.key === key) { e.drive = drive || null; hit = true; } });
  if (hit) await figma.clientStorage.setAsync(UT_INDEX_KEY, idx);
  return { updated: hit };
}

// What a build of `key` still lacks on this side: the manifest, and which images.
async function utStatus(key) {
  var M = await utManifest(key);
  if (!M) return { manifest: false, missing: [] };
  var missing = [];
  var hashes = utHashesIn(M.root);
  for (var i = 0; i < hashes.length; i++) { if (!(await utAssetBytes(key, hashes[i]))) missing.push(hashes[i]); }
  return { manifest: true, missing: missing };
}

// Keep an image or manifest for this session only (the UI downloaded it from Drive for a build).
function utStage(key, manifest, assets) {
  var mem = UT_MEM[key] = UT_MEM[key] || { manifest: null, assets: {} };
  if (manifest) mem.manifest = manifest;
  (assets || []).forEach(function (a) { if (a && a.hash && a.data && a.data.length) mem.assets[a.hash] = a.data; });
  Object.keys(UT_MAT_CACHE).forEach(function (k) { if (k.indexOf(key + '|') === 0) delete UT_MAT_CACHE[k]; });
  return { staged: (assets || []).length };
}

// Mark which registry templates belong to the user, so the UI can strip and re-apply them.
function utRegistryRows(index) {
  return (index || []).map(function (e) {
    return { key: e.key, category: e.category, categoryLabel: e.categoryLabel, gender: e.gender, id: e.id,
      label: e.label, sub: e.sub, status: 'active', version: e.version };
  });
}
