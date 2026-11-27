// User templates, sandbox side: runs the REAL built plugin/code.js in a vm against a mocked Figma.
// Proves: capture extracts image BYTES -> saved to clientStorage within budget -> reload in a new
// plugin session -> build in a DIFFERENT file (old hashes do not resolve there) re-creates every
// image with createImage and remaps the hashes, sheet text fills the roles, missing images become
// labelled placeholders, and an over-quota store never breaks the templates already saved.
// Run: node --test user-templates-sandbox.test.js   (after node ../build.js)
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const CODE = fs.readFileSync(path.join(__dirname, '..', '..', 'plugin', 'code.js'), 'utf8');
const plain = x => JSON.parse(JSON.stringify(x));
let uid = 0;

// the shared mock (also used by the headless UI test): harness/figma-mock.js
const FM = require('./harness/figma-mock.js');
const { makeStorage, walk, png, buildDesign, sheetRow } = FM;
const sha1 = FM.contentHash;   // the mock's createImage content hash (Figma's is SHA-1)
function makeFigma(storage, images) { const posted = []; const env = FM.makeFigma(storage, images, m => posted.push(m)); env.posted = posted; return env; }
async function boot(storage, images) {
  const env = makeFigma(storage, images);
  const ctx = vm.createContext({ figma: env.figma, console, setTimeout, clearTimeout, Promise, JSON, Math, Date, Uint8Array, __html__: '' });
  vm.runInContext(CODE, ctx);
  await new Promise(r => setTimeout(r, 30));
  env.init = env.posted.find(m => m.type === 'init');
  env.ctx = ctx;
  env.send = async (m) => { const from = env.posted.length; await env.figma.ui.onmessage(m); await new Promise(r => setTimeout(r, 5)); return env.posted.slice(from); };
  env.ask = async (m) => { m.reqId = m.reqId || 'r' + (++uid); const out = await env.send(m); const r = out.find(p => p.type === 'reply' && p.reqId === m.reqId); assert.ok(r, 'no reply to ' + m.type); return r; };
  return env;
}

const TEMPLATE = { id: 'split-hero', label: 'Split hero', categoryId: 'yoga-pants', categoryLabel: 'Yoga Pants', genderId: 'women' };
const KEY = 'yoga-pants/women/split-hero';

test('capture -> bytes saved locally -> reload -> build in another file with images re-created', async () => {
  const storage = makeStorage();
  const photoBytes = png(300000, 1), textureBytes = png(40000, 2);
  const fileA = new Map([[sha1(photoBytes), photoBytes], [sha1(textureBytes), textureBytes]]);
  const A = await boot(storage, fileA);
  assert.deepEqual(plain(A.init.userTemplates.index), [], 'starts with no user templates');
  const frame = buildDesign(A.page, sha1(photoBytes), sha1(textureBytes));

  const out = await A.send({ type: 'capture-template', frameId: frame.id, pageId: A.page.id, template: TEMPLATE });
  const res = out.find(m => m.type === 'capture-result');
  assert.ok(res, 'capture-result posted: ' + JSON.stringify(out.find(m => m.type === 'capture-error')));
  const steps = [...new Set(out.filter(m => m.type === 'capture-progress').map(m => m.step))];
  assert.deepEqual(steps, ['scan', 'capture', 'classify', 'images', 'render-probe', 'diff', 'save-local'], 'progress for every stage, images included');
  assert.equal(res.key, KEY);
  assert.equal(res.images, 2, 'both image fills captured as assets');
  assert.equal(res.local.manifest, true);
  assert.equal(res.local.assetsStored, 2, 'both images fit the budget and are stored');
  assert.equal(res.entry.status, 'active', 'usable in Automate straight away (drafts are disabled there)');
  assert.equal(res.diff.mismatched, 0, 'round trip is clean: ' + JSON.stringify(res.diff.mismatches.slice(0, 3)));
  assert.ok(!res.warnings.some(w => /blank|missing/i.test(w)), 'no "renders blank" warning any more: ' + res.warnings.join(' | '));

  // what is in clientStorage: an index, one manifest, and each image ONCE as raw bytes
  const keys = [...storage.map.keys()].sort();
  assert.ok(keys.includes('capturedTemplateIndex'));
  assert.ok(keys.some(k => k.startsWith('capturedTemplate:' + KEY + '#')));
  const photoKey = 'capturedAsset:' + sha1(photoBytes);
  assert.ok(storage.map.get(photoKey) instanceof Uint8Array && storage.map.get(photoKey).length === 300000, 'image stored as bytes, not base64');
  const M = [...storage.map.entries()].find(([k]) => k.startsWith('capturedTemplate:'))[1];
  assert.equal(M.meta.categoryLabel, 'Yoga Pants', 'typed category label kept');
  assert.deepEqual(M.meta.assets.map(a => [a.hash, a.mime, a.bytes, a.width]).sort(), [[sha1(photoBytes), 'image/png', 300000, 640], [sha1(textureBytes), 'image/png', 40000, 640]].sort());
  assert.ok(storage.total() < 4400000);

  // a second save under the same key without "replace" is refused by the sandbox too
  const dup = await A.send({ type: 'capture-template', frameId: frame.id, pageId: A.page.id, template: TEMPLATE });
  assert.equal(dup.find(m => m.type === 'capture-error').code, 'exists');
  // and a bundled key can never be overwritten
  const bundled = await A.send({ type: 'capture-template', frameId: frame.id, pageId: A.page.id, template: { id: 'template-1', label: 'x', categoryId: 'running', genderId: 'women' }, replace: true });
  assert.equal(bundled.find(m => m.type === 'capture-error').code, 'bundled');

  // ---- plugin restart in a DIFFERENT Figma file: same clientStorage, but none of the images
  const fileB = new Map();
  const B = await boot(storage, fileB);
  assert.deepEqual(plain(B.init.userTemplates.index.map(e => [e.key, e.local.manifest, e.local.assetsStored, e.local.assetsTotal])), [[KEY, true, 2, 2]]);
  const cat = B.init.registry.categories.find(c => c.id === 'yoga-pants');
  assert.ok(cat && cat.label === 'Yoga Pants' && cat.userOnly, 'category created in the registry from the saved template');
  const tpl = cat.genders.find(g => g.id === 'women').templates[0];
  assert.deepEqual(plain([tpl.id, tpl.status, tpl.user]), ['split-hero', 'active', true]);
  assert.ok(!(KEY in B.init.manifests), 'manifests are not pushed through init; the UI asks for one');
  assert.equal(B.figma.getImageByHash(sha1(photoBytes)), null, 'precondition: the old hash does not resolve in file B');

  // Automate 'run' with this key and NO manifest from the UI: the sandbox loads it from clientStorage
  const row = sheetRow('706524', 'Yoga Pants', 'STRETCH FREE', 'Made to move', 'Women');
  const runOut = await B.send({ type: 'run', rows: [row], keys: [KEY], errors: [null], manifests: {}, source: 'user' });
  const done = runOut.find(m => m.type === 'done');
  assert.ok(done, 'run finished: ' + JSON.stringify(runOut.find(m => m.type === 'error')));
  assert.equal(done.report[0].ok, true, JSON.stringify(done.report));
  const built = B.page.children.find(n => n.type === 'FRAME');
  const fills = []; walk(built, n => (n.fills || []).forEach(p => p.type === 'IMAGE' && fills.push([n.name, p.imageHash])));
  assert.equal(B.figma._created.length, 2, 'both images re-created with figma.createImage');
  // the texture keeps its image (art direction); the photo slot is blanked to the placeholder grey by design
  assert.deepEqual(fills, [['Texture', sha1(textureBytes)]], 'hashes remapped to images that exist in file B');
  assert.ok(fileB.has(sha1(textureBytes)));
  const texts = []; walk(built, n => n.type === 'TEXT' && texts.push(n.characters));
  assert.ok(texts.includes('STRETCH'), 'hero.word filled from the sheet: ' + texts.join(' | '));
  assert.ok(texts.includes('Made to move'), 'hero.tagline filled from the sheet');
  assert.ok(texts.some(t => /^\+ /.test(t)), 'photo slot carries its "+ label" placeholder');
  assert.equal(JSON.parse(built.getPluginData('aplus')).templateKey, KEY, 'frame tagged for Export');

  // ---- usertpl-get returns the bytes (what Drive upload and "Export file" use)
  const got = await B.ask({ type: 'usertpl-get', key: KEY, assets: true });
  assert.equal(got.result.assets.length, 2); assert.deepEqual(plain(got.result.missing), []);
  assert.equal(got.result.assets.find(a => a.hash === sha1(photoBytes)).data.length, 300000);
});

test('missing image -> labelled placeholder + warning, never a crash', async () => {
  const storage = makeStorage();
  const photoBytes = png(5000, 3), textureBytes = png(4000, 4);
  const A = await boot(storage, new Map([[sha1(photoBytes), photoBytes], [sha1(textureBytes), textureBytes]]));
  const frame = buildDesign(A.page, sha1(photoBytes), sha1(textureBytes));
  await A.send({ type: 'capture-template', frameId: frame.id, pageId: A.page.id, template: TEMPLATE });
  // lose the texture's bytes on this computer (e.g. it did not fit), then build in a new file
  storage.map.delete('capturedAsset:' + sha1(textureBytes));
  const B = await boot(storage, new Map());
  const out = await B.send({ type: 'run', rows: [sheetRow('706524', 'Yoga Pants', 'GO', '', 'Women')], keys: [KEY], errors: [null], manifests: {}, source: 'user' });
  const done = out.find(m => m.type === 'done');
  assert.equal(done.report[0].ok, true);
  assert.ok(done.report[0].warnings.some(w => /1 image\(s\).*\[image missing\]/.test(w) && /Texture/.test(w)), done.report[0].warnings.join(' | '));
  const built = B.page.children.find(n => n.type === 'FRAME');
  const names = []; walk(built, n => names.push(n.name));
  assert.ok(names.includes('[image missing] Texture'), 'placeholder layer is labelled');
  const tex = []; walk(built, n => n.name === '[image missing] Texture' && tex.push(n.fills[0]));
  assert.equal(tex[0].type, 'SOLID'); assert.equal(tex[0].opacity, 0.07, 'placeholder keeps the paint opacity');
});

test('quota: an oversized template is refused locally with a clear reason; the others survive', async () => {
  const storage = makeStorage();
  // something else already uses 3.9 MB of the 5 MB (another feature's cache)
  storage.map.set('tplcache:m:big', 'x'.repeat(3900000));
  const small = png(20000, 5), big = png(900000, 6);
  const images = new Map([[sha1(small), small], [sha1(big), big]]);
  const A = await boot(storage, images);
  // first template: small, fits
  const f1 = buildDesign(A.page, sha1(small), sha1(small));
  let res = (await A.send({ type: 'capture-template', frameId: f1.id, pageId: A.page.id, template: { ...TEMPLATE, id: 'small' } })).find(m => m.type === 'capture-result');
  assert.equal(res.local.manifest, true); assert.equal(res.local.assetsStored, 1);
  // second template: its 900 KB photo cannot fit in what is left -> manifest kept, image left out, said so
  const f2 = buildDesign(A.page, sha1(big), sha1(small));
  res = (await A.send({ type: 'capture-template', frameId: f2.id, pageId: A.page.id, template: { ...TEMPLATE, id: 'big' } })).find(m => m.type === 'capture-result');
  assert.equal(res.local.manifest, true);
  assert.equal(res.local.assetsStored, 1, 'the shared small image counts once; the big one is left out');
  assert.match(res.local.reason, /1 of 2 image\(s\) did not fit on this computer/);
  assert.ok(storage.total() <= 4400000, 'stays under the safe budget: ' + storage.total());
  // the session still holds the big image, so a Drive upload / export right now has everything
  const got = await A.ask({ type: 'usertpl-get', key: 'yoga-pants/women/big', assets: true });
  assert.equal(got.result.assets.length, 2);

  // now the store fills up completely: the manifest itself no longer fits -> nothing written, clear message
  storage.map.set('tplcache:m:big2', 'y'.repeat(4400000 - storage.total() - 3000));
  const f3 = buildDesign(A.page, sha1(small), sha1(small));
  res = (await A.send({ type: 'capture-template', frameId: f3.id, pageId: A.page.id, template: { ...TEMPLATE, id: 'third' } })).find(m => m.type === 'capture-result');
  assert.equal(res.local.manifest, false);
  assert.match(res.local.reason, /This computer has .* of template space left/);

  // a write Figma itself rejects mid-save rolls back only that template
  storage.failNext = 1;
  const f4 = buildDesign(A.page, sha1(small), sha1(small));
  storage.map.delete('tplcache:m:big2');
  res = (await A.send({ type: 'capture-template', frameId: f4.id, pageId: A.page.id, template: { ...TEMPLATE, id: 'fourth' } })).find(m => m.type === 'capture-result');
  assert.equal(res.local.manifest, false); assert.match(res.local.reason, /Figma refused to store/);

  const list = (await A.ask({ type: 'usertpl-list' })).result;
  assert.deepEqual(plain(list.index.map(e => e.key)).sort(), ['yoga-pants/women/big', 'yoga-pants/women/small'], 'earlier templates intact');
  assert.ok(list.usage.total <= list.usage.budget && list.usage.budget === 4400000 && list.usage.quota === 5000000);
  assert.ok(!storage.map.has('capturedAsset:' + sha1(big)));

  // remove one: its manifest goes, the image the other template still uses stays
  await A.ask({ type: 'usertpl-remove', key: 'yoga-pants/women/small' });
  assert.ok(storage.map.has('capturedAsset:' + sha1(small)), 'shared image kept for the remaining template');
  await A.ask({ type: 'usertpl-remove', key: 'yoga-pants/women/big' });
  assert.ok(!storage.map.has('capturedAsset:' + sha1(small)), 'last reference gone -> image deleted');
  assert.ok(![...storage.map.keys()].some(k => k.startsWith('capturedTemplate:')), 'no orphaned manifests');
});

test('import / Drive download path: usertpl-put validates and stores; stage serves a session-only build', async () => {
  const storage = makeStorage();
  const A = await boot(storage, new Map());
  const bad = await A.ask({ type: 'usertpl-put', manifest: { schema: 'nope' }, assets: [] });
  assert.equal(bad.ok, false); assert.equal(bad.code, 'bad-template');
  const noContent = await A.ask({ type: 'usertpl-put', manifest: { schema: 'aplus.template/2', renderer: 'aplus-capture-v1', meta: { key: 'a/b/c', category: 'a', gender: 'b', id: 'c' }, root: { type: 'FRAME' }, fonts: {} }, assets: [] });
  assert.match(noContent.error, /sheet mapping/);
  const img = png(3000, 9);
  const M = {
    schema: 'aplus.template/2', renderer: 'aplus-capture-v1',
    meta: { key: 'shorts/men/imported', category: 'shorts', categoryLabel: 'Shorts', gender: 'men', id: 'imported', label: 'Imported', width: 100, height: 100,
      assets: [{ hash: sha1(img), name: sha1(img) + '.png', mime: 'image/png', bytes: 3000, width: 10, height: 10 }] },
    fonts: { 'Inter|Regular': { family: 'Inter', style: 'Regular', fallback: 'regular' } },
    palette: { slotFill: [205, 209, 214], slotLabel: [70, 76, 84], label: [130, 130, 130] },
    roles: {}, slots: [], warnings: [],
    content: { styleIdColumn: 1, headlineColumn: 6, taglineColumn: 7, fabricCopyColumn: 8, compositionColumn: 9, iconsColumn: 10, cardColumns: [11, 12], callouts: { min: 1, max: 1 }, comparison: { defaults: ['Regular fit', 'Slim fit'] } },
    root: { type: 'FRAME', path: '0', props: { name: 'Imported', width: 100, height: 100 }, children: [
      { type: 'RECTANGLE', path: '0/0', props: { name: 'Logo', width: 50, height: 50, fills: [{ type: 'IMAGE', imageHash: sha1(img), scaleMode: 'FIT' }] } }] }
  };
  const ok = await A.ask({ type: 'usertpl-put', manifest: M, assets: [{ hash: sha1(img), mime: 'image/png', data: img }], drive: { fileId: 'F1', folderId: 'D1' } });
  assert.equal(ok.ok, true); assert.equal(ok.result.local.assetsStored, 1);
  const again = await A.ask({ type: 'usertpl-put', manifest: M, assets: [] });
  assert.equal(again.code, 'exists', 'no silent overwrite');
  const list = (await A.ask({ type: 'usertpl-list' })).result.index;
  assert.deepEqual(plain(list[0].drive), { fileId: 'F1', folderId: 'D1' });
  const st = (await A.ask({ type: 'usertpl-status', key: 'shorts/men/imported' })).result;
  assert.deepEqual(plain(st), { manifest: true, missing: [] });

  // a Drive-only template on a new machine: staged for this session, built, nothing persisted
  const B = await boot(makeStorage(), new Map());
  await B.ask({ type: 'usertpl-stage', key: 'shorts/men/imported', manifest: M, assets: [{ hash: sha1(img), data: img }] });
  const out = await B.send({ type: 'run', rows: [sheetRow('700001', 'Shorts', '', '', 'Men')], keys: ['shorts/men/imported'], errors: [null], manifests: { 'shorts/men/imported': M }, source: 'user' });
  assert.ok(out.find(m => m.type === 'done'), JSON.stringify(out.filter(m => m.type === 'error')));
  assert.equal(out.find(m => m.type === 'done').report[0].ok, true, JSON.stringify(out.find(m => m.type === 'done').report));
  const logo = []; walk(B.page, n => n.name === 'Logo' && logo.push(n.fills[0].imageHash));
  assert.deepEqual(logo, [sha1(img)], 'image re-created from the staged bytes');
});
