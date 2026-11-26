// ===== A+ Studio · tiny .env loader (no dependency) =====
// Required at the top of every module that reads process.env, so load order never matters.
// Real environment variables always win over the file (Render injects them directly).

var fs = require('fs');
var path = require('path');

if (!global.__aplusEnvLoaded) {
  global.__aplusEnvLoaded = true;
  try {
    var txt = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    txt.split(/\r?\n/).forEach(function (line) {
      if (/^\s*#/.test(line)) return;
      var m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  } catch (e) { /* no .env file — fine, env vars may come from the platform */ }
}

module.exports = {};
