// Builds the Figma plugin from plugin-src/:
//   plugin/code.js  — the sandbox side: renderer + bundled manifests + capture + core + panel handlers
//   plugin/ui.html  — the iframe UI: ui/shell.html with the three panels and every script inlined
//
//   node plugin-src/build.js
//
// Both outputs are generated: never edit plugin/code.js or plugin/ui.html by hand. Ownership of the
// sources (platform vs. the automate / design / export panels) is in plugin-src/BUILD.md.
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var cp = require('child_process');

var SRC = __dirname;
var OUT = path.join(SRC, '..', 'plugin');
function read(rel) { return fs.readFileSync(path.join(SRC, rel), 'utf8'); }
function fail(msg) { console.error('BUILD FAILED: ' + msg); process.exit(1); }
function parses(code, name) {
  try { new vm.Script(code, { filename: name }); }
  catch (e) { fail(name + ' does not parse: ' + e.message + (e.stack ? '\n' + String(e.stack).split('\n').slice(0, 3).join('\n') : '')); }
}

// ---------------------------------------------------------------------------------------------
// 1. bundled manifests (regenerated from backend/templates so the offline copy never drifts)
// ---------------------------------------------------------------------------------------------
cp.execFileSync(process.execPath, [path.join(SRC, 'build-fallback.js')], { stdio: 'inherit' });

// ---------------------------------------------------------------------------------------------
// 2. plugin/code.js (Figma sandbox)
// ---------------------------------------------------------------------------------------------
// Order matters:
//   renderer.js          manifest-driven renderer (aplus-standard-v1) — automate panel
//   manifest-fallback.js generated FALLBACK_REGISTRY / FALLBACK_MANIFESTS
//   capture.js           frame capture (aplus-capture-v1); folds captured templates into the
//                        FALLBACK_* maps and reuses loadFontsFromManifest()/rowFromManifest()
//   main.js              CORE: showUI, page/selection sync, clientStorage, message router
//                        (onUiMessage / onInit / replyTo). Boots on a microtask, so every
//                        handler registered by the files below is in place first.
//   main-automate.js     'run', 'add-comparison', 'save-link'
//   main-design.js       'capture-template' + captured-template init contribution
//   main-export.js       'export-style', 'save-export-config' + exportConfig init contribution
var SANDBOX = ['renderer.js', 'manifest-fallback.js', 'capture.js', 'main.js', 'main-automate.js', 'main-design.js', 'main-export.js'];
var code = SANDBOX.map(function (f) {
  var body = read(f);
  parses(body, 'plugin-src/' + f);
  return '// ===== ' + f + ' =====\n' + body;
}).join('\n');
parses(code, 'plugin/code.js');
fs.writeFileSync(path.join(OUT, 'code.js'), code);
console.log('built plugin/code.js (' + code.length + ' bytes from ' + SANDBOX.join(' + ') + ')');

// ---------------------------------------------------------------------------------------------
// 3. plugin/ui.html (iframe)
// ---------------------------------------------------------------------------------------------
var PANELS = ['automate', 'design', 'export'];
// Each its own <script> tag, in this order: a syntax error in one panel cannot take the others
// (or the sign-in gate) down with it, and every panel sees the platform's globals.
var SCRIPTS = [
  'vendor/gifenc.js',     // window.gifenc   (GIF encoding)
  'vendor/fflate.js',     // window.fflate   (ZIP)
  'vendor/mp4-muxer.js',  // Mp4Muxer        (MP4 container for WebCodecs)
  'ui/platform.js',       // shared state, bridge, backend, auth, drive, sheets, templateStore, ui
  'ui/automate.js',
  'ui/design.js',
  'ui/export.js'
];

var html = read('ui/shell.html');
PANELS.forEach(function (p) {
  var marker = '<!-- @panel ' + p + ' -->';
  if (html.indexOf(marker) < 0) fail('ui/shell.html has no "' + marker + '" marker');
  html = html.replace(marker, function () { return read('ui/' + p + '.html').replace(/\s+$/, ''); });
});

var scriptTags = SCRIPTS.map(function (f) {
  var js = read(f);
  parses(js, 'plugin-src/' + f);
  // A literal "</script" inside inlined code would end the tag early; "<!--" would switch the HTML
  // parser into script-data-escaped state. Neither may reach the page unescaped.
  js = js.replace(/<\/script/gi, '<\\/script');
  if (/<!--/.test(js)) fail(f + ' contains "<!--", which is unsafe inside an inline <script>. Rewrite it (e.g. "<" + "!--").');
  return '<script data-src="' + f + '">\n' + js.replace(/\s+$/, '') + '\n</script>';
}).join('\n');
if (html.indexOf('<!-- @scripts -->') < 0) fail('ui/shell.html has no "<!-- @scripts -->" marker');
html = html.replace('<!-- @scripts -->', function () { return scriptTags; });

var left = html.match(/<!-- @(panel|scripts)[^>]*-->/);
if (left) fail('unreplaced marker in ui.html: ' + left[0]);
// The plugin must never ship secrets. Cheap guard against the obvious shapes.
var secret = html.match(/sk-or-v1-[A-Za-z0-9]{10,}|sk-ant-[A-Za-z0-9-]{10,}|GOCSPX-[A-Za-z0-9_-]{10,}|ya29\.[A-Za-z0-9_-]{20,}|1\/\/0[A-Za-z0-9_-]{20,}/);
if (secret) fail('ui.html contains something that looks like a secret/token (' + secret[0].slice(0, 8) + '…). Remove it.');

// after the doctype: a comment BEFORE it would put the page in quirks mode
if (!/^<!DOCTYPE html>/i.test(html)) fail('ui/shell.html must start with <!DOCTYPE html>');
html = html.replace(/^<!DOCTYPE html>\r?\n?/i, '<!DOCTYPE html>\n<!-- GENERATED by plugin-src/build.js from plugin-src/ui/ — do not edit; edit the sources and rebuild. -->\n');
fs.writeFileSync(path.join(OUT, 'ui.html'), html);
console.log('built plugin/ui.html (' + html.length + ' bytes: shell + ' + PANELS.join('/') + ' panels + ' + SCRIPTS.length + ' scripts)');
