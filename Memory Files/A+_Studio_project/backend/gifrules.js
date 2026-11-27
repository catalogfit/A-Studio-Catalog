// ===== A+ Studio · GIF rules: which animation goes under which category =====
// Config lives in backend/gif-rules.json (override the path with GIF_RULES_PATH). It is DATA, owned
// by the Export panel: no category is named in this code.
//
//   GET  /api/gif-rules                     -> the file, as-is (plus `resolvedFrom`)
//   POST /api/gif-match { session, category, gender? }
//        -> { found: true,  category, rule, file: { id, name, mimeType, size, width, height, … } }
//        -> { found: false, category, reason, candidates? }
//
// Matching uses Drive METADATA only. No bytes are downloaded here; the plugin fetches the file
// itself, directly from Google, with its own short-lived token (POST /auth/token).
//
// A category rule may carry:
//   file       base name to look for (extension optional)      default: the category label / id
//   fileId     an exact Drive file id (skips the folder lookup)
//   folderId   a different source folder for this category
//   aliases    other spellings that should resolve to this category (["run"])
//   genders    { "<gender>": { file | fileId | folderId } } — per-gender override
//   disabled   true = this category has no animation, on purpose

require('./env');

var fs = require('fs');
var path = require('path');

var RULES_PATH = process.env.GIF_RULES_PATH || path.join(__dirname, 'gif-rules.json');
var cache = { mtimeMs: -1, data: null, error: null };

function load() {
  var st;
  try { st = fs.statSync(RULES_PATH); }
  catch (e) { var er = new Error('gif-rules.json not found at ' + RULES_PATH); er.statusCode = 500; throw er; }
  if (st.mtimeMs !== cache.mtimeMs) {
    try {
      var data = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
      if (!data || typeof data !== 'object' || !data.categories || typeof data.categories !== 'object') {
        throw new Error('gif-rules.json has no "categories" object');
      }
      cache = { mtimeMs: st.mtimeMs, data: data, error: null };
    } catch (e) {
      cache = { mtimeMs: st.mtimeMs, data: null, error: 'gif-rules.json is invalid: ' + e.message };
    }
  }
  if (cache.error) { var e2 = new Error(cache.error); e2.statusCode = 500; throw e2; }
  return cache.data;
}

// "Running", "running", "RUN-NING" -> "running"
function norm(s, ignorePunct) {
  s = String(s == null ? '' : s).trim().toLowerCase();
  return ignorePunct ? s.replace(/[^a-z0-9]+/g, '') : s;
}
function stripExt(name) { return String(name || '').replace(/\.[A-Za-z0-9]{2,5}$/, ''); }

// Find the category entry for whatever the sheet / UI calls it: the key, the label, or an alias.
function findCategory(rules, category) {
  var want = norm(category, true);
  if (!want) return null;
  var keys = Object.keys(rules.categories || {});
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i], c = rules.categories[k] || {};
    var names = [k, c.label].concat(Array.isArray(c.aliases) ? c.aliases : []);
    if (names.some(function (n) { return n && norm(n, true) === want; })) return { key: k, entry: c };
  }
  return null;
}

// Resolve (category, gender) to a concrete lookup: { key, label, folderId, fileId?, file }.
// An unknown category still resolves by convention (file named after the category), because
// "drop Hiking.mp4 into the folder" should work without a config change.
function resolveRule(rules, category, gender) {
  var conv = rules.convention || {};
  var src = rules.source || {};
  var hit = findCategory(rules, category);
  var entry = hit ? hit.entry : {};
  var g = gender && entry.genders ? (entry.genders[norm(gender)] || null) : null;
  var label = entry.label || String(category || '').trim();
  return {
    key: hit ? hit.key : norm(category, true),
    configured: !!hit,
    label: label,
    gender: g ? norm(gender) : null,
    disabled: !!entry.disabled,
    folderId: (g && g.folderId) || entry.folderId || src.folderId || null,
    fileId: (g && g.fileId) || entry.fileId || null,
    file: (g && g.file) || entry.file || label,
    prefer: Array.isArray(conv.prefer) && conv.prefer.length ? conv.prefer : ['video/mp4', 'image/gif', 'video/quicktime', 'video/webm'],
    ignorePunctuation: conv.ignorePunctuation !== false
  };
}

function pickByName(files, rule) {
  var wantFull = norm(rule.file, rule.ignorePunctuation);
  var wantBase = norm(stripExt(rule.file), rule.ignorePunctuation);
  var hasExt = stripExt(rule.file) !== String(rule.file);
  var hits = files.filter(function (f) {
    var n = norm(f.name, rule.ignorePunctuation);
    var b = norm(stripExt(f.name), rule.ignorePunctuation);
    return hasExt ? n === wantFull : b === wantBase;
  });
  hits.sort(function (a, b) {
    var ia = rule.prefer.indexOf(a.mimeType), ib = rule.prefer.indexOf(b.mimeType);
    if (ia < 0) ia = 99; if (ib < 0) ib = 99;
    if (ia !== ib) return ia - ib;
    return String(b.modifiedTime || '').localeCompare(String(a.modifiedTime || ''));   // newest first
  });
  return hits;
}

function fileOut(f) {
  return {
    id: f.id, name: f.name, mimeType: f.mimeType,
    size: f.size != null ? Number(f.size) : null,
    width: f.width || null, height: f.height || null,
    durationMillis: f.durationMillis != null ? f.durationMillis : null,
    modifiedTime: f.modifiedTime || null
  };
}

// google = the backend's google.js module (listFolder / fileMeta). Metadata only.
async function match(google, session, category, gender) {
  var rules = load();
  if (!String(category || '').trim()) {
    var e = new Error('Missing "category".'); e.statusCode = 400; throw e;
  }
  var rule = resolveRule(rules, category, gender);
  var ruleOut = { key: rule.key, label: rule.label, configured: rule.configured, gender: rule.gender,
    folderId: rule.folderId, file: rule.fileId ? null : rule.file, fileId: rule.fileId };
  if (rule.disabled) return { found: false, category: rule.key, rule: ruleOut, reason: 'No animation is configured for "' + rule.label + '" (disabled in gif-rules.json).' };

  if (rule.fileId) {
    var meta = await google.fileMeta(session, rule.fileId);   // throws coded errors (404, scope)
    return { found: true, category: rule.key, rule: ruleOut, file: fileOut(meta), matchedBy: 'fileId' };
  }
  if (!rule.folderId) return { found: false, category: rule.key, rule: ruleOut, reason: 'gif-rules.json has no source folder.' };

  var listing = await google.listFolder(rule.folderId, { session: session, mimeTypes: rule.prefer });
  var hits = pickByName(listing.files || [], rule);
  if (!hits.length) {
    return {
      found: false, category: rule.key, rule: ruleOut,
      reason: 'No animation named "' + rule.file + '" in ' + (listing.folderName ? '"' + listing.folderName + '"' : 'the source folder') + '.',
      candidates: (listing.files || []).slice(0, 25).map(function (f) { return f.name; })
    };
  }
  return {
    found: true, category: rule.key, rule: ruleOut, file: fileOut(hits[0]),
    matchedBy: rule.configured ? 'rule' : 'convention',
    alternatives: hits.slice(1, 5).map(fileOut),
    folder: { id: listing.folderId, name: listing.folderName }
  };
}

module.exports = { load: load, resolveRule: resolveRule, match: match, pickByName: pickByName, RULES_PATH: RULES_PATH };
