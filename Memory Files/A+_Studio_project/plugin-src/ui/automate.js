/* =============================================================================================
   plugin-src/ui/automate.js — the "Automate A+" panel.  OWNED BY THE AUTOMATE PANEL.
   Markup: ui/automate.html. Sandbox side: plugin-src/main-automate.js (+ renderer.js).
   Uses platform.js: state, $, esc, bus, bridge, sheets, registry helpers (catById, genderById,
   activeTemplate, hasFeature, genderReady, sheetSchema, parseCatGender, words, parseTable,
   fetchManifest), errorText. Publishes Panels.automate (see the bottom of this file).
   ============================================================================================= */
(function () {
  // ---------- this panel's state (on the shared object so the original code reads unchanged) ----------
  state.cat = null; state.gender = null; state.templateId = null;
  state.src = 'link';
  state.rows = [];
  state.rowNums = [];        // 1-based sheet row number per entry of state.rows
  state.rowScope = null;     // null = whole sheet; otherwise an array of sheet row numbers (link source only)
  state.scopeBlocked = false; // true = the link's range= could not be resolved; Run stays disabled
  state.scopeNote = null;    // { kind: 'ok'|'warn', text: '' }
  state.edits = {};          // state.rows index -> { columnIndex: correctedValue }
  state.reviewed = false;

    // force = the designer's picks win (used by the "Selection" source)
    function resolveRowTarget(r, force) {
      var sc = sheetSchema();
      var catId, genId;
      if (force) { catId = state.cat; genId = state.gender; }
      else {
        var p = parseCatGender(r[sc.categoryColumn], r[sc.genderColumn]);
        // an unrecognised word in column B is passed through so the error can name it,
        // rather than silently falling back to whatever is selected in the panel
        var typed = words(r[sc.categoryColumn]);
        catId = p.cat || (typed.length ? typed[0] : state.cat);
        genId = p.gender || null;
      }
      if (!catId) return { error: 'No category in column B and none selected above.' };
      var cat = catById(catId);
      if (!cat) return { error: 'Unknown category "' + catId + '" in column B.' };
      genId = genId || cat.defaultGender || ((cat.genders || [])[0] || {}).id;
      var gen = genderById(cat, genId);
      if (!gen) return { error: 'Unknown gender "' + genId + '" for ' + cat.label + ' (column C).' };
      // the picked template applies to rows that match the picked category + gender
      var tpl = (catId === state.cat && genId === state.gender && state.templateId
        && (gen.templates || []).find(function (t) { return t.id === state.templateId; })) || activeTemplate(gen);
      // The sheet decides: a row that carries fit-comparison copy needs a template that can
      // draw that card, so upgrade to one. In Selection mode the designer's pick is final.
      var note = '';
      if (!force && sc.comparisonColumn !== undefined && String(r[sc.comparisonColumn] || '').trim()
        && !hasFeature(tpl, 'fitComparison')) {
        var up = (gen.templates || []).find(function (t) { return t.status === 'active' && hasFeature(t, 'fitComparison'); });
        if (up) { tpl = up; note = 'fit card'; }
      }
      if (cat.status !== 'active' || !genderReady(gen) || !tpl) {
        return { error: cat.label + ' · ' + (gen.label || genId) + ' is not built yet.' };
      }
      return { key: catId + '/' + genId + '/' + tpl.id, catId: catId, genderId: genId, templateId: tpl.id,
        label: cat.label + ' · ' + gen.label + (note ? ' · ' + note : '') };
    }

    // Which columns actually carry content, whichever sheet layout is configured.
    function contentColumns(sc) {
      var cc = sc.cardColumns || [];
      return [sc.heroColumn, sc.fabricColumn, sc.headlineColumn, sc.taglineColumn,
        sc.fabricCopyColumn, sc.compositionColumn, sc.iconsColumn]
        .concat(cc).filter(function (c) { return c !== undefined; });
    }
    function contentRows(table) {
      var sc = sheetSchema();
      var cols = contentColumns(sc).concat([sc.styleIdColumn, sc.categoryColumn, sc.genderColumn,
        sc.comparisonColumn, sc.statusColumn].filter(function (c) { return c !== undefined; }));
      var maxCol = Math.max.apply(null, cols) + 1;
      var contentCols = contentColumns(sc);
      // A row counts as content when its style-ID cell holds a six-digit ID, or any content
      // column has text. The header row is skipped by name, and spacer rows fall out naturally.
      return (table || []).filter(function (r) {
        var first = String(r[sc.styleIdColumn] || '');
        if (/^\s*(style\s*id|format\b)/i.test(first)) return false;
        if (/^\s*(group|category)\s*$/i.test(String(r[0] || ''))) return false;
        return /\d{6}/.test(first) || contentCols.some(function (ci) { return String(r[ci] || '').trim(); });
      }).map(function (r) { return r.slice(0, maxCol); });
    }

    // rows the Run button will actually build (Selection mode narrows to the selected styles)
    function activeRows() {
      if (state.src !== 'selection') return state.rows;
      var sc = sheetSchema(), want = state.selection.ids;
      if (!want.length) return [];
      return state.rows.filter(function (r) {
        var ids = String(r[sc.styleIdColumn] || '').match(/\d{6}/g) || [];
        return ids.some(function (i) { return want.indexOf(i) >= 0; });
      });
    }

    function showRows(rows, nums) {
      state.rows = rows;
      state.rowNums = nums || [];
      state.edits = {};
      setReviewed(false);
      renderFound();
    }
    function renderFound() {
      var rows = editedRows(), f = $('found'), sc = sheetSchema(), cc = sc.cardColumns || [5, 6, 7, 8];
      var force = state.src === 'selection';
      if (!rows.length) {
        f.classList.add('hidden'); $('run').disabled = true;
        // Distinguish "dropped by the row scope" from "genuinely nothing matched". Saying the
        // second when the first is true would be a lie about the user's own data.
        if (scopeIsActive() && activeRows().length) {
          f.classList.remove('hidden');
          f.innerHTML = '<div class="h">All rows filtered out by the row scope</div>' +
            '<div class="r">' + esc(scopeLabel()) + ' holds no content row</div>';
        } else if (force && state.rows.length && state.selection.ids.length) {
          f.classList.remove('hidden');
          f.innerHTML = '<div class="h">No sheet row matches the selected style ID(s)</div><div class="r">' + esc(state.selection.ids.join(', ')) + '</div>';
        }
        return;
      }
      if (state.scopeBlocked) { f.classList.add('hidden'); $('run').disabled = true; return; }
      f.classList.remove('hidden');
      f.innerHTML = '<div class="h">' + rows.length + ' A+ row' + (rows.length > 1 ? 's' : '') + ' ready</div>' + rows.map(function (r) {
        var ids = (String(r[sc.styleIdColumn] || '').match(/\d{6}/g) || ['(no style ID)']).join(', ');
        var cards = cc.filter(function (ci) { return String(r[ci] || '').trim(); }).length;
        var t = resolveRowTarget(r, force);
        var where = t.error ? 'no template' : t.label;
        var flag = '';
        if (sc.statusColumn !== undefined) {
          var st = String(r[sc.statusColumn] || '').trim();
          if (st && !/^ok$/i.test(st)) flag = ' · status: ' + st;
        }
        if (cards < 3) flag += ' · only ' + cards + ' features';
        var bad = t.error || cards < 3;
        return '<div class="r"' + (bad ? ' style="color:var(--danger)"' : '') + '>' + esc(ids) + ' · ' + esc(where) + ' · ' + cards + ' cards' + esc(flag) + '</div>';
      }).join('');
      $('run').disabled = false;
    }
    function setErr(m) { $('err').textContent = m || ''; }

    // ---------- live template preview, drawn from the manifest itself ----------
    function pcol(M, role) { var p = M.palette && M.palette[role]; return p ? 'rgb(' + p.join(',') + ')' : '#9aa0a6'; }
    var GT = { TB: [[0, 1, 0], [-1, 0, 1]], LR: [[1, 0, 0], [0, 1, 0]], RL: [[-1, 0, 1], [0, 1, 0]] };

    // Turn one manifest paint into an SVG fill, adding any gradient to `defs`.
    // A Figma gradientTransform maps object space into gradient space, where the ramp runs
    // along x from 0 to 1 — so the SVG endpoints are recovered by inverting that mapping.
    function svgPaint(M, p, id, defs) {
      if (!p) return 'none';
      if (p.solid !== undefined) {
        var c = Array.isArray(p.solid) ? 'rgb(' + p.solid.join(',') + ')' : pcol(M, p.solid);
        return { fill: c, op: p.opacity === undefined ? 1 : p.opacity };
      }
      // an image fill shows as a flat tint at its real opacity — the texture itself cannot be
      // embedded here, and exaggerating it would misrepresent how subtle it is on the canvas
      if (p.image) return { fill: '#b9bec4', op: p.opacity === undefined ? 1 : p.opacity };
      if (!p.stops) return 'none';
      var stops = p.stops.map(function (s) {
        return '<stop offset="' + s[0] + '" stop-color="rgb(' + s[1].join(',') + ')" stop-opacity="' + s[2] + '"/>';
      }).join('');
      if (p.radial) {
        defs.push('<radialGradient id="' + id + '" cx="0.5" cy="0.5" r="0.55">' + stops + '</radialGradient>');
      } else {
        var m = p.gt || GT[p.transform] || GT.TB;
        var a = m[0][0], b = m[0][1], tx = m[0][2];
        var den = a * a + b * b || 1;
        var x1 = -tx * a / den, y1 = -tx * b / den;
        defs.push('<linearGradient id="' + id + '" x1="' + x1 + '" y1="' + y1 +
          '" x2="' + (x1 + a / den) + '" y2="' + (y1 + b / den) + '">' + stops + '</linearGradient>');
      }
      return { fill: 'url(#' + id + ')', op: p.opacity === undefined ? 1 : p.opacity };
    }

    // One manifest layer as an SVG element. Figma rotates anticlockwise about the node origin,
    // SVG rotates clockwise, hence the negated angle.
    function svgLayer(M, L, uid, i, defs, H) {
      if (L.visible === false) return '';
      var y = L.yFromBottom !== undefined ? (H - L.yFromBottom) : L.y;
      var h = L.hToFramePlus !== undefined ? (H - y + L.hToFramePlus) : L.h;
      var paints = (L.fills || []).map(function (p, k) { return svgPaint(M, p, uid + '_' + i + '_' + k, defs); })
        .filter(function (p) { return p !== 'none'; });
      if (!paints.length) return '';
      var op = (L.opacity === undefined ? 1 : L.opacity);
      // a Figma relativeTransform [[a,b,tx],[c,d,ty]] becomes SVG matrix(a c b d tx ty)
      var xf = '', ox = L.x, oy = y;
      if (L.rt) {
        var ty = L.yFromBottom !== undefined ? (H - L.yFromBottom) : L.rt[1][2];
        xf = ' transform="matrix(' + [L.rt[0][0], L.rt[1][0], L.rt[0][1], L.rt[1][1], L.rt[0][2], ty].join(' ') + ')"';
        ox = 0; oy = 0;
      } else if (L.rotation) {
        xf = ' transform="rotate(' + (-L.rotation) + ' ' + L.x + ' ' + y + ')"';
      }
      return paints.map(function (p) {
        var o = Math.min(1, op * p.op);
        if (L.shape === 'ellipse') {
          return '<ellipse cx="' + (ox + L.w / 2) + '" cy="' + (oy + h / 2) + '" rx="' + (L.w / 2) + '" ry="' + (h / 2) +
            '" fill="' + p.fill + '" opacity="' + o + '"' + xf + '/>';
        }
        return '<rect x="' + ox + '" y="' + oy + '" width="' + L.w + '" height="' + h + '"' +
          (L.radius ? ' rx="' + L.radius + '"' : '') + ' fill="' + p.fill + '" opacity="' + o + '"' + xf + '/>';
      }).join('');
    }
    function svgLayers(M, layers, uid, tag, defs, H, roles) {
      return (layers || []).map(function (L, i) {
        if (L.role) return (roles && roles[L.role]) ? roles[L.role]() : '';
        return svgLayer(M, L, uid + tag, i, defs, H);
      }).join('');
    }
    // A schematic but geometrically honest preview: every number comes from the manifest,
    // so the thumbnail can never drift from what the plugin will actually draw.
    function previewSvg(M, uid) {
      if (!M || !M.callouts) return '';
      var W = (M.meta && M.meta.width) || 1572;
      var cf = M.callouts.frame, calloutH = cf.h4;
      var cmpOn = !!(M.comparison && M.comparison.enabled);
      var pad = M.frame.bottomPad === undefined ? 108.76 : M.frame.bottomPad;
      var cmpTop = cf.y + calloutH + (cmpOn ? M.comparison.gap : 0);
      var H = Math.round(cmpTop + (cmpOn ? M.comparison.h : 0) + pad);
      var defs = [], s = [];
      var hm = M.hero, fb = M.fabric, co = M.callouts;
      var hd = (M.content && M.content.heroDefaults) || ['RUN', 'UNSTOPPABLE', ''];

      defs.push('<linearGradient id="barL' + uid + '" x1="0" y1="0" x2="1" y2="0">' + co.bar.gradientStops.map(function (st) { return '<stop offset="' + st[0] + '" stop-color="rgb(' + st[1].join(',') + ')" stop-opacity="' + st[2] + '"/>'; }).join('') + '</linearGradient>');
      defs.push('<linearGradient id="barR' + uid + '" x1="1" y1="0" x2="0" y2="0">' + co.bar.gradientStops.map(function (st) { return '<stop offset="' + st[0] + '" stop-color="rgb(' + st[1].join(',') + ')" stop-opacity="' + st[2] + '"/>'; }).join('') + '</linearGradient>');
      defs.push('<clipPath id="hc' + uid + '"><rect x="' + hm.x + '" y="' + hm.y + '" width="' + hm.w + '" height="' + hm.h + '"/></clipPath>');

      s.push('<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="' + pcol(M, M.frame.fillRole || 'white') + '"/>');
      s.push(svgLayers(M, M.background.layers, uid, 'bg', defs, H));

      // hero — same layer stack the renderer walks, so the preview shows the real graphics
      var hw = svgPaint(M, (hm.word.fills || [])[0], 'hw' + uid, defs);
      s.push('<g clip-path="url(#hc' + uid + ')">');
      var heroFill = Array.isArray(hm.fill) ? 'rgb(' + hm.fill.join(',') + ')' : pcol(M, hm.fill);
      s.push('<rect x="' + hm.x + '" y="' + hm.y + '" width="' + hm.w + '" height="' + hm.h + '" fill="' + heroFill + '"/>');
      s.push(svgLayers(M, hm.layers, uid, 'he', defs, H, {
        bgPhoto: function () {
          var bp = hm.bgPhoto;
          return bp ? slot(M, bp.x, bp.y, bp.w, bp.h, false) : '';
        },
        word: function () {
          return '<text x="' + (hm.w / 2) + '" y="' + (hm.word.y + hm.word.size * 0.78) + '" text-anchor="middle" font-family="Poppins, Inter, sans-serif" font-weight="800" font-size="' + hm.word.size + '" fill="' + hw.fill + '" opacity="' + hm.word.opacity + '" textLength="' + hm.word.maxWidth + '" lengthAdjust="spacingAndGlyphs">' + esc(hd[0]) + '</text>';
        },
        italic: function () {
          return '<text x="' + (hm.w / 2) + '" y="' + (hm.italic.y + hm.italic.size * 0.8) + '" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-size="' + hm.italic.size + '" fill="' + pcol(M, hm.italic.colorRole) + '" opacity="' + hm.italic.opacity + '" textLength="' + hm.italic.maxWidth + '" lengthAdjust="spacingAndGlyphs">' + esc(hd[1]) + '</text>';
        },
        model: function () { return slot(M, hm.model.x, hm.model.y, hm.model.w, hm.model.h, false); },
        tagline: function () {
          return '<rect x="' + hm.tagline.x + '" y="' + hm.tagline.y + '" width="' + hm.tagline.width + '" height="' + (hm.tagline.size * 2.2) + '" rx="6" fill="' + pcol(M, 'tag') + '" opacity=".35"/>';
        }
      }));
      s.push('</g>');

      // fabric
      var fx = fb.box.x, fy = fb.box.y;
      s.push('<rect x="' + fx + '" y="' + fy + '" width="' + fb.box.w + '" height="' + fb.box.h + '" rx="' + (fb.box.radius || 0) + '" fill="' + pcol(M, fb.box.fillRole) + '"/>');
      s.push('<g transform="translate(' + fx + ' ' + fy + ')">');
      s.push(svgLayers(M, fb.layers, uid, 'fa', defs, H, {
        bgPhoto: function () { return ''; },
        closeup: function () { return slot(M, fb.closeup.x, fb.closeup.y, fb.closeup.w, fb.closeup.h, true); },
        ring: function () {
          var r = fb.ring;
          return r ? '<circle cx="' + (r.x + r.w / 2) + '" cy="' + (r.y + r.h / 2) + '" r="' + (r.w / 2) +
            '" fill="none" stroke="' + pcol(M, r.strokeRole || 'white') + '" stroke-width="' + (r.strokeWeight || 2) +
            '" opacity="' + (r.strokeOpacity === undefined ? 1 : r.strokeOpacity) + '"/>' : '';
        }
      }));
      s.push('</g>');
      var ts = fb.textStack;
      s.push('<text x="' + (W / 2) + '" y="' + (ts.y + ts.heading.size * 0.8) + '" text-anchor="middle" font-family="Georgia, serif" font-style="italic" font-weight="700" font-size="' + ts.heading.size + '" fill="' + pcol(M, 'white') + '">FABRIC IN FOCUS</text>');
      for (var li = 0; li < 3; li++) {
        var lw = [1100, 1240, 900][li];
        s.push('<rect x="' + ((W - lw) / 2) + '" y="' + (ts.y + 150 + li * 62) + '" width="' + lw + '" height="30" rx="15" fill="' + pcol(M, 'white') + '" opacity=".4"/>');
      }
      s.push('<rect x="' + ((W - ts.divider.w) / 2) + '" y="' + (ts.y + 370) + '" width="' + ts.divider.w + '" height="4" fill="' + pcol(M, 'white') + '" opacity=".85"/>');
      for (var ic = 0; ic < 3; ic++) {
        s.push('<circle cx="' + (W / 2 + (ic - 1) * 230) + '" cy="' + (ts.y + 520) + '" r="76" fill="none" stroke="' + pcol(M, 'white') + '" stroke-width="5" opacity=".75"/>');
      }

      // callouts
      co.cards.slice(0, 4).forEach(function (L, i) {
        var by = cf.y + L.bar.y;
        s.push('<rect x="' + (cf.x + L.bar.x) + '" y="' + by + '" width="' + L.bar.w + '" height="' + co.barHeight + '" fill="url(#' + (L.bar.flip ? 'barR' : 'barL') + uid + ')"/>');
        s.push(slot(M, cf.x + L.photo.x, cf.y + L.photo.y, L.photo.d, L.photo.d, true));
        var tx = L.text.left !== undefined ? (cf.x + L.text.left) : (cf.x + L.text.right - L.text.w);
        var mid = by + co.barHeight / 2;
        s.push('<rect x="' + (L.text.align === 'RIGHT' ? tx + L.text.w - 520 : tx) + '" y="' + (mid - 110) + '" width="520" height="56" rx="10" fill="' + pcol(M, 'ink') + '" opacity=".8"/>');
        [0, 1, 2].forEach(function (k) {
          var cw = [L.text.copyW, L.text.copyW * 0.92, L.text.copyW * 0.6][k];
          s.push('<rect x="' + (L.text.align === 'RIGHT' ? tx + L.text.w - cw : tx) + '" y="' + (mid - 26 + k * 44) + '" width="' + cw + '" height="26" rx="13" fill="' + pcol(M, 'ink') + '" opacity=".35"/>');
        });
      });

      // fit comparison
      if (cmpOn) {
        var cp = M.comparison, lb2 = cp.label, ph2 = cp.photo;
        for (var ci2 = 0; ci2 < 2; ci2++) {
          s.push('<rect x="' + (cp.x + lb2.xs[ci2]) + '" y="' + (cmpTop + (lb2.y || 0)) + '" width="' + lb2.w + '" height="' + lb2.size + '" rx="8" fill="' + pcol(M, 'ink') + '" opacity=".8"/>');
          s.push(slot(M, cp.x + ph2.xs[ci2], cmpTop + ph2.y, ph2.w, ph2.h, false));
        }
        var gd = cp.guides, gcol = pcol(M, gd.colorRole);
        (gd.vertical || []).forEach(function (v) {
          s.push('<rect x="' + (cp.x + v.x) + '" y="' + (cmpTop + v.y) + '" width="' + gd.thickness + '" height="' + v.h + '" fill="' + gcol + '" opacity="' + gd.opacity + '"/>');
        });
        (gd.horizontal || []).forEach(function (hz) {
          s.push('<rect x="' + (cp.x + hz.x) + '" y="' + (cmpTop + hz.y) + '" width="' + hz.w + '" height="' + gd.thickness + '" fill="' + gcol + '" opacity="' + gd.opacity + '"/>');
        });
      }

      // slice divider
      (M.slices || []).forEach(function (sl) {
        if (!sl.y) return;
        s.push('<rect x="0" y="' + sl.y + '" width="' + W + '" height="3" fill="#5b5bd6" opacity=".5"/>');
      });

      return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMin meet" xmlns="http://www.w3.org/2000/svg">' +
        '<defs>' + defs.join('') + '</defs>' + s.join('') + '</svg>';
    }
    function slot(M, x, y, w, h, circle) {
      var fill = pcol(M, 'slotFill'), stroke = pcol(M, 'slotStroke');
      if (circle) {
        return '<circle cx="' + (x + w / 2) + '" cy="' + (y + h / 2) + '" r="' + (w / 2) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="4" stroke-dasharray="18 14" opacity=".9"/>';
      }
      return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="4" stroke-dasharray="18 14" opacity=".75"/>';
    }

    // ---------- category / gender / template pickers ----------
    function renderCats() {
      var cats = (state.registry && state.registry.categories) || [];
      $('cats').innerHTML = cats.map(function (c) {
        var ready = c.status === 'active' && (c.genders || []).some(genderReady);
        var hero = ((c.genders || [])[0] || {}).hero || [];
        return '<button class="cat" data-cat="' + esc(c.id) + '"' + (ready ? '' : ' disabled') +
          '><b>' + esc(c.label) + ' A+</b><span>' + esc(ready ? hero.join(' · ') : 'coming next') + '</span></button>';
      }).join('');
      document.querySelectorAll('.cat').forEach(function (b) {
        b.onclick = function () {
          if (b.disabled) return;
          document.querySelectorAll('.cat').forEach(function (x) { x.classList.toggle('on', x === b); });
          state.cat = b.dataset.cat; state.gender = null; state.templateId = null;
          renderGenders();
        };
      });
      var cur = state.cat && document.querySelector('.cat[data-cat="' + state.cat + '"]:not([disabled])');
      (cur || document.querySelector('.cat:not([disabled])') || { click: function () {} }).click();
    }

    function renderGenders() {
      var cat = catById(state.cat), gens = (cat && cat.genders) || [];
      $('genders').innerHTML = gens.map(function (g) {
        return '<button class="chip" data-g="' + esc(g.id) + '"' + (genderReady(g) ? '' : ' disabled') + '>' +
          esc(g.label) + (genderReady(g) ? '' : ' · soon') + '</button>';
      }).join('') || '<span class="muted">No genders defined for this category.</span>';
      document.querySelectorAll('#genders .chip').forEach(function (b) {
        b.onclick = function () {
          if (b.disabled) return;
          document.querySelectorAll('#genders .chip').forEach(function (x) { x.classList.toggle('on', x === b); });
          state.gender = b.dataset.g; state.templateId = null;
          renderTemplates();
        };
      });
      var want = state.gender && document.querySelector('#genders .chip[data-g="' + state.gender + '"]:not([disabled])');
      var first = want || document.querySelector('#genders .chip:not([disabled])');
      if (first) first.click(); else { state.gender = null; renderTemplates(); }
    }

    function renderTemplates() {
      var cat = catById(state.cat), gen = genderById(cat, state.gender);
      var tpls = (gen && gen.templates) || [];
      if (!tpls.length) {
        $('tpls').innerHTML = '<span class="muted">No template yet.</span>';
        $('tplnote').textContent = ''; $('tplmeta').textContent = '';
        state.templateId = null; drawPreview(); return;
      }
      $('tpls').innerHTML = tpls.map(function (t) {
        return '<button class="tpl" data-tpl="' + esc(t.id) + '"' + (t.status === 'active' ? '' : ' disabled') + '>' +
          '<b>' + esc(t.label) + '</b><span>' + esc(t.sub || '') + '</span></button>';
      }).join('');
      document.querySelectorAll('.tpl').forEach(function (b) {
        b.onclick = function () {
          if (b.disabled) return;
          document.querySelectorAll('.tpl').forEach(function (x) { x.classList.toggle('on', x === b); });
          state.templateId = b.dataset.tpl;
          var t = tpls.find(function (x) { return x.id === state.templateId; });
          $('tplnote').textContent = (t && t.sub) ? t.sub : '';
          drawPreview();
          renderFound();
        };
      });
      var want = state.templateId && document.querySelector('.tpl[data-tpl="' + state.templateId + '"]:not([disabled])');
      (want || document.querySelector('.tpl:not([disabled])') || { click: function () {} }).click();
      primeManifests(tpls);
    }

    // The preview is the selected template's own manifest, drawn to scale and scrollable —
    // the whole A+, not a crop, so the callout rhythm and the fit card are both visible.
    function drawPreview() {
      var host = $('preview');
      if (!state.cat || !state.gender || !state.templateId) { host.innerHTML = '<div class="empty">Pick a template.</div>'; return; }
      var key = state.cat + '/' + state.gender + '/' + state.templateId;
      var M = state.manifestCache[key];
      if (!M) { host.innerHTML = '<div class="empty">Loading preview…</div>'; return; }
      host.innerHTML = previewSvg(M, 'pv' + key.replace(/\W/g, ''));
      host.scrollTop = 0;
      $('tplmeta').textContent = 'scrollable';
    }

    // Fetch each template's manifest once so the preview is the real thing.
    async function primeManifests(tpls) {
      for (var i = 0; i < tpls.length; i++) {
        var t = tpls[i], key = state.cat + '/' + state.gender + '/' + t.id;
        if (!state.manifestCache[key]) {
          var M = await fetchManifest(state.cat, state.gender, t.id);
          if (M) state.manifestCache[key] = M;
        }
      }
      drawPreview();
    }

    // ---------- segmented tabs ----------
    document.querySelectorAll('#view-automate .seg button').forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll('#view-automate .seg button').forEach(function (x) { x.classList.toggle('on', x === b); });
        state.src = b.dataset.src;
        $('src-link').classList.toggle('hidden', state.src !== 'link');
        $('src-paste').classList.toggle('hidden', state.src !== 'paste');
        $('src-selection').classList.toggle('hidden', state.src !== 'selection');
        // switching source changes which rows are in play — the review sign-off no longer applies
        setReviewed(false);
        renderFound();
      };
    });
    $('paste').oninput = function () {
      var t = parseTable($('paste').value);
      setErr(''); showRows(contentRows(t), sheetRowNumbers(t));
    };

    // ---------- selection ----------
    function renderSelection() {
      var sel = state.selection, n = sel.frames.length;
      $('addcmp').disabled = !n;
      if (!n) { $('selinfo').innerHTML = 'Select an A+ frame.'; }
      else {
        $('selinfo').innerHTML = '<b>' + n + ' frame' + (n > 1 ? 's' : '') + ' selected</b>' +
          (sel.ids.length ? ' · style ' + esc(sel.ids.join(', ')) : ' · <span style="color:var(--danger)">no style ID in the frame name</span>');
      }
      renderFound();
    }

    $('extras-h').onclick = function () { $('extras').classList.toggle('open'); };

    // ---------- link loading ----------
    function toCsvUrl(link) {
      link = link.trim();
      if (/output=csv|format=csv/.test(link)) return link;
      var m = link.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      var g = link.match(/[#&?]gid=(\d+)/);
      if (m && !/\/d\/e\//.test(link)) return 'https://docs.google.com/spreadsheets/d/' + m[1] + '/export?format=csv' + (g ? '&gid=' + g[1] : '');
      return link;
    }
    $('load').onclick = async function () {
      setErr(''); var link = $('link').value.trim();
      if (!link) { setErr('Paste the sheet link first.'); return; }
      bridge.send('save-link', { link: link });
      $('load').disabled = true; $('load').textContent = 'Loading…';
      try {
        var rows;
        if (state.session && state.googleEmail) {
          // direct to the Sheets API with the user's short-lived token (platform.js sheets.read)
          rows = (await sheets.read(link)).rows;
        } else {
          var r2 = await fetch(toCsvUrl(link)); var text = await r2.text();
          if (!r2.ok || /<html/i.test(text.slice(0, 200))) throw new Error('not csv');
          rows = parseTable(text);
        }
        showRows(contentRows(rows), sheetRowNumbers(rows));
        if (!state.rows.length) setErr('No rows with content in that sheet.');
      } catch (e) {
        setErr('Could not read that sheet: ' + errorText(e));
        showRows([], []);
      }
      $('load').disabled = false; $('load').textContent = 'Load';
    };

    // ---------- run ----------
    $('run').onclick = async function () {
      // defensive: the button is disabled while the range is unresolved, but never trust that alone
      if (state.scopeBlocked) { setErr('Fix or clear the range= in the sheet link before running.'); return; }
      var rows = editedRows();
      if (!rows.length) return;
      setErr(''); $('report').innerHTML = '';
      $('run').disabled = true; $('run').textContent = 'Preparing…';
      var force = state.src === 'selection';
      var targets = rows.map(function (r) { return resolveRowTarget(r, force); });
      var keys = targets.map(function (t) { return t.key || null; });
      var errors = targets.map(function (t) { return t.error || null; });
      if (!keys.some(function (k) { return k; })) {
        setErr('No row could be routed — check columns B and C.');
        $('run').disabled = !!state.scopeBlocked; $('run').textContent = 'Run A+'; return;
      }
      var manifests = {}, distinct = {};
      targets.forEach(function (t) { if (t.key) distinct[t.key] = t; });
      for (var k in distinct) {
        var m = await fetchManifest(distinct[k].catId, distinct[k].genderId, distinct[k].templateId);
        if (m) manifests[k] = m;
      }
      var source = Object.keys(manifests).some(function (k) { return state.manifestSource[k] === 'backend'; }) ? 'backend' : 'bundled';
      $('run').textContent = 'Building 0 / ' + rows.length + '…';
      bridge.send('run', { rows: rows, keys: keys, errors: errors, manifests: manifests, source: source });
    };

    // ---------- add fit comparison to the selected frames ----------
    $('addcmp').onclick = async function () {
      setErr(''); $('report').innerHTML = '';
      if (!state.cat || !state.gender || !state.templateId) { setErr('Pick a category, gender and template first.'); return; }
      var key = state.cat + '/' + state.gender + '/' + state.templateId;
      var M = await fetchManifest(state.cat, state.gender, state.templateId);
      if (!M) { setErr('Could not load that template.'); return; }
      if (!M.comparison) { setErr('This template has no fit comparison block.'); return; }
      var man = {}; man[key] = M;
      var l = $('cmp-left').value.trim(), r = $('cmp-right').value.trim();
      $('addcmp').disabled = true; $('addcmp').textContent = 'Adding…';
      bridge.send('add-comparison', { key: key, manifests: man, labels: [l, r], source: state.manifestSource[key] || 'bundled' });
    };

    /* ======================================================================
       Everything below is the panel restructure. The engine above is untouched
       except for three call sites that now read the reviewed copy of the rows
       (editedRows) and the row-number bookkeeping in showRows.
       ====================================================================== */

    // ---------- row numbers, row scope, inline corrections ----------
    // contentRows' filter is per-row and stateless, so running it on a one-row table is a
    // faithful way to ask "does this row survive?" without duplicating the predicate.
    function sheetRowNumbers(table) {
      var out = [];
      (table || []).forEach(function (r, i) { if (contentRows([r]).length) out.push(i + 1); });
      return out;
    }
    function rowNumberOf(r) {
      var i = state.rows.indexOf(r);
      return i >= 0 ? state.rowNums[i] : undefined;
    }
    // state.rowScope holds SHEET row numbers, taken from `range=` in the link box. Those numbers
    // only mean anything for the Sheet-link source: pasted rows are numbered from 1 and a canvas
    // selection has no sheet rows at all, so applying the scope there silently drops good rows.
    function scopeIsActive() {
      return state.src === 'link' && !!(state.rowScope && state.rowScope.length);
    }
    function scopeLabel() {
      if (!scopeIsActive()) return '';
      var lo = state.rowScope[0], hi = state.rowScope[state.rowScope.length - 1];
      return lo === hi ? ('Sheet row ' + lo) : ('Sheet rows ' + lo + '–' + hi);
    }
    function scopeRows(rows) {
      if (!scopeIsActive()) return rows;
      return rows.filter(function (r) {
        var n = rowNumberOf(r);
        return n !== undefined && state.rowScope.indexOf(n) >= 0;
      });
    }
    function editRow(r) {
      var i = state.rows.indexOf(r);
      var e = i >= 0 ? state.edits[i] : null;
      if (!e) return r;
      var copy = r.slice();
      for (var c in e) copy[c] = e[c];
      return copy;
    }
    // the rows the UI reports on and the Run button sends: scoped by the link, corrected in Review
    function editedRows() { return scopeRows(activeRows()).map(editRow); }

    // ---------- Google Sheets link → row scope ----------
    // Handles: a plain tab link, "Get link to this cell" (#gid=..&range=A5),
    // an A1 span (range=A5:J9), a whole-row span (range=5:9), range=R5C2 notation,
    // and any of those carrying a tab prefix (range=Sheet1!A5:J9, range='My tab'!A5:J9).
    function parseLinkScope(link) {
      link = String(link || '').trim();
      if (!link) return { kind: 'none' };
      var hasRange = /[#&?]range=/i.test(link);
      if (!hasRange) return { kind: 'all' };
      var raw = (link.match(/[#&?]range=([^&#\s]+)/i) || [])[1] || '';
      try { raw = decodeURIComponent(raw); } catch (e) {}
      // the tab name selects a tab, not rows — strip it and scope on what follows
      var body = raw.replace(/^(?:'(?:[^']|'')*'|[^'!]*)!/, '');
      var parts = body.split(':');
      function rowOf(tok) {
        var m = /^[A-Za-z]*(\d+)$/.exec(tok);                 // A5 or 5
        if (m) return parseInt(m[1], 10);
        var r = /^R(\d+)C\d+$/i.exec(tok);                    // R5C2
        if (r) return parseInt(r[1], 10);
        return null;
      }
      var a = rowOf(parts[0]), b = parts.length > 1 ? rowOf(parts[1]) : a;
      if (!a || !b) return { kind: 'unresolved', raw: raw };
      var lo = Math.min(a, b), hi = Math.max(a, b), rows = [];
      for (var n = lo; n <= hi; n++) rows.push(n);
      return { kind: 'rows', rows: rows, lo: lo, hi: hi, raw: raw };
    }
    function applyLinkScope() {
      var sc = parseLinkScope($('link').value);
      var host = $('scope-note'), meta = $('scopemeta');
      state.rowScope = null; state.scopeBlocked = false; meta.textContent = '';
      if (sc.kind === 'none' || sc.kind === 'all') { host.innerHTML = ''; }
      else if (sc.kind === 'unresolved') {
        // An unresolved range must not fall through to "run the whole tab" on the next click.
        state.scopeBlocked = true;
        meta.textContent = 'scope unresolved';
        host.innerHTML = '<div class="note warn"><b>Row link not understood</b>That link carries <code>range=' +
          esc(sc.raw) + '</code>, which this plugin cannot turn into row numbers. <b>Nothing has been scoped</b> — ' +
          'it would run every row in the tab. Use <code>&amp;range=A5</code> or <code>&amp;range=5:9</code>, or clear the range to run the whole tab on purpose. ' +
          '<b>Run is disabled until the range is corrected or cleared.</b></div>';
      } else {
        state.rowScope = sc.rows;
        meta.textContent = sc.lo === sc.hi ? ('row ' + sc.lo) : ('rows ' + sc.lo + '–' + sc.hi);
        host.innerHTML = '<div class="note info"><b>Scoped to ' + (sc.lo === sc.hi ? ('sheet row ' + sc.lo) : ('sheet rows ' + sc.lo + '–' + sc.hi)) +
          '</b>Remove <code>range=</code> to run the whole tab.</div>';
      }
      // The row set the user is signing off on just changed — the sign-off no longer applies.
      setReviewed(false);
    }
    $('link').oninput = function () { applyLinkScope(); renderFound(); };

    // ---------- the review stage ----------
    function reviewFields() {
      var sc = sheetSchema(), f = [];
      function add(c, l, big) { if (c !== undefined) f.push({ c: c, l: l, big: !!big }); }
      add(sc.styleIdColumn, 'Style IDs');
      add(sc.categoryColumn, 'Category');
      add(sc.genderColumn, 'Gender');
      add(sc.heroColumn, 'Card 1 · hero', true);
      add(sc.headlineColumn, 'Headline', true);
      add(sc.taglineColumn, 'Tagline', true);
      add(sc.fabricColumn, 'Card 2 · fabric', true);
      add(sc.fabricCopyColumn, 'Fabric copy', true);
      add(sc.compositionColumn, 'Composition');
      add(sc.iconsColumn, 'Fabric icons');
      (sc.cardColumns || []).forEach(function (c, i) { add(c, 'Feature ' + (i + 1), true); });
      add(sc.comparisonColumn, 'Fit comparison', true);
      add(sc.statusColumn, 'Status');
      return f;
    }
    function targetLine(row) {
      var t = resolveRowTarget(row, state.src === 'selection');
      return t.error ? { bad: true, text: t.error } : { bad: false, text: 'Builds as ' + t.label };
    }
    function renderReview() {
      var host = $('review'), sc = sheetSchema();
      var raw = scopeRows(activeRows());
      $('rv-count').textContent = raw.length ? (raw.length + ' row' + (raw.length > 1 ? 's' : '')) : '';
      if (!raw.length) {
        var why;
        if (!state.rows.length) why = 'Load a sheet.';
        else if (scopeIsActive() && activeRows().length) why = scopeLabel() + ' holds no content row.';
        else why = 'No row matches.';
        host.innerHTML = '<div class="empty">' + esc(why) + '</div>';
        return;
      }
      var fields = reviewFields();
      host.innerHTML = raw.map(function (r) {
        var i = state.rows.indexOf(r);
        var row = editRow(r);
        var ids = (String(row[sc.styleIdColumn] || '').match(/\d{6}/g) || ['(no style ID)']).join(', ');
        var num = rowNumberOf(r);
        var tl = targetLine(row);
        return '<div class="card">' +
          '<h4>' + esc(ids) + (num ? ' <em>sheet row ' + num + '</em>' : '') + '</h4>' +
          '<div class="tgt' + (tl.bad ? ' bad' : '') + '" id="rv-t-' + i + '">' + esc(tl.text) + '</div>' +
          fields.map(function (fd) {
            var v = row[fd.c] === undefined ? '' : String(row[fd.c]);
            // HTML parsing drops ONE newline immediately after <textarea>, so a cell whose value
            // starts with a newline would come back a line short. Emit a sacrificial '\n' first.
            return '<div class="f"><label>' + esc(fd.l) + '</label>' +
              '<textarea class="rv-in" rows="' + (fd.big ? 2 : 1) + '" data-r="' + i + '" data-c="' + fd.c + '">\n' + esc(v) + '</textarea></div>';
          }).join('') +
          '</div>';
      }).join('');
    }
    $('review').addEventListener('input', function (ev) {
      var el = ev.target;
      if (!el || !el.classList || !el.classList.contains('rv-in')) return;
      var i = parseInt(el.dataset.r, 10), c = parseInt(el.dataset.c, 10);
      if (isNaN(i) || isNaN(c)) return;
      if (!state.edits[i]) state.edits[i] = {};
      state.edits[i][c] = el.value;
      setReviewed(false);
      // refresh the derived readouts without re-rendering the field the user is typing in
      baseRenderFound();
      bus.emit('rows-changed');
      var raw = state.rows[i];
      var line = $('rv-t-' + i);
      if (raw && line) {
        var tl = targetLine(editRow(raw));
        line.textContent = tl.text;
        line.classList.toggle('bad', tl.bad);
      }
    });
    // Nothing outside this panel reads state.reviewed (product decision 8: the review step is being
    // removed; Export no longer depends on it).
    function setReviewed(v) {
      state.reviewed = !!v;
      $('rv-ok').checked = !!v;
    }
    $('rv-ok').onchange = function () { setReviewed($('rv-ok').checked); };

    // renderFound is the original, hard-won function — wrapped rather than edited so the
    // review readout and the Export panel (via 'rows-changed') refresh from the same trigger.
    var baseRenderFound = renderFound;
    renderFound = function () { baseRenderFound(); renderReview(); bus.emit('rows-changed'); };

  // ---------- events from the platform and the sandbox ----------
  bus.on('registry', function () { renderCats(); });
  bus.on('selection', function () { renderSelection(); });
  bus.on('init', function (m) {
    $('link').value = m.sheetLink || '';
    applyLinkScope();
    renderReview();
  });
  bridge.on('progress', function (m) { $('run').textContent = 'Building ' + m.done + ' / ' + m.total + '…'; });
  bridge.on('error', function (m) {
    setErr(m.message);
    $('run').disabled = !!state.scopeBlocked; $('run').textContent = 'Run A+';
    $('addcmp').disabled = !state.selection.frames.length; $('addcmp').textContent = 'Add fit comparison';
  });
  bridge.on('done', function (m) {
    $('run').disabled = !!state.scopeBlocked; $('run').textContent = 'Run A+';
    $('addcmp').disabled = !state.selection.frames.length; $('addcmp').textContent = 'Add fit comparison';
    var html = '';
    if (m.missingFonts && m.missingFonts.length) html += '<div class="err">Fonts missing on this machine, Inter used instead: ' + esc(m.missingFonts.join(', ')) + '</div>';
    html += '<div class="hint">Template: <b>' + esc(m.template || '') + '</b> · source: ' + esc(m.source || 'bundled') + '</div>';
    html += m.report.map(function (r) {
      return '<div class="item"><b class="' + (r.ok ? 'ok' : 'bad') + '">' + (r.ok ? '✓ ' : '✕ ') + esc(r.name) + '</b>' +
        (r.warnings && r.warnings.length ? '<ul>' + r.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
    }).join('');
    html += '<div class="hint">Next: drop in photos, then export slices 1 and 2.</div>';
    $('report').innerHTML = html;
  });

  // ---------- public API for the other panels ----------
  // styleRows(): one entry per style ID in the rows this panel would build (scoped, corrected),
  //   { styleId, category, gender, label, error, row } — what Export lists.
  // picks(): the designer's current category / gender / template / source picks.
  Panels.automate = {
    styleRows: function () {
      var sc = sheetSchema(), out = [], seen = {};
      editedRows().forEach(function (r) {
        var t = resolveRowTarget(r, state.src === 'selection');
        (String(r[sc.styleIdColumn] || '').match(/\d{6}/g) || []).forEach(function (id) {
          if (seen[id]) return; seen[id] = 1;
          out.push({ styleId: id, category: t.catId || '', gender: t.genderId || '', label: t.error ? '' : t.label, error: t.error || null, row: r.slice() });
        });
      });
      return out;
    },
    picks: function () { return { cat: state.cat, gender: state.gender, templateId: state.templateId, src: state.src }; },
    resolveRowTarget: function (r, force) { return resolveRowTarget(r, force); }
  };
})();
