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
//   POST /auth/token      -> { session } -> { accessToken, expiresAt, expiresIn, scopes, email, driveAccess, needsReconsent }
//                            a SHORT-LIVED Google access token for the user's own account, so the plugin
//                            talks to Drive/Sheets directly (bytes never transit this server). The refresh
//                            token is never returned. Rate-limited. See docs/architecture-client-side.md.
//   GIF rules (which animation goes under which category — backend/gif-rules.json):
//   GET  /api/gif-rules   -> the rules file
//   POST /api/gif-match   -> { session, category, gender? } -> { found, file: {id,name,mimeType,size,width,height} } | { found:false, reason }
//                            Drive METADATA only, no bytes.
//   POST /api/sheet       -> { session, url } -> reads that sheet with the user's account -> { rows }
//   Drive (needs the drive.readonly scope — existing users must re-consent once):
//   POST /api/drive/list      -> { session, folder } -> { files: [{id,name,mimeType,size,...}] }
//   POST /api/drive/file      -> { session, fileId } -> that file's metadata
//   POST /api/drive/download  -> { session, fileId } -> the file's bytes (binary, or base64 JSON)
//   Export:
//   POST /api/compose     -> { session, aplusPng, gif|driveFileId, format } -> animated GIF / MP4
//                            !! an animated GIF is NOT accepted by Amazon A+ — see compose.js
//                            !! requires a signed-in session and is concurrency-capped
//   Captured templates: NOT stored here. A user's templates live on their computer, in their own
//   Google Drive and in files they export (docs/user-templates.md); the plugin never posts them.
//   POST   /api/templates  -> 410 Gone, unless SERVER_TEMPLATE_STORE=true (legacy, off by default)
//   DELETE /api/templates/:category/:gender/:id        -> removes a legacy server-captured template only
//   AI labelling (advisory names only — docs/ai-labelling.md):
//   POST /api/label       -> { session, skeleton } -> { roles: { layerId: { role, confidence } } }

require('./env');

var http = require('http');
var fs = require('fs');
var path = require('path');
var google = require('./google');
var manifests = require('./manifests');
var compose = require('./compose');
var sessionStore = require('./session');
var store = require('./store');
var labeller = require('./label');
var llm = require('./llm');
var gifrules = require('./gifrules');
var ratelimit = require('./ratelimit');

var PORT = process.env.PORT || 8787;
var MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES || 96 * 1024 * 1024);
// A captured manifest is tens of KB, not tens of MB. Capping this route separately means a
// hostile POST /api/templates cannot buffer 96 MB before being rejected.
var MAX_TEMPLATE_BODY_BYTES = Number(process.env.MAX_TEMPLATE_BODY_BYTES || 4 * 1024 * 1024);
// The legacy server-side store for captured templates. Off: user templates belong to the user
// (their computer + their Drive — docs/user-templates.md), so the backend stays light and shared.
var SERVER_TEMPLATE_STORE = String(process.env.SERVER_TEMPLATE_STORE || 'false').toLowerCase() === 'true';
var MAX_LABEL_BODY_BYTES = Number(process.env.MAX_LABEL_BODY_BYTES || 4 * 1024 * 1024);
// /api/compose can hold ~500 MB of pixel buffers and tens of seconds of CPU for one job, so it is
// no longer anonymous and no longer unbounded. Set REQUIRE_SESSION=false only for local work.
var REQUIRE_SESSION = String(process.env.REQUIRE_SESSION || 'true').toLowerCase() !== 'false';
var COMPOSE_MAX_CONCURRENT = Number(process.env.COMPOSE_MAX_CONCURRENT || 2);
var composeInFlight = 0;
// /auth/token mints nothing new while the cached access token is valid (ensureToken caches it), so
// these limits only bound abuse: a stolen-blob replay loop, or a plugin bug that calls it in a loop.
var TOKEN_RATE_PER_SESSION = Number(process.env.TOKEN_RATE_PER_SESSION || 30);   // per minute
var TOKEN_RATE_PER_IP = Number(process.env.TOKEN_RATE_PER_IP || 120);             // per minute
var GIF_MATCH_RATE_PER_IP = Number(process.env.GIF_MATCH_RATE_PER_IP || 60);      // per minute
var tokenBySession = ratelimit.limiter({ windowMs: 60000, max: TOKEN_RATE_PER_SESSION });
var tokenByIp = ratelimit.limiter({ windowMs: 60000, max: TOKEN_RATE_PER_IP });
var gifMatchByIp = ratelimit.limiter({ windowMs: 60000, max: GIF_MATCH_RATE_PER_IP });
var ROOT = __dirname;
var TEMPLATES = path.join(ROOT, 'templates');
var SAFE = /^[a-z0-9][a-z0-9-]*$/i; // category / template id guard (no path traversal)

function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-cache'
  });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body, null, 2));
}
// `errCode` is machine-readable (no-session, invalid-session, revoked, needs-reconsent,
// insufficient-scope, rate-limited, …) so the plugin can map it without parsing English.
function err(res, code, message, errCode) { send(res, code, errCode ? { error: message, code: errCode } : { error: message }); }
function errFrom(res, e, fallback) {
  return err(res, statusOf(e, fallback), String((e && e.message) || e), (e && typeof e.code === 'string') ? e.code : undefined);
}
function tooMany(res, verdict, what) {
  res.setHeader('Retry-After', String(verdict.retryAfter));
  return err(res, 429, 'Too many ' + what + ' requests — try again in ' + verdict.retryAfter + ' s.', 'rate-limited');
}
function query(u) { var q = {}, i = u.indexOf('?'); if (i >= 0) u.slice(i + 1).split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) q[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' ')); }); return q; }

// A+ PNGs arrive base64-encoded inside the JSON body, so this buffers up to ~96 MB by default.
// It is capped so a malformed or hostile request cannot grow the heap without bound.
function readBody(req, maxBytes) {
  var cap = Number(maxBytes) > 0 ? Number(maxBytes) : MAX_BODY_BYTES;
  return new Promise(function (resolve, reject) {
    var c = [], n = 0, done = false;
    req.on('data', function (d) {
      if (done) return;
      n += d.length;
      if (n > cap) {
        done = true;
        req.destroy();
        var e = new Error('Request body is larger than the ' + Math.round(cap / 1048576) + ' MB limit for this endpoint.');
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

// Gate for the endpoints that spend real resources: /api/compose (≈500 MB and seconds of CPU per
// job), /api/label (real money at an LLM provider), and the template writes. google.status() opens
// the sealed session locally — no network call, no token refresh — so this costs nothing.
// Returns null when the caller may proceed, or an { code, message } to refuse with.
function denySession(ref) {
  if (!REQUIRE_SESSION) return null;
  if (!google.configured()) {
    return { code: 503, message: 'This endpoint requires a signed-in session, but Google sign-in is not configured on this backend. Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET, or set REQUIRE_SESSION=false for local development only.' };
  }
  var st;
  try { st = google.status(ref); } catch (e) { st = null; }
  if (!st || !st.connected) return { code: 401, message: 'Not connected — sign in with Google first.' };
  return null;
}
function statusOf(e, fallback) { return (e && e.statusCode) || fallback; }
function page(res, title, msg) { send(res, 200, '<!doctype html><meta charset="utf-8"><title>' + title + '</title><div style="font:16px system-ui;max-width:460px;margin:16vh auto;text-align:center;color:#1e1e1e"><div style="font-size:40px">' + (title.indexOf('Connected') === 0 ? '✅' : '⚠️') + '</div><h2>' + title + '</h2><p style="color:#666">' + msg + '</p><p style="color:#999;font-size:13px">You can close this tab and return to Figma.</p></div>', 'text/html; charset=utf-8'); }

// The registry the API serves is the built-in index.json with every captured template folded in,
// so a captured template is selectable in the plugin exactly like a hand-built one.
function registry() { return store.mergeRegistry(manifests.registry()); }

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
        // Presence booleans and the model id only — never the key, never a dollar figure.
        llm: llm.info(),
        templateStore: store.info(),
        limits: { requireSession: REQUIRE_SESSION, composeMaxConcurrent: COMPOSE_MAX_CONCURRENT, composeInFlight: composeInFlight,
          tokenPerSessionPerMin: TOKEN_RATE_PER_SESSION, tokenPerIpPerMin: TOKEN_RATE_PER_IP, gifMatchPerIpPerMin: GIF_MATCH_RATE_PER_IP },
        gifRules: (function () { try { var gr = gifrules.load(); return { ok: true, categories: Object.keys(gr.categories).length, folderId: (gr.source || {}).folderId || null }; } catch (e) { return { ok: false, error: e.message }; } })()
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

    // ----- short-lived access token for the plugin's direct Drive/Sheets calls -----
    // POST only, session in the BODY (never a query string: URLs end up in logs). The response is
    // no-store. The refresh token stays sealed in the session blob and is never returned.
    if (url === '/auth/token') {
      if (req.method !== 'POST') return err(res, 405, 'Use POST with { session } in the body.');
      var ipV = tokenByIp.hit(ratelimit.clientIp(req));
      if (!ipV.ok) return tooMany(res, ipV, 'token');
      var bTok = await readBody(req, 64 * 1024);
      var sTok = String((bTok && (bTok.session || bTok.sessionId)) || '');
      if (!sTok) return err(res, 401, 'Not connected — sign in with Google first.', 'no-session');
      if (!google.configured()) return err(res, 503, 'Google sign-in is not configured on this backend.', 'not-configured');
      var sV = tokenBySession.hit(google.sessionKey(sTok));
      if (!sV.ok) return tooMany(res, sV, 'token');
      try {
        var tok = await google.accessToken(sTok);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Pragma', 'no-cache');
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'no-store'
        });
        return res.end(JSON.stringify(tok));
      } catch (e) { return errFrom(res, e, 401); }
    }

    // ----- GIF rules: config + Drive-metadata match -----
    if (url === '/api/gif-rules' && req.method === 'GET') {
      try { return send(res, 200, gifrules.load()); }
      catch (e) { return errFrom(res, e, 500); }
    }
    if (url === '/api/gif-match' && req.method === 'POST') {
      var gmV = gifMatchByIp.hit(ratelimit.clientIp(req));
      if (!gmV.ok) return tooMany(res, gmV, 'gif-match');
      var bGm = await readBody(req, 64 * 1024);
      var sGm = sessionOf(bGm, q);
      if (!sGm) return err(res, 401, 'Not connected — sign in with Google first.', 'no-session');
      if (!bGm.category) return err(res, 400, 'Missing "category".', 'bad-request');
      try { return send(res, 200, await gifrules.match(google, sGm, bGm.category, bGm.gender || null)); }
      catch (e) { return errFrom(res, e, 400); }
    }

    // ----- read a Google Sheet with the connected account -----
    if (url === '/api/sheet' && req.method === 'POST') {
      var b = await readBody(req);
      if (!b.session) return err(res, 401, 'Not connected — sign in with Google first.');
      if (!b.url) return err(res, 400, 'Missing sheet url.');
      try { var out = await google.readSheet(sessionOf(b, q), b.url); return send(res, 200, out); }
      catch (e) { return errFrom(res, e, 400); }
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
      } catch (e) { return errFrom(res, e, 400); }
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

    // ----- the export composite (FALLBACK ONLY) -----
    // Since the client-side refactor, GIF/MP4 compositing runs on the user's device (gifenc /
    // WebCodecs + mp4-muxer in the plugin iframe). This endpoint stays as a documented, clearly
    // labelled fallback for browsers without H.264 WebCodecs — see docs/architecture-client-side.md.
    // Body is JSON with base64 payloads (see docs/export-pipeline.md for why, not multipart).
    if (url === '/api/compose' && req.method === 'POST') {
      var bc = await readBody(req);
      // A single compose job holds the PNG, the GIF and ffmpeg's scratch frames — hundreds of MB
      // and seconds of CPU. Two guards, in this order: who you are, then how many at once.
      var denyC = denySession(sessionOf(bc, q));
      if (denyC) return err(res, denyC.code, denyC.message);
      if (composeInFlight >= COMPOSE_MAX_CONCURRENT) {
        res.setHeader('Retry-After', '10');
        return err(res, 429, 'The server is already running ' + COMPOSE_MAX_CONCURRENT + ' export job(s). Try again in a few seconds.');
      }
      composeInFlight++;
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
      finally { composeInFlight--; }
    }

    // ----- AI semantic labelling (advisory names only) -----
    // The model never decides geometry, paint or z-order — see backend/label.js and
    // docs/ai-labelling.md. If the model is unreachable this still returns 200 with heuristics.
    if (url === '/api/label' && req.method === 'POST') {
      var bL = await readBody(req, MAX_LABEL_BODY_BYTES);
      var denyL = denySession(sessionOf(bL, q));
      if (denyL) return err(res, denyL.code, denyL.message);
      try { return send(res, 200, await labeller.label(bL)); }
      catch (e) { return err(res, statusOf(e, 400), llm.scrub(String((e && e.message) || e))); }
    }

    // ----- the labelling role vocabulary, for a review UI's dropdown -----
    if (url === '/api/label/roles' && (req.method === 'GET' || req.method === 'POST')) {
      return send(res, 200, { schema: labeller.SCHEMA_VERSION, roles: labeller.ROLES, llm: llm.info(), maxLayers: labeller.MAX_LAYERS });
    }

    if (parts[0] === 'api' && parts[1] === 'templates') {
      // ----- save a captured template -----
      // POST /api/templates { session, category, gender, id, label, manifest }
      if (parts.length === 2 && req.method === 'POST') {
        if (!SERVER_TEMPLATE_STORE) {
          return err(res, 410, 'Templates are no longer stored on the A+ service. The plugin saves them on your computer and in your own Google Drive (docs/user-templates.md).');
        }
        var bT = await readBody(req, MAX_TEMPLATE_BODY_BYTES);
        var denyT = denySession(sessionOf(bT, q));
        if (denyT) return err(res, denyT.code, denyT.message);

        var rec;
        try { rec = store.validate(bT); }
        catch (e) { return err(res, statusOf(e, 400), String((e && e.message) || e)); }

        // A captured template may never shadow a hand-built one. The four Running manifests are
        // files in the image; overwriting one from the network is not a feature.
        var regT = manifests.registry();
        var catT = manifests.findCategory(regT, rec.category);
        var genT = manifests.findGender(catT, rec.gender);
        if (manifests.findTemplate(genT, rec.id)) {
          return err(res, 409, '"' + rec.category + '/' + rec.gender + '/' + rec.id + '" is a built-in template and cannot be overwritten by a capture. Choose a different id.');
        }

        try {
          var saved = store.put(rec);
          return send(res, saved.replaced ? 200 : 201, {
            ok: true,
            replaced: saved.replaced,
            template: saved.entry,
            url: '/api/templates/' + rec.category + '/' + rec.gender + '/' + rec.id,
            persistence: store.info()   // says plainly whether this survives a restart
          });
        } catch (e) { return err(res, statusOf(e, 500), String((e && e.message) || e)); }
      }

      // /api/templates — built-ins plus anything captured, in one registry the plugin can't
      // tell apart except by the `source` field.
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
      var tplEntry = manifests.findTemplate(gen, templateId);
      if (!tplEntry) {
        return err(res, 404, 'Unknown template "' + templateId + '" in "' + category + '/' + genderId + '"');
      }
      var isCaptured = tplEntry.source === 'captured';

      // DELETE /api/templates/:category/:gender/:template — captured templates only.
      // The four built-in Running manifests are files in the Docker image and are never deletable
      // through the API; removing one is a code change and a deploy, by design.
      if (parts.length === 5 && req.method === 'DELETE') {
        var bD = await readBody(req, 64 * 1024);
        var denyD = denySession(sessionOf(bD, q));
        if (denyD) return err(res, denyD.code, denyD.message);
        if (!isCaptured || !store.has(category, genderId, templateId)) {
          return err(res, 403, '"' + category + '/' + genderId + '/' + templateId + '" is a built-in template and cannot be deleted through the API.');
        }
        var removed = store.remove(category, genderId, templateId);
        return send(res, 200, { ok: true, deleted: removed, template: category + '/' + genderId + '/' + templateId });
      }

      // /api/templates/:category/:gender/:template  -> the resolved manifest
      if (parts.length === 5) {
        try {
          var resolved = isCaptured ? store.resolve(category, genderId, templateId) : manifests.resolve(category, genderId, templateId);
          if (!resolved) return err(res, 404, 'The manifest for "' + category + '/' + genderId + '/' + templateId + '" is registered but its file is missing. If this is a captured template, the store it was written to did not survive a restart — see /health -> templateStore.');
          return send(res, 200, resolved);
        }
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
  console.log('  Scopes: drive + spreadsheets.readonly + openid + email — sessions from before the full-drive change report needsReconsent.');
  console.log('  POST /auth/token: short-lived access tokens, ' + TOKEN_RATE_PER_SESSION + '/min per session, ' + TOKEN_RATE_PER_IP + '/min per IP');
  console.log('  ffmpeg: ' + (tool.available
    ? tool.version + (tool.encoders.libx264 ? ' (libx264 ok)' : ' (NO libx264 — format:"mp4" unavailable)')
    : 'NOT FOUND — /api/compose will return 503. Use the Docker image or install ffmpeg.'));
  var li = llm.info();
  console.log('  AI labelling: ' + (li.configured
    ? 'provider=' + li.provider + ' model=' + li.model + ' (advisory roles only — see docs/ai-labelling.md)'
    : 'NOT configured — POST /api/label still works and returns heuristic roles.'));
  console.log('  Captured templates: ' + store.info().dir + ' [' + store.info().durability + ']');
  console.log('  /api/compose: session required=' + REQUIRE_SESSION + ', max concurrent=' + COMPOSE_MAX_CONCURRENT);
  sessionStore.warnIfEphemeral();
  store.warnIfEphemeral();
});
