// Export panel, sandbox side: runs the real built plugin/code.js against a mocked Figma page.
// No network, no Figma. Run: (cd plugin-src/test && npm test)  — or: node --test export-sandbox.test.js
const test = require('node:test'), assert = require('node:assert/strict'), path = require('path');
const fs = require('fs'), vm = require('vm');
const code = fs.readFileSync(path.join(__dirname, '..', '..', 'plugin', 'code.js'), 'utf8');
let uid = 0;
function text(chars, extra) { return Object.assign({ type: 'TEXT', id: 't' + (++uid), name: chars, characters: chars, x: 0, y: 0, width: 50, height: 20 }, extra || {}); }
function frame(name, kids, opts) {
  const f = Object.assign({ type: 'FRAME', id: 'f' + (++uid), name, x: 0, y: 0, width: 1572, height: 5000, children: kids || [], _pd: {} }, opts || {});
  f.getPluginData = k => f._pd[k] || ''; f.setPluginData = (k, v) => { f._pd[k] = v; };
  f.findAllWithCriteria = ({ types }) => { const out = []; (function walk(n) { (n.children || []).forEach(c => { if (types.includes(c.type)) out.push(c); walk(c); }); })(f); return out; };
  f.exportAsync = async (s) => { f._lastExport = s; return new Uint8Array([1, 2, 3]); };
  f.children.forEach(c => c.parent = f);
  return f;
}
const tagged = frame('A+ build', [text('RUN')]); tagged.setPluginData('aplus', JSON.stringify({ v: 1, styleIds: ['708202'], category: 'running', gender: 'women', templateKey: 'running/women/template-1' }));
const heroOnly = frame('707041, 707042', [frame('hero', [text('TRAIN'), text('FEARLESS')])]);
const noCat = frame('710024', [text('COMFY')]);
const notAplus = frame('Moodboard', [text('hello')]);
const section = { type: 'SECTION', id: 's1', name: 'Section', children: [heroOnly, noCat] };
const page = { id: 'p1', name: 'Page 1', type: 'PAGE', children: [tagged, section, notAplus], selection: [] };
[tagged, section, notAplus].forEach(n => n.parent = page);
const posted = [];
const figma = {
  showUI() {}, notify() {}, on() {}, commitUndo() {},
  ui: { postMessage: m => posted.push(m), onmessage: null, resize() {} },
  clientStorage: { getAsync: async () => null, setAsync: async () => {}, keysAsync: async () => [] },
  currentPage: page, root: { children: [page] }, viewport: { scrollAndZoomIntoView() {} },
  getNodeByIdAsync: async id => [tagged, heroOnly, noCat, notAplus].find(n => n.id === id) || null,
  loadAllPagesAsync: async () => {}, mixed: Symbol('mixed'),
};
const ctx = vm.createContext({ figma, console, setTimeout, clearTimeout, Promise, JSON, Math, Date, Uint8Array, __html__: '' });
vm.runInContext(code, ctx);
const ask = async (m) => { posted.length = 0; await figma.ui.onmessage(m); await new Promise(r => setTimeout(r, 30)); return posted.find(p => p.type === 'reply' && p.reqId === m.reqId); };
// values built inside the vm are from another realm; compare plain JSON copies
const plain = x => JSON.parse(JSON.stringify(x));
test('export handlers: select all, scan, render, errors', async () => {
  await new Promise(r => setTimeout(r, 50));
  let r = await ask({ type: 'export-select-all', reqId: 'a' });
  assert.equal(r.result.count, 3, 'three A+ frames (one inside a section twice over), moodboard ignored');
  assert.deepEqual(plain(page.selection.map(n => n.name)), ['A+ build', '707041, 707042', '710024']);
  r = await ask({ type: 'export-scan', reqId: 'b', scope: 'selection' });
  const [a, b, c] = r.result.frames;
  assert.deepEqual(plain([a.ids, a.category, a.gender, a.source]), [['708202'], 'running', 'women', 'tag']);
  assert.deepEqual(plain([b.ids, b.category, b.source]), [['707041', '707042'], 'training', 'hero']);
  assert.deepEqual(plain([c.ids, c.category]), [['710024'], null]);
  r = await ask({ type: 'export-frame', reqId: 'c', frameId: tagged.id, format: 'PNG', width: 582 });
  assert.deepEqual(plain(tagged._lastExport), { format: 'PNG', constraint: { type: 'WIDTH', value: 582 } });
  assert.equal(r.result.width, 582);
  r = await ask({ type: 'export-frame', reqId: 'd', frameId: heroOnly.id, format: 'JPG', scale: 2 });
  assert.deepEqual(plain(heroOnly._lastExport), { format: 'JPG', constraint: { type: 'SCALE', value: 2 } });
  r = await ask({ type: 'export-frame', reqId: 'e', frameId: 'gone', format: 'PNG' });
  assert.equal(r.ok, false); assert.match(r.error, /no longer on the canvas/);
  r = await ask({ type: 'export-frame', reqId: 'f', frameId: tagged.id, format: 'GIF' });
  assert.equal(r.ok, false); assert.match(r.error, /cannot export "GIF"/);
});
