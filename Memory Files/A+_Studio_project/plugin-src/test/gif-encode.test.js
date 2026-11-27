// GIF export: the properties the encoder's size and smoothness depend on.
// These are the parts that can be checked without Figma, a browser or a video file — the
// dithering, the frame-delay arithmetic and the change-detection threshold. The visual result
// still needs a real export to judge.
// Run: (cd plugin-src/test && npm test)
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');

// Pull the pure helpers out of export.js. They sit inside one big IIFE that expects a browser,
// so the functions are extracted by name rather than by running the file.
const SRC = fs.readFileSync(path.join(__dirname, '..', 'ui', 'export.js'), 'utf8');
function slice(from, to) {
  const a = SRC.indexOf(from), b = SRC.indexOf(to, a);
  assert.ok(a >= 0 && b > a, 'could not find ' + from + ' .. ' + to + ' in export.js');
  return SRC.slice(a, b);
}
const ctx = vm.createContext({});
vm.runInContext(slice('var GIF_RATES', 'async function gifPalettes'), ctx);
vm.runInContext(slice('var BAYER8', 'function gifEncoder'), ctx);
vm.runInContext('this.gifFps = gifFps; this.ditherOrdered = ditherOrdered; this.ditherFS = ditherFS;', ctx);

// A small palette and two "video frames" that differ only by ±2 per channel — the scale of
// sensor and compression noise, well below a visible step.
const PAL = [];
for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++) PAL.push([r * 51, g * 51, b * 51]);
const W = 48, H = 32;
function frame(seed, noise) {
  const d = new Uint8ClampedArray(W * H * 4);
  let s = seed;
  for (let i = 0; i < W * H; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const n = noise ? ((s >> 16) % (2 * noise + 1)) - noise : 0;
    // a smooth gradient, the case that bands worst without dithering
    const base = 40 + Math.floor(160 * (i % W) / W);
    d[i * 4] = base + n; d[i * 4 + 1] = base + n; d[i * 4 + 2] = base + n; d[i * 4 + 3] = 255;
  }
  return d;
}
function changed(a, b) { let c = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) c++; return c; }

test('gifFps snaps to a rate that divides 100, so every frame delay is identical', () => {
  assert.equal(ctx.gifFps(30), 25, '30 fps must not be used: it needs 3.33cs');
  assert.equal(ctx.gifFps(24), 25);
  assert.equal(ctx.gifFps(60), 50);
  assert.equal(ctx.gifFps(12), 10);
  for (const want of [10, 12, 24, 25, 30, 50, 60]) {
    assert.equal(100 % ctx.gifFps(want), 0, ctx.gifFps(want) + ' does not divide 100');
  }
});

test('the chosen rates produce a constant centisecond delay (no judder)', () => {
  for (const fps of ctx.GIF_RATES) {
    let prevCs = 0; const delays = [];
    for (let i = 0; i < 20; i++) { const cs = Math.round((i + 1) * 100 / fps); delays.push(cs - prevCs); prevCs = cs; }
    assert.equal(new Set(delays).size, 1, fps + ' fps gave uneven delays: ' + delays.join(','));
  }
  // and the rate that was in use before does not
  let prevCs = 0; const bad = [];
  for (let i = 0; i < 20; i++) { const cs = Math.round((i + 1) * 100 / 30); bad.push(cs - prevCs); prevCs = cs; }
  assert.ok(new Set(bad).size > 1, '30 fps was expected to be uneven — this test guards the reason for snapping');
});

test('ordered dithering is temporally stable: identical input gives identical indices', () => {
  const a = ctx.ditherOrdered(frame(1, 0), W, H, PAL, 0.55);
  const b = ctx.ditherOrdered(frame(1, 0), W, H, PAL, 0.55);
  assert.equal(changed(a, b), 0);
});

test('ordered dithering barely moves under source noise; Floyd-Steinberg moves a lot', () => {
  const base = frame(1, 0);
  const noisy = frame(1, 2);                    // same picture, +-2 per channel
  const ordA = ctx.ditherOrdered(base, W, H, PAL, 0.55);
  const ordB = ctx.ditherOrdered(noisy, W, H, PAL, 0.55);
  const fsA = ctx.ditherFS(base, W, H, PAL, 0.75);
  const fsB = ctx.ditherFS(noisy, W, H, PAL, 0.75);

  const ordPct = 100 * changed(ordA, ordB) / ordA.length;
  const fsPct = 100 * changed(fsA, fsB) / fsA.length;
  // This is the whole reason the animation uses ordered dithering: Floyd-Steinberg propagates
  // error along the scanline, so one noisy pixel re-rolls everything after it and nothing diffs
  // away to transparent. That is what produced a 22 MB GIF instead of ~3-5 MB.
  assert.ok(fsPct > ordPct * 2,
    'expected Floyd-Steinberg to be far less stable than ordered: FS ' + fsPct.toFixed(1) +
    '% vs ordered ' + ordPct.toFixed(1) + '%');
});

test('ordered dithering breaks a flat tone between two palette entries into a mix', () => {
  // This, not "a gradient spans more levels", is what dithering does: it cannot invent palette
  // entries, it distributes the ones it has so the EYE averages them to the in-between colour.
  // So the test is a flat patch whose colour falls between two entries — plain nearest must
  // give exactly one index (that is the banding), ordered must give both.
  // Palette spacing is 16 here, the order an adaptive 255-colour palette gives inside a smooth
  // region, and within reach of the dither amplitude (0.55 * 32 / 2 ~= 9 levels).
  const FINE = [];
  for (let v = 0; v <= 255; v += 16) FINE.push([v, v, v]);
  const flat = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {        // 100 sits between the 96 and 112 entries
    flat[i * 4] = 100; flat[i * 4 + 1] = 100; flat[i * 4 + 2] = 100; flat[i * 4 + 3] = 255;
  }
  const none = ctx.ditherOrdered(flat, W, H, FINE, 0);      // strength 0 == plain nearest
  const dithered = ctx.ditherOrdered(flat, W, H, FINE, 0.55);
  assert.equal(new Set(none).size, 1, 'undithered flat tone should collapse to a single entry');
  assert.ok(new Set(dithered).size >= 2,
    'ordered dithering should mix at least two entries across a flat in-between tone');
  // and it must stay deterministic: same input, same output, every frame
  assert.equal(changed(dithered, ctx.ditherOrdered(flat, W, H, FINE, 0.55)), 0);
});

test('the change threshold treats noise as unchanged but a real step as changed', () => {
  // mirrors closeIdx in gifEncoder: dr^2*2 + dg^2*4 + db^2*3 <= GIF_DIFF_T
  const T = Number(/var GIF_DIFF_T = (\d+)/.exec(SRC)[1]);
  const dist = (a, b) => {
    const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    return dr * dr * 2 + dg * dg * 4 + db * db * 3;
  };
  assert.ok(dist([100, 100, 100], [102, 102, 102]) <= T, 'a +-2 noise step must count as unchanged');
  assert.ok(dist([100, 100, 100], [100, 100, 100]) <= T, 'identical must count as unchanged');
  assert.ok(dist([100, 100, 100], [110, 110, 110]) > T, 'a visible 10-level step must count as changed');
  assert.ok(dist([100, 100, 100], [100, 106, 100]) > T, 'green is weighted most and must trip at ~6');
});
