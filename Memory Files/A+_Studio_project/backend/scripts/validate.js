#!/usr/bin/env node
// ===== A+ Studio · manifest validator =====
//
//   npm run validate            check everything, exit 1 on any ERROR
//   npm run validate -- --warn  also exit 1 on warnings (use this in CI)
//   npm run validate -- --json  machine-readable output
//
// WHAT IT CHECKS, AND WHY EACH CHECK EXISTS
// Every rule here corresponds to a way a manifest can be wrong while still being valid JSON —
// which is exactly the failure mode docs/add-to-template-plan.md §2 documents four times over:
// "it looks almost right" and nobody notices for weeks.
//
//   registry   index.json's shape; every templates[].file exists; every manifest file on disk is
//              reachable from the registry (an orphan is a template nobody can select)
//   loading    every manifest resolves through its "extends" chain without cycles or depth blowups
//   renderer   the resolved manifest carries what plugin-src/renderer.js dereferences without a
//              guard — meta/fonts/palette/frame/hero/fabric/callouts/content and their required
//              children. A missing one is a TypeError inside Figma, not a 500 here.
//   references every `colorRole` / `fillRole` names a real palette entry, every `font` names a
//              real fonts entry, every gradient `transform` is one the renderer knows
//   content    the sheet column mapping is present, integral and non-negative
//   captured   anything written by POST /api/templates is checked the same way as a built-in
//
// It loads manifests through backend/manifests.js, so the traversal and cycle guards under test
// are the real ones.

var fs = require('fs');
var path = require('path');

var BACKEND = path.join(__dirname, '..');
var manifests = require(path.join(BACKEND, 'manifests'));
var TEMPLATES = manifests.TEMPLATES;

var argv = process.argv.slice(2);
var STRICT = argv.indexOf('--warn') >= 0 || argv.indexOf('--strict') >= 0;
var AS_JSON = argv.indexOf('--json') >= 0;

var errors = [];
var warnings = [];
var checked = 0;

function fail(where, msg) { errors.push({ where: where, message: msg }); }
function warn(where, msg) { warnings.push({ where: where, message: msg }); }

function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function isNum(v) { return typeof v === 'number' && isFinite(v); }
function isInt(v) { return isNum(v) && Math.floor(v) === v; }

// What the renderer reads without a defensive guard. Path -> expected kind.
var RENDERER_REQUIRED = [
  ['meta', 'object'],
  ['meta.width', 'number'],
  ['fonts', 'object'],
  ['palette', 'object'],
  ['frame', 'object'],
  ['hero', 'object'],
  ['hero.w', 'number'], ['hero.h', 'number'], ['hero.layers', 'array'],
  ['hero.word', 'object'], ['hero.italic', 'object'], ['hero.model', 'object'], ['hero.tagline', 'object'],
  ['fabric', 'object'], ['fabric.box', 'object'], ['fabric.textStack', 'object'],
  ['callouts', 'object'], ['callouts.frame', 'object'], ['callouts.title', 'object'], ['callouts.copy', 'object'], ['callouts.cards', 'object'],
  ['content', 'object']
];

var CONTENT_INT_FIELDS = [
  'styleIdColumn', 'categoryColumn', 'genderColumn', 'headlineColumn', 'taglineColumn',
  'fabricCopyColumn', 'compositionColumn', 'iconsColumn', 'statusColumn'
];

var KNOWN_GRADIENT_TRANSFORMS = ['TB', 'LR', 'RL']; // GRADIENT_TRANSFORMS in plugin-src/renderer.js
var RENDERER_ID = 'aplus-standard-v1';

function at(obj, dotted) {
  var parts = dotted.split('.'), cur = obj;
  for (var i = 0; i < parts.length; i++) {
    if (!isObj(cur) && !Array.isArray(cur)) return undefined;
    cur = cur[parts[i]];
  }
  return cur;
}
function kindOf(v) { return Array.isArray(v) ? 'array' : (v === null ? 'null' : typeof v); }

// ---------------------------------------------------------------------------------------------
// walk a resolved manifest for role / font / gradient references
// ---------------------------------------------------------------------------------------------

function checkReferences(where, M) {
  var palette = isObj(M.palette) ? M.palette : {};
  var fonts = isObj(M.fonts) ? M.fonts : {};
  var seenRoles = Object.create(null);

  function walk(node, trail) {
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) walk(node[i], trail + '[' + i + ']');
      return;
    }
    if (!isObj(node)) return;

    Object.keys(node).forEach(function (k) {
      var v = node[k];
      var p = trail ? trail + '.' + k : k;

      if ((k === 'colorRole' || k === 'fillRole') && typeof v === 'string') {
        if (!Object.prototype.hasOwnProperty.call(palette, v)) fail(where, p + ' = "' + v + '" is not a palette role. Known: ' + Object.keys(palette).join(', '));
        else seenRoles[v] = true;
      }
      if (k === 'font' && typeof v === 'string') {
        if (!Object.prototype.hasOwnProperty.call(fonts, v)) fail(where, p + ' = "' + v + '" is not a font role. Known: ' + Object.keys(fonts).join(', '));
      }
      if (k === 'transform' && typeof v === 'string') {
        if (KNOWN_GRADIENT_TRANSFORMS.indexOf(v) < 0) {
          fail(where, p + ' = "' + v + '" is not a gradient transform the renderer knows (' + KNOWN_GRADIENT_TRANSFORMS.join('/') + '). Emit the raw matrix as "gt" instead — never snap an angle to the nearest named direction.');
        }
      }
      if (k === 'stops' && Array.isArray(v)) {
        v.forEach(function (s, i) {
          if (!Array.isArray(s) || s.length < 2) { fail(where, p + '[' + i + '] must be [position, [r,g,b], alpha?]'); return; }
          if (!isNum(s[0]) || s[0] < 0 || s[0] > 1) fail(where, p + '[' + i + '][0] gradient stop position must be 0..1, got ' + JSON.stringify(s[0]));
          if (!Array.isArray(s[1]) || s[1].length !== 3 || !s[1].every(isNum)) fail(where, p + '[' + i + '][1] must be [r,g,b] 0-255');
          else s[1].forEach(function (c, ci) { if (c < 0 || c > 255) fail(where, p + '[' + i + '][1][' + ci + '] = ' + c + ' is outside 0-255'); });
          if (s.length > 2 && (!isNum(s[2]) || s[2] < 0 || s[2] > 1)) fail(where, p + '[' + i + '][2] alpha must be 0..1, got ' + JSON.stringify(s[2]));
        });
      }
      if (k === 'gt' && v != null) {
        if (!Array.isArray(v) || v.length !== 2 || !v.every(function (row) { return Array.isArray(row) && row.length === 3 && row.every(isNum); })) {
          fail(where, p + ' must be a 2x3 gradient matrix [[a,b,c],[d,e,f]]');
        }
      }
      if (k === 'rt' && v != null) {
        if (!Array.isArray(v) || v.length !== 2 || !v.every(function (row) { return Array.isArray(row) && row.length === 3 && row.every(isNum); })) {
          fail(where, p + ' must be a 2x3 relativeTransform matrix — this is the field that carries a flip, so a wrong shape mirrors the layer into the wrong corner.');
        }
      }
      if (k === 'opacity' && isNum(v) && (v < 0 || v > 1)) fail(where, p + ' = ' + v + ' must be 0..1');

      walk(v, p);
    });
  }

  walk(M, '');

  Object.keys(palette).forEach(function (role) {
    var c = palette[role];
    if (!Array.isArray(c) || c.length !== 3 || !c.every(isNum)) fail(where, 'palette.' + role + ' must be [r,g,b] 0-255');
    else c.forEach(function (n, i) { if (n < 0 || n > 255) fail(where, 'palette.' + role + '[' + i + '] = ' + n + ' is outside 0-255'); });
    if (!seenRoles[role] && role !== 'white' && role !== 'ink') warn(where, 'palette.' + role + ' is defined but never referenced.');
  });

  Object.keys(fonts).forEach(function (role) {
    var f = fonts[role];
    if (!isObj(f) || typeof f.family !== 'string' || typeof f.style !== 'string') {
      fail(where, 'fonts.' + role + ' must be { family, style, fallback? }');
    }
  });
}

function checkContent(where, M) {
  var c = M.content;
  if (!isObj(c)) return; // already reported by the required-shape pass
  CONTENT_INT_FIELDS.forEach(function (k) {
    if (c[k] === undefined) { warn(where, 'content.' + k + ' is not set — that column will not be read from the sheet.'); return; }
    if (!isInt(c[k]) || c[k] < 0) fail(where, 'content.' + k + ' must be a non-negative integer column index, got ' + JSON.stringify(c[k]));
  });
  if (!Array.isArray(c.cardColumns) || !c.cardColumns.length) fail(where, 'content.cardColumns must be a non-empty array of column indexes.');
  else c.cardColumns.forEach(function (n, i) { if (!isInt(n) || n < 0) fail(where, 'content.cardColumns[' + i + '] must be a non-negative integer, got ' + JSON.stringify(n)); });

  if (isObj(c.callouts)) {
    if (c.callouts.min != null && !isInt(c.callouts.min)) fail(where, 'content.callouts.min must be an integer.');
    if (c.callouts.max != null && !isInt(c.callouts.max)) fail(where, 'content.callouts.max must be an integer.');
    if (isInt(c.callouts.min) && isInt(c.callouts.max) && c.callouts.min > c.callouts.max) fail(where, 'content.callouts.min (' + c.callouts.min + ') is greater than max (' + c.callouts.max + ').');
    if (Array.isArray(c.cardColumns) && isInt(c.callouts.max) && c.cardColumns.length < c.callouts.max) {
      warn(where, 'content.callouts.max is ' + c.callouts.max + ' but only ' + c.cardColumns.length + ' cardColumns are mapped.');
    }
  }
}

function checkSlices(where, M) {
  if (M.slices === undefined) return;
  if (!Array.isArray(M.slices)) { fail(where, 'slices must be an array.'); return; }
  M.slices.forEach(function (s, i) {
    if (!isObj(s)) { fail(where, 'slices[' + i + '] must be an object.'); return; }
    if (!isNum(s.y)) fail(where, 'slices[' + i + '].y must be a number.');
    if (!isNum(s.h) && s.hToEnd !== true) fail(where, 'slices[' + i + '] needs either a numeric h or hToEnd:true.');
  });
}

function checkResolved(where, M, opts) {
  checked++;
  opts = opts || {};

  if (M.schema && !/^aplus\.template\//.test(String(M.schema))) warn(where, 'schema is "' + M.schema + '"; expected aplus.template/<n>.');
  if (M.renderer !== RENDERER_ID) fail(where, 'renderer must be "' + RENDERER_ID + '", got ' + JSON.stringify(M.renderer));

  RENDERER_REQUIRED.forEach(function (row) {
    var v = at(M, row[0]);
    if (v === undefined || v === null) { fail(where, 'missing ' + row[0] + ' (' + row[1] + ') — plugin-src/renderer.js dereferences it with no guard.'); return; }
    if (kindOf(v) !== row[1]) fail(where, row[0] + ' must be a ' + row[1] + ', got ' + kindOf(v));
  });

  if (opts.expectCategory && isObj(M.meta) && M.meta.category !== opts.expectCategory) {
    warn(where, 'meta.category is "' + M.meta.category + '" but the manifest lives under "' + opts.expectCategory + '/".');
  }
  if (opts.expectGender && isObj(M.meta) && M.meta.gender && M.meta.gender !== opts.expectGender) {
    warn(where, 'meta.gender is "' + M.meta.gender + '" but the manifest lives under "' + opts.expectGender + '/".');
  }
  if (isObj(M.meta) && M.meta.status && ['active', 'draft', 'coming-soon', 'retired'].indexOf(M.meta.status) < 0) {
    warn(where, 'meta.status "' + M.meta.status + '" is not one of active/draft/coming-soon/retired.');
  }

  checkReferences(where, M);
  checkContent(where, M);
  checkSlices(where, M);
}

// ---------------------------------------------------------------------------------------------
// registry
// ---------------------------------------------------------------------------------------------

function listManifestFiles() {
  var out = [];
  (function walk(dir, rel) {
    var items;
    try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    items.forEach(function (d) {
      if (d.isDirectory()) return walk(path.join(dir, d.name), rel ? rel + '/' + d.name : d.name);
      if (!/\.json$/.test(d.name)) return;
      var r = (rel ? rel + '/' : '') + d.name;
      if (r === 'index.json') return;
      out.push(r);
    });
  })(TEMPLATES, '');
  return out;
}

function validateRegistry() {
  var where = 'templates/index.json';
  var reg;
  try { reg = manifests.registry(); }
  catch (e) { fail(where, 'cannot be read: ' + ((e && e.message) || e)); return { reg: null, referenced: {} }; }

  if (!Array.isArray(reg.categories)) { fail(where, 'categories must be an array.'); return { reg: reg, referenced: {} }; }
  if (!isObj(reg.sheet)) warn(where, 'no "sheet" block — the plugin falls back to per-manifest content mapping only.');

  var referenced = Object.create(null);
  var seenCat = Object.create(null);

  reg.categories.forEach(function (cat, ci) {
    var cw = where + ' categories[' + ci + ']';
    if (!cat || typeof cat.id !== 'string') { fail(cw, 'needs a string id.'); return; }
    if (seenCat[cat.id]) fail(cw, 'duplicate category id "' + cat.id + '".');
    seenCat[cat.id] = true;
    if (typeof cat.label !== 'string') warn(cw, 'category "' + cat.id + '" has no label.');
    if (!Array.isArray(cat.genders)) { fail(cw, 'category "' + cat.id + '" needs a genders array.'); return; }

    var genderIds = cat.genders.map(function (g) { return g && g.id; });
    if (cat.defaultGender && genderIds.indexOf(cat.defaultGender) < 0) {
      fail(cw, 'defaultGender "' + cat.defaultGender + '" is not one of ' + JSON.stringify(genderIds) + '.');
    }

    var seenGen = Object.create(null);
    cat.genders.forEach(function (gen, gi) {
      var gw = cw + '.genders[' + gi + ']';
      if (!gen || typeof gen.id !== 'string') { fail(gw, 'needs a string id.'); return; }
      if (seenGen[gen.id]) fail(gw, 'duplicate gender id "' + gen.id + '" in "' + cat.id + '".');
      seenGen[gen.id] = true;
      if (!Array.isArray(gen.templates)) { fail(gw, 'needs a templates array (use [] for coming-soon).'); return; }
      if (gen.status === 'active' && !gen.templates.length) warn(gw, '"' + cat.id + '/' + gen.id + '" is active but has no templates.');

      var seenTpl = Object.create(null);
      gen.templates.forEach(function (t, ti) {
        var tw = cat.id + '/' + gen.id + '/' + (t && t.id ? t.id : '[' + ti + ']');
        if (!t || typeof t.id !== 'string') { fail(gw + '.templates[' + ti + ']', 'needs a string id.'); return; }
        if (seenTpl[t.id]) fail(tw, 'duplicate template id.');
        seenTpl[t.id] = true;
        if (typeof t.label !== 'string') warn(tw, 'has no label — the plugin shows the id instead.');

        var expected = cat.id + '/' + gen.id + '/' + t.id + '.json';
        if (typeof t.file !== 'string') { fail(tw, 'needs a "file" path (expected "' + expected + '").'); return; }
        if (t.file !== expected) warn(tw, 'file is "' + t.file + '"; the loader derives "' + expected + '" from the ids, so the file field is cosmetic and now disagrees with it.');
        referenced[expected] = true;

        if (!fs.existsSync(path.join(TEMPLATES, expected))) { fail(tw, 'manifest file is missing: templates/' + expected); return; }

        var M;
        try { M = manifests.resolve(cat.id, gen.id, t.id); }
        catch (e) { fail(tw, 'does not resolve: ' + ((e && e.message) || e)); return; }
        checkResolved(tw, M, { expectCategory: cat.id, expectGender: gen.id });
      });
    });
  });

  return { reg: reg, referenced: referenced };
}

// A partial (`_base`, `_women`) is only ever reached through an "extends", so it is not expected
// to be renderer-complete on its own — but it must still parse and its own references must hold.
function validatePartials(referenced) {
  listManifestFiles().forEach(function (rel) {
    if (referenced[rel]) return;
    var base = rel.replace(/\.json$/, '');
    var leaf = base.split('/').pop();
    var isPartial = leaf[0] === '_';
    var where = 'templates/' + rel;

    var raw;
    try { raw = JSON.parse(fs.readFileSync(path.join(TEMPLATES, rel), 'utf8')); }
    catch (e) { fail(where, 'is not valid JSON: ' + ((e && e.message) || e)); return; }

    if (!isPartial) {
      fail(where, 'is a manifest on disk that no registry entry points at — nobody can select it. Add it to index.json or delete it.');
    }

    try { manifests.load(base); }
    catch (e) { fail(where, 'does not load: ' + ((e && e.message) || e)); return; }

    if (isPartial && raw.renderer && raw.renderer !== RENDERER_ID) fail(where, 'renderer must be "' + RENDERER_ID + '", got ' + JSON.stringify(raw.renderer));
    checked++;
  });
}

// Captured templates (POST /api/templates) are held outside templates/ and get the same treatment.
function validateCaptured() {
  var store;
  try { store = require(path.join(BACKEND, 'store')); } catch (e) { return; }
  var list;
  try { list = store.list(); } catch (e) { return; }
  if (!list.length) return;
  list.forEach(function (t) {
    var where = 'captured ' + t.category + '/' + t.gender + '/' + t.id;
    var M;
    try { M = store.resolve(t.category, t.gender, t.id); }
    catch (e) { fail(where, 'does not resolve: ' + ((e && e.message) || e)); return; }
    if (!M) { fail(where, 'is in the captured index but its manifest file is gone (an ephemeral store lost it on restart).'); return; }
    checkResolved(where, M, { expectCategory: t.category, expectGender: t.gender });
  });
}

// ---------------------------------------------------------------------------------------------

var r = validateRegistry();
validatePartials(r.referenced);
validateCaptured();

if (AS_JSON) {
  console.log(JSON.stringify({ ok: !errors.length, checked: checked, errors: errors, warnings: warnings }, null, 2));
} else {
  errors.forEach(function (e) { console.error('ERROR  ' + e.where + ': ' + e.message); });
  warnings.forEach(function (w) { console.warn('warn   ' + w.where + ': ' + w.message); });
  console.log('');
  console.log(errors.length ? '✗ ' + errors.length + ' error(s), ' + warnings.length + ' warning(s) across ' + checked + ' manifest(s).'
    : '✓ ' + checked + ' manifest(s) valid' + (warnings.length ? ', ' + warnings.length + ' warning(s).' : '.'));
}

process.exit(errors.length || (STRICT && warnings.length) ? 1 : 0);
