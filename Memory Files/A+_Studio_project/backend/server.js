// ===== A+ Studio · template backend =====
// Serves the per-category A+ template manifests the Figma plugin fills.
// Zero dependencies (pure Node http), zero cost, Render-ready.
//
//   node server.js            -> http://localhost:8787
//   PORT=3000 node server.js  -> http://localhost:3000
//
// Endpoints:
//   GET /health                               -> { ok: true }
//   GET /api/templates                                 -> the registry (categories -> genders -> templates)
//   GET /api/templates/:category                       -> one category's registry entry
//   GET /api/templates/:category/:gender               -> one gender's entry (its template list)
//   GET /api/templates/:category/:gender/:template     -> one resolved manifest (the design file)
//   GET /api/templates/:category/:gender/:template/preview.svg -> reference SVG preview (if present)
//   Google (sign in to read Sheets without "Publish to web"):
//   POST /auth/new        -> { sessionId, authUrl } to open in the browser
//   GET  /auth/callback   -> Google redirect target; exchanges the code, shows a done page
//   GET  /auth/status     -> { configured, connected, email }
//   POST /auth/logout     -> disconnect
//   POST /api/sheet       -> { session, url } -> reads that sheet with the user's account -> { rows }
//   Drive (needs the drive.readonly scope — existing users must re-consent once):
//   POST /api/drive/list      -> { session, folder } -> { files: [{id,name,mimeType,size,...}] }
//   POST /api/drive/file      -> { session, fileId } -> that file's metadata
//   POST /api/drive/download  -> { session, fileId } -> the file's bytes (binary, or base64 JSON)
//   Export:
//   POST /api/compose     -> { session?, aplusPng, gif|driveFileId, format } -> animated GIF / MP4
//                            !! an animated GIF is NOT accepted by Amazon A+ — see compose.js

require('./env');

var http = require('http');
var fs = require('fs');
var path = require('path');
var google = require('./google');
var manifests = require('./manifests');
var compose = require('./compose');
var sessionStore = require('./session');

var PORT = process.env.PORT || 8787;
// Optional, for the AI-assisted template labelling described in docs/add-to-template-plan.md.
// NOT implemented yet — this is env plumbing only. The key must never reach the plugin: plugin
// code ships as a readable file, so anything in it is public. /health reports presence, never value.
var ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
var ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
var MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 96 * 1024 * 1024);
var ROOT = __dirname;
var TEMPLATES = path.join(ROOT, 'templates');
var SAFE = /^[a-z0-9][a-z0-9-]*$/i; // category / template id guard (no path traversal)

function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-cache'
  });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body, null, 2));
}
function err(res, code, message) { send(res, code, { error: message }); }
function query(u) { var q = {}, i = u.indexOf('?'); if (i >= 0) u.slice(i + 1).split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) q[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' ')); }); return q; }

// A+ PNGs arrive base64-encoded inside the JSON body, so this buffers up to ~96 MB by default.
// It is capped so a malformed or hostile request cannot grow the heap without bound.
function readBody(req) {
  return new Promise(function (resolve, reject) {
    var c = [], n = 0, done = false;
    req.on('data', function (d) {
      if (done) return;
      n += d.length;
      if (n > MAX_BODY_BYTES) {
        done = true;
        req.destroy();
        var e = new Error('Request body is larger than the ' + Math.round(MAX_BODY_BYTES / 1048576) + ' MB limit.');
        e.statusCode = 413;
        return reject(e);
      }
      c.push(d);
    });
    req.on('end', function () { if (done) return; done = true; var t = Buffer.concat(c).toString('utf8'); try { resolve(JSON.parse(t || '{}')); } catch (e) { resolve({}); } });
    req.on('error', function () { if (done) return; done = true; resolve({}); });
  });
}
// Accept the session from the body or the query string, under either name.
function sessionOf(b, q) { return String((b && (b.session || b.sessionId)) || (q && (q.session || q.sessionId)) || ''); }
function statusOf(e, fallback) { return (e && e.statusCode) || fallback; }
function page(res, title, msg) { send(res, 200, '<!doctype html><meta charset="utf-8"><title>' + title + '</title><div style="font:16px system-ui;max-width:460px;margin:16vh auto;text-align:center;color:#1e1e1e"><div style="font-size:40px">' + (title.indexOf('Connected') === 0 ? '✅' : '⚠️') + '</div><h2>' + title + '</h2><p style="color:#666">' + msg + '</p><p style="color:#999;font-size:13px">You can close this tab and return to Figma.</p></div>', 'text/html; charset=utf-8'); }

var registry = manifests.registry;

var server = http.createServer(async function (req, res) {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  var q = query(req.url);
  var url = req.url.split('?')[0].replace(/\/+$/, '') || '/';
  var parts = url.split('/').filter(Boolean); // e.g. ['api','templates','running','template-1']

  try {
    if (url === '/health') {
      var tool = compose.toolCheck();
      return send(res, 200, {
        ok: true,
        service: 'aplus-template-backend',
        google: google.configured(),
        scopes: google.SCOPE_LIST,
        sessions: sessionStore.info(),
        ffmpeg: { available: tool.available, version: tool.version, libx264: !!tool.encoders.libx264, error: tool.error },
        anthropic: { configured: !!ANTHROPIC_API_KEY, model: ANTHROPIC_MODEL, implemented: false } // presence only — never the key
      });
    }
    if (url === '/' ) return send(res, 200, { service: 'aplus-template-backend', try: '/api/templates' });

    // ----- Google OAuth -----
    if (url === '/auth/new' && req.method === 'POST') {
      if (!google.configured()) return err(res, 503, 'Google sign-in is not configured on this backend yet (set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).');
      return send(res, 200, google.newSession());
    }
    if (url === '/auth/callback') {
      if (q.error) return page(res, 'Sign-in cancelled', 'Google returned: ' + q.error);
      if (!q.code || !q.state) return page(res, 'Sign-in failed', 'Missing code or state.');
      try { var s = await google.handleCallback(q.code, q.state); return page(res, 'Connected to Google', (s.email ? s.email + ' is now connected.' : 'Your account is connected.')); }
      catch (e) { return page(res, 'Sign-in failed', String((e && e.message) || e)); }
    }
    if (url === '/auth/status') return send(res, 200, google.status(q.session || ''));
    if (url === '/auth/logout' && req.method === 'POST') { var b0 = await readBody(req); google.logout(sessionOf(b0, q)); return send(res, 200, { ok: true }); }

    // ----- read a Google Sheet with the connected account -----
    if (url === '/api/sheet' && req.method === 'POST') {
      var b = await readBody(req);
      if (!b.session) return err(res, 401, 'Not connected — sign in with Google first.');
      if (!b.url) return err(res, 400, 'Missing sheet url.');
      try { var out = await google.readSheet(sessionOf(b, q), b.url); return send(res, 200, out); }
      catch (e) { return err(res, 400, String((e && e.message) || e)); }
    }

    // ----- Drive: list a folder of category GIFs, and fetch one -----
    // Needs the drive.readonly scope. Sessions created before Nov 2026 only carry drive.file and
    // will get a "please connect Google again" message rather than an empty list.
    if (url === '/api/drive/list' && (req.method === 'POST' || req.method === 'GET')) {
      var bl = req.method === 'POST' ? await readBody(req) : {};
      var folder = bl.folder || bl.folderId || bl.url || q.folder || q.folderId || q.url;
      if (!folder) return err(res, 400, 'Missing "folder" (a Drive folder link or id).');
      try {
        return send(res, 200, await google.listFolder(folder, {
          session: sessionOf(bl, q),
          all: String(bl.all != null ? bl.all : q.all) === 'true',
          mimeTypes: Array.isArray(bl.mimeTypes) ? bl.mimeTypes : null
        }));
      } catch (e) { return err(res, statusOf(e, 400), String((e && e.message) || e)); }
    }

    if (url === '/api/drive/file' && (req.method === 'POST' || req.method === 'GET')) {
      var bf = req.method === 'POST' ? await readBody(req) : {};
      var fid = bf.fileId || bf.id || bf.url || q.fileId || q.id || q.url;
      if (!fid) return err(res, 400, 'Missing "fileId".');
      try { return send(res, 200, await google.fileMeta(sessionOf(bf, q), fid)); }
      catch (e) { return err(res, statusOf(e, 400), String((e && e.message) || e)); }
    }

    // Bytes. Binary by default; add base64:true (or ?base64=1) to get JSON the plugin UI can
    // hand straight to the sandbox.
    if (url === '/api/drive/download' && (req.method === 'POST' || req.method === 'GET')) {
      var bd = req.method === 'POST' ? await readBody(req) : {};
      var did = bd.fileId || bd.id || bd.url || q.fileId || q.id || q.url;
      if (!did) return err(res, 400, 'Missing "fileId".');
      try {
        var f = await google.downloadFile(sessionOf(bd, q), did);
        if (bd.base64 === true || q.base64 === '1' || q.base64 === 'true') {
          return send(res, 200, { ok: true, id: did, name: f.name, mimeType: f.mimeType, size: f.size, width: f.width, height: f.height, base64: f.buffer.toString('base64') });
        }
        res.writeHead(200, {
          'Content-Type': f.mimeType || 'application/octet-stream',
          'Content-Length': f.buffer.length,
          'Content-Disposition': 'inline; filename="' + String(f.name || 'file').replace(/["\\\r\n]/g, '_') + '"',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store'
        });
        return res.end(f.buffer);
      } catch (e) { return err(res, statusOf(e, 400), String((e && e.message) || e)); }
    }

    // ----- the export composite -----
    // Body is JSON with base64 payloads (see docs/export-pipeline.md for why, not multipart).
    if (url === '/api/compose' && req.method === 'POST') {
      var bc = await readBody(req);
      try {
        var r = await compose.compose(bc, { downloadDriveFile: google.downloadFile });
        var buf = r.buffer;
        delete r.buffer;
        if (!buf) return send(res, 200, r); // dryRun
        if (bc.responseType === 'binary' || q.binary === '1') {
          res.writeHead(200, {
            'Content-Type': r.mimeType,
            'Content-Length': buf.length,
            'Content-Disposition': 'attachment; filename="' + r.filename + '"',
            'X-Aplus-Width': String(r.output.width),
            'X-Aplus-Height': String(r.output.height),
            'X-Aplus-Frames': String(r.output.frames),
            'X-Aplus-Amazon-Accepted': String(r.amazon.acceptedByAmazonAPlus),
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Expose-Headers': 'X-Aplus-Width, X-Aplus-Height, X-Aplus-Frames, X-Aplus-Amazon-Accepted',
            'Cache-Control': 'no-store'
          });
          return res.end(buf);
        }
        r.base64 = buf.toString('base64');
        return send(res, 200, r);
      } catch (e) { return err(res, statusOf(e, 400), String((e && e.message) || e)); }
    }

    if (parts[0] === 'api' && parts[1] === 'templates') {
      // /api/templates
      if (parts.length === 2) return send(res, 200, registry());

      var category = parts[2];
      if (!SAFE.test(category)) return err(res, 400, 'Bad category');
      var reg = registry();
      var cat = manifests.findCategory(reg, category);
      if (!cat) return err(res, 404, 'Unknown category "' + category + '"');

      // /api/templates/:category
      if (parts.length === 3) return send(res, 200, cat);

      var genderId = parts[3];
      if (!SAFE.test(genderId)) return err(res, 400, 'Bad gender id');
      var gen = manifests.findGender(cat, genderId);
      if (!gen) return err(res, 404, 'Unknown gender "' + genderId + '" in "' + category + '"');

      // /api/templates/:category/:gender
      if (parts.length === 4) return send(res, 200, gen);

      var templateId = parts[4];
      if (!SAFE.test(templateId)) return err(res, 400, 'Bad template id');
      if (!manifests.findTemplate(gen, templateId)) {
        return err(res, 404, 'Unknown template "' + templateId + '" in "' + category + '/' + genderId + '"');
      }

      // /api/templates/:category/:gender/:template  -> the resolved manifest
      if (parts.length === 5) {
        try { return send(res, 200, manifests.resolve(category, genderId, templateId)); }
        catch (e) { return err(res, 404, String((e && e.message) || e)); }
      }

      // /api/templates/:category/:gender/:template/preview.svg
      if (parts.length === 6 && parts[5] === 'preview.svg') {
        var svg = path.join(TEMPLATES, category, genderId, templateId + '.preview.svg');
        if (!fs.existsSync(svg)) return err(res, 404, 'No preview.svg for ' + category + '/' + genderId + '/' + templateId);
        return send(res, 200, fs.readFileSync(svg), 'image/svg+xml; charset=utf-8');
      }
    }

    return err(res, 404, 'Not found: ' + url);
  } catch (e) {
    if (e && e.statusCode === 413) return err(res, 413, e.message);
    return err(res, 500, String((e && e.message) || e));
  }
});

// A compose job can legitimately take minutes on a tall canvas; don't let Node time the socket out.
server.requestTimeout = 0;
server.headersTimeout = 65000;
server.keepAliveTimeout = 120000;

server.listen(PORT, function () {
  var tool = compose.toolCheck();
  console.log('A+ template backend on http://localhost:' + PORT);
  console.log('  GET  /api/templates');
  console.log('  Google sign-in: ' + (google.configured() ? 'configured (redirect ' + google.REDIRECT_URI + ')' : 'NOT configured — set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET to enable'));
  console.log('  Drive scope: drive.readonly  — existing users must connect Google again once.');
  console.log('  ffmpeg: ' + (tool.available
    ? tool.version + (tool.encoders.libx264 ? ' (libx264 ok)' : ' (NO libx264 — format:"mp4" unavailable)')
    : 'NOT FOUND — /api/compose will return 503. Use the Docker image or install ffmpeg.'));
  if (ANTHROPIC_API_KEY) console.log('  ANTHROPIC_API_KEY: set (AI template labelling is not implemented yet).');
  sessionStore.warnIfEphemeral();
});
