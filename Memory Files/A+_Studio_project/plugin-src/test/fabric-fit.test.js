// Fabric-in-Focus fit: long fabric copy must not push the icon row out of the fabric card.
// Runs renderer.js's fitFabricStack against every bundled template's real measurements, with a
// simple text model (0.5 x size per character, 1.3 x line height) standing in for Figma layout.
// No Figma, no network. Run: (cd plugin-src/test && npm test)
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.join(__dirname, '..');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(SRC, 'manifest-fallback.js'), 'utf8') + ';this.M = FALLBACK_MANIFESTS;', ctx);
const r = fs.readFileSync(path.join(SRC, 'renderer.js'), 'utf8');
vm.runInContext(r.slice(r.indexOf('var FAB_MIN_GAP'), r.indexOf('function stack(')), ctx);

const FIXED = 475;   // heading + divider + composition + icon row + gaps, measured off the designs
const SHORT = 'COMFORtech is our signature fabric, brushed for cotton-like smoothness with an odour-free finish that lasts. Lightweight by design, it moves with you effortlessly.';
const LONG = 'Hyper Soft is a high-performance polyester fabric crafted for exceptional softness. Smooth against the skin, it delivers lasting comfort without compromising on durability. The high lycra content offers Super Stretch freedom while maintaining structure through every motion. FLY-DRY is our patented fabric technology that wicks moisture from the skin for faster evaporation keeping you dry and comfortable.';

function run(key, copyText) {
  const fb = ctx.M[key].fabric, ts = fb.textStack;
  const copy = {
    fontSize: ts.copy.size, width: ts.copy.width, textAutoResize: '',
    resize(w) { this.width = w; },
    get height() { const perLine = Math.floor(this.width / (0.5 * this.fontSize)); return Math.ceil(copyText.length / perLine) * 1.3 * this.fontSize; }
  };
  const cols = { y: ts.y, get height() { return FIXED + copy.height; } };
  const warn = [];
  const res = ctx.fitFabricStack(fb, ts, cols, copy, warn);
  const limit = fb.box.y + Math.min(fb.box.h, fb.bgPhoto.y + fb.bgPhoto.h) - ctx.FAB_BOTTOM_PAD;
  return { res, cols, copy, warn, limit, ts };
}

for (const key of Object.keys(ctx.M)) {
  test(key + ': short copy renders exactly as designed', () => {
    const { cols, copy, warn, ts } = run(key, SHORT);
    assert.equal(cols.y, ts.y); assert.equal(copy.fontSize, ts.copy.size); assert.equal(warn.length, 0);
  });
  test(key + ': long copy keeps the icon row inside the card', () => {
    const { res, cols, copy, limit, ts, warn } = run(key, LONG);
    assert.ok(res.fits, 'fits'); assert.ok(cols.y + cols.height <= limit + 0.5, 'bottom inside the card');
    assert.ok(cols.y <= ts.y, 'never placed below the design position');
    assert.ok(copy.fontSize >= Math.round(ts.copy.size * 0.8), 'copy never below 80 %');
    assert.equal(warn.length, 1, 'the adjustment is reported');
  });
  test(key + ': impossible copy is reported, not hidden', () => {
    const { res, warn } = run(key, 'x'.repeat(900));
    assert.equal(res.fits, false); assert.match(warn[0], /Shorten the fabric copy/);
  });
}
