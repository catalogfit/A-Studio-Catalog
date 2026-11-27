/* =============================================================================================
   plugin-src/ui/export.js — the "Export" panel.  OWNED BY THE EXPORT PANEL.
   Markup: ui/export.html. Sandbox side: plugin-src/main-export.js. Backend config: backend/gif-rules.json.
   Uses platform.js: state, $, esc, bus, bridge, backend, drive, files, errorText, registryCats,
   Panels.automate.styleRows()/picks(). Vendor globals available: gifenc, fflate, Mp4Muxer.
   Publishes Panels.export.
   ============================================================================================= */
(function () {
  // ---------- this panel's state ----------
  state.gifRules = [];
  state.exportFolder = '';

    // ---------- PANEL 3 — export ----------
    var ruleSeq = 0;
    function newRule() { return { id: 'r' + (++ruleSeq), category: '', gender: '', styleId: '', gif: '' }; }
    function renderRules() {
      var host = $('ex-rules'), cats = registryCats();
      $('ex-rulemeta').textContent = state.gifRules.length ? (state.gifRules.length + ' rule' + (state.gifRules.length > 1 ? 's' : '')) : 'none yet';
      if (!state.gifRules.length) {
        host.innerHTML = '<div class="note info" style="margin-top:0"><b>No rules yet</b>Add one per GIF.</div>';
        return;
      }
      host.innerHTML = state.gifRules.map(function (r, i) {
        return '<div class="rule" data-i="' + i + '">' +
          '<div class="g">' +
          '<div><label>Category</label><select data-k="category"><option value="">any</option>' +
          cats.map(function (c) { return '<option value="' + esc(c.id) + '"' + (r.category === c.id ? ' selected' : '') + '>' + esc(c.label) + '</option>'; }).join('') +
          '</select></div>' +
          '<div><label>Gender</label><input data-k="gender" value="' + esc(r.gender) + '" placeholder="any"></div>' +
          '<div><label>Style ID</label><input data-k="styleId" value="' + esc(r.styleId) + '" placeholder="any"></div>' +
          '<div><label>GIF / video</label><input data-k="gif" value="' + esc(r.gif) + '" placeholder="e.g. Running.mp4"></div>' +
          '</div>' +
          '<button class="btn ghost x" data-del="' + i + '">Remove rule</button>' +
          '</div>';
      }).join('');
    }
    $('ex-rules').addEventListener('input', function (ev) {
      var el = ev.target, k = el.dataset && el.dataset.k;
      if (!k) return;
      var box = el.closest('.rule'); if (!box) return;
      var r = state.gifRules[parseInt(box.dataset.i, 10)];
      if (r) { r[k] = el.value; renderExportStyles(); saveExportConfig(); }
    });
    $('ex-rules').addEventListener('change', function (ev) {
      var el = ev.target, k = el.dataset && el.dataset.k;
      if (!k) return;
      var box = el.closest('.rule'); if (!box) return;
      var r = state.gifRules[parseInt(box.dataset.i, 10)];
      if (r) { r[k] = el.value; renderExportStyles(); saveExportConfig(); }
    });
    $('ex-rules').addEventListener('click', function (ev) {
      var d = ev.target.dataset && ev.target.dataset.del;
      if (d === undefined) return;
      state.gifRules.splice(parseInt(d, 10), 1);
      renderRules(); renderExportStyles(); saveExportConfig();
    });
    $('ex-addrule').onclick = function () { state.gifRules.push(newRule()); renderRules(); renderExportStyles(); saveExportConfig(); };
    $('ex-folder').oninput = function () { state.exportFolder = $('ex-folder').value.trim(); state.driveCache = {}; renderExportStyles(); saveExportConfig(); };
    $('ex-format').onchange = function () { renderExportStyles(); };

    // folder + rules persist in figma.clientStorage, debounced so typing does not hammer it
    function saveExportConfig() {
      clearTimeout(state.pending.saveEx);
      state.pending.saveEx = setTimeout(function () {
        bridge.send('save-export-config', { config: {
          folder: state.exportFolder,
          rules: state.gifRules.map(function (r) { return { category: r.category, gender: r.gender, styleId: r.styleId, gif: r.gif }; })
        } });
      }, 400);
    }
    function loadExportConfig(cfg) {
      if (!cfg) return;
      state.exportFolder = cfg.folder || '';
      $('ex-folder').value = state.exportFolder;
      state.gifRules = (cfg.rules || []).map(function (r) {
        var n = newRule(); n.category = r.category || ''; n.gender = r.gender || ''; n.styleId = r.styleId || ''; n.gif = r.gif || ''; return n;
      });
      renderRules();
    }
    function isComposite(fmt) { return fmt === 'gif' || fmt === 'mp4'; }

    // Matching is data: first rule whose filled fields all match wins. No category is named in code.
    function gifFor(ctx) {
      for (var i = 0; i < state.gifRules.length; i++) {
        var r = state.gifRules[i];
        if (r.category && r.category !== ctx.category) continue;
        if (r.gender && String(r.gender).toLowerCase() !== String(ctx.gender || '').toLowerCase()) continue;
        if (r.styleId && String(r.styleId).trim() !== ctx.styleId) continue;
        return r;
      }
      return null;
    }
    // Style IDs come from the Automate panel's loaded rows (Panels.automate.styleRows) plus
    // anything selected on the canvas.
    function exportCandidates() {
      var out = [], seen = {};
      var A = Panels.automate || {};
      (A.styleRows ? A.styleRows() : []).forEach(function (c) {
        if (seen[c.styleId]) return; seen[c.styleId] = 1;
        out.push({ styleId: c.styleId, category: c.category, gender: c.gender, label: c.label, error: c.error });
      });
      var picks = A.picks ? A.picks() : {};
      (state.selection.ids || []).forEach(function (id) {
        if (seen[id]) return; seen[id] = 1;
        out.push({ styleId: id, category: picks.cat || '', gender: picks.gender || '', label: 'from canvas selection', error: null });
      });
      return out;
    }
    function renderExportStyles() {
      var host = $('ex-styles'); if (!host) return;
      var list = exportCandidates();
      $('ex-stylemeta').textContent = list.length ? (list.length + ' style ID' + (list.length > 1 ? 's' : '')) : '';
      if (!list.length) {
        host.innerHTML = '<div class="note info"><b>Nothing to export yet</b>Load a sheet, or select A+ frames.</div>';
        return;
      }
      host.innerHTML = list.map(function (c, i) {
          var g = gifFor(c);
          return '<div class="srow">' +
            '<div><div class="sid">' + esc(c.styleId) + '</div>' +
            '<div class="sg">' + esc(c.label || c.error || '—') + ' · GIF: ' + esc(g && g.gif ? g.gif : 'no rule matches') + '</div></div>' +
            '<div class="sp"><button class="btn ghost" data-ex="' + i + '">Export</button></div>' +
            '</div>';
        }).join('');
    }
    $('ex-styles').addEventListener('click', function (ev) {
      var d = ev.target.dataset && ev.target.dataset.ex;
      if (d === undefined) return;
      var c = exportCandidates()[parseInt(d, 10)];
      if (!c) return;
      var fmt = $('ex-format').value;
      var composite = isComposite(fmt) ? fmt : null;
      var g = gifFor(c);
      // check everything the composite needs BEFORE asking Figma to render a large PNG
      if (composite) {
        var why = !g || !g.gif ? 'No GIF rule matches style ' + c.styleId + '. Add a rule in step 2.'
          : (!(state.session && state.googleEmail) ? 'Connect Google first. The GIF is read from your Drive.'
          : (!looksLikeDriveId(g.gif) && !state.exportFolder ? 'Set the GIF source folder in step 1.' : ''));
        if (why) { exportNote('warn', 'Cannot export ' + c.styleId, esc(why)); return; }
      }
      var reqId = 'x' + Date.now();
      state.exportJob = { reqId: reqId, styleId: c.styleId, composite: composite, gif: g ? g.gif : null };
      bridge.send('export-style', {
        reqId: reqId,
        styleId: c.styleId, pageId: state.pageId,
        // a composite is built on a PNG of the A+; the backend turns it into the GIF/MP4
        format: composite ? 'PNG' : fmt,
        composite: composite,
        scale: parseInt($('ex-scale').value, 10) || 1
      });
      exportNote('pending', 'Exporting ' + c.styleId, 'Rendering the frame in Figma…');
      clearTimeout(state.pending.exp);
      state.pending.exp = setTimeout(function () {
        if (!state.exportJob || state.exportJob.reqId !== reqId) return;
        state.exportJob = null;
        exportNote('warn', 'Figma did not answer', 'The plugin code did not reply within 60 s. Close and reopen the plugin, then try again. If it keeps happening, the installed <code>code.js</code> is out of date: rebuild it with <code>node plugin-src/build.js</code>.');
      }, 60000);
    });

    function exportNote(kind, title, html) {
      $('ex-out').innerHTML = '<div class="note ' + kind + '"><b>' + esc(title) + '</b>' + html + '</div>';
    }
    function looksLikeDriveId(s) {
      s = String(s || '').trim();
      return /drive\.google\.com|docs\.google\.com/.test(s) || /^[A-Za-z0-9_-]{25,}$/.test(s);
    }
    var u8ToB64 = files.toB64, b64ToU8 = files.fromB64, fmtBytes = files.fmtBytes, saveFile = files.save;
    function postJson(path, body) { return backend.post(path, body); }
    // A rule's GIF is either a Drive link/id, or a file name looked up in the source folder.
    async function resolveGifFile(gif) {
      if (looksLikeDriveId(gif)) return { id: gif, name: gif };
      state.driveCache = state.driveCache || {};
      var list = state.driveCache[state.exportFolder];
      if (!list) {
        list = await postJson('/api/drive/list', { session: state.session, folder: state.exportFolder });
        state.driveCache[state.exportFolder] = list;
      }
      var want = String(gif).trim().toLowerCase(), files = list.files || [];
      var hit = files.filter(function (f) {
        var n = String(f.name).toLowerCase();
        return n === want || n.replace(/\.[^.]+$/, '') === want;
      })[0];
      if (!hit) {
        throw new Error('"' + gif + '" is not in ' + (list.folderName ? '"' + list.folderName + '"' : 'the folder') + '. ' +
          (files.length ? 'Animations there: ' + files.slice(0, 8).map(function (f) { return f.name; }).join(', ') + (files.length > 8 ? '…' : '') : 'It has no GIF or video files.'));
      }
      return hit;
    }
    async function finishExport(m) {
      var job = state.exportJob;
      if (!job || job.reqId !== m.reqId) return;          // a stale reply from an earlier click
      clearTimeout(state.pending.exp);
      var dupe = m.matches > 1 ? '<br>' + m.matches + ' frames match this style ID. Exported "' + esc(m.frameName) + '". Select a frame to pick a different one.' : '';
      try {
        if (!job.composite) {
          var ext = m.format.toLowerCase(), mime = { png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml', pdf: 'application/pdf' }[ext];
          var link = saveFile(m.bytes, mime, job.styleId + '.' + ext);
          exportNote('info', 'Exported ' + job.styleId + ' · ' + m.format,
            esc(m.frameName) + ' · ' + m.width + '×' + m.height + ' · ' + fmtBytes(m.bytes.length) + '<br>' + link + dupe);
          return;
        }
        exportNote('pending', 'Exporting ' + job.styleId, 'Finding "' + esc(job.gif) + '" in Drive…');
        var file = await resolveGifFile(job.gif);
        exportNote('pending', 'Exporting ' + job.styleId, 'Building the ' + job.composite.toUpperCase() + ' with "' + esc(file.name) + '" on the backend. Large A+ pages can take 10 to 30 s…');
        var r = await postJson('/api/compose', { session: state.session, aplusPng: u8ToB64(m.bytes), driveFileId: file.id, format: job.composite });
        var out = b64ToU8(r.base64);
        var link2 = saveFile(out, r.mimeType, job.styleId + '.' + job.composite);
        var amz = r.amazon || {};
        exportNote(amz.acceptedByAmazonAPlus === false ? 'pending' : 'info',
          'Exported ' + job.styleId + ' · ' + job.composite.toUpperCase(),
          esc(r.output.width + '×' + r.output.height + ' · ' + r.output.frames + ' frames · ' + fmtBytes(out.length) + ' · GIF: ' + file.name) +
          '<br>' + link2 + dupe +
          (amz.reason ? '<br><br><b>Amazon:</b> ' + esc(amz.reason) : ''));
      } catch (e) {
        exportNote('warn', 'Export failed · ' + job.styleId, esc(errorText(e)));
      } finally {
        if (state.exportJob === job) state.exportJob = null;
      }
    }

  // ---------- events from the platform and the sandbox ----------
  bus.on('registry', function () { renderRules(); });
  bus.on('rows-changed', function () { renderExportStyles(); });
  bus.on('selection', function () { renderExportStyles(); });
  bus.on('tab', function (name) { if (name === 'export') renderExportStyles(); });
  bus.on('init', function (m) {
    loadExportConfig(m.exportConfig);   // after the registry, so rule rows can list categories
    renderExportStyles();
  });
  bridge.on('export-bytes', function (m) { return finishExport(m); });
  bridge.on('export-error', function (m) {
    if (state.exportJob && m.reqId && state.exportJob.reqId !== m.reqId) return;
    clearTimeout(state.pending.exp);
    state.exportJob = null;
    exportNote('warn', 'Export failed' + (m.styleId ? ' · ' + m.styleId : ''), esc(m.message || 'No reason given.'));
  });

  Panels.export = {};

  // first paint
  renderRules();
  renderExportStyles();
})();
