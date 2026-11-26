// ===== A+ Studio · manifest loading =====
// A template manifest may "extend" another one. Shared geometry lives in a base file
// (e.g. running/_base.json) and each gender template overrides only what differs —
// meta, slot labels, which optional blocks are on. Everything is resolved here, so the
// plugin and the renderer only ever see one flat, complete manifest.

var fs = require('fs');
var path = require('path');

var TEMPLATES = path.join(__dirname, 'templates');
var SEGMENT = /^[a-z0-9_][a-z0-9_-]*$/i;   // guards every path segment (no traversal)
var MAX_DEPTH = 8;

function isPlain(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

// Deep merge: objects merge key by key, everything else (arrays, scalars) is replaced.
// Arrays are replaced rather than concatenated so a template can redefine callouts.cards
// wholesale without inheriting leftovers from the base.
function merge(base, over) {
  if (!isPlain(base) || !isPlain(over)) return over;
  var out = {};
  Object.keys(base).forEach(function (k) { out[k] = base[k]; });
  Object.keys(over).forEach(function (k) {
    out[k] = (isPlain(base[k]) && isPlain(over[k])) ? merge(base[k], over[k]) : over[k];
  });
  return out;
}

function safeRel(rel) {
  var parts = String(rel || '').split('/').filter(Boolean);
  if (!parts.length || parts.length > 4) return null;
  for (var i = 0; i < parts.length; i++) if (!SEGMENT.test(parts[i])) return null;
  return parts.join('/');
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

// rel is a template path without the .json, e.g. "running/women/template-1"
function load(rel, seen) {
  seen = seen || [];
  var safe = safeRel(rel);
  if (!safe) throw new Error('Bad manifest path "' + rel + '"');
  if (seen.indexOf(safe) >= 0) throw new Error('Circular "extends" chain at ' + safe);
  if (seen.length >= MAX_DEPTH) throw new Error('"extends" chain too deep at ' + safe);
  seen.push(safe);

  var file = path.join(TEMPLATES, safe + '.json');
  if (!fs.existsSync(file)) throw new Error('Manifest file missing: ' + safe + '.json');
  var m = readJson(file);

  if (m.extends) {
    var parent = load(m.extends, seen);
    delete m.extends;
    m = merge(parent, m);
  }
  return m;
}

function registry() { return readJson(path.join(TEMPLATES, 'index.json')); }

// ---- registry lookups (category -> gender -> template) ----
function findCategory(reg, categoryId) {
  return (reg.categories || []).find(function (c) { return c.id === categoryId; }) || null;
}
function findGender(cat, genderId) {
  return ((cat && cat.genders) || []).find(function (g) { return g.id === genderId; }) || null;
}
function findTemplate(gender, templateId) {
  return ((gender && gender.templates) || []).find(function (t) { return t.id === templateId; }) || null;
}

// Resolves "running/women/template-1" against the registry, then loads the manifest.
// Throws with a message that names exactly what was not found.
function resolve(categoryId, genderId, templateId) {
  var reg = registry();
  var cat = findCategory(reg, categoryId);
  if (!cat) throw new Error('Unknown category "' + categoryId + '"');
  var gen = findGender(cat, genderId);
  if (!gen) throw new Error('Unknown gender "' + genderId + '" in "' + categoryId + '"');
  var tpl = findTemplate(gen, templateId);
  if (!tpl) throw new Error('Unknown template "' + templateId + '" in "' + categoryId + '/' + genderId + '"');
  return load(categoryId + '/' + genderId + '/' + templateId);
}

module.exports = {
  merge: merge, load: load, resolve: resolve, registry: registry,
  findCategory: findCategory, findGender: findGender, findTemplate: findTemplate,
  safeRel: safeRel,
  SEGMENT: SEGMENT,   // reused by store.js so captured ids get the same no-traversal guard
  TEMPLATES: TEMPLATES
};
