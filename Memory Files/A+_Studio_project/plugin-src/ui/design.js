/* =============================================================================================
   plugin-src/ui/design.js — the "Add design" panel.  OWNED BY THE DESIGN PANEL.
   Markup: ui/design.html. Sandbox side: plugin-src/main-design.js (+ capture.js, user-templates.js).
   Uses platform.js: state, $, esc, bus, bridge, auth, files, errorText, registryCats, slugify,
   userTemplates (this computer / Drive / file tiers — docs/user-templates.md).
   Publishes Panels.design.

   Flow: select a frame -> name it (free-text category, gender, id) -> Save as template
     1. capture in the sandbox (progress per stage, images included)
     2. saved on this computer (clientStorage, within its budget)       -> registry refreshed at once
     3. uploaded to the user's Drive (progress)                          -> "Saved · this computer + Drive"
     A Drive failure leaves a "Retry upload" button; nothing is ever sent to the A+ backend.
   ============================================================================================= */
(function () {
  var D = state.design = {
    idEdited: false,      // once the user types an id, the name stops overwriting it
    busy: false,          // a capture / import is running
    uploading: {},        // key -> { text, pct } while a Drive upload runs
    uploadErr: {},        // key -> error text after a failed upload (Retry shown)
    confirmDelete: null,  // key whose Delete is waiting for "Yes, delete"
    lastCapture: null     // the capture-result being finished (Drive upload)
  };
  var GENDER_LABEL = { men: 'Men', women: 'Women', unisex: 'Unisex' };
  var STEP_TEXT = {
    scan: 'Finding the frame', capture: 'Reading every layer', classify: 'Finding text roles and photo slots',
    images: 'Copying the images', 'render-probe': 'Rebuilding it to check the copy', diff: 'Comparing the copy with your frame',
    'save-local': 'Saving on this computer'
  };
  var STEP_ORDER = ['scan', 'capture', 'classify', 'images', 'render-probe', 'diff', 'save-local'];

  function fmt(n) { return files.fmtBytes(Math.max(0, Number(n) || 0)); }
  function progressNote(title, text, pct) {
    return '<div class="note pending"><b>' + esc(title) + '</b>' + esc(text || '') +
      '<div class="track"><i style="width:' + Math.max(3, Math.min(100, pct || 0)) + '%"></i></div></div>';
  }

  // ---------- identity: category (free text), gender, name, id ----------
  function renderCategoryList() {
    var seen = {};
    $('ad-cats').innerHTML = registryCats().map(function (c) {
      if (seen[c.label]) return ''; seen[c.label] = 1;
      return '<option value="' + esc(c.label) + '"></option>';
    }).join('');
  }
  // The typed category: an existing one when the label or id matches, else a new id from the text.
  function typedCategory() {
    var raw = $('ad-cat').value.trim();
    if (!raw) return null;
    var hit = registryCats().filter(function (c) { return c.label.toLowerCase() === raw.toLowerCase() || c.id === raw.toLowerCase() || c.id === slugify(raw); })[0];
    if (hit) return { id: hit.id, label: hit.label, existing: true };
    var id = slugify(raw, 60);
    return id ? { id: id, label: raw, existing: false } : null;
  }
  function currentKey() {
    var c = typedCategory(), id = slugify($('ad-id').value, 60), g = $('ad-gender').value;
    if (!c || !id) return null;
    return { key: c.id + '/' + g + '/' + id, cat: c, gender: g, id: id };
  }
  $('ad-name').oninput = function () {
    if (!D.idEdited) $('ad-id').value = slugify($('ad-name').value, 60);
    renderForm();
  };
  $('ad-id').oninput = function () { D.idEdited = !!$('ad-id').value.trim(); renderForm(); };
  $('ad-id').onblur = function () { var v = slugify($('ad-id').value, 60); if (v !== $('ad-id').value) { $('ad-id').value = v; renderForm(); } };
  $('ad-cat').oninput = renderForm;
  $('ad-gender').onchange = renderForm;

  function renderForm() {
    var f = (state.selection.frames || [])[0];
    var n = (state.selection.frames || []).length;
    $('ad-selmeta').textContent = n ? (n + ' selected') : '';
    if (!f) $('ad-sel').innerHTML = 'Select one frame to capture.';
    else {
      $('ad-sel').innerHTML = '<b>' + esc(f.name) + '</b><br>' +
        '<span class="muted">' + f.w + ' × ' + f.h + ' px</span>' +
        (n > 1 ? '<br><span style="color:var(--danger)">' + n + ' frames selected. Only the first is saved.</span>' : '');
    }
    var k = currentKey();
    if (!k) {
      $('ad-keyline').innerHTML = $('ad-cat').value.trim() && !typedCategory()
        ? '<span style="color:var(--danger)">Use at least one letter or digit in the category.</span>'
        : 'Saved as <code>category/gender/id</code>.';
    } else {
      var st = userTemplates.keyStatus(k.key);
      $('ad-keyline').innerHTML = 'Saved as <code>' + esc(k.key) + '</code>' +
        (k.cat.existing ? '' : ' · new category <b>' + esc(k.cat.label) + '</b>') +
        (st === 'user' ? ' · <span style="color:var(--danger)">you already have a template with this id</span>' : '') +
        (st === 'bundled' ? ' · <span style="color:var(--danger)">a built-in template uses this id</span>' : '');
    }
    $('ad-where').innerHTML = auth.isConnected()
      ? 'Saved on this computer and in your Google Drive (<code>Cult A+ Design Lab/Templates</code>).'
      : 'Saved on this computer only. Sign in to Google to keep a copy in your Drive.';
    $('ad-go').disabled = D.busy || !(f && $('ad-name').value.trim() && k);
  }

  // ---------- in-panel choices (no confirm() dialogs in a Figma plugin) ----------
  // choose(host, html, [{ label, cls, fn }]) — renders a note with buttons; any button clears it.
  function choose(host, html, options) {
    host.innerHTML = '<div class="note pending">' + html + '<div class="ut-choice">' +
      options.map(function (o, i) { return '<button data-i="' + i + '" class="' + (o.cls || '') + '">' + esc(o.label) + '</button>'; }).join('') +
      '</div></div>';
    host.querySelectorAll('.ut-choice button').forEach(function (b) {
      b.onclick = function () { host.innerHTML = ''; options[Number(b.dataset.i)].fn(); };
    });
  }
  // Same key already used? Ask: Replace / Save as new / Cancel (bundled keys: Save as new only).
  function resolveKeyClash(host, k, label, go) {
    var st = userTemplates.keyStatus(k.key);
    if (st === 'free') return go(k, false);
    var newId = userTemplates.suggestFreeId(k.cat.id, k.gender, k.id);
    var opts = [];
    if (st === 'user') opts.push({ label: 'Replace it', cls: 'danger', fn: function () { go(k, true); } });
    opts.push({ label: 'Save as new (' + newId + ')', cls: 'go', fn: function () {
      go({ key: k.cat.id + '/' + k.gender + '/' + newId, cat: k.cat, gender: k.gender, id: newId }, false);
    } });
    opts.push({ label: 'Cancel', fn: function () { renderForm(); } });
    var e = userTemplates.find(k.key);
    choose(host, st === 'user'
      ? '<b>You already have “' + esc((e && e.label) || k.key) + '”</b>It is saved as <code>' + esc(k.key) + '</code> (' +
        esc(whereText(e)) + '). Replace it with “' + esc(label) + '”, or keep both?'
      : '<b>That id belongs to a built-in template</b><code>' + esc(k.key) + '</code> ships with the plugin and cannot be replaced.', opts);
  }

  // ---------- save: capture -> this computer -> Drive ----------
  $('ad-go').onclick = function () {
    var f = (state.selection.frames || [])[0], k = currentKey();
    if (!f || !k) return;
    $('ad-out').innerHTML = '';
    resolveKeyClash($('ad-conflict'), k, $('ad-name').value.trim(), function (kk, replace) { startCapture(f, kk, replace); });
  };
  function startCapture(f, k, replace) {
    D.busy = true; D.lastCapture = null;
    $('ad-id').value = k.id;
    renderForm();
    $('ad-out').innerHTML = progressNote('Saving · 1 of ' + (auth.isConnected() ? 3 : 2), STEP_TEXT.scan + '…', 2);
    bridge.send('capture-template', {
      frameId: f.id, frameName: f.name, width: f.w, height: f.h, styleIds: f.ids || [], pageId: state.pageId,
      template: { id: k.id, label: $('ad-name').value.trim(), categoryId: k.cat.id, categoryLabel: k.cat.label, genderId: k.gender, status: 'active' },
      replace: !!replace
    });
    armCaptureFallback();
  }
  // Only fires when this code.js is older than the panel (nothing answers capture-template).
  function armCaptureFallback() {
    clearTimeout(state.pending.capture);
    state.pending.capture = setTimeout(function () {
      D.busy = false; renderForm();
      $('ad-out').innerHTML = ui.note('warn', 'The plugin code is out of date',
        'Nothing answered the save request. Close and reopen the plugin (or rebuild it). Nothing was saved and the frame is untouched.');
    }, 4000);
  }
  function renderCaptureProgress(m) {
    var i = Math.max(0, STEP_ORDER.indexOf(m.step));
    var within = Number(m.total) > 0 ? Math.min(1, (Number(m.done) || 0) / Number(m.total)) : 0;
    var pct = Math.round(((i + within) / STEP_ORDER.length) * 100);
    var extra = m.step === 'images' && m.total ? ' (' + Math.min(m.done + 1, m.total) + ' of ' + m.total + ')' : '';
    $('ad-out').innerHTML = progressNote(m.step === 'save-local' ? 'Saving on this computer' : 'Reading your frame',
      (STEP_TEXT[m.step] || 'Working') + extra + '…', pct);
  }

  function whereText(e) {
    var w = userTemplates.where(e);
    return w === 'both' ? 'this computer + Drive' : w === 'computer' ? 'this computer only' : w === 'drive' ? 'your Drive only' : 'not saved';
  }
  function roundTripDetails(d) {
    if (!d) return '';
    var mis = d.mismatches || [];
    var pct = typeof d.score === 'number' ? Math.round(d.score * 1000) / 10 + '%' : '—';
    return '<details class="ut-details"><summary>' + (mis.length ? mis.length + ' difference(s)' : 'Copy check: identical') + '</summary>' +
      '<div class="hint">The plugin rebuilt your frame from the saved template and compared ' + esc(String(d.compared || 0)) +
      ' properties: ' + esc(pct) + ' match.' + (mis.length ? ' These did not come back exactly:' : '') + '</div>' +
      (mis.length ? '<div class="hint" style="max-height:180px;overflow:auto">' + mis.slice(0, 60).map(function (x) {
        return '<div><code>' + esc(x.path || '') + '</code> expected ' + esc(String(x.expected)).slice(0, 80) + ', got ' + esc(String(x.actual)).slice(0, 80) + '</div>';
      }).join('') + '</div>' : '') + '</details>';
  }
  function warningsBlock(w) {
    if (!w || !w.length) return '';
    return '<details class="ut-details"><summary>' + w.length + ' note(s)</summary><ul class="hint" style="margin:6px 0 0 15px;padding:0">' +
      w.map(function (x) { return '<li>' + esc(String(x)) + '</li>'; }).join('') + '</ul></details>';
  }

  // The capture is saved (or not) on this computer; now the Drive copy, then the final status.
  async function finishCapture(m) {
    D.lastCapture = m;
    await userTemplates.refreshLocal();          // -> setRegistry: Automate / Export pickers update now
    userTemplates.forget(m.key);
    var label = m.label || m.key;
    var localOk = !!(m.local && m.local.manifest);
    var head = '<span class="em">' + esc(label) + '</span> · <code>' + esc(m.key) + '</code><br>' +
      esc(m.stats.layers + ' layers · ' + m.images + ' image(s) · ' + fmt(m.manifestBytes + (m.imageBytes || 0)));
    var details = roundTripDetails(m.diff) + warningsBlock(m.warnings);

    if (!auth.isConnected()) {
      $('ad-out').innerHTML = localOk
        ? ui.note(m.local.reason ? 'pending' : 'info', 'Saved on this computer', head + (m.local.reason ? '<br>' + esc(m.local.reason) : '') +
            '<br>Sign in to Google to keep a copy in your Drive.') + details
        : ui.note('warn', 'Not saved yet', head + '<br>' + esc(m.local.reason || '') +
            '<br>Sign in to Google to save it to your Drive, or download it as a file now.' +
            '<div class="ut-choice"><button class="go" id="ad-save-file">Download template file</button></div>') + details;
      wireSaveFile(m.key);
      D.busy = false; renderForm(); renderMine();
      return;
    }
    await uploadWithProgress(m.key, $('ad-out'), function (ok, err) {
      if (ok) {
        $('ad-name').value = ''; $('ad-id').value = ''; D.idEdited = false;   // ready for the next one
        $('ad-out').innerHTML = ui.note(m.local.reason ? 'pending' : 'info',
          localOk ? 'Saved · this computer + Google Drive' : 'Saved to Google Drive',
          head + (m.local.reason ? '<br>' + esc(m.local.reason) : '') +
          '<br>It is in Automate now, under <span class="em">' + esc(categoryLabelOf(m.key)) + ' · ' + esc(GENDER_LABEL[m.key.split('/')[1]] || '') + '</span>.') + details;
      } else {
        $('ad-out').innerHTML = ui.note(localOk ? 'pending' : 'warn',
          localOk ? 'Saved on this computer · Drive upload failed' : 'Not saved yet · Drive upload failed',
          head + '<br>' + esc(errorText(err)) + (localOk ? '' : '<br>' + esc(m.local.reason || '') + ' Download the file so it is not lost.') +
          '<div class="ut-choice"><button class="go" id="ad-retry">Retry upload</button>' +
          (localOk ? '' : '<button id="ad-save-file">Download template file</button>') + '</div>') + details;
        $('ad-retry').onclick = function () { finishCapture(m); };
        wireSaveFile(m.key);
      }
      D.busy = false; renderForm();
    });
  }
  function categoryLabelOf(key) {
    var c = registryCats().filter(function (x) { return x.id === key.split('/')[0]; })[0];
    return c ? c.label : key.split('/')[0];
  }
  function wireSaveFile(key) {
    var b = $('ad-save-file');
    if (b) b.onclick = function () { exportTemplate(key, $('ad-out')); };
  }
  // Runs the Drive upload for `key`, drawing progress into `host`; done(ok, err).
  async function uploadWithProgress(key, host, done) {
    D.uploading[key] = { text: 'Starting…', pct: 2 }; delete D.uploadErr[key];
    host.innerHTML = progressNote('Uploading to your Google Drive', 'Starting…', 2);
    renderMine();
    try {
      await userTemplates.uploadToDrive(key, function (p) {
        D.uploading[key] = p;
        host.innerHTML = progressNote('Uploading to your Google Drive', p.text, p.pct);
      });
      delete D.uploading[key];
      done(true);
    } catch (e) {
      delete D.uploading[key]; D.uploadErr[key] = errorText(e);
      done(false, e);
    }
    renderMine();
  }

  // ---------- My templates ----------
  function renderMine() {
    var list = userTemplates.list();
    var u = userTemplates.usage();
    $('ad-usage').textContent = u ? ('This computer: ' + fmt(u.own) + ' used · ' + fmt(Math.max(0, u.budget - u.total)) + ' free') : '';
    if (!list.length) {
      $('ad-mine').innerHTML = '<div class="ut-empty"><b>No templates yet.</b><br>Select a finished A+ frame, name it above and press ' +
        '<b>Save as template</b>. It appears here and in Automate straight away.' +
        (auth.isConnected() && !userTemplates.driveListed() ? '<br><span class="muted">Checking your Drive…</span>' : '') + '</div>';
      return;
    }
    $('ad-mine').innerHTML = list.map(function (e) {
      var up = D.uploading[e.key], err = D.uploadErr[e.key];
      var canDrive = auth.isConnected();
      var size = e.bytes || (e.drive && e.drive.bytes) || 0;
      var partial = e.local && e.local.assetsTotal && e.local.assetsStored < e.local.assetsTotal;
      var acts;
      if (D.confirmDelete === e.key) {
        acts = '<span class="w" style="margin:0">' + (e.drive ? 'Delete from this computer and move the Drive copy to the Drive bin?' : 'Delete from this computer? This cannot be undone.') + '</span>' +
          '<button class="danger" data-act="delete-yes">Yes, delete</button><button data-act="delete-no">Keep</button>';
      } else {
        acts = '<button data-act="export">Export file</button>' +
          (e.local && !e.drive && canDrive ? '<button class="go" data-act="upload"' + (up ? ' disabled' : '') + '>' + (err ? 'Retry upload' : 'Upload to Drive') + '</button>' : '') +
          '<button class="danger" data-act="delete"' + (!e.local && !canDrive ? ' disabled title="Sign in to Google to delete a Drive template"' : '') + '>Delete</button>';
      }
      return '<div class="ut-row" data-key="' + esc(e.key) + '">' +
        '<div class="t"><b>' + esc(e.label || e.key) + '</b><span class="muted" style="font-size:10px">' + (size ? fmt(size) : '') + '</span></div>' +
        '<div class="k">' + esc(e.key) + '</div>' +
        '<div class="w"><span class="ut-badge ' + (e.local ? 'on' : 'off') + '">This computer' + (partial ? ' · ' + e.local.assetsStored + '/' + e.local.assetsTotal + ' images' : '') + '</span>' +
        '<span class="ut-badge ' + (e.drive ? 'on' : 'off') + '">Drive' + (e.drive && e.drive.unverified ? ' (not checked yet)' : '') + '</span></div>' +
        (up ? '<div class="w">' + esc(up.text) + '</div><div class="track"><i style="width:' + Math.max(3, up.pct || 0) + '%"></i></div>' : '') +
        (err && !up ? '<div class="w" style="color:var(--danger)">Drive upload failed: ' + esc(err) + '</div>' : '') +
        (!e.local && e.drive ? '<div class="w">Downloads from your Drive the first time you use it here.</div>' : '') +
        '<div class="acts">' + acts + '</div></div>';
    }).join('') + (userTemplates.driveError() ? '<div class="hint" style="color:var(--danger)">Could not list your Drive templates: ' + esc(errorText(userTemplates.driveError())) + '</div>' : '');
    $('ad-mine').querySelectorAll('.ut-row button').forEach(function (b) {
      b.onclick = function () { onRowAction(b.closest('.ut-row').dataset.key, b.dataset.act); };
    });
  }
  async function onRowAction(key, act) {
    var out = $('ad-mine-out');
    if (act === 'export') return exportTemplate(key, out);
    if (act === 'upload') {
      return uploadWithProgress(key, out, function (ok, err) {
        out.innerHTML = ok ? ui.note('info', 'Uploaded to your Drive', '<code>' + esc(key) + '</code> is now in <code>Cult A+ Design Lab/Templates</code>.')
          : ui.note('warn', 'Drive upload failed', esc(errorText(err)));
      });
    }
    if (act === 'delete') { D.confirmDelete = key; return renderMine(); }
    if (act === 'delete-no') { D.confirmDelete = null; return renderMine(); }
    if (act === 'delete-yes') {
      D.confirmDelete = null;
      out.innerHTML = progressNote('Deleting', key, 40);
      try {
        var r = await userTemplates.remove(key);
        var bits = [];
        if (r.local) bits.push('removed from this computer');
        if (r.drive === 'trashed') bits.push('Drive copy moved to the Drive bin (restore it from drive.google.com within 30 days)');
        if (r.drive === 'gone') bits.push('the Drive copy was already gone');
        if (r.drive === 'skipped') bits.push('the Drive copy was kept because you are not signed in');
        out.innerHTML = r.drive === 'failed'
          ? ui.note('warn', 'Deleted here · Drive copy not moved to the bin', esc(errorText(r.driveError)) + ' It will show up again from Drive; delete it once more to retry.')
          : ui.note('info', 'Deleted', '<code>' + esc(key) + '</code>: ' + esc(bits.join('; ') || 'nothing to delete') + '.');
      } catch (e) { out.innerHTML = ui.note('warn', 'Could not delete', esc(errorText(e))); }
      renderMine(); renderForm();
    }
  }
  async function exportTemplate(key, host) {
    host.innerHTML = progressNote('Preparing the template file', 'Collecting the images…', 30);
    try {
      var r = await userTemplates.exportFile(key, function (p) { host.innerHTML = progressNote('Preparing the template file', p.text, 30 + 60 * (p.done || 0) / Math.max(1, p.total || 1)); });
      host.innerHTML = ui.note(r.missing ? 'pending' : 'info', 'Template file ready', '<code>' + esc(r.name) + '</code> · ' + esc(fmt(r.bytes)) +
        (r.missing ? '<br>' + r.missing + ' image(s) were not available here and are not in the file.' : '') + '<br>' + r.link);
    } catch (e) { host.innerHTML = ui.note('warn', 'Could not export', esc(errorText(e))); }
  }

  // ---------- import a template file ----------
  $('ad-import').onclick = function () { $('ad-file').value = ''; $('ad-file').click(); };
  $('ad-file').onchange = async function () {
    var file = $('ad-file').files && $('ad-file').files[0];
    var out = $('ad-mine-out');
    if (!file) return;
    var parsed;
    try {
      if (file.size > 60 * 1024 * 1024) throw PlatformError('bad-request', 'That file is larger than 60 MB.');
      out.innerHTML = progressNote('Reading ' + file.name, 'Checking the template…', 20);
      parsed = userTemplates.parseFile(await file.text());
    } catch (e) { out.innerHTML = ui.note('warn', 'Could not import ' + file.name, esc(errorText(e))); return; }
    var M = parsed.manifest, meta = M.meta;
    var k = { key: meta.key, cat: { id: meta.category, label: meta.categoryLabel || meta.category }, gender: meta.gender, id: meta.id };
    resolveKeyClash(out, k, meta.label || meta.key, async function (kk, replace) {
      var man = kk.key === meta.key ? M : userTemplates.rekey(M, kk.id, null);
      out.innerHTML = progressNote('Importing “' + (meta.label || meta.key) + '”', 'Saving on this computer…', 25);
      try {
        var r = await userTemplates.saveWhole(man, parsed.assets, {
          replace: replace,
          onProgress: function (p) { out.innerHTML = progressNote('Importing “' + (meta.label || meta.key) + '”', p.text, 30 + 0.7 * (p.pct || 0)); }
        });
        var where = [];
        if (r.local && r.local.manifest) where.push('this computer');
        if (r.drive) where.push('Google Drive');
        out.innerHTML = ui.note(r.driveError || !where.length || (r.local && r.local.reason) ? 'pending' : 'info',
          where.length ? 'Imported · ' + where.join(' + ') : 'Not saved',
          '<code>' + esc(r.key) + '</code>' +
          (r.local && r.local.reason ? '<br>' + esc(r.local.reason) : '') +
          (r.driveError ? '<br>Drive upload failed: ' + esc(errorText(r.driveError)) + ' Use <span class="em">Upload to Drive</span> on the template below.' : '') +
          (parsed.warnings.length ? '<br>' + parsed.warnings.map(esc).join('<br>') : ''));
      } catch (e) { out.innerHTML = ui.note('warn', 'Could not import', esc(errorText(e))); }
      renderMine(); renderForm();
    });
  };

  // ---------- events from the platform and the sandbox ----------
  bus.on('registry', function () { renderCategoryList(); renderForm(); });
  bus.on('user-templates', function () { renderMine(); renderForm(); });
  bus.on('auth', function () { renderForm(); renderMine(); });
  bus.on('selection', function () { renderForm(); });
  bus.on('tab', function (name) { if (name === 'design') { renderForm(); renderMine(); } });
  bridge.on('capture-progress', function (m) {
    clearTimeout(state.pending.capture);   // the handler exists; the fallback must not fire
    renderCaptureProgress(m);
  });
  bridge.on('capture-result', function (m) {
    clearTimeout(state.pending.capture);
    finishCapture(m).catch(function (e) {
      D.busy = false; renderForm();
      $('ad-out').innerHTML = ui.note('warn', 'Something went wrong after saving', esc(errorText(e)));
    });
  });
  bridge.on('capture-error', function (m) {
    clearTimeout(state.pending.capture);
    D.busy = false; renderForm();
    $('ad-out').innerHTML = ui.note('warn', m.code === 'exists' ? 'Already saved' : 'Could not save the template', esc(m.message || 'No reason given.'));
  });

  Panels.design = {
    // for other panels / tests: the user's templates as listed in My templates
    templates: function () { return userTemplates.list(); }
  };

  // first paint
  renderCategoryList();
  renderForm();
  renderMine();
})();
