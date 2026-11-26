// ===== A+ Studio · store for captured templates =====
//
// WHERE CAPTURED TEMPLATES LIVE, AND THE HONEST ANSWER ABOUT DURABILITY
//
// The four Running templates are files in backend/templates/, baked into the Docker image. They
// survive a restart because they are part of the build. A template captured from a Figma frame at
// runtime is not — it has to be written somewhere after the image was built.
//
// Render's filesystem is ephemeral. Every deploy, every restart, and every idle spin-down on the
// free tier wipes anything written at runtime. session.js already solved its version of this by
// refusing to be the system of record (it seals state into a token the client holds). A template
// manifest cannot use that trick: it is tens of KB, it must be listable by everyone, and the
// registry has to show it to a designer who never captured it.
//
// So, plainly: **a captured template written to the container's own disk does NOT survive a
// Render restart.** There is no clever way around that, and this module does not pretend there
// is. What it does instead:
//
//   1. It writes to TEMPLATE_STORE_DIR, which defaults to backend/.data/templates (ephemeral).
//   2. It reports its own durability in every write response, in GET /api/templates, and in
//      /health — never as a boolean guess, but as one of three honest states:
//        "ephemeral"  no TEMPLATE_STORE_DIR set. Lost on restart. The default.
//        "disk"       TEMPLATE_STORE_DIR is set AND TEMPLATE_STORE_DURABLE=true, i.e. the
//                     operator has told us this path is a mounted persistent disk.
//        "unknown"    TEMPLATE_STORE_DIR is set but not declared durable. It might be a disk;
//                     we cannot tell from inside the container, so we do not claim it is.
//   3. It warns loudly at boot.
//
// TO MAKE CAPTURED TEMPLATES ACTUALLY DURABLE ON RENDER, one of these is required:
//   (a) a Render persistent disk mounted at e.g. /var/data, with TEMPLATE_STORE_DIR=/var/data/templates
//       and TEMPLATE_STORE_DURABLE=true. Cheapest. Cost: it pins the service to a single instance
//       and a single region, and Render's free tier cannot mount disks.
//   (b) external object storage (S3 / GCS / Cloudflare R2) behind this same interface. Survives
//       anything, scales horizontally. Cost: a new credential, a new bill, and ~a day of work
//       since the zero-dependency rule means hand-rolling the signing.
//   (c) committing captured manifests back to the repo via the GitHub API, which makes Render
//       redeploy them as built-in files. Durable and reviewable — it is how the Running templates
//       already work — but needs a GitHub token and turns every capture into a deploy.
//
// (a) is the right first step; (c) matches the "status: draft, promoted by a human" model in
// docs/add-to-template-plan.md §7 and is the better end state. Neither is implemented here
// because neither is a code problem this module can solve on its own — they are credentials and
// infrastructure decisions that need the operator.

require('./env');

var fs = require('fs');
var path = require('path');
var manifests = require('./manifests');

var DEFAULT_DIR = path.join(__dirname, '.data', 'templates');
var DIR = process.env.TEMPLATE_STORE_DIR || DEFAULT_DIR;
var DECLARED_DURABLE = String(process.env.TEMPLATE_STORE_DURABLE || '').toLowerCase() === 'true';
var CONFIGURED = !!process.env.TEMPLATE_STORE_DIR;

var INDEX_FILE = path.join(DIR, 'index.json');
var INDEX_SCHEMA = 'aplus.captured/1';
var RENDERER = 'aplus-standard-v1';
var MAX_MANIFEST_BYTES = Number(process.env.MAX_TEMPLATE_BYTES || 2 * 1024 * 1024);

var SEGMENT = manifests.SEGMENT;   // the existing no-traversal guard, reused verbatim
var MAX_SEGMENT_LEN = 64;

var writable = false;
try {
  fs.mkdirSync(DIR, { recursive: true });
  fs.accessSync(DIR, fs.constants.W_OK);
  writable = true;
} catch (e) {
  console.warn('[store] TEMPLATE_STORE_DIR=' + DIR + ' is not writable (' + ((e && e.message) || e) + ') — captured templates cannot be saved.');
}

function durability() {
  if (!writable) return 'unavailable';
  if (!CONFIGURED) return 'ephemeral';
  return DECLARED_DURABLE ? 'disk' : 'unknown';
}

var DURABILITY_NOTE = {
  unavailable: 'The template store directory is not writable; POST /api/templates will fail.',
  ephemeral: 'NOT DURABLE. This is the container\'s own filesystem. Every Render deploy, restart or idle spin-down deletes these templates. Mount a persistent disk and set TEMPLATE_STORE_DIR + TEMPLATE_STORE_DURABLE=true, or move the store to object storage. See the header of backend/store.js.',
  unknown: 'TEMPLATE_STORE_DIR is set but not declared durable. If it is a mounted persistent disk, set TEMPLATE_STORE_DURABLE=true to say so. Until then, assume these templates are lost on restart.',
  disk: 'The operator has declared TEMPLATE_STORE_DIR a mounted persistent disk, so these templates survive a restart. They are still tied to that one instance and region.'
};

function info() {
  var d = durability();
  return {
    dir: CONFIGURED ? DIR : '(default) ' + DIR,
    writable: writable,
    durability: d,
    survivesRestart: d === 'disk',
    note: DURABILITY_NOTE[d]
  };
}

function warnIfEphemeral() {
  var d = durability();
  if (d === 'disk') return;
  console.warn('');
  console.warn('  !! Captured templates are stored at ' + DIR);
  console.warn('     durability: ' + d.toUpperCase() + ' — ' + DURABILITY_NOTE[d]);
  console.warn('');
}

// ---------------------------------------------------------------------------------------------
// index
// ---------------------------------------------------------------------------------------------

function emptyIndex() { return { schema: INDEX_SCHEMA, updated: null, templates: [] }; }

function readIndex() {
  try {
    var j = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    if (!j || !Array.isArray(j.templates)) return emptyIndex();
    return j;
  } catch (e) { return emptyIndex(); }
}

function writeJsonAtomic(file, obj) {
  var tmp = file + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file); // avoids a half-written file if the process is killed mid-write
}

function writeIndex(idx) {
  idx.schema = INDEX_SCHEMA;
  idx.updated = new Date().toISOString();
  writeJsonAtomic(INDEX_FILE, idx);
}

function key(c, g, i) { return c + '/' + g + '/' + i; }
function entryFile(c, g, i) { return path.join(DIR, c, g, i + '.json'); }

function find(idx, c, g, i) {
  for (var n = 0; n < idx.templates.length; n++) {
    var t = idx.templates[n];
    if (t.category === c && t.gender === g && t.id === i) return t;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// validation
// ---------------------------------------------------------------------------------------------

function bad(message, code) { var e = new Error(message); e.statusCode = code || 400; return e; }

function checkSegment(value, what) {
  var s = String(value == null ? '' : value);
  if (!s) throw bad('Missing "' + what + '".');
  if (s.length > MAX_SEGMENT_LEN) throw bad('"' + what + '" is longer than ' + MAX_SEGMENT_LEN + ' characters.');
  // manifests.SEGMENT is the same guard the manifest loader uses: no slashes, no dots, no "..".
  if (!SEGMENT.test(s)) throw bad('"' + what + '" must match ' + SEGMENT.source + ' (letters, digits, _ and - only) — path separators and traversal are rejected.');
  return s;
}

function titleCase(s) { return String(s).replace(/[-_]+/g, ' ').replace(/\b\w/g, function (m) { return m.toUpperCase(); }); }

// Validates the submitted body and returns the normalised record. Throws with .statusCode.
function validate(body) {
  if (!body || typeof body !== 'object') throw bad('Expected a JSON object.');

  var category = checkSegment(body.category, 'category');
  var gender = checkSegment(body.gender, 'gender');
  var id = checkSegment(body.id, 'id');

  var manifest = body.manifest;
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw bad('Missing "manifest" object.');

  var bytes = Buffer.byteLength(JSON.stringify(manifest));
  if (bytes > MAX_MANIFEST_BYTES) {
    throw bad('The manifest is ' + Math.round(bytes / 1024) + ' KB, over the ' + Math.round(MAX_MANIFEST_BYTES / 1024) + ' KB limit (MAX_TEMPLATE_BYTES).', 413);
  }

  if (manifest.renderer !== RENDERER) {
    throw bad('manifest.renderer must be "' + RENDERER + '" (got ' + JSON.stringify(manifest.renderer == null ? null : String(manifest.renderer).slice(0, 40)) + '). This backend only serves manifests that renderer can draw.');
  }

  // "extends" is allowed, but only against a built-in manifest path, resolved by the existing
  // loader so its own traversal guard applies. Captured-extends-captured is deliberately not
  // supported: it would make deletion order matter.
  if (manifest.extends != null) {
    var rel = String(manifest.extends);
    try { manifests.load(rel); }
    catch (e) { throw bad('manifest.extends "' + rel.slice(0, 80) + '" does not resolve to a built-in manifest: ' + ((e && e.message) || e)); }
  }

  var label = String(body.label == null ? '' : body.label).slice(0, 120) || (titleCase(id));
  var sub = String(body.sub == null ? '' : body.sub).slice(0, 200) || null;
  var status = String(body.status || 'draft');
  if (status !== 'draft' && status !== 'active') throw bad('"status" must be "draft" or "active".');

  return {
    category: category,
    categoryLabel: String(body.categoryLabel || '').slice(0, 80) || titleCase(category),
    gender: gender,
    genderLabel: String(body.genderLabel || '').slice(0, 80) || titleCase(gender),
    id: id,
    label: label,
    sub: sub,
    status: status,
    manifest: manifest
  };
}

// ---------------------------------------------------------------------------------------------
// read / write
// ---------------------------------------------------------------------------------------------

function list() { return readIndex().templates.slice(); }

function has(c, g, i) { return !!find(readIndex(), c, g, i); }

function rawManifest(c, g, i) {
  var f = entryFile(c, g, i);
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; }
}

// The resolved manifest, with any "extends" chain flattened exactly as manifests.resolve() does
// for built-ins, so the plugin cannot tell the two apart.
function resolve(c, g, i) {
  var m = rawManifest(c, g, i);
  if (!m) return null;
  if (m.extends) {
    var parent = manifests.load(m.extends);
    var copy = {};
    Object.keys(m).forEach(function (k) { if (k !== 'extends') copy[k] = m[k]; });
    m = manifests.merge(parent, copy);
  }
  return m;
}

function put(record) {
  if (!writable) throw bad('The template store directory is not writable — captured templates cannot be saved. ' + DURABILITY_NOTE.unavailable, 503);
  var c = record.category, g = record.gender, i = record.id;

  writeJsonAtomic(entryFile(c, g, i), record.manifest);

  var idx = readIndex();
  var existing = find(idx, c, g, i);
  var now = new Date().toISOString();
  var entry = {
    category: c, categoryLabel: record.categoryLabel,
    gender: g, genderLabel: record.genderLabel,
    id: i,
    label: record.label,
    sub: record.sub,
    status: record.status,
    source: 'captured',
    version: record.manifest && record.manifest.meta && record.manifest.meta.version != null ? record.manifest.meta.version : 1,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now
  };
  if (existing) idx.templates[idx.templates.indexOf(existing)] = entry;
  else idx.templates.push(entry);
  writeIndex(idx);

  return { entry: entry, replaced: !!existing };
}

function remove(c, g, i) {
  var idx = readIndex();
  var existing = find(idx, c, g, i);
  if (!existing) return false;
  idx.templates.splice(idx.templates.indexOf(existing), 1);
  writeIndex(idx);
  try { fs.unlinkSync(entryFile(c, g, i)); } catch (e) { /* index is the source of truth */ }
  return true;
}

// ---------------------------------------------------------------------------------------------
// registry merge
// ---------------------------------------------------------------------------------------------
// Folds captured templates into the built-in registry so GET /api/templates shows both and the
// plugin uses them identically. Captured entries are tagged source:"captured" and sort after the
// hand-built ones; a captured template may also introduce a category or gender the index.json
// does not have, which is the point — that is how Training/Lifestyle/Seamless get unblocked.

function byId(arr, id) {
  for (var i = 0; i < (arr || []).length; i++) if (arr[i] && arr[i].id === id) return arr[i];
  return null;
}

function mergeRegistry(reg) {
  // Work on a copy: registry() re-reads index.json each call, but a caller may hold the object.
  var out = JSON.parse(JSON.stringify(reg || {}));
  var captured = list();
  out.categories = out.categories || [];

  captured.forEach(function (t) {
    var cat = byId(out.categories, t.category);
    if (!cat) {
      cat = { id: t.category, label: t.categoryLabel || t.category, status: 'active', defaultGender: t.gender, source: 'captured', genders: [] };
      out.categories.push(cat);
    }
    cat.genders = cat.genders || [];
    if (cat.status === 'coming-soon') cat.status = 'active'; // it now has a real template in it

    var gen = byId(cat.genders, t.gender);
    if (!gen) {
      gen = { id: t.gender, label: t.genderLabel || t.gender, status: 'active', templates: [], source: 'captured' };
      cat.genders.push(gen);
    }
    gen.templates = gen.templates || [];
    if (gen.status === 'coming-soon') gen.status = 'active';

    var entry = {
      id: t.id, label: t.label, sub: t.sub || null,
      version: t.version, status: t.status,
      source: 'captured', createdAt: t.createdAt, updatedAt: t.updatedAt
    };
    var existing = byId(gen.templates, t.id);
    if (existing) gen.templates[gen.templates.indexOf(existing)] = entry;
    else gen.templates.push(entry);
  });

  out.captured = { count: captured.length, persistence: info() };
  return out;
}

module.exports = {
  validate: validate,
  put: put,
  remove: remove,
  has: has,
  list: list,
  resolve: resolve,
  rawManifest: rawManifest,
  mergeRegistry: mergeRegistry,
  info: info,
  warnIfEphemeral: warnIfEphemeral,
  RENDERER: RENDERER,
  MAX_MANIFEST_BYTES: MAX_MANIFEST_BYTES,
  DIR: DIR
};
