// ===== sandbox handlers: Automate A+ — OWNED BY THE AUTOMATE PANEL =====
// UI counterpart: plugin-src/ui/automate.js. Renderer: plugin-src/renderer.js.
// Hooks from main.js (core): onUiMessage, onInit, replyTo/replyError, fallbackManifest.
// Messages handled:  save-link {link} · add-comparison {key, manifests, labels, source} ·
//                    run {rows, keys, errors, manifests, source}
// Messages posted:   progress {done,total} · done {report, missingFonts, source, template} · error {message}

onInit(async function (init) {
  init.sheetLink = (await figma.clientStorage.getAsync('sheetLink')) || '';
});

onUiMessage('save-link', async function (msg) { await figma.clientStorage.setAsync('sheetLink', msg.link || ''); });

// ---------- add the fit comparison card to the frames that are selected ----------
onUiMessage('add-comparison', async function (msg) {
  var Mc = (msg.manifests && msg.manifests[msg.key]) || fallbackManifest(msg.key);
  if (!Mc) { figma.ui.postMessage({ type: 'error', message: 'No template loaded for "' + msg.key + '".' }); return; }
  if (!Mc.comparison) { figma.ui.postMessage({ type: 'error', message: 'This template has no fit comparison block.' }); return; }
  var targets = figma.currentPage.selection.filter(function (n) { return n.type === 'FRAME'; });
  if (!targets.length) { figma.ui.postMessage({ type: 'error', message: 'Select the A+ frame(s) first.' }); return; }
  try {
    var fc = await loadFontsFromManifest(Mc);
    var labels = [
      (msg.labels && msg.labels[0]) || Mc.content.comparison.defaults[0],
      (msg.labels && msg.labels[1]) || Mc.content.comparison.defaults[1]
    ];
    var rep = [];
    for (var t = 0; t < targets.length; t++) {
      try { addComparisonToFrame(Mc, fc.F, targets[t], labels); rep.push({ name: targets[t].name, ok: true, warnings: [] }); }
      catch (e) { rep.push({ name: targets[t].name, ok: false, warnings: [String((e && e.message) || e)] }); }
    }
    figma.commitUndo();
    figma.ui.postMessage({ type: 'done', report: rep, missingFonts: fc.missing, source: msg.source || 'bundled', template: Mc.meta.label });
    figma.notify('A+: fit comparison added to ' + rep.filter(function (r) { return r.ok; }).length + ' frame(s)');
  } catch (e) {
    figma.ui.postMessage({ type: 'error', message: String((e && e.message) || e) });
  }
});

// ---------- build one A+ per sheet row ----------
onUiMessage('run', async function (msg) {
  // Per-row routing: the UI has already resolved each row's category (column B) and gender
  // (column C) to a manifest key ("running/women/template-1") in msg.keys[i], or an error
  // string in msg.errors[i] for rows it could not route. Backend manifests arrive in msg.manifests.
  var keys = msg.keys || [];
  var errors = msg.errors || [];
  var manifests = msg.manifests || {};
  // A manifest is buildable if one of the two renderers in this bundle understands it:
  // 'aplus-standard-v1' is the hand-built A+ layout, 'aplus-capture-v1' is a frame captured
  // from the canvas. Anything else is a manifest written for a renderer we do not have.
  // A user's own template comes from the UI (msg.manifests) or from this computer's store
  // (user-templates.js); its images are re-created from stored bytes inside capBuildTree.
  async function manifestFor(key) {
    if (!key) return null;
    var m = manifests[key] || fallbackManifest(key);
    if (!m) { try { m = await utManifest(key); } catch (e) { m = null; } }
    if (m && m.renderer && m.renderer !== 'aplus-standard-v1' && m.renderer !== CAP_RENDERER) return null;
    return m;
  }
  if (!msg.rows || !msg.rows.length) {
    figma.ui.postMessage({ type: 'error', message: 'No rows to build.' });
    return;
  }

  try {
    var icons = await buildIconIndexAll();
    var maxX = 0, minY = Infinity;
    figma.currentPage.children.forEach(function (n) { maxX = Math.max(maxX, n.x + n.width); minY = Math.min(minY, n.y); });
    var x = maxX + 600, y = isFinite(minY) ? minY : 0;
    var created = [], report = [], missingFonts = {}, lastLabel = '';
    for (var i = 0; i < msg.rows.length; i++) {
      var key = keys[i];
      var manifest = await manifestFor(key);
      var row = manifest ? rowFromManifest(manifest, msg.rows[i]) : null;
      // only used to name a row we could not route (no manifest, so no schema to ask).
      // the live sheet keeps style IDs in column B and the older one in column A, so look at
      // both rather than hardcoding either — a routed row gets its ids from the manifest above.
      var ids = (String(msg.rows[i][1] || '').match(/\d{6}/g)
        || String(msg.rows[i][0] || '').match(/\d{6}/g) || []);
      var name = (row && row.ids.length ? row.ids.join(', ') : (ids.join(', ') || ('Row ' + (i + 1))));
      if (errors[i]) {
        report.push({ name: name, ok: false, warnings: [errors[i]] });
      } else if (!manifest) {
        report.push({ name: name, ok: false, warnings: ['No active template for "' + (key || 'unknown category/gender') + '" — check columns B and C.'] });
      } else {
        try {
          var fonts = await loadFontsFromManifest(manifest);
          fonts.missing.forEach(function (f) { missingFonts[f] = 1; });
          var res = manifest.renderer === CAP_RENDERER
            ? await capBuildFromManifest(manifest, row, { x: x, y: y })
            : await buildFromManifest(manifest, row, { F: fonts.F, icons: icons, x: x, y: y });
          // Tag the frame so Export knows its category without guessing (main-export.js reads it).
          try {
            var kp = String(key || '').split('/');
            res.frame.setPluginData('aplus', JSON.stringify({
              v: 1, styleIds: row.ids || [], category: kp[0] || null, gender: kp[1] || null, templateKey: key
            }));
          } catch (tagErr) { res.warnings = (res.warnings || []).concat(['Could not tag the frame for Export: ' + tagErr.message]); }
          created.push(res.frame, res.label);
          report.push({ name: name + '  ·  ' + manifest.meta.label, ok: true, warnings: res.warnings });
          lastLabel = manifest.meta.label;
          x += ((manifest.meta && manifest.meta.width) || 1572) + 600;
        } catch (e) {
          report.push({ name: name, ok: false, warnings: [String(e && e.message || e)] });
        }
      }
      figma.ui.postMessage({ type: 'progress', done: i + 1, total: msg.rows.length });
      await new Promise(function (r) { setTimeout(r, 0); });
    }
    if (created.length) {
      figma.currentPage.selection = created.filter(function (n) { return n.type === 'FRAME'; });
      figma.viewport.scrollAndZoomIntoView(created);
    }
    figma.commitUndo();
    figma.ui.postMessage({
      type: 'done', report: report, missingFonts: Object.keys(missingFonts),
      source: msg.source || 'bundled', template: lastLabel
    });
    figma.notify('A+: ' + report.filter(function (r) { return r.ok; }).length + ' design(s) created');
  } catch (e) {
    figma.ui.postMessage({ type: 'error', message: String(e && e.message || e) });
  }
});
