// Regenerates plugin-src/manifest-fallback.js from the backend template files,
// so the plugin's offline copy never drifts from the backend.
//   node plugin-src/build-fallback.js
//
// Manifests are written with "extends" (a thin gender template on top of a shared base).
// They are resolved to flat manifests here, because the plugin has no file system and the
// renderer expects one complete object.
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var backend = require(path.join(ROOT, 'backend', 'manifests.js'));
var reg = backend.registry();

var manifests = {}, skipped = [];
reg.categories.forEach(function (cat) {
  (cat.genders || []).forEach(function (gen) {
    (gen.templates || []).forEach(function (t) {
      var key = cat.id + '/' + gen.id + '/' + t.id;
      try { manifests[key] = backend.load(key); }
      catch (e) { skipped.push(key + ' (' + e.message + ')'); }
    });
  });
});

var out = '// ===== A+ Studio · bundled fallback (auto-generated from backend/templates) =====\n' +
  '// Used when the backend is unreachable, so the plugin always works offline.\n' +
  '// Manifest keys are "<category>/<gender>/<template>" and every "extends" is already resolved.\n' +
  '// Regenerate: node plugin-src/build-fallback.js\n' +
  'var FALLBACK_REGISTRY = ' + JSON.stringify(reg, null, 2) + ';\n\n' +
  'var FALLBACK_MANIFESTS = ' + JSON.stringify(manifests, null, 2) + ';\n';

fs.writeFileSync(path.join(__dirname, 'manifest-fallback.js'), out);
console.log('wrote plugin-src/manifest-fallback.js (' + out.length + ' bytes, ' + Object.keys(manifests).length + ' manifest(s))');
if (skipped.length) console.log('  skipped: ' + skipped.join(', '));
