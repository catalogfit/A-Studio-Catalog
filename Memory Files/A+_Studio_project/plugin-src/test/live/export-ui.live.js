// LIVE end-to-end check of the Export panel (not part of `npm test`).
// Loads the built plugin/ui.html in headless Chrome inside an https host page (as Figma does),
// simulates the Figma sandbox with a PNG standing in for the A+ frames, and talks to a REAL
// backend + Google Drive with a real session. It DOES upload to Drive in the "drive" step.
// Usage:
//   PPT=$(pwd)/node_modules/puppeteer-core SHOTS=/tmp node live/export-ui.live.js \
//     ../../plugin/ui.html <a+.png> <file holding a sealed session> <download dir> gif,go
// Steps: static-png2x | static-jpg1x | gif | mp4 | skip | still | drive | zip | go | shot<name>
// Backend expected at http://localhost:8787 (docker container aplus-backend).
// Headless test of the Export panel: real built ui.html in a null-origin iframe (as in Figma),
// a simulated Figma sandbox, the local backend, and the real Google session (read-only).
const puppeteer = require(process.env.PPT);
const fs = require('fs'), path = require('path');
const [,, UI, PNG, SESSION_FILE, DL, SCENARIO] = process.argv;
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-first-run', '--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests'] });
  const page = await browser.newPage();
  const cdp = await page.target().createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL, eventsEnabled: true });
  const logs = [];
  page.on('console', m => logs.push('[' + m.type() + '] ' + m.text()));
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message));
  const reg = await (await fetch('http://localhost:8787/api/templates')).json();
  // serve the host page over https, as Figma does, so the plugin iframe is a secure context
  await page.setRequestInterception(true);
  page.on('request', r => r.url() === 'https://figma.test/' ? r.respond({ status: 200, contentType: 'text/html', body: '<html><body style="margin:0;background:#000"><iframe id="ui" style="width:460px;height:1500px;border:0"></iframe></body></html>' }) : r.continue());
  await page.goto('https://figma.test/');
  await page.evaluate(async (ui, png, session, reg, scenario) => {
    const frame = document.getElementById('ui');
    const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
    const FRAMES = [
      { id: '1:1', name: 'A+ · 706524', w: img.width, h: img.height, ids: ['706524'], category: 'running', gender: 'men', source: 'hero' },
      { id: '1:2', name: 'A+ · 707041', w: img.width, h: img.height, ids: ['707041', '707042'], category: 'training', gender: 'men', source: 'tag' },
    ];
    window.__sent = [];
    async function render(width, scale) {
      const w = Math.round(width || img.width * (scale || 1)), h = Math.round(img.height * w / img.width);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h);
      const b = await new Promise(r => c.toBlob(r, 'image/png'));
      return { bytes: new Uint8Array(await b.arrayBuffer()), width: w, height: h };
    }
    const toUi = m => frame.contentWindow.postMessage({ pluginMessage: m }, '*');
    window.addEventListener('message', async ev => {
      const m = ev.data && ev.data.pluginMessage; if (!m) return;
      window.__sent.push(m.type);
      const reply = (result) => toUi({ type: 'reply', reqId: m.reqId, ok: true, result });
      if (m.type === 'export-scan') reply({ pageId: 'p1', frames: window.__selected || FRAMES, other: 0 });
      else if (m.type === 'export-thumb') reply({ bytes: (await render(76)).bytes });
      else if (m.type === 'export-frame') { const r = await render(m.width, m.scale); reply({ bytes: r.bytes, width: r.width, height: r.height, name: 'A+' }); }
      else if (m.type === 'export-select-all') { reply({ count: 2 }); }
      else if (m.type === 'tplcache-list') reply([]);
      else if (m.reqId) reply(null);
    });
    frame.srcdoc = ui;
    await new Promise(r => frame.onload = r);
    toUi({ type: 'init', sheetLink: '', backendUrl: 'http://localhost:8787', session, exportConfig: null, registry: reg, manifests: {}, captured: [], page: 'Page 1' });
    toUi({ type: 'page', id: 'p1', name: 'Page 1', frameCount: 2 });
    toUi({ type: 'selection', pageId: 'p1', frames: FRAMES.map(f => ({ id: f.id, name: f.name, w: f.w, h: f.h, ids: f.ids })), ids: ['706524', '707041', '707042'], other: 0 });
  }, fs.readFileSync(UI, 'utf8'), fs.readFileSync(PNG).toString('base64'), fs.readFileSync(SESSION_FILE, 'utf8'), reg, SCENARIO);
  const ui = page.frames()[1];
  await new Promise(r => setTimeout(r, 2500));
  // get past the sign-in gate if it is up (old read-only session -> "reconsent" state)
  await ui.evaluate(() => { const s = document.getElementById('gate-skip'); if (s && !s.classList.contains('hidden')) s.click(); const g = document.querySelector('[data-tab="export"]'); g && g.click(); });
  await new Promise(r => setTimeout(r, 1500));
  const snap = async (label) => {
    const t = await ui.evaluate(() => ({
      count: document.getElementById('ex-count').textContent,
      frames: [...document.querySelectorAll('#ex-frames .exrow')].map(r => r.querySelector('.ids').textContent + ' | ' + r.querySelector('.sub').textContent + ' | cat=' + r.querySelector('select').value),
      gifnote: document.getElementById('ex-gifnote').innerText.replace(/\s+/g, ' ').trim(),
      go: document.getElementById('ex-go').textContent + (document.getElementById('ex-go').disabled ? ' (disabled)' : ''),
      format: document.getElementById('ex-format').value, size: document.getElementById('ex-size').value,
      out: document.getElementById('ex-out').innerText.replace(/\s+/g, ' ').trim(),
      progress: [...document.querySelectorAll('#ex-progress .sub')].map(e => e.textContent),
    }));
    console.log('--- ' + label + '\n' + JSON.stringify(t, null, 1));
  };
  const click = (sel) => ui.evaluate(s => document.querySelector(s).click(), sel);
  const setSel = (sel, v) => ui.evaluate((s, v) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('change')); e.dispatchEvent(new Event('input')); }, sel, v);
  const waitDone = async (max) => { const t0 = Date.now(); while (Date.now() - t0 < max) { const busy = await ui.evaluate(() => /Cancel/.test(document.getElementById('ex-go').textContent)); if (!busy) return (Date.now() - t0) / 1000; await new Promise(r => setTimeout(r, 500)); } return -1; };

  await snap('initial (static mode)');
  for (const step of SCENARIO.split(',')) {
    if (step === 'static-png2x') { await click('#ex-mode [data-mode="static"]'); await setSel('#ex-format', 'PNG'); await setSel('#ex-size', '2'); }
    if (step === 'static-jpg1x') { await click('#ex-mode [data-mode="static"]'); await setSel('#ex-format', 'JPG'); await setSel('#ex-size', '1'); }
    if (step === 'gif') { await click('#ex-mode [data-mode="gif"]'); await setSel('#ex-format', 'gif'); await setSel('#ex-size', 'w582'); await new Promise(r => setTimeout(r, 6000)); }
    if (step === 'mp4') { await click('#ex-mode [data-mode="gif"]'); await setSel('#ex-format', 'mp4'); await setSel('#ex-size', 'w582'); await new Promise(r => setTimeout(r, 6000)); }
    if (step === 'skip') { await click('#ex-missing [data-missing="skip"]'); }
    if (step === 'still') { await click('#ex-missing [data-missing="still"]'); }
    if (step === 'drive') { await click('#ex-dest [data-dest="drive"]'); await setSel('#ex-drive', 'https://drive.google.com/drive/folders/10RViOBmMmhxj3WhmnfiQdiKQxcNopKnF'); }
    if (step.startsWith('shot')) { await new Promise(r => setTimeout(r, 1500)); const el = await page.$('#ui'); await el.screenshot({ path: process.env.SHOTS + '/' + step + '.png' }); }
    if (step === 'zip') { await click('#ex-dest [data-dest="zip"]'); }
    if (step === 'go') { await snap('before export'); await click('#ex-go'); const secs = await waitDone(240000); await snap('after export (' + secs + ' s)'); await new Promise(r => setTimeout(r, 1500)); }
  }
  console.log('--- console errors/warnings\n' + logs.filter(l => /error|warn/i.test(l)).slice(0, 15).join('\n'));
  await browser.close();
})().catch(e => { console.error('HARNESS FAIL', e); process.exit(1); });
