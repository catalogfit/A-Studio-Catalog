// ===== A+ Studio · tiny in-memory rate limiter (no deps) =====
// Fixed-window counters keyed by an arbitrary string (a session hash, a client IP). In-memory is
// the right size for one Render instance: a restart resets the counters, which only ever errs on
// the side of letting a legitimate user through.
//
//   var rl = limiter({ windowMs: 60000, max: 30 });
//   var verdict = rl.hit(key);     // { ok: true, remaining } or { ok: false, retryAfter }

function limiter(opts) {
  var windowMs = Math.max(1000, Number(opts && opts.windowMs) || 60000);
  var max = Math.max(1, Number(opts && opts.max) || 60);
  var buckets = new Map();

  function sweep(now) {
    if (buckets.size < 5000) return;
    buckets.forEach(function (b, k) { if (now - b.start >= windowMs) buckets.delete(k); });
  }

  return {
    max: max,
    windowMs: windowMs,
    hit: function (key) {
      var now = Date.now();
      key = String(key || 'anon');
      var b = buckets.get(key);
      if (!b || now - b.start >= windowMs) { b = { start: now, n: 0 }; buckets.set(key, b); sweep(now); }
      b.n++;
      if (b.n > max) return { ok: false, retryAfter: Math.max(1, Math.ceil((b.start + windowMs - now) / 1000)) };
      return { ok: true, remaining: max - b.n };
    },
    reset: function () { buckets.clear(); }
  };
}

// The caller's IP. Render (and most proxies) put the real client first in X-Forwarded-For.
function clientIp(req) {
  var xf = req.headers && req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

module.exports = { limiter: limiter, clientIp: clientIp };
