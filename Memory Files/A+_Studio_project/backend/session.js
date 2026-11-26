// ===== A+ Studio · sealed sessions =====
//
// WHY THIS EXISTS
// Sessions used to be rows in backend/.data/sessions.json. Render's filesystem is ephemeral:
// every deploy, every restart, every idle-spindown on the free tier wipes that file, and every
// user is silently signed out with no error to explain it.
//
// THE FIX: the server stops being the system of record. The Google **refresh token** is sealed
// into an opaque, authenticated blob (AES-256-GCM) and handed back to the plugin, which already
// stores an opaque "session" string in figma.clientStorage. The server keeps nothing it cannot
// afford to lose, so a redeploy is invisible to the user.
//
//   sealed token = "v1.<iv>.<tag>.<ciphertext>"   (all base64url)
//   plaintext    = JSON { rt, em, sc, iat }        (refresh token, email, scopes, issued-at)
//
// The plugin cannot read it (no key). A tampered blob fails the GCM tag and is rejected.
// Short-lived access tokens are NOT sealed — they are cached in memory and re-minted from the
// refresh token on a cold start, which costs one extra round-trip to Google and nothing else.
//
// SECURITY — read docs/export-pipeline.md §Security before changing anything here:
//   * The blob contains a long-lived Google refresh token carrying drive.readonly and
//     spreadsheets.readonly for a curefit.com account. Anyone who holds BOTH the blob and
//     SESSION_SECRET can read that user's entire Drive. Treat SESSION_SECRET like a database
//     password: Render secret env var only, never committed, never logged.
//   * Rotating SESSION_SECRET invalidates every outstanding session (everyone re-consents).
//     That is the revocation mechanism — there is no server-side session list to clear.
//   * Never log a sealed token, and never echo one into an error message or a URL.

require('./env');

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

var VERSION = 'v1';
var ALG = 'aes-256-gcm';

// Optional belt-and-braces disk persistence. Only used when SESSION_DIR points at a writable
// directory — e.g. a Render persistent disk mounted at /var/data. Unset (the default, and what
// we deploy) means "no disk at all", which is exactly what makes the free tier safe.
var SESSION_DIR = process.env.SESSION_DIR || '';

var ephemeralSecret = false;
var SECRET = process.env.SESSION_SECRET || '';
if (!SECRET) {
  SECRET = crypto.randomBytes(32).toString('hex');
  ephemeralSecret = true;
}

var KEY = crypto.scryptSync(SECRET, 'aplus-studio/session/v1', 32);

function b64u(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64u(s) { return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64'); }

// Seal a payload object into the opaque string the plugin stores.
function seal(payload) {
  var iv = crypto.randomBytes(12);
  var c = crypto.createCipheriv(ALG, KEY, iv);
  var ct = Buffer.concat([c.update(Buffer.from(JSON.stringify(payload), 'utf8')), c.final()]);
  return [VERSION, b64u(iv), b64u(c.getAuthTag()), b64u(ct)].join('.');
}

// Open a sealed token. Returns null for anything that is not a valid, untampered v1 blob
// (including a legacy hex session id) — callers treat null as "not a sealed token".
function open(token) {
  if (!token || typeof token !== 'string') return null;
  var p = token.split('.');
  if (p.length !== 4 || p[0] !== VERSION) return null;
  try {
    var d = crypto.createDecipheriv(ALG, KEY, unb64u(p[1]));
    d.setAuthTag(unb64u(p[2]));
    var out = Buffer.concat([d.update(unb64u(p[3])), d.final()]).toString('utf8');
    var obj = JSON.parse(out);
    return obj && typeof obj === 'object' ? obj : null;
  } catch (e) {
    return null; // wrong key (secret rotated), tampered, or truncated
  }
}

function isSealed(token) { return typeof token === 'string' && token.indexOf(VERSION + '.') === 0 && token.split('.').length === 4; }

// ---- optional disk mirror (only when SESSION_DIR is set) --------------------------------
var diskFile = SESSION_DIR ? path.join(SESSION_DIR, 'sessions.json') : '';
var diskOk = false;
if (diskFile) {
  try { fs.mkdirSync(SESSION_DIR, { recursive: true }); fs.accessSync(SESSION_DIR, fs.constants.W_OK); diskOk = true; }
  catch (e) { console.warn('[session] SESSION_DIR=' + SESSION_DIR + ' is not writable — falling back to sealed-token-only mode.'); }
}
function loadDisk() {
  if (!diskOk) return {};
  try { return JSON.parse(fs.readFileSync(diskFile, 'utf8')) || {}; } catch (e) { return {}; }
}
function saveDisk(obj) {
  if (!diskOk) return;
  try {
    var tmp = diskFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj), { mode: 0o600 });
    fs.renameSync(tmp, diskFile); // atomic-ish; avoids a half-written file after a kill
  } catch (e) { /* non-fatal: sealed tokens are the real persistence */ }
}

function info() {
  return {
    mode: 'sealed-token',
    secret: ephemeralSecret ? 'ephemeral' : 'configured',
    diskMirror: diskOk ? SESSION_DIR : null
  };
}

function warnIfEphemeral() {
  if (!ephemeralSecret) return;
  console.warn('');
  console.warn('  !! SESSION_SECRET is not set — a random one was generated for this process.');
  console.warn('     Google sign-ins will NOT survive a restart or redeploy. Set SESSION_SECRET');
  console.warn('     (openssl rand -hex 32) in your .env / Render env group. See backend/README.md.');
  console.warn('');
}

module.exports = { seal: seal, open: open, isSealed: isSealed, loadDisk: loadDisk, saveDisk: saveDisk, info: info, warnIfEphemeral: warnIfEphemeral, ephemeralSecret: function () { return ephemeralSecret; } };
