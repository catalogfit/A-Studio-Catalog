// Fabric icon resolution: canvas (production, then ICON BANK) first, the plugin's catalogue copy
// last, and an honest gap for names nobody knows. Uses renderer.js's real resolver against
// hand-built node trees shaped like the Figma file (backend/icons/index.json).
// No Figma, no network. Run: (cd plugin-src/test && npm test)
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.join(__dirname, '..');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(SRC, 'icon-fallback.js'), 'utf8'), ctx);
const r = fs.readFileSync(path.join(SRC, 'renderer.js'), 'utf8');
vm.runInContext(r.slice(r.indexOf('var ICON_RING_D'), r.indexOf('function rowFromManifest')), ctx);

function N(type, name, box, kids, extra) {
  const n = Object.assign({ type, name, visible: true, absoluteBoundingBox: box }, extra || {});
  if (kids) {
    n.children = kids; kids.forEach(k => { k.parent = n; });
    n.findAll = f => { const o = []; (function w(x) { (x.children || []).forEach(c => { if (f(c)) o.push(c); w(c); }); })(n); return o; };
  }
  return n;
}
function page(kids) {
  const p = N('PAGE', 'Page 2', null, kids);
  p.findAllWithCriteria = ({ types }) => p.findAll(n => types.includes(n.type));
  return p;
}
// Odour Free as catalogued: Group 1130:4906 > Group 1130:4907 > {Ellipse 33.75, Vector 17.21}, label beside
function odourFree(x, y) {
  const D = 33.752941, G = 17.211765;
  const ell = N('ELLIPSE', 'Ellipse', { x, y, width: D, height: D });
  const vec = N('VECTOR', 'Vector', { x: x + (D - G) / 2, y: y + (D - G) / 2, width: G, height: G });
  const lab = N('TEXT', 'Odour Free', { x: x - 5, y: y + D + 6, width: 44, height: 12 }, null, { characters: 'Odour Free' });
  const inner = N('GROUP', 'Group', { x, y, width: D, height: D }, [ell, vec]);
  return N('GROUP', 'Group 1244830616', { x: x - 5, y, width: 44, height: D + 18 }, [inner, lab]);
}

test('Odour-Free resolves to the ICON BANK copy when it is on the canvas, scaled by its own ring', () => {
  const idx = ctx.buildIconIndex(page([odourFree(68481, 13903)]));
  const hit = ctx.resolveIcon(idx, 'Odour-Free');
  assert.ok(hit); assert.equal(hit.source, 'bank'); assert.equal(hit.entry.name, 'Odour Free');
  assert.ok(Math.abs(ctx.iconBankScale(hit.entry) - 4.4695) < 0.001);
});

test('Odour-Free falls back to the plugin catalogue when no page has it', () => {
  const idx = ctx.buildIconIndex(page([]));
  const hit = ctx.resolveIcon(idx, 'Odour-Free');
  assert.ok(hit, 'resolved'); assert.equal(hit.source, 'catalogue'); assert.equal(hit.entry.name, 'Odour Free');
  assert.match(hit.entry.svg, /^<svg[\s\S]*<path/); assert.ok(hit.entry.glyphRatio > 0.4 && hit.entry.glyphRatio < 0.6);
});

test('the canvas copy wins over the catalogue copy', () => {
  const hit = ctx.resolveIcon(ctx.buildIconIndex(page([odourFree(0, 0)])), 'odour free');
  assert.equal(hit.source, 'bank');
});

test('an unknown name stays an honest gap — nothing is substituted', () => {
  const idx = ctx.buildIconIndex(page([odourFree(0, 0)]));
  assert.equal(ctx.resolveIcon(idx, 'Odourless'), null);
  assert.equal(ctx.resolveIcon(idx, 'Stretchy Odour'), null);
});

test('the rebuilt label keeps the sheet spelling, except through an alias', () => {
  assert.equal(ctx.iconLabelText({ via: 'normalised', entry: { name: 'Odour Free' } }, 'Odour-Free'), 'Odour-Free');
  assert.equal(ctx.iconLabelText({ via: 'normalised', entry: { name: 'Odour Free' } }, 'odour-free'), 'Odour Free');
  assert.equal(ctx.iconLabelText({ via: 'alias', entry: { name: 'Super-Soft' } }, 'Soft'), 'Super-Soft');
});

test('only clean vector glyphs are bundled (no rasters, no grey export backgrounds)', () => {
  for (const k of Object.keys(ctx.ICON_FALLBACK)) {
    const svg = ctx.ICON_FALLBACK[k].svg;
    assert.doesNotMatch(svg, /<image\b/, k);
    assert.doesNotMatch(svg, /fill="#9A9A9A"/i, k);
  }
  assert.ok(ctx.ICON_FALLBACK['odour free'], 'Odour Free is bundled');
});
