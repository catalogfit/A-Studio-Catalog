// ===== A+ Studio · provider-agnostic LLM client =====
//
// WHAT THIS IS FOR
// One job only: the *semantic labelling* pass described in docs/ai-labelling.md — giving human
// names to layers a deterministic capture has already measured. The model never produces a
// number this system uses. See label.js for the validation that enforces that.
//
// WHY IT IS HAND-ROLLED
// The backend has zero npm dependencies on purpose (see the Dockerfile — there is no npm install
// step at all). So this is plain `https`, in the same shape as google.js.
//
// PROVIDERS
//   openrouter  POST https://openrouter.ai/api/v1/chat/completions   Authorization: Bearer <key>
//   anthropic   POST https://api.anthropic.com/v1/messages           x-api-key + anthropic-version
// Selected by LLM_PROVIDER if set, else by whichever key is present (OpenRouter wins if both).
//
// HARD LIMITS — all of these exist so a hung or hostile upstream cannot cost money or memory:
//   * request timeout            LLM_TIMEOUT_MS         (default 25 s)
//   * max response bytes         LLM_MAX_RESPONSE_BYTES (default 1 MB) — socket destroyed past it
//   * max request bytes          LLM_MAX_REQUEST_BYTES  (default 256 KB) — refused before sending
//   * concurrency                LLM_MAX_CONCURRENT     (default 2)
//   * monthly budget             see budget() below — refuses the call when exhausted
//
// SECRETS: the key is read from env and never logged, never echoed into an error message, never
// returned to a caller. info() reports booleans and the model id only.

require('./env');

var https = require('https');

// ---------------------------------------------------------------------------------------------
// configuration
// ---------------------------------------------------------------------------------------------

var OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
var ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// Defaults chosen 2026-11-26 against the live https://openrouter.ai/api/v1/models listing, not
// from memory. See docs/ai-labelling.md § Model choice for the reasoning.
//   OpenRouter: anthropic/claude-haiku-5.5  — $0.10/M in, $0.50/M out, 1M ctx, structured_outputs.
//   Anthropic direct: claude-haiku-4-5      — the current Haiku id on the first-party API.
var DEFAULT_MODEL = {
  openrouter: 'anthropic/claude-haiku-5.5',
  anthropic: 'claude-haiku-4-5'
};

var TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 25000);
var MAX_RESPONSE_BYTES = Number(process.env.LLM_MAX_RESPONSE_BYTES || 1024 * 1024);
var MAX_REQUEST_BYTES = Number(process.env.LLM_MAX_REQUEST_BYTES || 256 * 1024);
var MAX_CONCURRENT = Number(process.env.LLM_MAX_CONCURRENT || 2);
var MAX_TOKENS = Number(process.env.LLM_MAX_TOKENS || 4000);

// Cost guard. MIN_REMAINING is the floor we refuse to spend below, so a runaway caller cannot
// drain the key to zero and take the rest of the month's budget with it.
var MIN_REMAINING_USD = Number(process.env.LLM_MIN_REMAINING_USD || 0.5);
var MONTHLY_BUDGET_USD = process.env.LLM_MONTHLY_BUDGET_USD !== undefined && process.env.LLM_MONTHLY_BUDGET_USD !== ''
  ? Number(process.env.LLM_MONTHLY_BUDGET_USD) : null;
var BUDGET_TTL_MS = Number(process.env.LLM_BUDGET_TTL_MS || 120000); // re-check the key at most this often

var ANTHROPIC_VERSION = process.env.ANTHROPIC_VERSION || '2023-06-01';
var REFERER = process.env.LLM_HTTP_REFERER || 'https://github.com/curefit/aplus-studio';
var TITLE = process.env.LLM_APP_TITLE || 'A+ Studio template labelling';

function pickProvider() {
  var explicit = String(process.env.LLM_PROVIDER || '').trim().toLowerCase();
  if (explicit === 'none' || explicit === 'off' || explicit === 'disabled') return 'none';
  if (explicit === 'openrouter') return OPENROUTER_API_KEY ? 'openrouter' : 'none';
  if (explicit === 'anthropic') return ANTHROPIC_API_KEY ? 'anthropic' : 'none';
  if (explicit) return 'none'; // an unknown value is a configuration mistake, not a default
  if (OPENROUTER_API_KEY) return 'openrouter';
  if (ANTHROPIC_API_KEY) return 'anthropic';
  return 'none';
}

var PROVIDER = pickProvider();
var MODEL = process.env.LLM_MODEL || DEFAULT_MODEL[PROVIDER] || '';

function keyFor(provider) {
  return provider === 'openrouter' ? OPENROUTER_API_KEY : provider === 'anthropic' ? ANTHROPIC_API_KEY : '';
}
function configured() { return PROVIDER !== 'none' && !!keyFor(PROVIDER); }

// Safe for /health and for any response body: no secret material, no dollar figures.
function info() {
  return {
    provider: PROVIDER,
    configured: configured(),
    model: configured() ? MODEL : null,
    budgetGuard: PROVIDER === 'openrouter' ? 'upstream' : (MONTHLY_BUDGET_USD != null ? 'local' : 'none'),
    timeoutMs: TIMEOUT_MS,
    maxConcurrent: MAX_CONCURRENT
  };
}

// ---------------------------------------------------------------------------------------------
// transport
// ---------------------------------------------------------------------------------------------

// An error carrying .statusCode so the caller can distinguish "the model said no" from "we are
// broken". Never carries upstream body text beyond a short, key-free excerpt.
function llmError(message, statusCode, retryable) {
  var e = new Error(message);
  e.statusCode = statusCode || 502;
  e.retryable = !!retryable;
  e.llm = true;
  return e;
}

// Strip anything that looks like a credential out of text we might surface or log. Upstream error
// bodies occasionally echo request headers; this makes it impossible for one to leak through.
function scrub(text) {
  var s = String(text == null ? '' : text);
  if (OPENROUTER_API_KEY) s = s.split(OPENROUTER_API_KEY).join('[redacted]');
  if (ANTHROPIC_API_KEY) s = s.split(ANTHROPIC_API_KEY).join('[redacted]');
  return s.replace(/\b(sk-or-v1-|sk-ant-)[A-Za-z0-9_\-]{8,}/g, '$1[redacted]');
}

function httpJson(opts, bodyString) {
  return new Promise(function (resolve, reject) {
    var settled = false;
    function fail(e) { if (!settled) { settled = true; reject(e); } }
    function done(v) { if (!settled) { settled = true; resolve(v); } }

    var req = https.request(opts, function (res) {
      var chunks = [], total = 0, overflow = false;
      res.on('data', function (c) {
        if (overflow) return;
        total += c.length;
        if (total > MAX_RESPONSE_BYTES) {
          overflow = true;
          res.destroy();
          req.destroy();
          return fail(llmError('The model reply exceeded the ' + Math.round(MAX_RESPONSE_BYTES / 1024) + ' KB response limit.', 502, false));
        }
        chunks.push(c);
      });
      res.on('end', function () {
        if (overflow) return;
        var text = Buffer.concat(chunks).toString('utf8');
        var json = null;
        try { json = JSON.parse(text); } catch (e) { /* handled by the caller */ }
        done({ status: res.statusCode, json: json, text: text });
      });
      res.on('error', function (e) { fail(llmError('Model response stream failed: ' + scrub(e && e.message), 502, true)); });
    });

    req.setTimeout(TIMEOUT_MS, function () {
      req.destroy();
      fail(llmError('The model did not answer within ' + TIMEOUT_MS + ' ms.', 504, true));
    });
    req.on('error', function (e) { fail(llmError('Could not reach the model provider: ' + scrub(e && e.message), 502, true)); });
    if (bodyString) req.write(bodyString);
    req.end();
  });
}

// ---------------------------------------------------------------------------------------------
// cost guard
//
// OpenRouter exposes the key's own limit at GET /api/v1/key, which is the real number — it counts
// spend this backend did not do (another machine, another process, a redeploy). That is the guard
// we trust. The Anthropic API has no equivalent endpoint, so there the guard is a PROCESS-LOCAL
// tally against LLM_MONTHLY_BUDGET_USD: it resets on restart and is honestly reported as such.
// ---------------------------------------------------------------------------------------------

var _budgetCache = { at: 0, value: null };
var _localSpendUsd = 0;
var _localSpendSince = Date.now();

function budgetFromLocalTally() {
  if (MONTHLY_BUDGET_USD == null) {
    return {
      source: 'none',
      ok: true,
      limitUsd: null, usedUsd: null, remainingUsd: null,
      note: 'No budget guard for this provider. Set LLM_MONTHLY_BUDGET_USD to cap spend (process-local; resets on restart).'
    };
  }
  var remaining = MONTHLY_BUDGET_USD - _localSpendUsd;
  return {
    source: 'local-tally',
    ok: remaining > MIN_REMAINING_USD,
    limitUsd: MONTHLY_BUDGET_USD,
    usedUsd: Number(_localSpendUsd.toFixed(6)),
    remainingUsd: Number(remaining.toFixed(6)),
    since: new Date(_localSpendSince).toISOString(),
    note: 'Process-local tally — it resets on every restart or redeploy and does not see spend by other instances.'
  };
}

async function fetchOpenRouterBudget() {
  var r = await httpJson({
    method: 'GET', host: 'openrouter.ai', path: '/api/v1/key',
    headers: { Authorization: 'Bearer ' + OPENROUTER_API_KEY, Accept: 'application/json' }
  });
  if (r.status === 401 || r.status === 403) {
    return { source: 'openrouter', ok: false, limitUsd: null, usedUsd: null, remainingUsd: null, note: 'OpenRouter rejected the key (' + r.status + ').' };
  }
  if (r.status !== 200 || !r.json || !r.json.data) {
    return { source: 'openrouter', ok: true, limitUsd: null, usedUsd: null, remainingUsd: null, note: 'Could not read the key budget (' + r.status + ') — proceeding without an upstream guard.' };
  }
  var d = r.json.data;
  var limit = d.limit == null ? null : Number(d.limit);
  var used = d.usage == null ? null : Number(d.usage);
  var remaining = d.limit_remaining == null ? (limit == null ? null : limit - (used || 0)) : Number(d.limit_remaining);
  return {
    source: 'openrouter',
    ok: remaining == null ? true : remaining > MIN_REMAINING_USD, // an unlimited key has no remaining; that is fine
    limitUsd: limit,
    usedUsd: used,
    remainingUsd: remaining == null ? null : Number(remaining.toFixed(6)),
    floorUsd: MIN_REMAINING_USD,
    note: remaining == null ? 'This key has no monthly limit set, so there is nothing to exhaust.' : null
  };
}

// Returns the guard state. Cached for LLM_BUDGET_TTL_MS so a burst of labelling calls does not
// make one budget request each. Never throws — a guard that fails open is reported, not fatal.
async function budget(force) {
  if (!configured()) return { source: 'none', ok: false, limitUsd: null, usedUsd: null, remainingUsd: null, note: 'No LLM provider is configured.' };
  if (PROVIDER !== 'openrouter') return budgetFromLocalTally();
  var now = Date.now();
  if (!force && _budgetCache.value && now - _budgetCache.at < BUDGET_TTL_MS) return _budgetCache.value;
  var v;
  try { v = await fetchOpenRouterBudget(); }
  catch (e) { v = { source: 'openrouter', ok: true, limitUsd: null, usedUsd: null, remainingUsd: null, note: 'Budget check failed (' + scrub(e && e.message) + ') — proceeding without an upstream guard.' }; }
  _budgetCache = { at: now, value: v };
  return v;
}

// ---------------------------------------------------------------------------------------------
// concurrency
// ---------------------------------------------------------------------------------------------

var inFlight = 0;
function slots() { return { inFlight: inFlight, max: MAX_CONCURRENT }; }

// ---------------------------------------------------------------------------------------------
// the call
// ---------------------------------------------------------------------------------------------

function stripFence(text) {
  var s = String(text || '').trim();
  var m = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (m) s = m[1].trim();
  // Some models prepend a sentence. Take the outermost JSON object if there is one.
  if (s[0] !== '{') {
    var a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a >= 0 && b > a) s = s.slice(a, b + 1);
  }
  return s;
}

function openRouterBody(opts) {
  return {
    model: MODEL,
    temperature: 0,
    max_tokens: MAX_TOKENS,
    usage: { include: true }, // asks OpenRouter to return the real dollar cost of this call
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user }
    ],
    response_format: { type: 'json_schema', json_schema: opts.schema }
  };
}

function anthropicBody(opts, withStructuredOutput) {
  var body = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }]
  };
  // The first-party structured-outputs shape. If this backend is pointed at a model or an API
  // version that does not accept it, chat() retries once without it and parses the text instead —
  // which is why the prompt itself also states the required JSON shape.
  if (withStructuredOutput) body.output_config = { format: { type: 'json_schema', schema: opts.schema.schema } };
  return body;
}

function usageFromOpenRouter(json) {
  var u = (json && json.usage) || {};
  return {
    promptTokens: u.prompt_tokens == null ? null : Number(u.prompt_tokens),
    completionTokens: u.completion_tokens == null ? null : Number(u.completion_tokens),
    totalTokens: u.total_tokens == null ? null : Number(u.total_tokens),
    costUsd: u.cost == null ? null : Number(u.cost)
  };
}
function usageFromAnthropic(json) {
  var u = (json && json.usage) || {};
  return {
    promptTokens: u.input_tokens == null ? null : Number(u.input_tokens),
    completionTokens: u.output_tokens == null ? null : Number(u.output_tokens),
    totalTokens: (u.input_tokens == null || u.output_tokens == null) ? null : Number(u.input_tokens) + Number(u.output_tokens),
    costUsd: null // the Messages API does not price the call; see LLM_MONTHLY_BUDGET_USD
  };
}

function contentFromOpenRouter(json) {
  var c = json && json.choices && json.choices[0] && json.choices[0].message;
  return c ? (typeof c.content === 'string' ? c.content : JSON.stringify(c.content)) : '';
}
function contentFromAnthropic(json) {
  var parts = (json && json.content) || [];
  var out = '';
  for (var i = 0; i < parts.length; i++) if (parts[i] && parts[i].type === 'text') out += parts[i].text;
  return out;
}

async function send(provider, bodyObj) {
  var bodyString = JSON.stringify(bodyObj);
  var bytes = Buffer.byteLength(bodyString);
  if (bytes > MAX_REQUEST_BYTES) {
    throw llmError('The labelling prompt is ' + Math.round(bytes / 1024) + ' KB, over the ' + Math.round(MAX_REQUEST_BYTES / 1024) + ' KB request limit. Send fewer layers.', 413, false);
  }
  var opts = provider === 'openrouter'
    ? {
      method: 'POST', host: 'openrouter.ai', path: '/api/v1/chat/completions',
      headers: {
        Authorization: 'Bearer ' + OPENROUTER_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': bytes,
        'HTTP-Referer': REFERER,
        'X-Title': TITLE
      }
    }
    : {
      method: 'POST', host: 'api.anthropic.com', path: '/v1/messages',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
        'Content-Type': 'application/json',
        'Content-Length': bytes
      }
    };
  return httpJson(opts, bodyString);
}

// chat({ system, user, schema, label }) -> { json, usage, model, provider, raw }
// Throws an Error with .statusCode on every failure path. Callers must treat a throw as
// "no labels from the model" and fall back — never as a failed request.
async function chat(opts) {
  if (!configured()) throw llmError('No LLM provider is configured (set OPENROUTER_API_KEY or ANTHROPIC_API_KEY).', 503, false);
  if (inFlight >= MAX_CONCURRENT) throw llmError('Too many labelling requests in flight (' + MAX_CONCURRENT + ' max). Try again in a moment.', 429, true);

  var guard = await budget();
  if (!guard.ok) {
    throw llmError('Refusing the model call: the configured budget is exhausted' +
      (guard.remainingUsd != null ? ' ($' + guard.remainingUsd.toFixed(2) + ' left, floor $' + MIN_REMAINING_USD.toFixed(2) + ')' : '') +
      '.' + (guard.note ? ' ' + guard.note : ''), 402, false);
  }

  inFlight++;
  var started = Date.now();
  try {
    var r, structured = true;
    if (PROVIDER === 'openrouter') {
      r = await send('openrouter', openRouterBody(opts));
    } else {
      r = await send('anthropic', anthropicBody(opts, true));
      // One retry without output_config if the API rejects that field. Anything else is a real error.
      if (r.status === 400 && /output_config|json_schema|unexpected|unknown/i.test(String(r.text || ''))) {
        structured = false;
        r = await send('anthropic', anthropicBody(opts, false));
      }
    }

    if (r.status === 401 || r.status === 403) throw llmError('The model provider rejected our credentials (' + r.status + ').', 502, false);
    if (r.status === 429) throw llmError('The model provider rate-limited us (429).', 429, true);
    if (r.status === 402) throw llmError('The model provider reports the account is out of credit (402).', 402, false);
    if (r.status < 200 || r.status >= 300) {
      var detail = r.json && r.json.error && r.json.error.message ? r.json.error.message : String(r.text || '').slice(0, 200);
      throw llmError('Model provider returned ' + r.status + ': ' + scrub(detail), 502, r.status >= 500);
    }
    if (!r.json) throw llmError('Model provider returned a non-JSON response.', 502, true);
    if (r.json.error) throw llmError('Model provider error: ' + scrub(r.json.error.message || 'unknown'), 502, false);

    var text = PROVIDER === 'openrouter' ? contentFromOpenRouter(r.json) : contentFromAnthropic(r.json);
    var usage = PROVIDER === 'openrouter' ? usageFromOpenRouter(r.json) : usageFromAnthropic(r.json);

    var parsed;
    try { parsed = JSON.parse(stripFence(text)); }
    catch (e) { throw llmError('The model did not return parseable JSON.', 502, true); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw llmError('The model returned JSON that is not an object.', 502, true);

    if (usage.costUsd != null) _localSpendUsd += usage.costUsd;

    // Per-call usage log. Tokens and cost only — never the prompt, never the key.
    console.log('[llm] ' + (opts.label || 'call') + ' provider=' + PROVIDER + ' model=' + MODEL +
      ' in=' + (usage.promptTokens == null ? '?' : usage.promptTokens) +
      ' out=' + (usage.completionTokens == null ? '?' : usage.completionTokens) +
      ' cost=' + (usage.costUsd == null ? 'n/a' : '$' + usage.costUsd.toFixed(6)) +
      ' ms=' + (Date.now() - started) +
      (structured ? '' : ' (plain-text fallback)'));

    return { json: parsed, usage: usage, model: MODEL, provider: PROVIDER, structured: structured };
  } finally {
    inFlight--;
  }
}

module.exports = {
  info: info,
  configured: configured,
  budget: budget,
  chat: chat,
  slots: slots,
  scrub: scrub,
  PROVIDER: PROVIDER,
  MODEL: MODEL,
  DEFAULT_MODEL: DEFAULT_MODEL,
  MAX_CONCURRENT: MAX_CONCURRENT
};
