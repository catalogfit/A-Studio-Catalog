/* =============================================================================================
   plugin-src/ui/platform.js — shared foundation of the plugin UI.  OWNED BY THE PLATFORM.
   Panels (ui/automate.js, ui/design.js, ui/export.js) call what is defined here and never edit it.

   What lives here (full reference: plugin-src/BUILD.md "API for panels"):
     constants      BACKEND_DEFAULT, TEMPLATES_PATH
     state          the shared state object (panels may add their OWN fields, prefixed or documented)
     helpers        $, esc, PlatformError, errorText
     bus            in-UI events: init, registry, selection, page, tab, rows-changed, auth
     bridge         sandbox messaging: send(type, payload), on(type, fn), request(type, payload)
     backend        the A+ backend: url(), get(path), post(path, body)
     auth           Google session + short-lived access token: getAccessToken(), tokenInfo()
     googleFetch    authorised fetch to Google APIs with retry + error mapping
     drive          list / get / download / findOrCreateFolder / ensurePath / upload / update / trash
     sheets         read(urlOrId, { range })
     templateStore  list / cached / load / loadAsset / save / remove — "Cult A+ Design Lab/Templates"
     userTemplates  the user's own templates across this computer / Drive / a file (docs/user-templates.md)
     storage        small per-user prefs in figma.clientStorage (namespaced "ui:")
     ui             note(), toast(), errorText()
     files          save(), toB64(), fromB64(), fmtBytes()
     registry       catById, genderById, activeTemplate, hasFeature, genderReady, registryCats,
                    setRegistry, refreshRegistry, mergeRegistry, fetchManifest
     sheet model    sheetSchema, parseTable, words, parseCatGender
     Panels         each panel publishes its public API on Panels.<name>

   Security: the Google access token lives only in this iframe's memory (never clientStorage, never
   logged, never put in a URL). The refresh token never reaches the plugin at all.
   ============================================================================================= */

// ---------- constants ----------
// The one backend URL. A developer can point a build at another backend without a UI field:
// set figma.clientStorage "backendUrl" (from the plugin console: aplusDev.setBackend(url)).
var BACKEND_DEFAULT = 'https://cult-aplus-backend.onrender.com';
// The user's own template library, created in their My Drive on first save.
var TEMPLATES_PATH = ['Cult A+ Design Lab', 'Templates'];

// ---------- shared state ----------
// Platform-owned fields are listed here. Panels add their own fields from their own files
// (automate: cat/gender/templateId/src/rows/…; export: gifRules/exportFolder/…) — see BUILD.md.
var state = {
  backend: BACKEND_DEFAULT, backendOverride: false,
  session: '', googleEmail: null, poll: null, needsReconsent: false, driveAccess: null,
  registry: null, bundledRegistry: null, manifestCache: {}, manifestSource: {},
  userTemplates: [],          // merged rows from userTemplates (this computer + Drive) — see below
  selection: { frames: [], ids: [] },
  pageId: null, pageName: '',
  activeTab: 'automate',
  pending: {}
};
var Panels = {};   // Panels.automate / Panels.design / Panels.export — each panel's public API

var $ = function (id) { return document.getElementById(id); };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };

// ---------- errors ----------
// Every platform call rejects with a PlatformError: { code, message (user-facing), status, detail }.
// Codes: no-session, invalid-session, revoked, needs-reconsent, insufficient-scope, quota,
// rate-limited, not-found, forbidden, network, backend-unreachable, backend-error, google-error,
// timeout, bad-request, not-configured.
function PlatformError(code, message, extra) {
  var e = new Error(message || code);
  e.name = 'PlatformError';
  e.code = code;
  if (extra) for (var k in extra) e[k] = extra[k];
  return e;
}
var ERROR_TEXT = {
  'no-session': 'You are not signed in to Google. Sign in again.',
  'invalid-session': 'Your Google sign-in is no longer valid. Disconnect, then continue with Google again.',
  'revoked': 'Your Google sign-in expired or was revoked. Disconnect, then continue with Google again.',
  'needs-reconsent': 'Google needs you to approve the plugin\'s new Drive permission once. Disconnect, then continue with Google again.',
  'insufficient-scope': 'This Google sign-in does not include the permission this needs. Disconnect, then continue with Google again to grant it.',
  'quota': 'Google says this account has hit a Drive quota or rate limit. Wait a minute and try again, or free up Drive storage.',
  'rate-limited': 'Too many requests in a short time. Wait a few seconds and try again.',
  'not-found': 'That Drive item does not exist, or this Google account cannot see it.',
  'forbidden': 'This Google account does not have access to that item.',
  'network': 'Could not reach Google. Check your connection and try again.',
  'backend-unreachable': 'Could not reach the A+ service. If nobody has used it for a while it can take up to a minute to wake up. Try again shortly.',
  'backend-error': 'The A+ service had a problem. Try again in a moment.',
  'google-error': 'Google returned an unexpected error. Try again in a moment.',
  'timeout': 'That took too long and was stopped. Try again.',
  'not-configured': 'Google sign-in is not configured on the A+ service.'
};
function errorText(e) {
  if (!e) return 'Unknown error.';
  if (e.code && e.userMessage) return e.userMessage;
  if (e.code && ERROR_TEXT[e.code] && !e.keepMessage) return ERROR_TEXT[e.code];
  return String(e.message || e);
}
var AUTH_CODES = { 'no-session': 1, 'invalid-session': 1, 'revoked': 1, 'needs-reconsent': 1, 'insufficient-scope': 1 };

// ---------- event bus (UI-internal) ----------
// Events: init(msg) · registry(reg) · selection(sel) · page({id,name,frameCount}) · tab(name)
//         rows-changed() · auth({connected, email, needsReconsent}) · auth-error(err)
//         user-templates(rows) — the user's own templates changed (saved, imported, deleted, Drive listed)
var bus = (function () {
  var h = {};
  return {
    on: function (evt, fn) { (h[evt] = h[evt] || []).push(fn); return function () { bus.off(evt, fn); }; },
    off: function (evt, fn) { h[evt] = (h[evt] || []).filter(function (f) { return f !== fn; }); },
    emit: function (evt, data) {
      (h[evt] || []).slice().forEach(function (fn) {
        try { fn(data); } catch (e) { console.error('[bus:' + evt + ']', e); }
      });
    }
  };
})();

// ---------- sandbox bridge ----------
// send(type, payload)        fire-and-forget to plugin-src/main*.js
// on(type, fn)               subscribe to a sandbox message type (several subscribers allowed)
// request(type, payload, {timeoutMs})  -> Promise of the sandbox's reply (core sends
//                            { type: 'reply', reqId, ok, result | error }); see main.js replyTo().
var bridge = (function () {
  var handlers = {}, waiting = {}, seq = 0;
  function send(type, payload) {
    var m = {};
    if (payload) for (var k in payload) m[k] = payload[k];
    m.type = type;
    parent.postMessage({ pluginMessage: m }, '*');
  }
  function on(type, fn) { (handlers[type] = handlers[type] || []).push(fn); return function () { handlers[type] = (handlers[type] || []).filter(function (f) { return f !== fn; }); }; }
  function request(type, payload, opts) {
    var reqId = 'rq' + (++seq) + '-' + Date.now().toString(36);
    var timeoutMs = (opts && opts.timeoutMs) || 30000;
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () {
        delete waiting[reqId];
        reject(PlatformError('timeout', 'The plugin code did not answer "' + type + '" within ' + Math.round(timeoutMs / 1000) + ' s. Rebuild with node plugin-src/build.js and reopen the plugin.'));
      }, timeoutMs);
      waiting[reqId] = { resolve: resolve, reject: reject, t: t };
      var p = {}; if (payload) for (var k in payload) p[k] = payload[k];
      p.reqId = reqId;
      send(type, p);
    });
  }
  function dispatch(m) {
    if (m.type === 'reply' && m.reqId && waiting[m.reqId]) {
      var w = waiting[m.reqId]; delete waiting[m.reqId]; clearTimeout(w.t);
      if (m.ok === false) w.reject(PlatformError(m.code || 'sandbox-error', m.error || 'The plugin code reported an error.'));
      else w.resolve(m.result);
      return;
    }
    (handlers[m.type] || []).slice().forEach(function (fn) {
      try {
        var r = fn(m);
        if (r && typeof r.then === 'function') r.catch(function (e) { console.error('[bridge:' + m.type + ']', e); });
      } catch (e) { console.error('[bridge:' + m.type + ']', e); }
    });
  }
  window.onmessage = function (e) {
    var m = e.data && e.data.pluginMessage;
    if (!m || typeof m !== 'object' || !m.type) return;
    dispatch(m);
  };
  return { send: send, on: on, request: request, _dispatch: dispatch };
})();

// ---------- the A+ backend ----------
// Only small JSON goes here: OAuth, token minting, GIF rules, template registry, LLM labelling.
// Bytes (frames, GIFs, videos, ZIPs) never do — those go device <-> Google directly.
var backend = (function () {
  function url() { return String(state.backend || BACKEND_DEFAULT).replace(/\/+$/, ''); }
  async function call(method, path, body, opts) {
    opts = opts || {};
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    // Render Free sleeps when idle; a cold start can take ~60 s, so the default is generous.
    var timeoutMs = opts.timeoutMs || 75000;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs) : null;
    var res;
    try {
      res = await fetch(url() + path, {
        method: method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ctrl ? ctrl.signal : undefined
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw PlatformError('timeout', ERROR_TEXT.timeout);
      throw PlatformError('backend-unreachable', ERROR_TEXT['backend-unreachable'], { detail: String(e && e.message || e) });
    } finally { if (timer) clearTimeout(timer); }
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      var code = (data && data.code) || (res.status === 401 ? 'no-session' : res.status === 429 ? 'rate-limited'
        : res.status === 404 ? 'not-found' : res.status >= 500 ? 'backend-error' : 'bad-request');
      var err = PlatformError(code, (data && data.error) || ('HTTP ' + res.status), { status: res.status, data: data });
      // keep the server's own wording for request-specific problems; map auth/infra ones
      if (!ERROR_TEXT[code]) err.keepMessage = true;
      if (AUTH_CODES[code]) bus.emit('auth-error', err);
      throw err;
    }
    return data;
  }
  return {
    url: url,
    get: function (path, opts) { return call('GET', path, undefined, opts); },
    post: function (path, body, opts) { return call('POST', path, body || {}, opts); }
  };
})();

// ---------- Google session + access token ----------
var auth = (function () {
  var cache = null;       // { token, expiresAt, scopes, driveAccess, needsReconsent } — memory only
  var inflight = null;
  async function getAccessToken(opts) {
    if (!state.session) throw PlatformError('no-session', ERROR_TEXT['no-session']);
    var force = opts && opts.force;
    if (!force && cache && cache.session === state.session && Date.now() < cache.expiresAt - 120000) return cache.token;
    if (inflight) return inflight;
    inflight = (async function () {
      try {
        var r = await backend.post('/auth/token', { session: state.session });
        if (!r || !r.accessToken) throw PlatformError('backend-error', 'The A+ service did not return a Google token.');
        cache = {
          session: state.session, token: r.accessToken,
          expiresAt: Number(r.expiresAt) || (Date.now() + 50 * 60000),
          scopes: r.scopes || [], driveAccess: r.driveAccess || null, needsReconsent: !!r.needsReconsent
        };
        state.driveAccess = cache.driveAccess;
        return cache.token;
      } finally { inflight = null; }
    })();
    return inflight;
  }
  return {
    getAccessToken: getAccessToken,
    // what the token can do — never the token itself
    tokenInfo: function () { return cache ? { expiresAt: cache.expiresAt, scopes: cache.scopes.slice(), driveAccess: cache.driveAccess, needsReconsent: cache.needsReconsent } : null; },
    clearToken: function () { cache = null; },
    session: function () { return state.session; },
    email: function () { return state.googleEmail; },
    isConnected: function () { return !!(state.session && state.googleEmail); }
  };
})();

// ---------- authorised fetch to Google APIs ----------
// opts: { method, headers, body, as: 'json' | 'arrayBuffer' | 'text' | 'response', retries }
// Retries: one token refresh on 401; up to 3 backoffs on 429 / 5xx / rate-limit 403s.
async function googleFetch(url, opts) {
  opts = opts || {};
  var as = opts.as || 'json';
  var maxRetries = opts.retries === undefined ? 3 : opts.retries;
  var refreshed = false, forceToken = false;
  for (var attempt = 0; ; attempt++) {
    var token = await auth.getAccessToken({ force: forceToken });
    forceToken = false;
    var headers = {};
    if (opts.headers) for (var k in opts.headers) headers[k] = opts.headers[k];
    headers.Authorization = 'Bearer ' + token;
    var res;
    try {
      res = await fetch(url, { method: opts.method || 'GET', headers: headers, body: opts.body });
    } catch (e) {
      if (attempt < maxRetries) { await sleep(backoff(attempt)); continue; }
      throw PlatformError('network', ERROR_TEXT.network, { detail: String(e && e.message || e) });
    }
    if (res.ok) {
      if (as === 'response') return res;
      if (as === 'arrayBuffer') return new Uint8Array(await res.arrayBuffer());
      if (as === 'text') return res.text();
      if (res.status === 204) return null;
      return res.json();
    }
    var info = await googleErrorInfo(res);
    if (res.status === 401 && !refreshed) {
      refreshed = true; auth.clearToken(); forceToken = true; continue;
    }
    var retryable = res.status === 429 || res.status >= 500 ||
      (res.status === 403 && /rateLimitExceeded|userRateLimitExceeded|RATE_LIMIT/i.test(info.reasons));
    if (retryable && attempt < maxRetries) {
      var ra = Number(res.headers.get('Retry-After'));
      await sleep(ra > 0 ? Math.min(ra * 1000, 20000) : backoff(attempt));
      continue;
    }
    var err = mapGoogleError(res.status, info);
    if (AUTH_CODES[err.code]) bus.emit('auth-error', err);
    throw err;
  }
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function backoff(attempt) { return Math.min(8000, 600 * Math.pow(2, attempt)) + Math.floor(Math.random() * 250); }
async function googleErrorInfo(res) {
  var text = '';
  try { text = await res.text(); } catch (e) {}
  var j = null; try { j = JSON.parse(text); } catch (e) {}
  var er = (j && j.error) || {};
  var reasons = []
    .concat((er.errors || []).map(function (x) { return x.reason; }))
    .concat((er.details || []).map(function (x) { return x.reason; }))
    .concat([er.status]).filter(Boolean).join(' ');
  return { message: er.message || text.slice(0, 200), reasons: reasons };
}
function mapGoogleError(status, info) {
  var r = info.reasons || '';
  var extra = { status: status, detail: info.message, reasons: r };
  if (status === 401) return PlatformError('revoked', ERROR_TEXT.revoked, extra);
  if (status === 403) {
    if (/insufficientPermissions|ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficient.?scope/i.test(r + ' ' + info.message)) return PlatformError('insufficient-scope', ERROR_TEXT['insufficient-scope'], extra);
    if (/storageQuotaExceeded|dailyLimitExceeded|quotaExceeded|rateLimitExceeded|userRateLimitExceeded|RATE_LIMIT/i.test(r)) return PlatformError('quota', ERROR_TEXT.quota, extra);
    if (/fileNotDownloadable|cannotDownloadAbusiveFile/i.test(r)) return PlatformError('forbidden', 'Google will not let this file be downloaded (' + r + ').', extra);
    return PlatformError('forbidden', ERROR_TEXT.forbidden, extra);
  }
  if (status === 404) return PlatformError('not-found', ERROR_TEXT['not-found'], extra);
  if (status === 429) return PlatformError('quota', ERROR_TEXT.quota, extra);
  if (status === 400) return PlatformError('bad-request', 'Google rejected the request: ' + (info.message || 'bad request'), extra);
  return PlatformError('google-error', ERROR_TEXT['google-error'], extra);
}

// ---------- Drive (direct, with the user's token) ----------
var drive = (function () {
  var API = 'https://www.googleapis.com/drive/v3';
  var UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
  var COMMON = 'supportsAllDrives=true&includeItemsFromAllDrives=true';
  var FIELDS = 'id,name,mimeType,size,modifiedTime,parents,md5Checksum,appProperties,trashed,' +
    'imageMediaMetadata(width,height),videoMediaMetadata(width,height,durationMillis),webViewLink';
  var FOLDER = 'application/vnd.google-apps.folder';
  var MULTIPART_MAX = 5 * 1024 * 1024;   // Google's recommended ceiling for multipart; above it, resumable
  var folderCache = {};                  // "<parent>/<name>" -> id, for this session

  // Any Drive link shape, or a bare id.
  function parseId(input) {
    var s = String(input || '').trim();
    if (!s) return null;
    var m = s.match(/\/folders\/([a-zA-Z0-9_-]+)/) || s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      s.match(/\/d\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m) return m[1];
    if (/^[a-zA-Z0-9_-]{10,}$/.test(s) || s === 'root') return s;
    return null;
  }
  function q(s) { return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }
  function norm(f) {
    if (!f) return f;
    var im = f.imageMediaMetadata || {}, vm = f.videoMediaMetadata || {};
    return {
      id: f.id, name: f.name, mimeType: f.mimeType,
      size: f.size != null ? Number(f.size) : null,
      modifiedTime: f.modifiedTime || null, parents: f.parents || [],
      md5Checksum: f.md5Checksum || null, appProperties: f.appProperties || {},
      width: im.width || vm.width || null, height: im.height || vm.height || null,
      durationMillis: vm.durationMillis != null ? Number(vm.durationMillis) : null,
      webViewLink: f.webViewLink || null, isFolder: f.mimeType === FOLDER
    };
  }
  // query(qString, { orderBy, pageSize, max, fields }) -> normalized files, all pages
  async function query(qs, opts) {
    opts = opts || {};
    var out = [], token = '', guard = 0, max = opts.max || 5000;
    do {
      var url = API + '/files?' + COMMON + '&q=' + encodeURIComponent(qs) +
        '&fields=' + encodeURIComponent('nextPageToken,files(' + (opts.fields || FIELDS) + ')') +
        '&pageSize=' + (opts.pageSize || 200) + (opts.orderBy ? '&orderBy=' + encodeURIComponent(opts.orderBy) : '') +
        (opts.spaces ? '&spaces=' + encodeURIComponent(opts.spaces) : '') +
        (token ? '&pageToken=' + encodeURIComponent(token) : '');
      var r = await googleFetch(url);
      (r.files || []).forEach(function (f) { out.push(norm(f)); });
      token = r.nextPageToken || '';
    } while (token && out.length < max && ++guard < 50);
    return out;
  }
  // list(folder, { mimeTypes, foldersOnly, orderBy }) — folder = link or id; children, not recursive
  async function list(folder, opts) {
    opts = opts || {};
    var id = parseId(folder);
    if (!id) throw PlatformError('bad-request', 'That does not look like a Google Drive folder link or id.');
    var qs = q(id) + ' in parents and trashed = false';
    if (opts.mimeTypes && opts.mimeTypes.length) qs += ' and (' + opts.mimeTypes.map(function (m) { return 'mimeType = ' + q(m); }).join(' or ') + ')';
    if (opts.foldersOnly) qs += ' and mimeType = ' + q(FOLDER);
    return query(qs, { orderBy: opts.orderBy || 'folder,name_natural' });
  }
  async function get(fileId, fields) {
    var id = parseId(fileId);
    if (!id) throw PlatformError('bad-request', 'That does not look like a Google Drive file link or id.');
    return norm(await googleFetch(API + '/files/' + encodeURIComponent(id) + '?' + COMMON + '&fields=' + encodeURIComponent(fields || FIELDS)));
  }
  // download(fileId, { onProgress(loaded, total) }) -> Uint8Array. Bytes go Google -> this iframe.
  async function download(fileId, opts) {
    var id = parseId(fileId);
    if (!id) throw PlatformError('bad-request', 'That does not look like a Google Drive file link or id.');
    var res = await googleFetch(API + '/files/' + encodeURIComponent(id) + '?alt=media&' + COMMON, { as: 'response' });
    var total = Number(res.headers.get('Content-Length')) || 0;
    if (!(opts && opts.onProgress) || !res.body || !res.body.getReader) return new Uint8Array(await res.arrayBuffer());
    var reader = res.body.getReader(), chunks = [], loaded = 0;
    for (;;) {
      var step = await reader.read();
      if (step.done) break;
      chunks.push(step.value); loaded += step.value.length;
      try { opts.onProgress(loaded, total); } catch (e) {}
    }
    var out = new Uint8Array(loaded), o = 0;
    chunks.forEach(function (c) { out.set(c, o); o += c.length; });
    return out;
  }
  // findOrCreateFolder(parentId | 'root', name, { appProperties }) -> { id, name, created }
  async function findOrCreateFolder(parentId, name, opts) {
    var parent = parseId(parentId || 'root') || 'root';
    var ck = parent + '/' + name;
    if (folderCache[ck]) return { id: folderCache[ck], name: name, created: false };
    var hits = await query(q(parent) + ' in parents and name = ' + q(name) + ' and mimeType = ' + q(FOLDER) + ' and trashed = false',
      { orderBy: 'createdTime', pageSize: 10, max: 10 });
    if (hits.length) { folderCache[ck] = hits[0].id; return { id: hits[0].id, name: name, created: false }; }
    var meta = { name: name, mimeType: FOLDER, parents: [parent] };
    if (opts && opts.appProperties) meta.appProperties = opts.appProperties;
    var f = await googleFetch(API + '/files?supportsAllDrives=true&fields=' + encodeURIComponent(FIELDS), {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(meta)
    });
    folderCache[ck] = f.id;
    return { id: f.id, name: name, created: true };
  }
  // ensurePath(['A', 'B'], { parent: 'root' }) -> id of B, creating any missing folder
  async function ensurePath(names, opts) {
    var id = (opts && opts.parent) || 'root';
    for (var i = 0; i < names.length; i++) id = (await findOrCreateFolder(id, names[i])).id;
    return id;
  }
  // findPath(['A','B']) -> id or null, never creates anything
  async function findPath(names, opts) {
    var id = (opts && opts.parent) || 'root';
    for (var i = 0; i < names.length; i++) {
      var ck = id + '/' + names[i];
      if (folderCache[ck]) { id = folderCache[ck]; continue; }
      var hits = await query(q(id) + ' in parents and name = ' + q(names[i]) + ' and mimeType = ' + q(FOLDER) + ' and trashed = false',
        { orderBy: 'createdTime', pageSize: 10, max: 10 });
      if (!hits.length) return null;
      folderCache[ck] = id = hits[0].id;
    }
    return id;
  }

  function toBlobPart(bytes) {
    if (bytes instanceof Blob) return bytes;
    if (typeof bytes === 'string') return bytes;
    return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  }
  function sizeOf(bytes) { return bytes instanceof Blob ? bytes.size : (typeof bytes === 'string' ? new Blob([bytes]).size : bytes.byteLength); }

  // XHR, not fetch, so uploads can report progress. Auth/error handling mirrors googleFetch.
  function xhr(method, url, headers, body, onProgress) {
    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest();
      x.open(method, url, true);
      for (var k in headers) x.setRequestHeader(k, headers[k]);
      if (onProgress && x.upload) x.upload.onprogress = function (ev) { try { onProgress(ev.loaded, ev.total); } catch (e) {} };
      x.onload = function () { resolve({ status: x.status, text: x.responseText, header: function (h) { return x.getResponseHeader(h); } }); };
      x.onerror = function () { reject(PlatformError('network', ERROR_TEXT.network)); };
      x.send(body);
    });
  }
  async function authedXhr(method, url, headers, body, onProgress) {
    var refreshed = false, forceToken = false;
    for (var attempt = 0; attempt < 4; attempt++) {
      var token = await auth.getAccessToken({ force: forceToken });
      forceToken = false;
      var h = {}; for (var k in headers) h[k] = headers[k];
      h.Authorization = 'Bearer ' + token;
      var r = await xhr(method, url, h, body, onProgress);
      if (r.status >= 200 && r.status < 300) return r;
      if (r.status === 308) return r;   // resumable: "resume incomplete"
      var info = { message: '', reasons: '' };
      try { var j = JSON.parse(r.text); var er = j.error || {}; info.message = er.message || ''; info.reasons = [].concat((er.errors || []).map(function (x) { return x.reason; })).concat((er.details || []).map(function (x) { return x.reason; })).concat([er.status]).filter(Boolean).join(' '); } catch (e) { info.message = String(r.text || '').slice(0, 200); }
      if (r.status === 401 && !refreshed) { refreshed = true; auth.clearToken(); forceToken = true; continue; }
      if ((r.status === 429 || r.status >= 500) && attempt < 3) { await sleep(backoff(attempt)); continue; }
      var err = mapGoogleError(r.status, info);
      if (AUTH_CODES[err.code]) bus.emit('auth-error', err);
      throw err;
    }
    throw PlatformError('google-error', ERROR_TEXT['google-error']);
  }

  // upload(parentId, name, mime, bytes, { fileId, appProperties, description, onProgress })
  //   -> normalized file. With fileId: replaces that file's content (and name/appProperties).
  //   <= 5 MB: one multipart request.  > 5 MB: resumable session, sent in 8 MB chunks.
  async function upload(parentId, name, mime, bytes, opts) {
    opts = opts || {};
    mime = mime || 'application/octet-stream';
    var meta = { name: name };
    if (!opts.fileId) meta.parents = [parseId(parentId || 'root') || 'root'];
    if (opts.appProperties) meta.appProperties = opts.appProperties;
    if (opts.description) meta.description = opts.description;
    if (!opts.fileId) meta.mimeType = mime;
    var size = sizeOf(bytes);
    var method = opts.fileId ? 'PATCH' : 'POST';
    var base = UPLOAD + '/files' + (opts.fileId ? '/' + encodeURIComponent(opts.fileId) : '');
    var fields = '&supportsAllDrives=true&fields=' + encodeURIComponent(FIELDS);

    if (size <= MULTIPART_MAX && !opts.forceResumable) {
      var boundary = 'aplus' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      var body = new Blob([
        '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n',
        '--' + boundary + '\r\nContent-Type: ' + mime + '\r\n\r\n', toBlobPart(bytes), '\r\n--' + boundary + '--'
      ]);
      var r = await authedXhr(method, base + '?uploadType=multipart' + fields,
        { 'Content-Type': 'multipart/related; boundary=' + boundary }, body, opts.onProgress);
      return norm(JSON.parse(r.text));
    }

    // resumable: open a session, then PUT the bytes in 256 KB-aligned chunks
    var start = await authedXhr(method, base + '?uploadType=resumable' + fields, {
      'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(size)
    }, JSON.stringify(meta));
    var session = start.header('Location') || start.header('location');
    if (!session) throw PlatformError('google-error', 'Google did not return an upload session URL (the Location header was not readable).');
    var blob = bytes instanceof Blob ? bytes : new Blob([toBlobPart(bytes)]);
    var CHUNK = 8 * 1024 * 1024, offset = 0, last = null;
    while (offset < size) {
      var end = Math.min(size, offset + CHUNK);
      var off0 = offset;
      last = await authedXhr('PUT', session, { 'Content-Range': 'bytes ' + offset + '-' + (end - 1) + '/' + size },
        blob.slice(offset, end), opts.onProgress ? function (l) { opts.onProgress(off0 + l, size); } : null);
      if (last.status === 308) {
        var range = last.header('Range');   // "bytes=0-1234"; if unreadable, assume the chunk landed
        offset = range ? Number(String(range).split('-')[1]) + 1 : end;
      } else offset = end;
    }
    return norm(JSON.parse(last.text));
  }
  // update(fileId, metadata) — rename, move, set appProperties, trash
  async function update(fileId, metadata, opts) {
    var qs = '?supportsAllDrives=true&fields=' + encodeURIComponent(FIELDS);
    if (opts && opts.addParents) qs += '&addParents=' + encodeURIComponent(opts.addParents);
    if (opts && opts.removeParents) qs += '&removeParents=' + encodeURIComponent(opts.removeParents);
    return norm(await googleFetch(API + '/files/' + encodeURIComponent(fileId) + qs, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(metadata || {})
    }));
  }
  // trash(fileId) — reversible (Drive bin), never a hard delete. Forgets cached folder ids: a
  // trashed folder must not be handed out again by findOrCreateFolder (files put in it vanish).
  async function trash(fileId) { var r = await update(fileId, { trashed: true }); folderCache = {}; return r; }

  return {
    parseId: parseId, quote: q, query: query, list: list, get: get, download: download,
    findOrCreateFolder: findOrCreateFolder, ensurePath: ensurePath, findPath: findPath,
    upload: upload, update: update, trash: trash, FOLDER_MIME: FOLDER,
    _forgetFolders: function () { folderCache = {}; }
  };
})();

// ---------- Sheets (direct, read-only) ----------
var sheets = (function () {
  var API = 'https://sheets.googleapis.com/v4/spreadsheets/';
  function parseUrl(input) {
    var s = String(input || '').trim();
    var id = (s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/) || [])[1] || (/^[a-zA-Z0-9-_]{20,}$/.test(s) ? s : null);
    var gid = (s.match(/[#&?]gid=(\d+)/) || [])[1];
    var range = (s.match(/[#&?]range=([^&#\s]+)/i) || [])[1];
    try { if (range) range = decodeURIComponent(range); } catch (e) {}
    return { id: id, gid: gid != null ? Number(gid) : null, range: range || null, published: /\/d\/e\//.test(s) };
  }
  // read(urlOrId, { range: 'A5:J9' }) -> { rows, tab, spreadsheetId, title }
  // The whole tab by default (the link's gid picks the tab); `range` is optional A1 within it.
  async function read(urlOrId, opts) {
    var p = parseUrl(urlOrId);
    if (!p.id || p.published) throw PlatformError('bad-request', 'That is not a Google Sheets link.');
    var meta = await googleFetch(API + encodeURIComponent(p.id) + '?fields=' + encodeURIComponent('properties(title),sheets(properties(sheetId,title))'));
    var tabs = (meta.sheets || []).map(function (s) { return s.properties; });
    if (!tabs.length) throw PlatformError('not-found', 'That spreadsheet has no tabs.');
    var tab = tabs[0];
    if (p.gid != null) tab = tabs.filter(function (t) { return t.sheetId === p.gid; })[0] || tab;
    var a1 = "'" + String(tab.title).replace(/'/g, "''") + "'" + (opts && opts.range ? '!' + opts.range : '');
    var vals = await googleFetch(API + encodeURIComponent(p.id) + '/values/' + encodeURIComponent(a1) + '?majorDimension=ROWS');
    return { rows: vals.values || [], tab: tab.title, spreadsheetId: p.id, title: (meta.properties || {}).title || null };
  }
  return { parseUrl: parseUrl, read: read };
})();

// ---------- small per-user prefs (figma.clientStorage via the sandbox, namespaced "ui:") ----------
var storage = {
  get: function (key) { return bridge.request('storage-get', { key: String(key) }, { timeoutMs: 10000 }); },
  set: function (key, value) { return bridge.request('storage-set', { key: String(key), value: value }, { timeoutMs: 10000 }); }
};

// ---------- the user's template library in Google Drive ----------
// Layout in My Drive:
//   Cult A+ Design Lab/Templates/<category>__<gender>__<id>/manifest.json   (+ asset files)
// Every file and folder the store writes carries appProperties (private to this OAuth app):
//   aplusKind = template-folder | template-manifest | template-asset,  aplusKey = "<cat>/<gender>/<id>"
// so lookups never depend on names a user might change. manifest.json is an envelope:
//   { schema: 'aplus.drive-template/1', key, savedAt, manifest, assets: [{ name, mimeType, size, fileId }] }
// figma.clientStorage only CACHES manifests (JSON, no image bytes) — Drive is the source of truth.
var templateStore = (function () {
  var SCHEMA = 'aplus.drive-template/1';
  function keyOf(m) {
    var meta = (m && m.meta) || {};
    var k = meta.key || [meta.category, meta.gender, meta.id].filter(Boolean).join('/');
    if (!/^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/i.test(k)) {
      throw PlatformError('bad-request', 'A template needs meta.key "category/gender/id" (letters, digits, dashes). Got "' + k + '".');
    }
    return k;
  }
  function folderName(key) { return key.replace(/\//g, '__'); }
  function clip(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n) : s; }
  function entryOf(f) {
    var a = f.appProperties || {};
    return {
      key: a.aplusKey, label: a.aplusLabel || a.aplusKey, category: a.aplusCategory || String(a.aplusKey).split('/')[0],
      categoryLabel: a.aplusCatLabel || null, totalBytes: Number(a.aplusBytes) || null,
      gender: a.aplusGender || String(a.aplusKey).split('/')[1], id: a.aplusId || String(a.aplusKey).split('/')[2],
      status: a.aplusStatus || 'draft', version: Number(a.aplusVersion) || 1,
      fileId: f.id, folderId: (f.parents || [])[0] || null, modifiedTime: f.modifiedTime, size: f.size
    };
  }
  function byKind(kind, key) {
    var qs = "appProperties has { key='aplusKind' and value='" + kind + "' } and trashed = false";
    if (key) qs += " and appProperties has { key='aplusKey' and value=" + drive.quote(key) + ' }';
    return drive.query(qs, { pageSize: 200 });
  }
  function cachePut(key, entry, manifest) {
    return bridge.request('tplcache-put', { key: key, entry: entry, manifest: manifest }, { timeoutMs: 10000 }).catch(function (e) { console.warn('[templateStore] cache put failed', e && e.message); });
  }

  // list() -> [entry] from Drive (fresh), and refreshes the sandbox cache index
  async function list() {
    var files = await byKind('template-manifest');
    var entries = files.filter(function (f) { return f.appProperties && f.appProperties.aplusKey; }).map(entryOf);
    bridge.request('tplcache-sync', { keys: entries.map(function (e) { return e.key; }), entries: entries }, { timeoutMs: 10000 }).catch(function () {});
    return entries;
  }
  // cached() -> { index: [entry], manifests: { key: manifest } } from clientStorage; no network
  function cached() { return bridge.request('tplcache-list', {}, { timeoutMs: 10000 }); }
  // load(key, { cache }) -> { key, manifest, assets, savedAt, fileId } — Drive first, cache as fallback offline.
  // cache:false skips the tplcache copy (user templates keep their own copy on this computer).
  async function load(key, opts) {
    var files = await byKind('template-manifest', key);
    if (!files.length) throw PlatformError('not-found', 'No saved template "' + key + '" in your Drive.');
    var f = files[0];
    var bytes = await drive.download(f.id);
    var env = JSON.parse(new TextDecoder().decode(bytes));
    var out = { key: key, manifest: env.manifest || env, assets: env.assets || [], savedAt: env.savedAt || null, fileId: f.id, folderId: (f.parents || [])[0] || null, entry: entryOf(f) };
    if (!(opts && opts.cache === false)) cachePut(key, entryOf(f), out.manifest);
    return out;
  }
  function loadAsset(fileId) { return drive.download(fileId); }

  // save(manifest, assets?, { onProgress, cache }) — assets: [{ name, mimeType, bytes: Uint8Array }].
  // Replaces in place when the key exists (same folder, same file ids where names match). An asset
  // already in the folder with the same name and size is not sent again (user-template images are
  // named by content hash). Assets the manifest still lists in meta.assets are kept even when not
  // passed in; anything else old is trashed.
  async function save(manifest, assets, opts) {
    opts = opts || {};
    var key = keyOf(manifest);
    var meta = manifest.meta || {};
    var rootId = await drive.ensurePath(TEMPLATES_PATH);
    var tag = { aplusKey: key };
    var folders = await byKind('template-folder', key);
    var folderId, replaced = false;
    if (folders.length) { folderId = folders[0].id; replaced = true; }
    else {
      folderId = (await drive.findOrCreateFolder(rootId, folderName(key), { appProperties: { aplusKind: 'template-folder', aplusKey: key } })).id;
    }
    var existing = replaced ? await drive.list(folderId) : [];
    var byName = {}; existing.forEach(function (f) { byName[f.name] = f; });

    var refs = [];
    var list_ = assets || [];
    for (var i = 0; i < list_.length; i++) {
      var a = list_[i];
      if (!a || !a.name || !a.bytes) continue;
      if (a.name === 'manifest.json') throw PlatformError('bad-request', 'An asset cannot be called manifest.json.');
      var prev = byName[a.name];
      var size = a.bytes.byteLength !== undefined ? a.bytes.byteLength : a.bytes.length;
      if (prev && prev.size === size && opts.skipUnchanged !== false) {
        refs.push({ name: a.name, mimeType: a.mimeType || 'application/octet-stream', size: prev.size, fileId: prev.id });
        if (opts.onProgress) opts.onProgress({ step: 'asset', index: i, total: list_.length, loaded: size, size: size, skipped: true });
        continue;
      }
      var up = await drive.upload(folderId, a.name, a.mimeType || 'application/octet-stream', a.bytes, {
        fileId: prev ? prev.id : null,
        appProperties: { aplusKind: 'template-asset', aplusKey: key },
        onProgress: opts.onProgress ? function (l, t) { opts.onProgress({ step: 'asset', index: i, total: list_.length, loaded: l, size: t }); } : null
      });
      refs.push({ name: a.name, mimeType: a.mimeType || 'application/octet-stream', size: up.size, fileId: up.id });
    }
    var keep = {}; refs.forEach(function (r) { keep[r.name] = 1; });
    ((meta.assets) || []).forEach(function (a) {
      if (!a || !a.name || keep[a.name] || !byName[a.name]) return;
      keep[a.name] = 1;
      refs.push({ name: a.name, mimeType: a.mime || 'application/octet-stream', size: byName[a.name].size, fileId: byName[a.name].id });
    });
    for (var n in byName) {
      var f = byName[n];
      if (n !== 'manifest.json' && !keep[n] && f.appProperties && f.appProperties.aplusKind === 'template-asset') {
        try { await drive.trash(f.id); } catch (e) { console.warn('[templateStore] could not trash stale asset', n, e && e.message); }
      }
    }

    var envelope = { schema: SCHEMA, key: key, savedAt: new Date().toISOString(), manifest: manifest, assets: refs };
    var props = {
      aplusKind: 'template-manifest', aplusKey: key,
      aplusLabel: clip(meta.label || key, 90), aplusCategory: clip(meta.category || key.split('/')[0], 60),
      aplusGender: clip(meta.gender || key.split('/')[1], 40), aplusId: clip(meta.id || key.split('/')[2], 60),
      aplusStatus: clip(meta.status || 'draft', 20), aplusVersion: String(meta.version || 1),
      aplusCatLabel: clip(meta.categoryLabel || '', 60),
      aplusBytes: String(refs.reduce(function (n, r) { return n + (Number(r.size) || 0); }, 0) + JSON.stringify(manifest).length)
    };
    var prevM = byName['manifest.json'];
    if (opts.onProgress) opts.onProgress({ step: 'manifest', index: list_.length, total: list_.length });
    var mf = await drive.upload(folderId, 'manifest.json', 'application/json', JSON.stringify(envelope), {
      fileId: prevM ? prevM.id : null, appProperties: props, description: 'Cult A+ Design Lab template ' + key
    });
    var entry = entryOf(mf);
    if (opts.cache !== false) await cachePut(key, entry, manifest);
    return { key: key, fileId: mf.id, folderId: folderId, assets: refs, replaced: replaced, entry: entry };
  }

  // remove(key) — moves the template's folder to the Drive bin (recoverable for 30 days)
  async function remove(key) {
    var folders = await byKind('template-folder', key);
    var manifests = folders.length ? [] : await byKind('template-manifest', key);
    var target = folders[0] || manifests[0];
    if (!target) throw PlatformError('not-found', 'No saved template "' + key + '" in your Drive.');
    await drive.trash(target.id);
    await bridge.request('tplcache-remove', { key: key }, { timeoutMs: 10000 }).catch(function () {});
    return { ok: true, key: key, trashed: target.id };
  }

  return { list: list, cached: cached, load: load, loadAsset: loadAsset, save: save, remove: remove, PATH: TEMPLATES_PATH, SCHEMA: SCHEMA };
})();

// ---------- the user's own templates: this computer + their Drive + a file (never the backend) ----------
// docs/user-templates.md. Three tiers, all belonging to the signed-in user:
//   this computer  figma.clientStorage via the sandbox (usertpl-* messages, user-templates.js) —
//                  index + manifests + images while under the storage budget
//   their Drive    templateStore above, with their own token — "Cult A+ Design Lab/Templates/…"
//   a file         Export / Import of "<key>.aplus-template.json" (manifest + images, base64)
// Rows are merged by key into state.userTemplates and overlaid on the registry (setRegistry), so a
// saved template shows in Automate's and Export's pickers at once and after every restart.
var USER_TEMPLATE_FILE_SCHEMA = 'aplus.template-file/1';
var USER_TEMPLATE_FILE_MAX = 60 * 1024 * 1024;
var USER_KEY_RE = /^[a-z0-9][a-z0-9-]{0,59}\/[a-z0-9][a-z0-9-]{0,39}\/[a-z0-9][a-z0-9-]{0,59}$/;
function slugify(s, max) {
  var out = String(s == null ? '' : s).toLowerCase();
  try { out = out.normalize('NFKD').replace(/[̀-ͯ]/g, ''); } catch (e) {}
  out = out.replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return out.slice(0, max || 60).replace(/-+$/, '');
}
function titleCase(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

var userTemplates = (function () {
  var local = [];          // rows from the sandbox: this computer
  var usage = null;        // { own, foreign, total, budget, quota } bytes
  var driveRows = null;    // null = Drive not listed yet; [] = listed, nothing there
  var driveError = null;
  var driveEnv = {};       // key -> templateStore.load() result, this session

  function merged() {
    var by = {}, order = [];
    function row(k) { if (!by[k]) { by[k] = { key: k, local: null, drive: null }; order.push(k); } return by[k]; }
    local.forEach(function (r) {
      var e = row(r.key);
      ['label', 'category', 'categoryLabel', 'gender', 'id', 'sub', 'savedAt', 'bytes'].forEach(function (f) { e[f] = r[f]; });
      e.local = r.local && r.local.manifest ? r.local : null;
      if (!driveRows && r.drive) e.drive = { fileId: r.drive.fileId, folderId: r.drive.folderId, unverified: true };
    });
    (driveRows || []).forEach(function (d) {
      var e = row(d.key);
      if (!e.label) {
        e.label = d.label; e.category = d.category; e.gender = d.gender; e.id = d.id;
        e.savedAt = d.modifiedTime; e.bytes = d.totalBytes || d.size || 0;
      }
      if (!e.categoryLabel) e.categoryLabel = d.categoryLabel || titleCase(d.category);
      e.drive = { fileId: d.fileId, folderId: d.folderId, modifiedTime: d.modifiedTime, bytes: d.totalBytes || null };
    });
    return order.map(function (k) { return by[k]; })
      .filter(function (e) { return e.local || e.drive; })
      .sort(function (a, b) { return String(a.label || a.key).localeCompare(String(b.label || b.key)); });
  }
  function publish() {
    state.userTemplates = merged();
    if (state.registry) setRegistry(state.registry);     // re-applies the overlay, emits 'registry'
    bus.emit('user-templates', state.userTemplates);
  }
  function find(key) { return (state.userTemplates || []).filter(function (e) { return e.key === key; })[0] || null; }
  function where(e) { return !e ? 'none' : (e.local && e.drive ? 'both' : e.local ? 'computer' : 'drive'); }
  function forget(key) { delete state.manifestCache[key]; delete state.manifestSource[key]; delete driveEnv[key]; }

  function setLocal(r) { if (r) { local = r.index || []; usage = r.usage || usage; } }
  async function refreshLocal() {
    try { setLocal(await bridge.request('usertpl-list', {}, { timeoutMs: 15000 })); }
    catch (e) { console.warn('[userTemplates] could not read this computer\'s templates', e && e.message); }
    publish();
  }
  async function refreshDrive() {
    if (!auth.isConnected()) return;
    try { driveRows = await templateStore.list(); driveError = null; }
    catch (e) { driveError = e; console.warn('[userTemplates] Drive list failed', e && e.message); }
    publish();
  }
  // 'free' | 'user' | 'bundled' — bundled templates can never be replaced by the user's own
  function keyStatus(key) {
    if (find(key)) return 'user';
    var p = String(key).split('/');
    var cat = (state.bundledRegistry && state.bundledRegistry.categories || []).filter(function (c) { return c.id === p[0]; })[0];
    var g = cat && (cat.genders || []).filter(function (x) { return x.id === p[1]; })[0];
    if (g && (g.templates || []).some(function (t) { return t.id === p[2] && !t.user && !t.captured; })) return 'bundled';
    return 'free';
  }
  function suggestFreeId(cat, gender, id) {
    var base = String(id).replace(/-\d+$/, '') || 'template';
    for (var n = 2; n < 200; n++) { var c = (base + '-' + n).slice(0, 60); if (keyStatus(cat + '/' + gender + '/' + c) === 'free') return c; }
    return base + '-' + Date.now().toString(36);
  }

  async function driveLoad(key) {
    if (driveEnv[key]) return driveEnv[key];
    if (!auth.isConnected()) throw PlatformError('no-session', 'This template is in your Google Drive. Sign in to Google to use it on this computer.');
    driveEnv[key] = await templateStore.load(key, { cache: false });
    return driveEnv[key];
  }
  // The manifest only (previews, run). This computer first, then Drive.
  async function getManifest(key) {
    var e = find(key);
    if (!e) return null;
    if (e.local) {
      var r = await bridge.request('usertpl-get', { key: key, assets: false }, { timeoutMs: 20000 });
      if (r && r.manifest) return r.manifest;
    }
    if (e.drive) return (await driveLoad(key)).manifest;
    return null;
  }
  // Manifest + every image's bytes, from wherever they are. onProgress({ text, done, total }).
  async function collect(key, onProgress) {
    var e = find(key), out = { manifest: null, assets: [], missing: [] };
    var have = {};
    {
      // session memory / this computer first — right after a capture that did not fit locally,
      // the sandbox still holds the fresh copy, which must win over an older Drive version
      var r = await bridge.request('usertpl-get', { key: key, assets: true }, { timeoutMs: 60000 }).catch(function () { return null; });
      if (r && r.manifest) { out.manifest = r.manifest; out.assets = r.assets || []; out.assets.forEach(function (a) { have[a.hash] = 1; }); }
    }
    var want = [];
    var env = null;
    if (!out.manifest && e && e.drive) { env = await driveLoad(key); out.manifest = env.manifest; }
    if (!out.manifest) throw PlatformError('not-found', 'Template "' + key + '" is not on this computer or in your Drive.');
    ((out.manifest.meta && out.manifest.meta.assets) || []).forEach(function (a) { if (!have[a.hash]) want.push(a); });
    if (want.length && e && e.drive && auth.isConnected()) {
      env = env || await driveLoad(key);
      for (var i = 0; i < want.length; i++) {
        var a = want[i];
        var ref = (env.assets || []).filter(function (x) { return x.name === a.name; })[0];
        if (!ref) continue;
        if (onProgress) onProgress({ text: 'Downloading image ' + (i + 1) + ' of ' + want.length + ' from Drive…', done: i, total: want.length });
        var bytes = await templateStore.loadAsset(ref.fileId);
        out.assets.push({ hash: a.hash, mime: a.mime, name: a.name, width: a.width, height: a.height, bytes: bytes.length, data: bytes });
        have[a.hash] = 1;
      }
    }
    want.forEach(function (a) { if (!have[a.hash]) out.missing.push(a.hash); });
    return out;
  }

  // Before Automate builds: make sure the sandbox has each user template's manifest and images.
  // A template only in Drive is downloaded now (first use on this machine) and kept on this
  // computer when it fits; returns { key: manifest } for the run message.
  async function prepareRun(keys, onProgress) {
    var manifests = {};
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i], e = find(key);
      if (!e) continue;
      var st = await bridge.request('usertpl-status', { key: key }, { timeoutMs: 20000 }).catch(function () { return { manifest: false, missing: [] }; });
      if (st.manifest && !st.missing.length) continue;            // the sandbox has everything
      if (!e.drive) {
        if (!st.manifest) throw PlatformError('not-found', '"' + (e.label || key) + '" is not on this computer any more. Import its template file again.');
        continue;                                                  // builds with labelled placeholders for the missing images
      }
      if (onProgress) onProgress({ text: 'Getting "' + (e.label || key) + '" from your Drive…' });
      var full = await collect(key, onProgress);
      if (!st.manifest) {
        var put = await bridge.request('usertpl-put', { manifest: full.manifest, assets: full.assets, replace: true,
          drive: { fileId: e.drive.fileId, folderId: e.drive.folderId, savedAt: e.drive.modifiedTime || null } }, { timeoutMs: 60000 });
        if (put && put.local && put.local.reason) console.info('[userTemplates] ' + key + ': ' + put.local.reason);
        await refreshLocal();
      } else {
        await bridge.request('usertpl-stage', { key: key, assets: full.assets }, { timeoutMs: 60000 });
      }
      manifests[key] = full.manifest;
    }
    return manifests;
  }

  // Upload (or re-upload) one template to the user's Drive. onProgress({ text, pct }).
  async function uploadToDrive(key, onProgress) {
    if (!auth.isConnected()) throw PlatformError('no-session', 'Sign in to Google to back this template up to your Drive.');
    var full = await collect(key);
    var files_ = full.assets.map(function (a) { return { name: a.name, mimeType: a.mime, bytes: a.data }; });
    var res = await templateStore.save(full.manifest, files_, {
      cache: false,
      onProgress: function (p) {
        if (!onProgress) return;
        if (p.step === 'manifest') return onProgress({ text: 'Uploading the template file…', pct: 96 });
        var frac = p.size ? Math.min(1, p.loaded / p.size) : 0;
        onProgress({ text: (p.skipped ? 'Already in Drive: image ' : 'Uploading image ') + (p.index + 1) + ' of ' + p.total + '…',
          pct: Math.round(((p.index + frac) / Math.max(1, p.total)) * 92) });
      }
    });
    var mark = { fileId: res.fileId, folderId: res.folderId, savedAt: new Date().toISOString() };
    await bridge.request('usertpl-mark-drive', { key: key, drive: mark }, { timeoutMs: 15000 }).catch(function () {});
    driveRows = (driveRows || []).filter(function (d) { return d.key !== key; }).concat([res.entry]);
    local.forEach(function (r) { if (r.key === key) r.drive = mark; });
    forget(key);
    publish();
    return { res: res, missing: full.missing };
  }

  // ---- the file tier ----
  async function exportFile(key, onProgress) {
    var full = await collect(key, onProgress);
    var M = full.manifest;
    var doc = {
      schema: USER_TEMPLATE_FILE_SCHEMA, app: 'Cult A+ Design Lab', exportedAt: new Date().toISOString(),
      key: M.meta.key, label: M.meta.label,
      manifest: M,
      assets: full.assets.map(function (a) {
        return { hash: a.hash, name: a.name, mime: a.mime, width: a.width || null, height: a.height || null, bytes: a.data.length, data: files.toB64(a.data) };
      }),
      missingAssets: full.missing
    };
    var name = M.meta.key.replace(/\//g, '_') + '.aplus-template.json';
    var blob = new Blob([JSON.stringify(doc)], { type: 'application/json' });
    var link = files.save(blob, 'application/json', name);
    return { name: name, bytes: blob.size, missing: full.missing.length, link: link };
  }
  function hasBadKeys(v, depth) {
    if (!v || typeof v !== 'object' || depth > 40) return depth > 40;
    for (var k in v) {
      if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') return true;
      if (hasBadKeys(v[k], depth + 1)) return true;
    }
    return false;
  }
  // parseFile(text) -> { manifest, assets: [{hash, mime, name, width, height, data}], warnings }
  function parseFile(text) {
    function bad(m) { return PlatformError('bad-request', 'That file is not a usable template: ' + m); }
    if (text.length > USER_TEMPLATE_FILE_MAX) throw bad('it is larger than ' + Math.round(USER_TEMPLATE_FILE_MAX / 1048576) + ' MB.');
    var doc;
    try { doc = JSON.parse(text); } catch (e) { throw bad('it is not JSON.'); }
    if (!doc || doc.schema !== USER_TEMPLATE_FILE_SCHEMA) throw bad('it was not exported by Cult A+ Design Lab (schema ' + esc(String(doc && doc.schema)) + ').');
    if (hasBadKeys(doc, 0)) throw bad('it contains reserved property names.');
    var M = doc.manifest;
    if (!M || M.schema !== 'aplus.template/2' || M.renderer !== 'aplus-capture-v1') throw bad('the template inside is of an unsupported kind.');
    if (!M.meta || !USER_KEY_RE.test(String(M.meta.key || '')) || M.meta.key !== M.meta.category + '/' + M.meta.gender + '/' + M.meta.id) throw bad('its key is not "category/gender/id".');
    if (!M.root || !M.root.type || !M.content || !M.fonts) throw bad('the template has no layers, sheet mapping or fonts.');
    var warnings = [], assets = [];
    var ok = { 'image/png': 1, 'image/jpeg': 1, 'image/gif': 1, 'image/webp': 1 };
    (Array.isArray(doc.assets) ? doc.assets : []).forEach(function (a) {
      if (!a || !/^[A-Za-z0-9_-]{6,128}$/.test(String(a.hash)) || typeof a.data !== 'string') { warnings.push('An image entry was malformed and was skipped.'); return; }
      if (!ok[a.mime]) { warnings.push('Image ' + String(a.hash).slice(0, 8) + ' is not PNG/JPEG/GIF/WEBP and was skipped.'); return; }
      var data;
      try { data = files.fromB64(a.data); } catch (e) { warnings.push('Image ' + a.hash.slice(0, 8) + ' could not be decoded and was skipped.'); return; }
      if (a.bytes && data.length !== Number(a.bytes)) { warnings.push('Image ' + a.hash.slice(0, 8) + ' is truncated and was skipped.'); return; }
      assets.push({ hash: a.hash, mime: a.mime, name: String(a.name || a.hash).replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 140) || a.hash, width: a.width || null, height: a.height || null, bytes: data.length, data: data });
    });
    var need = ((M.meta.assets) || []).length;
    if (need > assets.length) warnings.push((need - assets.length) + ' of ' + need + ' image(s) are not in the file; those layers will show a labelled placeholder.');
    return { manifest: M, assets: assets, warnings: warnings };
  }
  // Re-key a parsed template ("Save as new").
  function rekey(M, id, label) {
    var c = JSON.parse(JSON.stringify(M));
    c.meta.id = id; c.meta.key = c.meta.category + '/' + c.meta.gender + '/' + id;
    if (label) c.meta.label = label;
    return c;
  }
  // Save a whole template (from a file): this computer, then Drive. Never throws for Drive — reports it.
  async function saveWhole(M, assets, opts) {
    opts = opts || {};
    var r = await bridge.request('usertpl-put', { manifest: M, assets: assets, replace: !!opts.replace, drive: null }, { timeoutMs: 60000 });
    forget(M.meta.key);
    await refreshLocal();
    var out = { key: M.meta.key, local: r.local, drive: null, driveError: null };
    if (auth.isConnected()) {
      try { out.drive = (await uploadToDrive(M.meta.key, opts.onProgress)).res; }
      catch (e) { out.driveError = e; }
    }
    return out;
  }
  // Delete everywhere: this computer now, Drive copy to the Drive bin (recoverable for 30 days).
  async function remove(key) {
    var e = find(key), out = { key: key, local: false, drive: 'none', driveError: null };
    if (e && e.local) { await bridge.request('usertpl-remove', { key: key }, { timeoutMs: 15000 }); out.local = true; }
    if (e && e.drive) {
      if (!auth.isConnected()) { out.drive = 'skipped'; }
      else {
        try { await templateStore.remove(key); out.drive = 'trashed'; driveRows = (driveRows || []).filter(function (d) { return d.key !== key; }); }
        catch (err) {
          if (err && err.code === 'not-found') { out.drive = 'gone'; driveRows = (driveRows || []).filter(function (d) { return d.key !== key; }); }
          else { out.drive = 'failed'; out.driveError = err; }
        }
      }
    }
    forget(key);
    await refreshLocal();
    return out;
  }

  return {
    list: function () { return state.userTemplates || []; }, find: find, where: where, isUser: function (k) { return !!find(k); },
    usage: function () { return usage; }, driveListed: function () { return driveRows !== null; }, driveError: function () { return driveError; },
    setLocal: function (r) { setLocal(r); publish(); }, refreshLocal: refreshLocal, refreshDrive: refreshDrive,
    keyStatus: keyStatus, suggestFreeId: suggestFreeId, getManifest: getManifest, collect: collect, prepareRun: prepareRun,
    uploadToDrive: uploadToDrive, exportFile: exportFile, parseFile: parseFile, rekey: rekey, saveWhole: saveWhole, remove: remove,
    forget: forget, FILE_SCHEMA: USER_TEMPLATE_FILE_SCHEMA
  };
})();

// The registry overlay: strip every user template (and categories/genders that existed only for
// them), then add the current state.userTemplates. Idempotent, so it runs on every setRegistry.
function applyUserTemplates(reg) {
  if (!reg || !reg.categories) return reg;
  var out = JSON.parse(JSON.stringify(reg));
  out.categories = out.categories.map(function (c) {
    c.genders = (c.genders || []).map(function (g) {
      g.templates = (g.templates || []).filter(function (t) { return !t.user && !t.captured; });
      return g;
    }).filter(function (g) { return !(g.userOnly && !g.templates.length); });
    return c;
  }).filter(function (c) { return !(c.userOnly && !c.genders.length); });
  (state.userTemplates || []).forEach(function (e) {
    if (!e.category || !e.gender || !e.id) return;
    var cat = out.categories.filter(function (c) { return c.id === e.category; })[0];
    if (!cat) {
      cat = { id: e.category, label: e.categoryLabel || titleCase(e.category), status: 'active', defaultGender: e.gender, genders: [], userOnly: true };
      out.categories.push(cat);
    }
    cat.status = 'active';
    var gen = (cat.genders || []).filter(function (g) { return g.id === e.gender; })[0];
    if (!gen) {
      gen = { id: e.gender, label: titleCase(e.gender), status: 'active', hero: ['', ''], templates: [], userOnly: true };
      (cat.genders = cat.genders || []).push(gen);
    }
    gen.status = 'active';
    gen.templates = (gen.templates || []).filter(function (t) { return t.id !== e.id; });
    gen.templates.push({ id: e.id, label: e.label || e.id, version: 1, status: 'active', captured: true, user: true,
      sub: 'Your template · ' + ({ both: 'this computer + Drive', computer: 'this computer', drive: 'your Drive' })[userTemplates.where(e)] });
  });
  return out;
}

// ---------- notes, toasts ----------
var ui = {
  // HTML string for the shared .note component; `html` is trusted markup, title is escaped
  note: function (kind, title, html) { return '<div class="note ' + (kind || 'info') + '"><b>' + esc(title) + '</b>' + (html || '') + '</div>'; },
  toast: function (text, kind, ms) {
    var host = $('toasts'); if (!host) return;
    var el = document.createElement('div');
    el.className = 'toast ' + (kind || 'info');
    el.textContent = String(text);
    host.appendChild(el);
    setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 250); }, ms || 4200);
  },
  errorText: errorText
};

// ---------- downloads + byte helpers (downloads must go through this iframe) ----------
var files = (function () {
  var lastUrl = null;
  function toB64(u8) {
    var s = '', CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }
  function fromB64(b64) {
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function fmtBytes(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  // save(bytes, mime, name) — triggers the download and returns HTML for a "save again" link,
  // in case the automatic save was blocked. The previous object URL is revoked.
  function save(u8, mime, name) {
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    var url = URL.createObjectURL(u8 instanceof Blob ? u8 : new Blob([u8], { type: mime }));
    lastUrl = url;
    var a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    return '<a href="' + url + '" download="' + esc(name) + '">Save ' + esc(name) + ' again</a>';
  }
  return { save: save, toB64: toB64, fromB64: fromB64, fmtBytes: fmtBytes };
})();

// ---------- sheet model (column schema comes from the registry) ----------
function parseTable(text) {
  var delim = text.indexOf('\t') >= 0 ? '\t' : ',';
  var rows = [], row = [], cell = '', q = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
    else if (ch === '"' && cell === '') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
// sheet schema: column B = category, column C = gender
function sheetSchema() {
  return (state.registry && state.registry.sheet) || {
    styleIdColumn: 0, categoryColumn: 1, genderColumn: 2, heroColumn: 3, fabricColumn: 4,
    cardColumns: [5, 6, 7, 8], comparisonColumn: 9,
    categoryAliases: { run: 'running', running: 'running', train: 'training', training: 'training', lifestyle: 'lifestyle', comfort: 'lifestyle', seamless: 'seamless', flex: 'seamless' },
    genderAliases: { m: 'men', men: 'men', mens: 'men', w: 'women', women: 'women', womens: 'women', unisex: 'unisex' }
  };
}
function words(v) { return String(v || '').toLowerCase().split(/[^a-z]+/).filter(Boolean); }
// Reads category and gender out of columns B and C. Gender may also be written into
// column B ("Running Women"), which is how the older sheets were filled in.
function parseCatGender(bRaw, cRaw) {
  var sc = sheetSchema(), ca = sc.categoryAliases || {}, ga = sc.genderAliases || {};
  var cat = '', gen = '';
  words(bRaw).forEach(function (t) { if (!cat && ca[t]) cat = ca[t]; if (!gen && ga[t]) gen = ga[t]; });
  words(cRaw).forEach(function (t) { if (!gen && ga[t]) gen = ga[t]; });
  if (!cat) {
    // a category the user created ("Yoga Pants" -> yoga-pants): match the whole cell, with or
    // without a gender word in it, against category ids and labels
    var tries = [slugify(bRaw), slugify(words(bRaw).filter(function (t) { return !ga[t]; }).join(' '))];
    registryCats().forEach(function (c) {
      if (cat) return;
      if (tries.indexOf(c.id) >= 0 || tries.indexOf(slugify(c.label)) >= 0) cat = c.id;
    });
  }
  return { cat: cat, gender: gen };
}

// ---------- registry ----------
function registryCats() { return (state.registry && state.registry.categories) || []; }
function catById(id) { return registryCats().find(function (c) { return c.id === id; }); }
function genderById(cat, id) { return (((cat || {}).genders) || []).find(function (g) { return g.id === id; }); }
function activeTemplate(gen) { return gen && ((gen.templates || []).find(function (t) { return t.status === 'active'; }) || (gen.templates || [])[0]); }
function hasFeature(tpl, f) { return !!(tpl && (tpl.features || []).indexOf(f) >= 0); }
function genderReady(g) { return g && g.status === 'active' && activeTemplate(g); }

// The ONLY way to change state.registry. Emits 'registry' so every panel re-renders its pickers.
// The user's own templates are overlaid on whatever registry arrives (bundled, backend or this one).
function setRegistry(reg) {
  state.registry = applyUserTemplates(reg);
  bus.emit('registry', reg);
}
// A backend can ADD templates but must never take one away. The Docker image bakes the
// template folder in at build time, so an image built before a template existed serves a
// registry without it — and replacing ours wholesale made that template vanish from the
// picker even though the plugin had it bundled. Merge instead.
function mergeRegistry(bundled, live) {
  if (!bundled || !bundled.categories) return live;
  var out = JSON.parse(JSON.stringify(live));
  var byId = {};
  out.categories.forEach(function (c) { byId[c.id] = c; });
  var restored = [];
  (bundled.categories || []).forEach(function (bc) {
    var lc = byId[bc.id];
    if (!lc) { out.categories.push(JSON.parse(JSON.stringify(bc))); return; }
    var lg = {};
    (lc.genders || []).forEach(function (g) { lg[g.id] = g; });
    (bc.genders || []).forEach(function (bg) {
      var g = lg[bg.id];
      if (!g) { (lc.genders = lc.genders || []).push(JSON.parse(JSON.stringify(bg))); return; }
      var have = {};
      (g.templates || []).forEach(function (t) { have[t.id] = 1; });
      (bg.templates || []).forEach(function (bt) {
        if (have[bt.id]) return;
        (g.templates = g.templates || []).push(JSON.parse(JSON.stringify(bt)));
        restored.push(bc.id + '/' + bg.id + '/' + bt.id);
      });
      if (bg.status === 'active' && g.status !== 'active' && (g.templates || []).length) g.status = 'active';
    });
    if (bc.status === 'active' && lc.status !== 'active') lc.status = 'active';
  });
  out.staleBackend = restored;
  return out;
}
async function refreshRegistry() {
  try {
    var reg = await backend.get('/api/templates', { timeoutMs: 75000 });
    if (!reg || !reg.categories) throw new Error('bad registry');
    var merged = mergeRegistry(state.bundledRegistry, reg);
    state.manifestCache = {}; state.manifestSource = {};
    setRegistry(merged);
    if (merged.staleBackend && merged.staleBackend.length) {
      // developer-facing: the deployed backend image predates templates this plugin ships with
      console.warn('[platform] backend registry is missing ' + merged.staleBackend.join(', ') + ' — using the bundled copy. Redeploy the backend to clear this.');
    }
    return true;
  } catch (e) {
    console.info('[platform] template registry: using the bundled copy (' + (e && e.message) + ')');
    return false;
  }
}
// The resolved manifest for one template: the backend's copy, else the bundled one.
async function fetchManifest(cat, gen, tpl) {
  var key = cat + '/' + gen + '/' + tpl;
  if (state.manifestCache[key]) return state.manifestCache[key];
  // the user's own template: this computer, else their Drive — never the backend
  if (userTemplates.isUser(key)) {
    try {
      var um = await userTemplates.getManifest(key);
      if (um) { state.manifestCache[key] = um; state.manifestSource[key] = 'user'; return um; }
    } catch (e) { console.warn('[platform] template ' + key + ': ' + errorText(e)); }
    return null;
  }
  try {
    var m = await backend.get('/api/templates/' + cat + '/' + gen + '/' + tpl, { timeoutMs: 30000 });
    if (m && m.meta) { state.manifestCache[key] = m; state.manifestSource[key] = 'backend'; return m; }
  } catch (e) {}
  var fb = (window.BUNDLED_MANIFESTS || {})[key];
  if (fb) { state.manifestCache[key] = fb; state.manifestSource[key] = 'bundled'; return fb; }
  return null;
}

// ---------- page ----------
function setPage(name, frameCount, id) {
  if (id !== undefined) state.pageId = id;
  state.pageName = name || '';
  $('page').textContent = name || 'Untitled page';
  $('page-sub').textContent = (frameCount === undefined || frameCount === null)
    ? 'Output lands here.'
    : (frameCount + ' frame' + (frameCount === 1 ? '' : 's') + ' · output lands here');
}

// ---------- Google sign-in gate ----------
// The gate stands in front of #app until /auth/status reports a connected account that carries
// the full Drive scope. "Continue with Google" is the only control on it.
function setGoogle(stateStr) {
  var p = $('pill-google');
  if (stateStr === 'connected') {
    $('g-title').textContent = 'Google';
    $('g-sub').textContent = state.needsReconsent ? 'needs new Drive permission' : (state.googleEmail || 'connected');
    p.classList.toggle('on', !state.needsReconsent);
    $('g-manage').classList.remove('hidden'); $('g-email').textContent = state.googleEmail ? '(' + state.googleEmail + ')' : '';
  } else {
    p.classList.remove('on'); $('g-title').textContent = 'Google';
    $('g-sub').textContent = stateStr === 'connecting' ? 'connecting…' : 'not connected';
    $('g-manage').classList.add('hidden');
  }
  $('gate-label').textContent = stateStr === 'connecting' ? 'Waiting for Google…'
    : (state.needsReconsent ? 'Reconnect Google' : 'Continue with Google');
  $('gate-connect').disabled = stateStr === 'connecting';
}
function showGate(on) {
  $('gate').classList.toggle('hidden', !on);
  $('app').classList.toggle('hidden', !!on);
  document.body.classList.toggle('gated', !!on);
  if (!on) window.scrollTo(0, 0);
}
function gateNote(kind, title, body) {
  $('gate-note').innerHTML = kind ? ui.note(kind, title, body) : '';
}
function showAuthLink(url, blocked) {
  $('gate-authlink').classList.remove('hidden');
  $('gate-authlink').innerHTML = (blocked ? 'Popup blocked — ' : '') + '<a href="' + esc(url) + '" target="_blank" rel="noopener">Open the Google sign-in page</a>';
}
function hideAuthLink() { $('gate-authlink').classList.add('hidden'); $('gate-authlink').innerHTML = ''; }

// One call answers every gate state. Returns: connected | reconsent | ready | unconfigured | unreachable
async function gateProbe() {
  var s;
  try {
    s = await backend.get('/auth/status?session=' + encodeURIComponent(state.session || ''), { timeoutMs: 75000 });
  } catch (e) {
    gateNote('warn', 'Can\'t reach the A+ service', esc(errorText(e)));
    scheduleWakeRetry();
    return 'unreachable';
  }
  clearTimeout(state.pending.wake); state.pending.wakeTries = 0;
  if (!s.configured) {
    gateNote('warn', 'Sign-in is not set up', 'The A+ service has no Google credentials yet. Ask the plugin owner to configure it.');
    return 'unconfigured';
  }
  // the durable sealed token — storing it is what survives a backend restart
  if (s.session && s.session !== state.session) {
    state.session = s.session;
    bridge.send('save-session', { session: state.session });
  }
  state.needsReconsent = !!s.needsReconsent;
  state.driveAccess = s.driveAccess || null;
  if (s.connected && s.needsReconsent) {
    state.googleEmail = s.email; setGoogle('connected');
    gateNote('pending', 'One more Google permission',
      'The plugin now saves your templates and exports to your own Google Drive, so it needs full Drive access. Continue with Google once to approve it.');
    bus.emit('auth', { connected: true, email: s.email, needsReconsent: true });
    return 'reconsent';
  }
  if (s.connected) {
    state.googleEmail = s.email; setGoogle('connected');
    gateNote('', '', ''); hideAuthLink(); showGate(false);
    bus.emit('auth', { connected: true, email: s.email, needsReconsent: false });
    return 'connected';
  }
  setGoogle('off'); gateNote('', '', '');
  return 'ready';
}
// Render Free sleeps when idle: keep probing quietly for ~90 s rather than dead-ending.
function scheduleWakeRetry() {
  clearTimeout(state.pending.wake);
  state.pending.wakeTries = (state.pending.wakeTries || 0) + 1;
  if (state.pending.wakeTries > 18) return;
  state.pending.wake = setTimeout(gateProbe, 5000);
}
async function connectGoogle() {
  hideAuthLink();
  setGoogle('connecting');
  try {
    var data = await backend.post('/auth/new', {});
    state.session = data.sessionId;
    auth.clearToken();
    bridge.send('save-session', { session: state.session });
    var w = null; try { w = window.open(data.authUrl, '_blank', 'noopener'); } catch (e) {}
    showAuthLink(data.authUrl, !w);
    gateNote('info', 'Waiting for Google', 'Finish in the browser tab — this panel follows along.');
    pollAuth();
  } catch (e) {
    gateNote('warn', e.code === 'not-configured' || e.status === 503 ? 'Sign-in is not set up' : 'Can\'t reach the A+ service', esc(errorText(e)));
    setGoogle('off');
  }
}
function pollAuth() {
  clearInterval(state.poll); var tries = 0;
  state.poll = setInterval(async function () {
    if (++tries > 60) {
      clearInterval(state.poll); setGoogle(state.googleEmail ? 'connected' : 'off');
      gateNote('pending', 'Sign-in timed out', 'Nothing came back from Google. Try again.');
      return;
    }
    var r = await gateProbe();
    if (r === 'connected' || r === 'unconfigured') clearInterval(state.poll);
  }, 2500);
}
async function disconnectGoogle() {
  clearInterval(state.poll);
  try { await backend.post('/auth/logout', { session: state.session }, { timeoutMs: 15000 }); } catch (e) {}
  auth.clearToken();
  state.googleEmail = null; state.needsReconsent = false; state.driveAccess = null;
  setGoogle('off'); showGate(true); gateProbe();
  bus.emit('auth', { connected: false, email: null, needsReconsent: false });
}
// signed in (or reconnected): the user's templates saved from other machines come back from Drive
bus.on('auth', function (a) { if (a && a.connected && !a.needsReconsent) userTemplates.refreshDrive(); });
// an auth failure anywhere (expired, revoked, scope) is surfaced once, not per call
bus.on('auth-error', function (e) {
  var now = Date.now();
  if (state.pending.lastAuthToast && now - state.pending.lastAuthToast < 8000) return;
  state.pending.lastAuthToast = now;
  ui.toast(errorText(e), 'warn', 7000);
});

// ---------- chrome wiring (tabs, settings, gate) ----------
$('gate-connect').onclick = connectGoogle;
$('gdisconnect').onclick = disconnectGoogle;
$('pill-google').onclick = function () { $('settings').classList.add('open'); };
$('settings-h').onclick = function () { $('settings').classList.toggle('open'); };
document.querySelectorAll('#tabs button').forEach(function (b) {
  b.onclick = function () {
    document.querySelectorAll('#tabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
    ['automate', 'design', 'export'].forEach(function (v) {
      var view = $('view-' + v);
      if (view) view.classList.toggle('on', v === b.dataset.tab);
    });
    state.activeTab = b.dataset.tab;
    bus.emit('tab', b.dataset.tab);
    window.scrollTo(0, 0);
  };
});

// ---------- sandbox -> UI: the platform-level messages ----------
bridge.on('init', function (m) {
  var override = String(m.backendUrl || '').trim();
  state.backendOverride = !!override && /^https?:\/\//i.test(override);
  state.backend = state.backendOverride ? override.replace(/\/+$/, '') : BACKEND_DEFAULT;
  if (state.backendOverride) console.info('[platform] developer backend override (clientStorage "backendUrl"): ' + state.backend);
  state.session = m.session || '';
  state.bundledRegistry = m.registry;       // so a stale backend can never remove a bundled template
  window.BUNDLED_MANIFESTS = m.manifests || {};
  if (m.page) setPage(m.page);              // legacy init.page, still honoured
  if (m.userTemplates) userTemplates.setLocal(m.userTemplates);   // this computer's templates, before the first overlay
  setRegistry(m.registry);                  // -> bus 'registry' (pickers, rules)
  setGoogle('off');
  bus.emit('init', m);                      // panels read their own init fields here
  showGate(true);                           // the gate stands until a saved session is confirmed
  refreshRegistry();
  gateProbe();
  bridge.send('ping-page');
});
bridge.on('page', function (m) {
  setPage(m.name, m.frameCount, m.id);
  bus.emit('page', { id: m.id, name: m.name, frameCount: m.frameCount });
});
bridge.on('selection', function (m) {
  // selection and page events race on a page switch; pageId lets the stale one go
  if (m.pageId && state.pageId && m.pageId !== state.pageId) return;
  state.selection = { frames: m.frames || [], ids: m.ids || [] };
  bus.emit('selection', state.selection);
});

// ---------- developer hooks (plugin console only; no UI) ----------
window.aplusDev = {
  setBackend: function (url) {
    bridge.send('save-backend', { url: String(url || '') });
    state.backend = String(url || '').trim().replace(/\/+$/, '') || BACKEND_DEFAULT;
    state.backendOverride = !!String(url || '').trim();
    auth.clearToken(); refreshRegistry(); gateProbe();
    return 'backend = ' + state.backend + ' (saved to clientStorage "backendUrl")';
  },
  clearBackend: function () { return window.aplusDev.setBackend(''); },
  info: function () { return { backend: state.backend, override: state.backendOverride, signedIn: auth.isConnected(), email: state.googleEmail, token: auth.tokenInfo() }; }
};

// one namespace with everything, for code that prefers it over the globals
var platform = {
  BACKEND_DEFAULT: BACKEND_DEFAULT, TEMPLATES_PATH: TEMPLATES_PATH,
  state: state, Panels: Panels, $: $, esc: esc, PlatformError: PlatformError, errorText: errorText,
  bus: bus, bridge: bridge, backend: backend, auth: auth, googleFetch: googleFetch,
  drive: drive, sheets: sheets, templateStore: templateStore, userTemplates: userTemplates, storage: storage, ui: ui, files: files, slugify: slugify,
  registry: { cats: registryCats, catById: catById, genderById: genderById, activeTemplate: activeTemplate,
    hasFeature: hasFeature, genderReady: genderReady, set: setRegistry, refresh: refreshRegistry,
    merge: mergeRegistry, fetchManifest: fetchManifest },
  sheet: { schema: sheetSchema, parseTable: parseTable, words: words, parseCatGender: parseCatGender },
  setPage: setPage
};
window.platform = platform;
