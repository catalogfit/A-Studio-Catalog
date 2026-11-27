/* =============================================================================================
   plugin-src/ui/design.js — the "Add design" panel.  OWNED BY THE DESIGN PANEL.
   Markup: ui/design.html. Sandbox side: plugin-src/main-design.js (+ capture.js).
   Uses platform.js: state, $, esc, bus, bridge, backend, registryCats, catById, templateStore.
   Publishes Panels.design.
   ============================================================================================= */
(function () {
    // ---------- PANEL 2 — add design ----------
    function renderDesignPickers() {
      var cats = registryCats();
      var cur = $('ad-cat').value;
      $('ad-cat').innerHTML = '<option value="">Category…</option>' + cats.map(function (c) {
        return '<option value="' + esc(c.id) + '">' + esc(c.label) + '</option>';
      }).join('');
      if (cur) $('ad-cat').value = cur;
      renderDesignGenders();
    }
    function renderDesignGenders() {
      var c = catById($('ad-cat').value);
      var gens = (c && c.genders) || [{ id: 'men', label: 'Men' }, { id: 'women', label: 'Women' }, { id: 'unisex', label: 'Unisex' }];
      $('ad-gender').innerHTML = gens.map(function (g) {
        return '<option value="' + esc(g.id) + '">' + esc(g.label) + '</option>';
      }).join('');
    }
    $('ad-cat').onchange = function () { renderDesignGenders(); renderDesignSelection(); };
    $('ad-name').oninput = renderDesignSelection;
    $('ad-id').oninput = renderDesignSelection;

    function renderDesignSelection() {
      var f = (state.selection.frames || [])[0];
      var n = (state.selection.frames || []).length;
      $('ad-selmeta').textContent = n ? (n + ' selected') : '';
      if (!f) {
        $('ad-sel').innerHTML = 'Select one frame to capture.';
      } else {
        $('ad-sel').innerHTML = '<b>' + esc(f.name) + '</b><br>' +
          '<span class="muted">' + f.w + ' × ' + f.h + ' px · node ' + esc(f.id) + '</span><br>' +
          '<span class="muted">Style IDs: ' + (f.ids && f.ids.length ? esc(f.ids.join(', ')) : 'none in the frame name') + '</span>' +
          (n > 1 ? '<br><span style="color:var(--danger)">' + n + ' frames selected — only the first is captured.</span>' : '');
      }
      // main.js answers `capture-template` now, so the original validation is back:
      // a frame, a name, an id and a category.
      $('ad-go').disabled = !(f && $('ad-name').value.trim() && $('ad-id').value.trim() && $('ad-cat').value);
      $('ad-go').textContent = 'Add as template';
    }

    $('ad-go').onclick = function () {
      var f = (state.selection.frames || [])[0];
      if (!f) return;
      var payload = {
        type: 'capture-template',
        frameId: f.id,
        frameName: f.name,
        width: f.w, height: f.h,
        styleIds: f.ids || [],
        pageId: state.pageId,
        template: {
          id: $('ad-id').value.trim(),
          label: $('ad-name').value.trim(),
          categoryId: $('ad-cat').value,
          genderId: $('ad-gender').value,
          status: 'draft'
        },
        semanticLabelling: $('ad-ai').checked,   // backend-side, never a key in this UI
        backend: backend.url()
      };
      $('ad-go').disabled = true;
      $('ad-out').innerHTML = '<div class="note pending"><b>Capturing</b>Reading the frame…<div class="track"><i></i></div></div>';
      bridge.send(payload.type, payload);
      armCaptureFallback();
    };

    // Kept for the case where the plugin build is older than this UI. In normal use the
    // first capture-progress clears it, so it no longer fires.
    function armCaptureFallback() {
      clearTimeout(state.pending.capture);
      state.pending.capture = setTimeout(function () {
        renderDesignSelection();
        $('ad-out').innerHTML = '<div class="note warn"><b>No handler — nothing was captured</b>' +
          'This <code>code.js</code> is older than the panel and does not answer <code>capture-template</code>. ' +
          'Rebuild the plugin. Nothing was written and the frame is untouched.</div>';
      }, 1500);
    }

    // ---------- capture render: progress, stats, and the round-trip diff ----------
    function renderCaptureProgress(m) {
      var done = Number(m.done) || 0, total = Number(m.total) || 0;
      var pct = total > 0 ? Math.max(0, Math.min(100, Math.round(done / total * 100))) : 0;
      $('ad-out').innerHTML = '<div class="note pending"><b>Capturing' + (total ? ' · ' + done + '/' + total : '') + '</b>' +
        esc(m.step || 'Working…') +
        '<div class="track"><i style="width:' + pct + '%"></i></div></div>';
    }
    function statTiles(st) {
      st = st || {};
      var keys = ['layers', 'texts', 'images', 'slots'];
      var have = keys.filter(function (k) { return st[k] !== undefined && st[k] !== null; });
      if (!have.length) return '';
      return '<div class="stats">' + have.map(function (k) {
        return '<div class="s"><b>' + esc(String(st[k])) + '</b>' + esc(k) + '</div>';
      }).join('') + '</div>';
    }
    // The diff score is the quality gate, so it is the largest thing on the panel and the
    // mismatches are listed in full rather than counted.
    function diffBlock(d) {
      if (!d) return '';
      var mis = d.mismatches || [];
      var clean = !mis.length;
      var score = (d.score === undefined || d.score === null) ? '—'
        : (typeof d.score === 'number' ? (d.score <= 1 ? Math.round(d.score * 100) + '%' : String(d.score)) : String(d.score));
      return '<div class="diff ' + (clean ? 'clean' : 'dirty') + '">' +
        '<div class="top"><span class="score">' + esc(score) + '</span>' +
        '<span class="vd"><b>Round trip</b><span>' + (clean
          ? 'Re-renders identically. Safe to use.'
          : esc(mis.length + ' propert' + (mis.length > 1 ? 'ies do' : 'y does') + ' not come back. The template was captured but did not round-trip cleanly.')) +
        '</span></span></div>' +
        (clean ? '' : '<div class="mis">' + mis.map(function (x) {
          return '<div class="m"><div class="path">' + esc(x.path || '(no path)') + '</div>' +
            '<div class="ab">expected <em>' + esc(String(x.expected)) + '</em> · got <em>' + esc(String(x.actual)) + '</em></div></div>';
        }).join('') + '</div>') +
        '</div>';
    }
    function renderCaptureResult(m) {
      var d = m.diff || null;
      var clean = !!(d && !(d.mismatches || []).length);
      var w = m.warnings || [];
      $('ad-out').innerHTML =
        '<div class="note ' + (clean ? 'info' : 'pending') + '"><b>' +
          (clean ? 'Captured · clean round trip' : 'Captured · round trip incomplete') + '</b>' +
          esc(((m.manifest && m.manifest.meta && m.manifest.meta.label) || $('ad-name').value.trim() || 'Template') +
              ' saved as a draft.') +
        '</div>' +
        statTiles(m.stats) +
        diffBlock(d) +
        (w.length ? '<div class="note warn"><b>Warnings</b><ul style="margin:4px 0 0 15px;padding:0">' +
          w.map(function (x) { return '<li>' + esc(String(x)) + '</li>'; }).join('') + '</ul></div>' : '');
    }

  // ---------- events from the platform and the sandbox ----------
  bus.on('registry', function () { renderDesignPickers(); });
  bus.on('selection', function () { renderDesignSelection(); });
  bus.on('tab', function (name) { if (name === 'design') renderDesignSelection(); });
  bridge.on('capture-progress', function (m) {
    clearTimeout(state.pending.capture);   // the handler exists; the fallback must not fire
    renderCaptureProgress(m);
  });
  bridge.on('capture-result', function (m) {
    clearTimeout(state.pending.capture);
    renderDesignSelection();
    renderCaptureResult(m);
  });
  bridge.on('capture-error', function (m) {
    clearTimeout(state.pending.capture);
    renderDesignSelection();
    $('ad-out').innerHTML = '<div class="note warn"><b>Capture failed</b>' +
      esc(m.message || 'No reason given.') + '</div>';
  });

  Panels.design = {};

  // first paint
  renderDesignSelection();
})();
