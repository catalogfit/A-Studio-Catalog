// Builds plugin/code.js from the three source files (and refreshes the bundled manifest first).
//   node build.js
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

cp.execFileSync(process.execPath, [path.join(__dirname, 'build-fallback.js')], { stdio: 'inherit' });

var parts = ['renderer.js', 'manifest-fallback.js', 'main.js'];
var out = parts.map(function (f) { return fs.readFileSync(path.join(__dirname, f), 'utf8'); }).join('\n');
var dest = path.join(__dirname, '..', 'plugin', 'code.js');
fs.writeFileSync(dest, out);
console.log('built plugin/code.js (' + out.length + ' bytes from ' + parts.join(' + ') + ')');
