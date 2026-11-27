// LIVE Drive round trip for user templates (not part of `npm test`). Uses a REAL Google session and
// WRITES to that account's Drive: saves "zz-test/unisex/live-check" under
// "Cult A+ Design Lab/Templates", lists it, loads it, downloads its image, then moves it to the
// Drive bin and checks it is gone from the list. It always tries the clean-up, even after a failure.
// The session and the access token are never printed.
// Usage (backend at http://localhost:8787):
//   node live/user-templates-drive.live.js ../../plugin/ui.html <file holding a sealed session>
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const [,, UI, SESSION_FILE] = process.argv;
const KEY = 'zz-test/unisex/live-check';
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new',
    args: ['--no-first-run', '--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests'] });
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', r => r.url() === 'https://figma.test/' ? r.respond({ status: 200, contentType: 'text/html', body: '<html><body><iframe id="ui"></iframe></body></html>' }) : r.continue());
  await page.goto('https://figma.test/');
  await page.evaluate(async (ui, session) => {
    const frame = document.getElementById('ui');
    const toUi = m => frame.contentWindow.postMessage({ pluginMessage: m }, '*');
    // a minimal sandbox: answer every request with null (the template cache is not under test here)
    window.addEventListener('message', ev => { const m = ev.data && ev.data.pluginMessage; if (m && m.reqId) toUi({ type: 'reply', reqId: m.reqId, ok: true, result: null }); });
    frame.srcdoc = ui;
    await new Promise(r => { frame.onload = r; });
    toUi({ type: 'init', backendUrl: 'http://localhost:8787', session, registry: { categories: [] }, manifests: {}, page: 'Page 1' });
  }, fs.readFileSync(UI, 'utf8'), fs.readFileSync(SESSION_FILE, 'utf8').trim());
  const ui = page.frames()[1];
  await ui.waitForFunction(() => window.auth && auth.isConnected(), { timeout: 30000 });
  const result = await ui.evaluate(async (KEY) => {
    const out = { steps: [] };
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
    const M = { schema: 'aplus.template/2', renderer: 'aplus-capture-v1',
      meta: { key: KEY, category: 'zz-test', categoryLabel: 'ZZ Test', gender: 'unisex', id: 'live-check', label: 'Live check (safe to delete)', status: 'active', version: 1,
        assets: [{ hash: 'livecheckhash01', name: 'livecheckhash01.png', mime: 'image/png', width: 1, height: 1, bytes: png.length }] },
      root: { type: 'FRAME', path: '0', props: { name: 'Live check' } }, fonts: {}, content: {} };
    try {
      const saved = await templateStore.save(M, [{ name: 'livecheckhash01.png', mimeType: 'image/png', bytes: png }], { cache: false });
      out.steps.push('save: folder + manifest + ' + saved.assets.length + ' asset');
      const listed = (await templateStore.list()).filter(e => e.key === KEY);
      out.steps.push('list: ' + listed.length + ' entry, categoryLabel=' + listed[0].categoryLabel + ', bytes=' + listed[0].totalBytes);
      const loaded = await templateStore.load(KEY, { cache: false });
      out.steps.push('load: key=' + loaded.manifest.meta.key + ', assets=' + loaded.assets.length);
      const bytes = await templateStore.loadAsset(loaded.assets[0].fileId);
      out.steps.push('asset bytes match: ' + (bytes.length === png.length && bytes.every((b, i) => b === png[i])));
      // a second save with the same image is not re-uploaded
      let skipped = false;
      await templateStore.save(M, [{ name: 'livecheckhash01.png', mimeType: 'image/png', bytes: png }], { cache: false, onProgress: p => { if (p.skipped) skipped = true; } });
      out.steps.push('re-save skips unchanged image: ' + skipped);
    } catch (e) { out.error = (e && e.code) + ': ' + (e && e.message); }
    // clean-up, always
    try {
      const r = await templateStore.remove(KEY);
      const t = await googleFetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(r.trashed) + '?supportsAllDrives=true&fields=id,name,trashed');
      out.cleanup = 'folder "' + t.name + '" trashed=' + t.trashed;
      out.trashedItems = r.files;
      for (let i = 0; i < 10; i++) {   // Drive search can lag a moment behind a trash
        out.afterList = (await templateStore.list()).filter(e => e.key === KEY).length;
        if (!out.afterList) break;
        await new Promise(res => setTimeout(res, 1500));
      }
    } catch (e) { out.cleanupError = (e && e.code) + ': ' + (e && e.message); }
    return out;
  }, KEY);
  console.log(JSON.stringify(result, null, 1));
  await browser.close();
  if (result.error || result.cleanupError || result.afterList !== 0) process.exit(1);
})().catch(e => { console.error('LIVE FAIL', e && e.message); process.exit(1); });
