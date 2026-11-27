// ===== A+ Studio · Google OAuth + Sheets/Drive (pure Node, no deps) =====
// Authorization-code flow. The plugin opens the consent URL in the browser; Google redirects back
// to /auth/callback; we exchange the code for tokens, SEAL the refresh token (see session.js) and
// hand the sealed blob back to the plugin as its session string. The server keeps no durable state,
// so a Render redeploy no longer signs everyone out.
//
// Configure via env (see backend/.env.example):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, SESSION_SECRET
//
// SCOPES — and why each one:
//   openid, email                        identify who connected (the UI shows the address)
//   spreadsheets.readonly                read the content sheet without "Publish to web"
//   drive                                full Drive: read the team's animation folder AND write the
//                                        user's own templates + exports into "Cult A+ Design Lab/"
//                                        in their My Drive (docs/architecture-client-side.md)
//
// History: drive.file (until Nov 2026) could not see an existing team folder; drive.readonly
// (Nov 2026) could read it but not write templates back. Full `drive` is the only scope that
// covers both. It is a restricted scope, but this Cloud project is Internal to the curefit.com
// Workspace, so no Google app verification is required.
//
// !! EXISTING USERS MUST RE-CONSENT ONCE. A token minted under drive.file / drive.readonly does
// not gain `drive` on refresh. status() reports needsReconsent:true for those sessions, and the
// read-only paths (gif-match, list, download) keep working with drive.readonly meanwhile.
//
// Since the client-side refactor the plugin talks to Drive/Sheets DIRECTLY with a short-lived
// access token minted by accessToken() below (POST /auth/token). The refresh token never leaves
// this server: it stays sealed inside the session blob (session.js).

require('./env');

var https = require('https');
var crypto = require('crypto');
var sessionStore = require('./session');

var CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
var CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
var REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || ('http://localhost:' + (process.env.PORT || 8787) + '/auth/callback');

var SCOPE_DRIVE = 'https://www.googleapis.com/auth/drive';
var SCOPE_DRIVE_READONLY = 'https://www.googleapis.com/auth/drive.readonly';
var SCOPE_SHEETS_READONLY = 'https://www.googleapis.com/auth/spreadsheets.readonly';
var SCOPE_LIST = [
  'openid',
  'email',
  SCOPE_SHEETS_READONLY,
  SCOPE_DRIVE
];
var SCOPES = SCOPE_LIST.join(' ');

// Scopes are compared as whole tokens. A substring test would be wrong now: the full-Drive scope
// URL is a prefix of the drive.readonly URL, so indexOf() would call a read-only session "full".
function scopeList(scopes) { return String(scopes || '').split(/\s+/).filter(Boolean); }
function hasScope(scopes, want) { return scopeList(scopes).indexOf(want) >= 0; }
function canReadDrive(scopes) { return hasScope(scopes, SCOPE_DRIVE) || hasScope(scopes, SCOPE_DRIVE_READONLY); }
function canWriteDrive(scopes) { return hasScope(scopes, SCOPE_DRIVE); }

// Errors carry a machine-readable `code` (and an HTTP status) so the plugin can map them to a
// clear message without parsing English: no-session, invalid-session, revoked, needs-reconsent,
// insufficient-scope, not-found, forbidden, google-error.
function codedError(code, status, message) {
  var e = new Error(message);
  e.code = code;
  e.statusCode = status;
  return e;
}
var RECONSENT_READ_MSG = 'This Google session predates the Drive change — please disconnect and connect Google again to grant Drive access.';

function configured() { return !!(CLIENT_ID && CLIENT_SECRET); }

// ---------------------------------------------------------------------------------------------
// transport
// ---------------------------------------------------------------------------------------------

function request(options, body, wantBuffer) {
  return new Promise(function (resolve, reject) {
    var req = https.request(options, function (res) {
      // Drive's alt=media redirects to a download host; follow it (GET only, same scheme).
      if (wantBuffer && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        var loc;
        try { loc = new URL(res.headers.location); } catch (e) { return reject(new Error('bad redirect from Google')); }
        if (loc.protocol !== 'https:') return reject(new Error('refusing non-https redirect'));
        return resolve(request({
          method: 'GET', host: loc.hostname, path: loc.pathname + loc.search, headers: options.headers
        }, null, true));
      }
      var chunks = [];
      var total = 0;
      res.on('data', function (c) {
        total += c.length;
        if (wantBuffer && total > MAX_DRIVE_BYTES) { req.destroy(new Error('file is larger than the ' + Math.round(MAX_DRIVE_BYTES / 1048576) + ' MB download limit')); return; }
        chunks.push(c);
      });
      res.on('end', function () {
        var buf = Buffer.concat(chunks);
        if (wantBuffer) return resolve({ status: res.statusCode, buffer: buf, headers: res.headers });
        var text = buf.toString('utf8'), json = null;
        try { json = JSON.parse(text); } catch (e) {}
        resolve({ status: res.statusCode, json: json, text: text, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
var MAX_DRIVE_BYTES = Number(process.env.MAX_DRIVE_DOWNLOAD_BYTES || 64 * 1024 * 1024);

function postForm(host, pathname, params) {
  var body = Object.keys(params).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
  return request({ method: 'POST', host: host, path: pathname, headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } }, body);
}
function getJson(host, pathname, token) {
  return request({ method: 'GET', host: host, path: pathname, headers: { Authorization: 'Bearer ' + token } });
}
function getBuffer(host, pathname, token) {
  return request({ method: 'GET', host: host, path: pathname, headers: { Authorization: 'Bearer ' + token } }, null, true);
}

// ---------------------------------------------------------------------------------------------
// session plumbing
//
//   pending[]  in-memory, lives only for the ~30s of the OAuth round-trip (and, for backward
//              compatibility, for the lifetime of the process so an un-updated plugin holding a
//              legacy hex id keeps working until the next restart).
//   sealed     the durable thing. Opaque to the plugin, decryptable only by this server.
//   live[]     in-memory cache of short-lived access tokens, keyed by a hash of the sealed blob.
// ---------------------------------------------------------------------------------------------

var pending = sessionStore.loadDisk(); // {} unless SESSION_DIR is configured
var live = Object.create(null);

function liveKey(sealed) { return crypto.createHash('sha256').update(sealed).digest('hex').slice(0, 32); }

function sealOf(sess) {
  return sessionStore.seal({
    rt: sess.refresh_token,
    em: sess.email || null,
    sc: sess.scopes || SCOPES,
    iat: Date.now()
  });
}

// Turn whatever the plugin sent (sealed blob, or a legacy hex id) into a working session object.
function resolveSession(ref) {
  ref = String(ref || '');
  if (!ref) throw codedError('no-session', 401, 'Not connected — sign in with Google first.');

  if (sessionStore.isSealed(ref)) {
    var p = sessionStore.open(ref);
    if (!p || !p.rt) throw codedError('invalid-session', 401, 'Your Google session is no longer valid — please connect Google again.');
    var k = liveKey(ref);
    var cached = live[k] || (live[k] = {});
    cached.refresh_token = p.rt;
    cached.email = p.em || null;
    cached.scopes = p.sc || '';
    cached.sealed = ref;
    return cached;
  }

  var s = pending[ref];
  if (!s || !(s.refresh_token || s.access_token)) throw codedError('no-session', 401, 'Not connected — sign in with Google first.');
  return s;
}

// ---------------------------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------------------------

function newSession() {
  var id = crypto.randomBytes(18).toString('hex');
  pending[id] = { created: Date.now() };
  sessionStore.saveDisk(pending);
  var authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + [
    'client_id=' + encodeURIComponent(CLIENT_ID),
    'redirect_uri=' + encodeURIComponent(REDIRECT_URI),
    'response_type=code',
    'scope=' + encodeURIComponent(SCOPES),
    'access_type=offline',
    // NOT include_granted_scopes: that folds every scope this client was ever granted (a live
    // session carried Gmail + Calendar) into the new token. Ask for exactly SCOPES.
    'prompt=consent', // forces a refresh_token AND re-shows the new Drive scope to existing users
    'state=' + encodeURIComponent(id)
  ].join('&');
  return { sessionId: id, authUrl: authUrl, scopes: SCOPE_LIST };
}

async function handleCallback(code, state) {
  var sess = pending[state];
  if (!sess) throw new Error('unknown or expired session');
  var r = await postForm('oauth2.googleapis.com', '/token', {
    code: code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code'
  });
  if (r.status !== 200 || !r.json || !r.json.access_token) throw new Error('token exchange failed: ' + String(r.text || '').slice(0, 200));
  sess.access_token = r.json.access_token;
  if (r.json.refresh_token) sess.refresh_token = r.json.refresh_token;
  sess.expiry = Date.now() + (r.json.expires_in || 3600) * 1000;
  sess.scopes = r.json.scope || SCOPES;
  try { var u = await getJson('openidconnect.googleapis.com', '/v1/userinfo', sess.access_token); if (u.json && u.json.email) sess.email = u.json.email; } catch (e) {}

  if (!sess.refresh_token) {
    // Without a refresh token the sealed blob is worthless (it would expire in an hour).
    // access_type=offline + prompt=consent should always give us one; if Google ever doesn't,
    // say so rather than handing back a session that dies silently in 60 minutes.
    throw new Error('Google did not return a refresh token. Revoke this app at myaccount.google.com/permissions and connect again.');
  }
  sess.sealed = sealOf(sess);
  live[liveKey(sess.sealed)] = {
    refresh_token: sess.refresh_token, access_token: sess.access_token,
    expiry: sess.expiry, email: sess.email, scopes: sess.scopes, sealed: sess.sealed
  };
  sessionStore.saveDisk(pending);
  return sess;
}

// status() is what the plugin polls. The important new field is `session`: the durable sealed
// token. A plugin that knows about it should overwrite its stored session id with this value —
// that is the whole restart-survival mechanism. A plugin that ignores it behaves exactly as before.
function status(ref) {
  var base = { configured: configured(), connected: false, email: null, scopes: [], needsReconsent: false, session: null, persistence: sessionStore.info().secret };
  ref = String(ref || '');
  if (!ref) return base;

  var sess = null;
  if (sessionStore.isSealed(ref)) {
    var p = sessionStore.open(ref);
    if (p && p.rt) sess = { email: p.em, scopes: p.sc, sealed: ref, refresh_token: p.rt };
  } else {
    var s = pending[ref];
    if (s && (s.refresh_token || s.access_token)) sess = s;
  }
  if (!sess) return base;

  base.connected = true;
  base.email = sess.email || null;
  base.scopes = String(sess.scopes || '').split(/\s+/).filter(Boolean);
  // needsReconsent = "this session cannot do everything the plugin now needs" (full Drive).
  // driveAccess says what it CAN do meanwhile: 'full', 'read' (drive.readonly) or 'none'.
  base.driveAccess = canWriteDrive(sess.scopes) ? 'full' : (canReadDrive(sess.scopes) ? 'read' : 'none');
  base.needsReconsent = !canWriteDrive(sess.scopes);
  base.session = sess.sealed || null;
  return base;
}

function logout(ref) {
  ref = String(ref || '');
  if (sessionStore.isSealed(ref)) { delete live[liveKey(ref)]; return; }
  if (pending[ref]) {
    if (pending[ref].sealed) delete live[liveKey(pending[ref].sealed)];
    delete pending[ref];
    sessionStore.saveDisk(pending);
  }
}

async function ensureToken(sess) {
  if (sess.access_token && sess.expiry && Date.now() < sess.expiry - 60000) return sess.access_token;
  if (!sess.refresh_token) throw codedError('no-session', 401, 'not authenticated');
  var r = await postForm('oauth2.googleapis.com', '/token', {
    refresh_token: sess.refresh_token, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: 'refresh_token'
  });
  if (r.status === 400 || r.status === 401) throw codedError('revoked', 401, 'Your Google connection was revoked or expired — please connect Google again.');
  if (r.status !== 200 || !r.json || !r.json.access_token) throw codedError('google-error', 502, 'token refresh failed (' + r.status + ')');
  sess.access_token = r.json.access_token;
  sess.expiry = Date.now() + (r.json.expires_in || 3600) * 1000;
  if (r.json.scope) sess.scopes = r.json.scope;
  return sess.access_token;
}

async function tokenFor(ref) { return ensureToken(resolveSession(ref)); }

// POST /auth/token. Hands the plugin a short-lived access token for the user's OWN account so
// Drive/Sheets bytes go device <-> Google directly and never transit this server. The refresh
// token is never returned. Why this is acceptable: docs/architecture-client-side.md.
//
// DOWN-SCOPED. A Google grant accumulates every scope the user ever gave this OAuth client
// (include_granted_scopes, or the same client used elsewhere) — a live session was seen carrying
// Gmail and Calendar scopes. The plugin must never hold those, so its token is minted with an
// explicit `scope` on the refresh grant: only PLUGIN_SCOPES ∩ granted. Google returns the narrowed
// set in `scope`; we report exactly that. The token is cached per session until ~60 s before expiry.
var PLUGIN_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/userinfo.email',
  SCOPE_SHEETS_READONLY,
  SCOPE_DRIVE,
  SCOPE_DRIVE_READONLY
];
function pluginScopesFor(granted) {
  var have = scopeList(granted);
  var want = PLUGIN_SCOPES.filter(function (sc) { return have.indexOf(sc) >= 0; });
  // full drive makes drive.readonly redundant; asking for both is harmless but noisy
  if (want.indexOf(SCOPE_DRIVE) >= 0) want = want.filter(function (sc) { return sc !== SCOPE_DRIVE_READONLY; });
  // 'email' and userinfo.email are the same grant under two names; Google echoes the long one
  if (want.indexOf('https://www.googleapis.com/auth/userinfo.email') >= 0) want = want.filter(function (sc) { return sc !== 'email'; });
  return want;
}

async function accessToken(ref) {
  var sess = resolveSession(ref);
  if (!sess.refresh_token) throw codedError('no-session', 401, 'not authenticated');
  var p = sess.plugin;
  if (!p || !p.token || Date.now() >= p.expiry - 60000) {
    var want = pluginScopesFor(sess.scopes);
    if (!want.length) throw codedError('needs-reconsent', 403, 'This Google session carries none of the scopes the plugin uses — please connect Google again.');
    var r = await postForm('oauth2.googleapis.com', '/token', {
      refresh_token: sess.refresh_token, client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token', scope: want.join(' ')
    });
    if (r.status === 400 || r.status === 401) {
      var reason = (r.json && (r.json.error || '')) || '';
      if (reason === 'invalid_scope') throw codedError('needs-reconsent', 403, 'Google refused the narrowed scope set — please connect Google again.');
      throw codedError('revoked', 401, 'Your Google connection was revoked or expired — please connect Google again.');
    }
    if (r.status !== 200 || !r.json || !r.json.access_token) throw codedError('google-error', 502, 'token refresh failed (' + r.status + ')');
    p = sess.plugin = {
      token: r.json.access_token,
      expiry: Date.now() + (r.json.expires_in || 3600) * 1000,
      scopes: r.json.scope || want.join(' ')
    };
  }
  return {
    accessToken: p.token,
    tokenType: 'Bearer',
    expiresAt: p.expiry,
    expiresIn: Math.max(0, Math.floor((p.expiry - Date.now()) / 1000)),
    scopes: scopeList(p.scopes),
    email: sess.email || null,
    driveAccess: canWriteDrive(p.scopes) ? 'full' : (canReadDrive(p.scopes) ? 'read' : 'none'),
    needsReconsent: !canWriteDrive(sess.scopes)
  };
}

// ---------------------------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------------------------

function parseSheetUrl(url) {
  var id = (String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/) || [])[1];
  var gid = (String(url).match(/[#&?]gid=(\d+)/) || [])[1];
  return { id: id, gid: gid != null ? Number(gid) : null };
}

async function readSheet(ref, url) {
  var sess = resolveSession(ref);
  var token = await ensureToken(sess);
  var p = parseSheetUrl(url);
  if (!p.id) throw new Error('That is not a Google Sheets link.');
  var meta = await getJson('sheets.googleapis.com', '/v4/spreadsheets/' + p.id + '?fields=sheets(properties(sheetId,title))', token);
  if (meta.status === 403) throw new Error('No access to that sheet with this Google account.');
  if (meta.status !== 200 || !meta.json || !meta.json.sheets || !meta.json.sheets.length) throw new Error('Cannot open that sheet (' + meta.status + ').');
  var title = meta.json.sheets[0].properties.title;
  if (p.gid != null) { var hit = meta.json.sheets.find(function (s) { return s.properties.sheetId === p.gid; }); if (hit) title = hit.properties.title; }
  var vals = await getJson('sheets.googleapis.com', '/v4/spreadsheets/' + p.id + '/values/' + encodeURIComponent(title) + '?majorDimension=ROWS', token);
  if (vals.status !== 200 || !vals.json) throw new Error('Cannot read the sheet values (' + vals.status + ').');
  return { rows: vals.json.values || [], tab: title, email: sess.email || null };
}

// ---------------------------------------------------------------------------------------------
// Drive
// ---------------------------------------------------------------------------------------------

var ID_RE = /^[a-zA-Z0-9_-]{10,}$/;

// Accepts a folder URL in any of Drive's shapes, or a bare folder id.
//   https://drive.google.com/drive/folders/<id>?usp=sharing
//   https://drive.google.com/drive/u/0/folders/<id>
//   https://drive.google.com/open?id=<id>
//   https://drive.google.com/drive/u/0/my-drive  -> no id (rejected)
function parseFolderRef(input) {
  var s = String(input || '').trim();
  if (!s) return null;
  var m = s.match(/\/folders\/([a-zA-Z0-9_-]+)/) ||
          s.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
          s.match(/\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (ID_RE.test(s) && s.indexOf('/') < 0) return s;
  return null;
}

// Accepts a file URL (…/file/d/<id>/view, …?id=<id>) or a bare file id.
function parseFileRef(input) {
  var s = String(input || '').trim();
  if (!s) return null;
  var m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
          s.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
          s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  if (ID_RE.test(s) && s.indexOf('/') < 0) return s;
  return null;
}

function driveError(status, text) {
  if (status === 401) return codedError('revoked', 401, 'Google rejected the token — please connect Google again.');
  if (status === 403) {
    if (/insufficient|scope/i.test(String(text))) return codedError('insufficient-scope', 403, RECONSENT_READ_MSG);
    if (/rateLimit|quota/i.test(String(text))) return codedError('quota', 429, 'Google Drive quota or rate limit hit — try again in a minute.');
    return codedError('forbidden', 403, 'This Google account cannot see that Drive item.');
  }
  if (status === 404) return codedError('not-found', 404, 'No such Drive item, or this Google account cannot see it.');
  if (status === 429) return codedError('quota', 429, 'Google Drive rate limit hit — try again in a minute.');
  return codedError('google-error', 502, 'Drive request failed (' + status + ').');
}

var DRIVE_COMMON = 'supportsAllDrives=true&includeItemsFromAllDrives=true';

// List a folder. `ref` may be a share URL or a bare id. By default returns only animated-GIF
// candidates — animated GIFs and the short video loops the team keeps as MP4/MOV/WebM
// (e.g. Gifs/Running.mp4); pass { all: true } to list everything, or { mimeTypes: [...] }.
var ANIMATION_MIMES = ['image/gif', 'video/mp4', 'video/quicktime', 'video/webm'];
async function listFolder(ref, opts) {
  opts = opts || {};
  var sess = resolveSession(opts.session);
  if (!canReadDrive(sess.scopes)) throw codedError('needs-reconsent', 403, RECONSENT_READ_MSG);
  var token = await ensureToken(sess);

  var folderId = parseFolderRef(ref);
  if (!folderId) throw new Error('That does not look like a Google Drive folder link or id.');

  var mimes = opts.all ? null : (opts.mimeTypes && opts.mimeTypes.length ? opts.mimeTypes : ANIMATION_MIMES);
  var q = "'" + folderId.replace(/'/g, "\\'") + "' in parents and trashed = false";
  if (mimes) q += ' and (' + mimes.map(function (m) { return "mimeType = '" + m.replace(/'/g, "\\'") + "'"; }).join(' or ') + ')';

  var fields = 'nextPageToken,files(id,name,mimeType,size,modifiedTime,md5Checksum,imageMediaMetadata(width,height),videoMediaMetadata(width,height,durationMillis),webViewLink,thumbnailLink)';
  var out = [];
  var pageToken = '';
  var guard = 0;
  do {
    var path_ = '/drive/v3/files?' + DRIVE_COMMON +
      '&q=' + encodeURIComponent(q) +
      '&fields=' + encodeURIComponent(fields) +
      '&orderBy=' + encodeURIComponent('folder,name_natural') +
      '&pageSize=200' + (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    var r = await getJson('www.googleapis.com', path_, token);
    if (r.status !== 200 || !r.json) throw driveError(r.status, r.text);
    (r.json.files || []).forEach(function (f) {
      out.push({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size != null ? Number(f.size) : null,
        modifiedTime: f.modifiedTime || null,
        width: (f.imageMediaMetadata && f.imageMediaMetadata.width) || (f.videoMediaMetadata && f.videoMediaMetadata.width) || null,
        height: (f.imageMediaMetadata && f.imageMediaMetadata.height) || (f.videoMediaMetadata && f.videoMediaMetadata.height) || null,
        durationMillis: (f.videoMediaMetadata && f.videoMediaMetadata.durationMillis != null) ? Number(f.videoMediaMetadata.durationMillis) : null,
        webViewLink: f.webViewLink || null
      });
    });
    pageToken = r.json.nextPageToken || '';
  } while (pageToken && ++guard < 25);

  // Folder name, for a friendlier UI. Non-fatal if it fails.
  var folderName = null;
  try {
    var fm = await getJson('www.googleapis.com', '/drive/v3/files/' + encodeURIComponent(folderId) + '?' + DRIVE_COMMON + '&fields=id,name,mimeType', token);
    if (fm.status === 200 && fm.json) {
      if (fm.json.mimeType && fm.json.mimeType !== 'application/vnd.google-apps.folder') throw new Error('That Drive link points at a file, not a folder.');
      folderName = fm.json.name || null;
    }
  } catch (e) { if (/points at a file/.test(e.message)) throw e; }

  return { folderId: folderId, folderName: folderName, count: out.length, files: out, email: sess.email || null };
}

async function fileMeta(ref, fileRef) {
  var sess = resolveSession(ref);
  if (!canReadDrive(sess.scopes)) throw codedError('needs-reconsent', 403, RECONSENT_READ_MSG);
  var token = await ensureToken(sess);
  var id = parseFileRef(fileRef);
  if (!id) throw new Error('That does not look like a Google Drive file link or id.');
  var r = await getJson('www.googleapis.com', '/drive/v3/files/' + encodeURIComponent(id) + '?' + DRIVE_COMMON + '&fields=' + encodeURIComponent('id,name,mimeType,size,modifiedTime,parents,imageMediaMetadata(width,height),videoMediaMetadata(width,height,durationMillis)'), token);
  if (r.status !== 200 || !r.json) throw driveError(r.status, r.text);
  var f = r.json;
  var im = f.imageMediaMetadata || {}, vm = f.videoMediaMetadata || {};
  return {
    id: f.id, name: f.name, mimeType: f.mimeType,
    size: f.size != null ? Number(f.size) : null,
    modifiedTime: f.modifiedTime || null,
    parents: f.parents || [],
    width: im.width || vm.width || null,
    height: im.height || vm.height || null,
    durationMillis: vm.durationMillis != null ? Number(vm.durationMillis) : null
  };
}

// Download a file's bytes. Google-native docs (Docs/Sheets/Slides) have no bytes to download and
// are rejected with a clear message rather than a confusing 403.
async function downloadFile(ref, fileRef) {
  var sess = resolveSession(ref);
  if (!canReadDrive(sess.scopes)) throw codedError('needs-reconsent', 403, RECONSENT_READ_MSG);
  var token = await ensureToken(sess);
  var meta = await fileMeta(ref, fileRef);
  if (/^application\/vnd\.google-apps\./.test(meta.mimeType)) throw new Error('"' + meta.name + '" is a Google-native file, not a downloadable asset.');
  if (meta.size != null && meta.size > MAX_DRIVE_BYTES) throw new Error('"' + meta.name + '" is ' + Math.round(meta.size / 1048576) + ' MB, over the ' + Math.round(MAX_DRIVE_BYTES / 1048576) + ' MB download limit.');

  var r = await getBuffer('www.googleapis.com', '/drive/v3/files/' + encodeURIComponent(meta.id) + '?alt=media&' + DRIVE_COMMON, token);
  if (r.status !== 200) throw driveError(r.status, r.buffer && r.buffer.toString('utf8').slice(0, 200));
  return { buffer: r.buffer, name: meta.name, mimeType: meta.mimeType, size: r.buffer.length, width: meta.width, height: meta.height };
}

module.exports = {
  configured: configured,
  newSession: newSession,
  handleCallback: handleCallback,
  status: status,
  logout: logout,
  readSheet: readSheet,
  listFolder: listFolder,
  fileMeta: fileMeta,
  downloadFile: downloadFile,
  parseFolderRef: parseFolderRef,
  parseFileRef: parseFileRef,
  tokenFor: tokenFor,
  accessToken: accessToken,
  sessionKey: function (ref) { return liveKey(String(ref || '')); },   // a hash, safe to use as a rate-limit key
  canReadDrive: canReadDrive,
  canWriteDrive: canWriteDrive,
  scopeList: scopeList,
  SCOPE_DRIVE: SCOPE_DRIVE,
  SCOPE_DRIVE_READONLY: SCOPE_DRIVE_READONLY,
  REDIRECT_URI: REDIRECT_URI,
  SCOPES: SCOPES,
  SCOPE_LIST: SCOPE_LIST,
  CLIENT_ID: CLIENT_ID
};
