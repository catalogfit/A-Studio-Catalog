// Builds plugin/code.js from the four source files (and refreshes the bundled manifest first).
//   node build.js
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

cp.execFileSync(process.execPath, [path.join(__dirname, 'build-fallback.js')], { stdio: 'inherit' });

// capture.js sits after manifest-fallback.js because it folds captured templates into
// FALLBACK_REGISTRY / FALLBACK_MANIFESTS, and after renderer.js because it reuses
// loadFontsFromManifest() and rowFromManifest().
var parts = ['renderer.js', 'manifest-fallback.js', 'capture.js', 'main.js'];
var out = parts.map(function (f) { return fs.readFileSync(path.join(__dirname, f), 'utf8'); }).join('\n');
var dest = path.join(__dirname, '..', 'plugin', 'code.js');
fs.writeFileSync(dest, out);
console.log('built plugin/code.js (' + out.length + ' bytes from ' + parts.join(' + ') + ')');
