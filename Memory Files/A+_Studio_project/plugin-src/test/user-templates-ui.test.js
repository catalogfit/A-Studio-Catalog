// User templates, end to end in headless Chrome: the REAL built plugin/ui.html in an iframe of an
// https page (as in Figma), talking to the REAL built plugin/code.js running on the Figma mock
// (harness/figma-mock.js) in the host page. Google Drive and the A+ backend are FAKES inside the
// page (fetch / XMLHttpRequest are replaced in the plugin iframe), so every request the UI makes is
// recorded and its shape asserted. No network, no real account.
//
// Covers: free-text category -> save -> registry refresh in Automate's picker -> My templates ->
// Replace / Save as new -> Drive upload request shape -> export file (download) -> delete (Drive bin)
// -> import file -> Drive failure + Retry -> a second machine: Drive-only template listed, fetched
// lazily with progress, built with its images re-created.
// Run: node --test user-templates-ui.test.js   (after node ../build.js)
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), os = require('os');
const puppeteer = require('puppeteer-core');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = path.join(__dirname, '..', '..');
const UI = fs.readFileSync(path.join(ROOT, 'plugin', 'ui.html'), 'utf8');
const CODE = fs.readFileSync(path.join(ROOT, 'plugin', 'code.js'), 'utf8');
const MOCK = fs.readFileSync(path.join(__dirname, 'harness', 'figma-mock.js'), 'utf8');
const KEY = 'yoga-pants/women/split-hero';

// ------------------------------------------------------------------ the host page (runs in Chrome)
function hostScript() {
  // ---------- fake Google Drive + fake A+ backend ----------
  const drive = window.__drive = { files: new Map(), seq: 0, log: [], failUploads: false };
  const backendLog = window.__backendLog = [];
  const json = (status, obj) => ({ status, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });
  function meta(f) {
    return { id: f.id, name: f.name, mimeType: f.mimeType, size: f.content ? String(f.content.length) : undefined, parents: f.parents,
      appProperties: f.appProperties || {}, modifiedTime: f.modifiedTime, trashed: !!f.trashed, md5Checksum: 'x' };
  }
  function matches(f, q) {
    let m;
    const re = /'([^']+)' in parents/g; while ((m = re.exec(q))) if (!f.parents.includes(m[1])) return false;
    if ((m = q.match(/name = '([^']*)'/)) && f.name !== m[1]) return false;
    if ((m = q.match(/mimeType = '([^']*)'/)) && f.mimeType !== m[1]) return false;
    if (/trashed = false/.test(q) && f.trashed) return false;
    const ap = /appProperties has \{ key='([^']+)' and value='([^']*)' \}/g;
    while ((m = ap.exec(q))) if ((f.appProperties || {})[m[1]] !== m[2]) return false;
    return true;
  }
  function create(metaIn, content) {
    const f = { id: 'fakeDriveId' + String(++drive.seq).padStart(6, '0'), name: metaIn.name, mimeType: metaIn.mimeType || 'application/octet-stream', parents: metaIn.parents || ['root'],
      appProperties: metaIn.appProperties || {}, content: content || null, modifiedTime: new Date().toISOString(), trashed: false };
    drive.files.set(f.id, f); return f;
  }
  function parseMultipart(bytes, ctype) {
    const boundary = ctype.match(/boundary=(.+)$/)[1];
    let s = ''; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    const parts = s.split('--' + boundary).slice(1, -1).map(p => {
      const start = s.indexOf(p); const head = p.indexOf('\r\n\r\n');
      const from = start + head + 4, to = start + p.length - 2;   // strip the trailing \r\n
      return { headers: p.slice(0, head), bytes: bytes.slice(from, to) };
    });
    return { meta: JSON.parse(new TextDecoder().decode(parts[0].bytes)), contentType: (parts[1].headers.match(/Content-Type: (.+)/) || [])[1], content: parts[1].bytes };
  }
  window.__fake = async function (method, url, headers, body) {
    const u = new URL(url);
    headers = headers || {};
    if (u.hostname === 'backend.test') {
      backendLog.push(method + ' ' + u.pathname);
      if (u.pathname === '/auth/status') return json(200, { configured: true, connected: true, email: 'designer@example.com', session: 'stub-session', needsReconsent: false, driveAccess: 'full' });
      if (u.pathname === '/auth/token') return json(200, { accessToken: 'fake-token', expiresAt: Date.now() + 3600000, scopes: ['https://www.googleapis.com/auth/drive'], driveAccess: 'full' });
      if (u.pathname === '/api/templates' && method === 'GET') return json(503, { error: 'use bundled' });
      return json(404, { error: 'not found' });
    }
    if (u.hostname !== 'www.googleapis.com') return json(404, { error: 'unexpected host ' + u.hostname });
    const auth = headers.Authorization || headers.authorization || '';
    const entry = { method, path: u.pathname, query: Object.fromEntries(u.searchParams), auth: auth === 'Bearer fake-token' };
    drive.log.push(entry);
    if (!entry.auth) return json(401, { error: { message: 'no token' } });
    let m;
    if (u.pathname.startsWith('/upload/drive/v3/files')) {
      if (drive.failUploads) return json(403, { error: { message: 'The user\'s Drive storage quota has been exceeded.', errors: [{ reason: 'storageQuotaExceeded' }] } });
      const bytes = new Uint8Array(await body.arrayBuffer());
      const mp = parseMultipart(bytes, headers['Content-Type']);
      entry.uploadType = u.searchParams.get('uploadType'); entry.meta = mp.meta; entry.bytes = mp.content.length; entry.partType = mp.contentType;
      const id = (u.pathname.match(/files\/([^/]+)$/) || [])[1];
      let f;
      if (id) { f = drive.files.get(id); Object.assign(f, { name: mp.meta.name || f.name, appProperties: Object.assign({}, f.appProperties, mp.meta.appProperties || {}), content: mp.content, modifiedTime: new Date().toISOString() }); }
      else f = create(mp.meta, mp.content);
      return json(200, meta(f));
    }
    if (u.pathname === '/drive/v3/files' && method === 'GET') {
      const q = u.searchParams.get('q');
      entry.q = q;
      return json(200, { files: [...drive.files.values()].filter(f => matches(f, q)).map(meta) });
    }
    if (u.pathname === '/drive/v3/files' && method === 'POST') { const f = create(JSON.parse(body)); entry.created = f.name; return json(200, meta(f)); }
    if ((m = u.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/))) {
      const f = drive.files.get(m[1]);
      if (!f) return json(404, { error: { message: 'File not found' } });
      if (method === 'PATCH') { const patch = JSON.parse(body); Object.assign(f, patch); entry.patch = patch; return json(200, meta(f)); }
      if (u.searchParams.get('alt') === 'media') return { status: 200, headers: { 'Content-Length': String(f.content.length) }, body: f.content };
      return json(200, meta(f));
    }
    return json(400, { error: { message: 'fake drive: unhandled ' + method + ' ' + u.pathname } });
  };

  // ---------- one "computer": a clientStorage + a Figma file, the real code.js, the real ui.html ----------
  window.__sent = [];
  window.__posted = [];
  window.machine = async function (opts) {
    const iframe = document.getElementById('ui');
    const storage = opts.storage || FigmaMock.makeStorage();
    await storage.setAsync('googleSession', 'stub-session');
    await storage.setAsync('backendUrl', 'https://backend.test');
    const images = new Map();
    const env = FigmaMock.makeFigma(storage, images, m => { window.__posted.push(m); iframe.contentWindow.postMessage({ pluginMessage: m }, '*'); });
    window.__env = env; window.__storage = storage; window.__images = images;
    if (opts.design) {
      const photo = FigmaMock.png(200000, 1), texture = FigmaMock.png(30000, 2);
      images.set(FigmaMock.contentHash(photo), photo); images.set(FigmaMock.contentHash(texture), texture);
      const f = FigmaMock.buildDesign(env.page, FigmaMock.contentHash(photo), FigmaMock.contentHash(texture));
      env.page.selection = [f];
      window.__hashes = { photo: FigmaMock.contentHash(photo), texture: FigmaMock.contentHash(texture) };
    }
    window.onmessage = (ev) => {
      if (ev.source !== iframe.contentWindow) return;
      const m = ev.data && ev.data.pluginMessage;
      if (!m) return;
      window.__sent.push(m);
      env.figma.ui.onmessage(m);
    };
    iframe.srcdoc = window.__UI;
    await new Promise(r => { iframe.onload = r; });
    new Function('figma', '__html__', window.__CODE)(env.figma, '');
  };
}

// Replaces fetch / XMLHttpRequest in the PLUGIN iframe so Google and the backend hit the fakes above.
function iframeStubs() {
  if (window.top === window || !window.parent.__fake) return;
  const realFetch = window.fetch.bind(window);
  const fake = (m, u, h, b) => window.parent.__fake(m, u, h, b);
  const ours = u => /^https:\/\/(www\.googleapis\.com|backend\.test)\//.test(String(u));
  window.fetch = async function (url, init) {
    if (!ours(url)) return realFetch(url, init);
    init = init || {};
    const r = await fake(init.method || 'GET', String(url), init.headers || {}, init.body);
    return new Response(r.status === 204 ? null : r.body, { status: r.status, headers: r.headers });
  };
  window.XMLHttpRequest = function () {
    const x = this, h = {}; let method, url;
    x.upload = {};
    x.open = (m, u) => { method = m; url = u; };
    x.setRequestHeader = (k, v) => { h[k] = v; };
    x.getResponseHeader = (k) => (x._rh || {})[k] || null;
    x.send = (body) => {
      fake(method, url, h, body).then(r => {
        const size = body && body.size ? body.size : 0;
        if (x.upload.onprogress) { x.upload.onprogress({ loaded: size / 2, total: size }); x.upload.onprogress({ loaded: size, total: size }); }
        x.status = r.status; x.responseText = typeof r.body === 'string' ? r.body : ''; x._rh = r.headers;
        x.onload && x.onload();
      }, () => x.onerror && x.onerror());
    };
  };
}

test('user templates: save, pickers, My templates, Drive, export/import, delete, second machine', { timeout: 240000 }, async (t) => {
  const DL = fs.mkdtempSync(path.join(os.tmpdir(), 'aplus-ut-dl-'));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-first-run'] });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const cdp = await page.target().createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL, eventsEnabled: true });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.evaluateOnNewDocument(iframeStubs);
  await page.setRequestInterception(true);
  page.on('request', r => r.url() === 'https://figma.test/'
    ? r.respond({ status: 200, contentType: 'text/html', body: '<html><body style="margin:0"><iframe id="ui" style="width:460px;height:2400px;border:0"></iframe></body></html>' })
    : r.continue());
  await page.goto('https://figma.test/');
  await page.evaluate((mock, host, ui, code) => {
    (0, eval)(mock); (0, eval)('(' + host + ')()');
    window.__UI = ui; window.__CODE = code;
  }, MOCK, hostScript.toString(), UI, CODE);

  const ui = () => page.frames().find(f => f !== page.mainFrame());
  const text = (sel) => ui().evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; }, sel);
  const click = (sel) => ui().evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error('no ' + s); e.click(); }, sel);
  const type = (sel, v) => ui().evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); }, sel, v);
  async function until(fn, what, ms) {
    const t0 = Date.now(); let last;
    while (Date.now() - t0 < (ms || 15000)) { try { last = await fn(); if (last) return last; } catch (e) { last = e.message; } await new Promise(r => setTimeout(r, 120)); }
    const where = await ui().evaluate(() => ({ out: (document.getElementById('ad-out') || {}).innerText, mine: (document.getElementById('ad-mine-out') || {}).innerText })).catch(() => ({}));
    throw new Error('timed out waiting for ' + what + ' (last: ' + JSON.stringify(last) + ') panel: ' + JSON.stringify(where));
  }
  // SHOTS=/some/dir saves screenshots of the panel at the interesting states
  const shot = async (name) => { if (!process.env.SHOTS) return; const el = await page.$('#ui'); await el.screenshot({ path: path.join(process.env.SHOTS, 'ut-' + name + '.png') }); };
  const driveFiles = () => page.evaluate(() => [...window.__drive.files.values()].map(f => ({ id: f.id, name: f.name, parents: f.parents, mimeType: f.mimeType, trashed: f.trashed, size: f.content ? f.content.length : 0, app: f.appProperties })));

  // ================================================================ machine A
  await page.evaluate(() => window.machine({ design: true }));
  await until(() => ui().evaluate(() => document.getElementById('gate').classList.contains('hidden')), 'the sign-in gate to clear');
  await click('[data-tab="design"]');

  await t.test('empty state, free-text category, id suggested from the name', async () => {
    assert.match(await text('#ad-mine'), /No templates yet/);
    await type('#ad-name', 'Split hero');
    await type('#ad-cat', 'Yoga Pants');
    await ui().evaluate(() => { const g = document.getElementById('ad-gender'); g.value = 'women'; g.dispatchEvent(new Event('change')); });
    assert.equal(await ui().evaluate(() => document.getElementById('ad-id').value), 'split-hero');
    assert.deepEqual(await ui().evaluate(() => [...document.querySelectorAll('#ad-gender option')].map(o => o.textContent)), ['Men', 'Women', 'Unisex']);
    assert.ok((await ui().evaluate(() => [...document.querySelectorAll('#ad-cats option')].map(o => o.value))).includes('Running'), 'datalist offers existing categories');
    assert.match(await text('#ad-keyline'), /Saved as yoga-pants\/women\/split-hero · new category Yoga Pants/);
    assert.match(await text('#ad-where'), /this computer and in your Google Drive/);
    assert.equal(await ui().evaluate(() => document.getElementById('ad-go').disabled), false);
  });

  await t.test('save: capture progress -> this computer -> Drive upload; nothing sent to the backend', async () => {
    // every state the panel shows on the way, recorded as it happens
    await ui().evaluate(() => { window.__outLog = []; new MutationObserver(() => { const t = document.getElementById('ad-out').textContent; if (window.__outLog[window.__outLog.length - 1] !== t) window.__outLog.push(t); }).observe(document.getElementById('ad-out'), { childList: true, subtree: true, characterData: true }); });
    await click('#ad-go');
    await until(async () => /Saved · this computer \+ Google Drive/.test(await text('#ad-out')), 'the save to finish', 20000);
    const seen = await ui().evaluate(() => window.__outLog);
    const out = await text('#ad-out');
    assert.match(out, /yoga-pants\/women\/split-hero/);
    assert.match(out, /2 image\(s\)/);
    assert.match(out, /It is in Automate now, under Yoga Pants · Women/);
    for (const want of [/Reading your frame.*Reading every layer/, /Copying the images \(1 of 2\)/, /Rebuilding it to check/, /Saving on this computer/, /Uploading to your Google Drive.*Uploading image 1 of 2/, /Uploading the template file/]) {
      assert.ok(seen.some(s => want.test(s)), want + ' was shown; saw: ' + seen.map(s => s.slice(0, 70)).join(' | '));
    }

    // Drive layout + request shape
    const files = await driveFiles();
    const byName = n => files.find(f => f.name === n);
    const lab = byName('Cult A+ Design Lab'), tpls = byName('Templates'), folder = byName('yoga-pants__women__split-hero');
    assert.ok(lab && tpls && folder, 'folders: ' + files.map(f => f.name).join(', '));
    assert.deepEqual([lab.parents[0], tpls.parents[0], folder.parents[0]], ['root', lab.id, tpls.id]);
    assert.deepEqual(folder.app, { aplusKind: 'template-folder', aplusKey: KEY });
    const inFolder = files.filter(f => f.parents[0] === folder.id);
    const mf = inFolder.find(f => f.name === 'manifest.json');
    assert.equal(mf.app.aplusKind, 'template-manifest'); assert.equal(mf.app.aplusKey, KEY);
    assert.equal(mf.app.aplusCatLabel, 'Yoga Pants'); assert.equal(mf.app.aplusStatus, 'active');
    const hashes = await page.evaluate(() => window.__hashes);
    const assets = inFolder.filter(f => f.name !== 'manifest.json').map(f => [f.name, f.size, f.app.aplusKind]).sort();
    assert.deepEqual(assets, [[hashes.photo + '.png', 200000, 'template-asset'], [hashes.texture + '.png', 30000, 'template-asset']].sort());
    const log = await page.evaluate(() => window.__drive.log);
    const uploads = log.filter(l => l.path.startsWith('/upload/'));
    assert.equal(uploads.length, 3, 'two images + the manifest');
    uploads.forEach(u => { assert.equal(u.uploadType, 'multipart'); assert.equal(u.auth, true); assert.equal(u.method, 'POST'); assert.deepEqual(u.meta.parents, [folder.id]); });
    const env = JSON.parse(await page.evaluate(id => new TextDecoder().decode(window.__drive.files.get(id).content), mf.id));
    assert.equal(env.schema, 'aplus.drive-template/1');
    assert.equal(env.manifest.meta.key, KEY);
    assert.equal(env.manifest.meta.assets.length, 2);
    assert.equal(env.assets.length, 2);
    assert.ok(log.every(l => l.auth), 'every Google call carries the user token');
    const backend = await page.evaluate(() => window.__backendLog);
    assert.ok(!backend.some(l => /^POST \/api\/templates/.test(l) || /^DELETE/.test(l)), 'no template ever goes to the backend: ' + backend.join(', '));
    assert.ok(backend.every(l => /^(GET \/auth\/status|POST \/auth\/token|GET \/api\/templates(\/running\/[a-z]+\/[a-z0-9-]+)?)$/.test(l)), 'only sign-in + bundled-template reads: ' + backend.join(', '));
    assert.ok(!backend.some(l => /yoga-pants/.test(l)), 'the user template is never fetched from the backend either');
    // this computer
    const st = await page.evaluate(() => [...window.__storage.map.keys()]);
    assert.ok(st.includes('capturedAsset:' + hashes.photo) && st.some(k => k.startsWith('capturedTemplate:' + 'yoga-pants/women/split-hero#')));
  });

  await t.test('My templates lists it with where it is stored', async () => {
    const row = await text('#ad-mine .ut-row[data-key="' + KEY + '"]');
    assert.match(row, /Split hero/); assert.match(row, /yoga-pants\/women\/split-hero/);
    assert.match(row, /\d+ KB/);
    const badges = await ui().evaluate(k => [...document.querySelectorAll('.ut-row[data-key="' + k + '"] .ut-badge')].map(b => b.className + ':' + b.textContent), KEY);
    assert.deepEqual(badges, ['ut-badge on:This computer', 'ut-badge on:Drive']);
    assert.match(await text('#ad-usage'), /This computer: .* used · .* free/);
    await shot('saved');
  });

  await t.test('registry refreshed: Automate picker and Export categories show it at once', async () => {
    await click('[data-tab="automate"]');
    const cat = await ui().evaluate(() => { const b = document.querySelector('.cat[data-cat="yoga-pants"]'); return b && { dis: b.disabled, t: b.innerText }; });
    assert.ok(cat && !cat.dis, 'category button enabled'); assert.match(cat.t, /Yoga Pants A\+/);
    await click('.cat[data-cat="yoga-pants"]');
    await until(() => ui().evaluate(() => { const g = document.querySelector('#genders .chip[data-g="women"]'); return g && !g.disabled && g.classList.contains('on'); }), 'women chip');
    const tpl = await ui().evaluate(() => { const b = document.querySelector('.tpl[data-tpl="split-hero"]'); return b && { dis: b.disabled, on: b.classList.contains('on'), t: b.innerText }; });
    assert.ok(tpl && !tpl.dis && tpl.on, JSON.stringify(tpl)); assert.match(tpl.t, /Your template · this computer \+ Drive/);
    await until(() => ui().evaluate(() => !!document.querySelector('#preview svg[data-captured]')), 'the template preview to draw from the local manifest');
    assert.ok(await ui().evaluate(() => registryCats().some(c => c.id === 'yoga-pants' && c.label === 'Yoga Pants')), 'Export reads the same registry');
    assert.deepEqual(await ui().evaluate(() => parseCatGender('Yoga Pants', 'Women')), { cat: 'yoga-pants', gender: 'women' }, 'a sheet row "Yoga Pants" routes to the new category');
    await click('[data-tab="design"]');
  });

  await t.test('same key again: in-panel Replace / Save as new; Save as new keeps both', async () => {
    assert.equal(await ui().evaluate(() => document.getElementById('ad-name').value + '|' + document.getElementById('ad-id').value), '|', 'form cleared after a successful save');
    await type('#ad-name', 'Split hero');
    assert.match(await text('#ad-keyline'), /you already have a template with this id/);
    await click('#ad-go');
    const c = await until(() => text('#ad-conflict'), 'the clash prompt');
    assert.match(c, /You already have “Split hero”/);
    await shot('clash');
    const btns = await ui().evaluate(() => [...document.querySelectorAll('#ad-conflict button')].map(b => b.textContent));
    assert.deepEqual(btns, ['Replace it', 'Save as new (split-hero-2)', 'Cancel']);
    await ui().evaluate(() => document.querySelectorAll('#ad-conflict button')[1].click());
    await until(async () => /Saved · this computer \+ Google Drive/.test(await text('#ad-out')) && /split-hero-2/.test(await text('#ad-out')), 'the second save');
    assert.ok(await ui().evaluate(() => !!document.querySelector('.ut-row[data-key="yoga-pants/women/split-hero-2"]')));
    // a built-in id offers Save as new only
    await type('#ad-name', 'Clash with built-in'); await type('#ad-cat', 'Running'); await type('#ad-id', 'template-1');
    await click('#ad-go');
    assert.deepEqual(await until(() => ui().evaluate(() => { const b = [...document.querySelectorAll('#ad-conflict button')].map(b => b.textContent); return b.length ? b : null; }), 'bundled prompt'),
      ['Save as new (' + (await ui().evaluate(() => userTemplates.suggestFreeId('running', 'women', 'template-1'))) + ')', 'Cancel']);
    await ui().evaluate(() => document.querySelectorAll('#ad-conflict button')[1].click());
    await type('#ad-cat', 'Yoga Pants'); await type('#ad-id', 'split-hero');
  });

  await t.test('delete: in-panel confirm, removed here, Drive copy moved to the bin', async () => {
    const k2 = 'yoga-pants/women/split-hero-2';
    await ui().evaluate(k => document.querySelector('.ut-row[data-key="' + k + '"] [data-act="delete"]').click(), k2);
    assert.match(await text('.ut-row[data-key="' + k2 + '"] .acts'), /move the Drive copy to the Drive bin\?\s*Yes, delete\s*Keep/);
    await ui().evaluate(k => document.querySelector('.ut-row[data-key="' + k + '"] [data-act="delete-yes"]').click(), k2);
    await until(async () => /Deleted/.test(await text('#ad-mine-out')), 'delete');
    assert.match(await text('#ad-mine-out'), /Drive copy moved to the Drive bin/);
    const f = (await driveFiles()).find(x => x.name === 'yoga-pants__women__split-hero-2');
    assert.equal(f.trashed, true, 'trashed, not hard-deleted');
    const patch = (await page.evaluate(() => window.__drive.log)).filter(l => l.method === 'PATCH');
    assert.deepEqual(patch.map(p => p.patch), [{ trashed: true }, { trashed: true }], 'manifest then folder to the bin (Drive trashes children lazily)');
    const mfile = (await driveFiles()).find(x => x.name === 'manifest.json' && x.parents[0] === f.id);
    assert.equal(mfile.trashed, true, 'the manifest itself is trashed, so a later Drive listing cannot bring it back');
    assert.ok(!(await ui().evaluate(k => !!document.querySelector('.ut-row[data-key="' + k + '"]'), k2)));
    assert.ok(!(await page.evaluate(() => [...window.__storage.map.keys()].some(k => k.includes('split-hero-2')))));
  });

  let exported;
  await t.test('export file: a download with the manifest and the images', async () => {
    await ui().evaluate(k => document.querySelector('.ut-row[data-key="' + k + '"] [data-act="export"]').click(), KEY);
    await until(async () => /Template file ready/.test(await text('#ad-mine-out')), 'export');
    const file = path.join(DL, 'yoga-pants_women_split-hero.aplus-template.json');
    await until(() => fs.existsSync(file) && fs.statSync(file).size > 0 && !fs.existsSync(file + '.crdownload'), 'the download');
    exported = file;
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(doc.schema, 'aplus.template-file/1');
    assert.equal(doc.manifest.meta.key, KEY);
    assert.equal(doc.assets.length, 2);
    const photo = doc.assets.find(a => a.bytes === 200000);
    assert.equal(Buffer.from(photo.data, 'base64').length, 200000);
    assert.equal(photo.mime, 'image/png');
  });

  await t.test('delete the original, then import the file back: this computer + Drive again', async () => {
    await ui().evaluate(k => document.querySelector('.ut-row[data-key="' + k + '"] [data-act="delete"]').click(), KEY);
    await ui().evaluate(k => document.querySelector('.ut-row[data-key="' + k + '"] [data-act="delete-yes"]').click(), KEY);
    await until(async () => /No templates yet/.test(await text('#ad-mine')), 'empty list');
    assert.ok(!(await ui().evaluate(() => registryCats().some(c => c.id === 'yoga-pants'))), 'category gone from the pickers with its last template');
    const input = await ui().$('#ad-file');
    await input.uploadFile(exported);
    await until(async () => /Imported · this computer \+ Google Drive/.test(await text('#ad-mine-out')), 'import', 20000);
    assert.ok(await ui().evaluate(k => !!document.querySelector('.ut-row[data-key="' + k + '"]'), KEY));
    assert.ok(await ui().evaluate(() => registryCats().some(c => c.id === 'yoga-pants')), 'back in the pickers');
    const live = (await driveFiles()).filter(f => f.name === 'yoga-pants__women__split-hero' && !f.trashed);
    assert.equal(live.length, 1, 'a fresh Drive folder');
    // importing it again asks before replacing
    await ui().evaluate(() => { document.getElementById('ad-file').value = ''; });
    await input.uploadFile(exported);
    assert.match(await until(() => text('#ad-mine-out .ut-choice'), 'clash prompt on import'), /Replace it\s*Save as new \(split-hero-2\)\s*Cancel/);
    await ui().evaluate(() => [...document.querySelectorAll('#ad-mine-out .ut-choice button')].pop().click());
  });

  await t.test('Drive failure: saved on this computer, Retry upload succeeds', async () => {
    await page.evaluate(() => { window.__drive.failUploads = true; });
    await type('#ad-name', 'Quota case'); await type('#ad-id', 'quota-case');
    await click('#ad-go');
    await until(async () => /Saved on this computer · Drive upload failed/.test(await text('#ad-out')), 'partial state', 20000);
    assert.match(await text('#ad-out'), /quota/i);
    await shot('drive-failed');
    assert.match(await text('.ut-row[data-key="yoga-pants/women/quota-case"]'), /Drive upload failed/);
    await page.evaluate(() => { window.__drive.failUploads = false; });
    await click('#ad-retry');
    await until(async () => /Saved · this computer \+ Google Drive/.test(await text('#ad-out')), 'retry', 20000);
  });

  // ================================================================ machine B: same Google account, new computer
  await t.test('another computer: Drive templates listed, fetched on first use with progress, built with images', async () => {
    await page.evaluate(() => { window.__posted = []; return window.machine({}); });
    await until(() => ui().evaluate(() => document.getElementById('gate').classList.contains('hidden')), 'gate on machine B');
    await click('[data-tab="design"]');
    await until(async () => /Split hero/.test(await text('#ad-mine')), 'Drive list on machine B');
    const badges = await ui().evaluate(k => [...document.querySelectorAll('.ut-row[data-key="' + k + '"] .ut-badge')].map(b => b.className + ':' + b.textContent), KEY);
    assert.deepEqual(badges, ['ut-badge off:This computer', 'ut-badge on:Drive']);
    assert.match(await text('.ut-row[data-key="' + KEY + '"]'), /Downloads from your Drive the first time you use it here/);
    await shot('machine-b');
    assert.ok(await ui().evaluate(() => registryCats().some(c => c.id === 'yoga-pants')), 'in the pickers from Drive');
    assert.equal(await page.evaluate(() => window.__storage.map.has('capturedTemplateIndex')), false, 'nothing local yet');

    const progress = await ui().evaluate(async (k) => { const p = []; const m = await userTemplates.prepareRun([k], x => p.push(x.text)); return { p, keys: Object.keys(m) }; }, KEY);
    assert.deepEqual(progress.keys, [KEY]);
    assert.ok(progress.p.some(s => /Getting "Split hero" from your Drive/.test(s)) && progress.p.some(s => /Downloading image 2 of 2 from Drive/.test(s)), progress.p.join(' | '));
    const local = await page.evaluate(() => [...window.__storage.map.keys()].filter(k => k.startsWith('captured')).length);
    assert.equal(local, 4, 'kept on this computer for next time (index + manifest + 2 images)');
    await until(async () => /This computer/.test(await text('.ut-row[data-key="' + KEY + '"] .ut-badge.on')), 'badge flips to this computer');

    // build it, through the same bridge the Run button uses
    await ui().evaluate((k, row) => bridge.send('run', { rows: [row], keys: [k], errors: [null], manifests: {}, source: 'user' }), KEY,
      (() => { const r = new Array(20).fill(''); r[1] = '706524'; r[2] = 'Yoga Pants'; r[6] = 'STRETCH FREE'; r[7] = 'Made to move'; r[19] = 'Women'; return r; })());
    const done = await until(() => page.evaluate(() => window.__posted.find(m => m.type === 'done')), 'run done');
    assert.equal(done.report[0].ok, true, JSON.stringify(done.report));
    const built = await page.evaluate(() => {
      const out = { texts: [], images: [] };
      FigmaMock.walk(window.__env.page, n => { if (n.type === 'TEXT') out.texts.push(n.characters); (n.fills || []).forEach(p => p.type === 'IMAGE' && out.images.push(p.imageHash)); });
      out.created = window.__env.figma._created.length; out.inFile = [...window.__images.keys()];
      return out;
    });
    assert.ok(built.texts.includes('STRETCH') && built.texts.includes('Made to move'), built.texts.join(' | '));
    assert.equal(built.created, 2, 'both images re-created in this file');
    assert.ok(built.images.length === 1 && built.inFile.includes(built.images[0]), 'texture paint points at an image that exists in this file');
  });

  await t.test('backend saw sign-in and bundled reads only, across every step', async () => {
    const backend = await page.evaluate(() => window.__backendLog);
    assert.ok(backend.every(l => /^(GET \/auth\/status|POST \/auth\/token|GET \/api\/templates(\/running\/[a-z]+\/[a-z0-9-]+)?)$/.test(l)), backend.join(', '));
  });

  await t.test('no page errors', async () => {
    assert.deepEqual(errors.filter(e => !/favicon|ERR_|Failed to load resource/.test(e)), []);
  });
});
