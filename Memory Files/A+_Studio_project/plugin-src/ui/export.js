/* =============================================================================================
   plugin-src/ui/export.js — the "Export" panel.  OWNED BY THE EXPORT PANEL.
   Markup: ui/export.html. Sandbox side: plugin-src/main-export.js. GIF rules: backend/gif-rules.json.

   Flow: frames (canvas selection, or "select all A+") -> With / Without GIF -> format + size ->
   ZIP download or Google Drive (a folder per style ID) -> Export.

   Everything heavy runs HERE, in the plugin iframe on the user's machine:
     - Figma renders each frame (sandbox exportAsync)
     - the category's animation is downloaded straight from Drive with the user's token
     - the GIF (gifenc) / MP4 (WebCodecs + mp4-muxer) is composited and encoded in this iframe
     - the ZIP (fflate) is built here, or each file is uploaded straight to Drive
   The backend is asked only which Drive file is the category's animation (/api/gif-match).
   Uses platform.js: state, $, esc, bus, bridge, backend, drive, auth, files, ui, errorText, registryCats.
   ============================================================================================= */
(function () {
  var ex = {
    frames: [],          // [{id,name,w,h,ids,category,gender,source}]
    pageId: null,
    other: 0,            // selected things that are not frames
    cat: {},             // frameId -> category override chosen in the list
    thumbs: {},          // frameId -> object URL
    match: {},           // category -> gif-match result | {pending:true} | {error}
    mode: 'static', format: 'PNG', size: '2', dest: 'zip', driveLink: '',
    missing: 'still',    // With GIF, category has no animation: 'still' | 'skip'
    running: false, cancel: false
  };
  var STATIC_FORMATS = [['PNG', 'PNG'], ['JPG', 'JPG'], ['SVG', 'SVG'], ['PDF', 'PDF']];
  var ANIM_FORMATS = [['gif', 'GIF'], ['mp4', 'MP4']];
  var STATIC_SIZES = [['1', '1×'], ['2', '2×'], ['3', '3×']];
  var ANIM_SIZES = [['w582', '582 px wide · house'], ['w970', '970 px wide'], ['s1', 'Frame width (1×)']];
  var MIME = { png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml', pdf: 'application/pdf', gif: 'image/gif', mp4: 'video/mp4' };
  var DEFAULT_FPS = 30;

  // ---------------------------------------------------------------------------------------------
  // settings
  // ---------------------------------------------------------------------------------------------
  function saveConfig() {
    clearTimeout(state.pending.saveEx);
    state.pending.saveEx = setTimeout(function () {
      bridge.send('save-export-config', { config: { v: 2, mode: ex.mode, format: ex.format, size: ex.size, dest: ex.dest, drive: ex.driveLink, missing: ex.missing } });
    }, 300);
  }
  function loadConfig(c) {
    if (!c || c.v !== 2) return;   // v1 was the rule-editor panel; its fields mean nothing now
    ex.mode = c.mode === 'gif' ? 'gif' : 'static';
    ex.dest = c.dest === 'drive' ? 'drive' : 'zip';
    ex.driveLink = c.drive || '';
    ex.missing = c.missing === 'skip' ? 'skip' : 'still';
    ex.format = c.format || ex.format; ex.size = c.size || ex.size;
  }
  function options(list, value) {
    return list.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === value ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('');
  }
  function renderControls() {
    var anim = ex.mode === 'gif';
    var fl = anim ? ANIM_FORMATS : STATIC_FORMATS, sl = anim ? ANIM_SIZES : STATIC_SIZES;
    if (!fl.some(function (o) { return o[0] === ex.format; })) ex.format = fl[0][0];
    if (!sl.some(function (o) { return o[0] === ex.size; })) ex.size = anim ? 'w582' : '2';
    $('ex-format').innerHTML = options(fl, ex.format);
    $('ex-size').innerHTML = options(sl, ex.size);
    var vector = ex.format === 'SVG' || ex.format === 'PDF';
    $('ex-size').disabled = vector;
    $('ex-sizehint').innerHTML = vector ? 'SVG and PDF are vector, so size does not apply.'
      : anim ? 'Figma renders the A+ at exactly this width. 582 px matches the team\'s existing A+ GIFs (about 4 MB). For crisper text, choose 970 px (about 2.5× the file size) or Frame width (largest).'
      : 'Multiplies each frame\'s own size. Amazon A+ images: JPG or PNG, under 2 MB.';
    document.querySelectorAll('#ex-mode button').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === ex.mode); });
    document.querySelectorAll('#ex-dest button').forEach(function (b) { b.classList.toggle('on', b.dataset.dest === ex.dest); });
    $('ex-drivebox').classList.toggle('hidden', ex.dest !== 'drive');
    if ($('ex-drive').value !== ex.driveLink) $('ex-drive').value = ex.driveLink;
    renderGifNote();
    renderGo();
  }

  // ---------------------------------------------------------------------------------------------
  // the frame list
  // ---------------------------------------------------------------------------------------------
  function catOf(f) { return ex.cat[f.id] !== undefined ? ex.cat[f.id] : (f.category || ''); }
  function catLabel(id) { var c = registryCats().find(function (x) { return x.id === id; }); return c ? c.label : (id || ''); }
  function primaryId(f) { return f.ids[0] || null; }

  var scanTimer = null, scanSeq = 0;
  function scheduleScan() { clearTimeout(scanTimer); scanTimer = setTimeout(scan, 120); }
  async function scan() {
    if (ex.running) return;
    var my = ++scanSeq;
    try {
      var r = await bridge.request('export-scan', { scope: 'selection' }, { timeoutMs: 20000 });
      if (my !== scanSeq) return;
      ex.frames = r.frames || []; ex.pageId = r.pageId; ex.other = r.other || 0;
      renderFrames();
      loadThumbs(my);
      if (ex.mode === 'gif') matchAll();
    } catch (e) {
      $('ex-frames').innerHTML = ui.note('warn', 'Could not read the selection', esc(errorText(e)));
    }
  }
  async function loadThumbs(my) {
    for (var i = 0; i < ex.frames.length; i++) {
      var f = ex.frames[i];
      if (ex.thumbs[f.id]) continue;
      try {
        var r = await bridge.request('export-thumb', { frameId: f.id }, { timeoutMs: 20000 });
        ex.thumbs[f.id] = URL.createObjectURL(new Blob([r.bytes], { type: 'image/png' }));
        var el = document.querySelector('#ex-frames [data-th="' + CSS.escape(f.id) + '"]');
        if (el) el.style.backgroundImage = 'url("' + ex.thumbs[f.id] + '")';
      } catch (e) { /* a missing thumbnail is cosmetic */ }
      if (my !== scanSeq) return;
    }
  }
  function frameStatus(f) {
    var c = catOf(f);
    if (!f.ids.length) return { cls: 'bad', text: 'No style ID found in the frame name or on the canvas. It will be saved under its frame name.' };
    if (ex.mode !== 'gif') return { cls: '', text: catLabel(c) || 'Category not detected' };
    if (!c) return { cls: 'bad', text: 'Pick a category to find its GIF' };
    var m = ex.match[c];
    if (!m || m.pending) return { cls: '', text: 'Looking for the ' + catLabel(c) + ' GIF…' };
    if (m.error) return { cls: 'bad', text: m.error };
    if (!m.found) return { cls: 'bad', text: 'No GIF for ' + catLabel(c) + ' · ' + (ex.missing === 'skip' ? 'will be skipped' : 'exports as a still image') };
    return { cls: 'good', text: 'GIF: ' + m.file.name + (m.file.durationMillis ? ' · ' + (m.file.durationMillis / 1000).toFixed(1) + ' s' : '') };
  }
  function renderFrames() {
    var n = ex.frames.length;
    $('ex-count').textContent = n ? n + ' frame' + (n > 1 ? 's' : '') : '';
    if (!n) {
      $('ex-frames').innerHTML = ui.note('info', 'No frames selected',
        'Select A+ frames on the canvas (shift-click for several), or press <b>Select all A+ on this page</b>.' +
        (ex.other ? '<br>' + ex.other + ' selected layer' + (ex.other > 1 ? 's are' : ' is') + ' not a frame and will be ignored.' : ''));
      renderGo(); return;
    }
    var cats = registryCats();
    $('ex-frames').innerHTML = ex.frames.map(function (f) {
      var st = frameStatus(f), c = catOf(f);
      var pick = '<select data-cat="' + esc(f.id) + '" title="Category — decides which GIF is used">' +
        '<option value=""' + (c ? '' : ' selected') + '>Category…</option>' +
        cats.map(function (k) { return '<option value="' + esc(k.id) + '"' + (k.id === c ? ' selected' : '') + '>' + esc(k.label) + '</option>'; }).join('') +
        '</select>';
      return '<div class="exrow">' +
        '<div class="th" data-th="' + esc(f.id) + '"' + (ex.thumbs[f.id] ? ' style="background-image:url(\'' + ex.thumbs[f.id] + '\')"' : '') + '></div>' +
        '<div class="mid"><div class="ids">' + esc(f.ids.join(', ') || '—') + '</div>' +
        '<div class="nm" title="' + esc(f.name) + '">' + esc(f.name) + ' · ' + f.w + '×' + f.h + '</div>' +
        '<div class="sub ' + st.cls + '">' + esc(st.text) + '</div></div>' + pick + '</div>';
    }).join('') + (ex.other ? '<div class="hint">' + ex.other + ' other selected layer' + (ex.other > 1 ? 's are' : ' is') + ' not a frame and will be ignored.</div>' : '');
    renderGifNote(); renderGo();
  }

  // ---------------------------------------------------------------------------------------------
  // GIF matching (backend rules -> a Drive file id; bytes are fetched later, straight from Drive)
  // ---------------------------------------------------------------------------------------------
  function matchAll() {
    var need = {};
    ex.frames.forEach(function (f) { var c = catOf(f); if (c && !ex.match[c]) need[c] = 1; });
    Object.keys(need).forEach(function (c) {
      ex.match[c] = { pending: true };
      backend.post('/api/gif-match', { session: state.session, category: c }, { timeoutMs: 75000 })
        .then(function (r) { ex.match[c] = r; })
        .catch(function (e) { ex.match[c] = { error: 'Could not look up the GIF: ' + errorText(e) }; })
        .then(function () { renderFrames(); });
    });
  }
  function renderGifNote() {
    var host = $('ex-gifnote');
    if (ex.mode !== 'gif') { host.innerHTML = ''; return; }
    var missing = ex.frames.filter(function (f) { var m = ex.match[catOf(f)]; return !catOf(f) || (m && !m.pending && !m.found); });
    if (!missing.length) {
      host.innerHTML = '<div class="hint">Each frame gets its category\'s animation from the team <b>Gifs</b> folder in Drive.</div>';
      return;
    }
    var names = {}; missing.forEach(function (f) { names[catOf(f) ? catLabel(catOf(f)) : 'no category'] = 1; });
    host.innerHTML = ui.note('warn', missing.length + ' frame' + (missing.length > 1 ? 's have' : ' has') + ' no GIF',
      'No animation for: ' + esc(Object.keys(names).join(', ')) + '. Add a file named after the category to the Gifs folder, or:') +
      '<div class="seg" id="ex-missing" style="margin-top:8px">' +
      '<button data-missing="still"' + (ex.missing === 'still' ? ' class="on"' : '') + '>Export them as still images</button>' +
      '<button data-missing="skip"' + (ex.missing === 'skip' ? ' class="on"' : '') + '>Skip them</button></div>';
  }

  // ---------------------------------------------------------------------------------------------
  // the Export button
  // ---------------------------------------------------------------------------------------------
  function plan() {
    // -> [{frame, kind:'static'|'anim', category, match}] ; anything that cannot go is listed in `blocked`
    var jobs = [], blocked = [];
    ex.frames.forEach(function (f) {
      if (ex.mode !== 'gif') { jobs.push({ f: f, kind: 'static' }); return; }
      var c = catOf(f), m = ex.match[c];
      if (c && m && m.found) { jobs.push({ f: f, kind: 'anim', category: c, match: m }); return; }
      if (c && (!m || m.pending)) { blocked.push(f); return; }
      if (ex.missing === 'still') jobs.push({ f: f, kind: 'static', fallback: true });
    });
    return { jobs: jobs, blocked: blocked };
  }
  function renderGo() {
    var b = $('ex-go');
    if (ex.running) { b.textContent = 'Cancel'; b.disabled = false; return; }
    var p = plan();
    var label = ex.mode === 'gif' ? ex.format.toUpperCase() : ex.format;
    b.disabled = !p.jobs.length || p.blocked.length > 0 || (ex.dest === 'drive' && !drive.parseId(ex.driveLink));
    b.textContent = !ex.frames.length ? 'Export' : p.blocked.length ? 'Looking up GIFs…'
      : (ex.dest === 'drive' && !drive.parseId(ex.driveLink)) ? 'Paste a Drive folder link'
      : 'Export ' + p.jobs.length + ' frame' + (p.jobs.length > 1 ? 's' : '') + ' · ' + label + (ex.dest === 'zip' ? ' · ZIP' : ' · Drive');
  }

  function sizeOpts(f, kind) {
    if (kind === 'anim') {
      var w = ex.size === 'w970' ? 970 : ex.size === 'w582' ? 582 : f.w;
      return { width: w - (w % 2) };                            // even: H.264 needs it, GIF does not mind
    }
    if (ex.mode === 'gif') return { width: ex.size === 'w970' ? 970 : ex.size === 'w582' ? 582 : f.w }; // still fallback, same width
    return { scale: Number(ex.size) || 1 };
  }
  function folderNames(f) {
    if (f.ids.length) return f.ids.slice();
    return [String(f.name || 'frame').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'frame'];
  }

  async function run() {
    var p = plan();
    if (!p.jobs.length) return;
    ex.running = true; ex.cancel = false; renderGo();
    $('ex-out').innerHTML = '';
    var rows = p.jobs.map(function (j, i) {
      return '<div class="exrow"><div class="mid"><div class="ids">' + esc(j.f.ids.join(', ') || j.f.name) + '</div>' +
        '<div class="sub" id="ex-st-' + i + '">Waiting</div><div class="exbar"><i id="ex-bar-' + i + '"></i></div></div></div>';
    });
    $('ex-progress').innerHTML = rows.join('');
    function status(i, text, pct, cls) {
      var s = $('ex-st-' + i); if (s) { s.textContent = text; s.className = 'sub' + (cls ? ' ' + cls : ''); }
      var b = $('ex-bar-' + i); if (b && pct != null) b.style.width = Math.round(pct * 100) + '%';
    }

    var zip = {}, results = [], driveRoot = null, assetCache = {};
    try {
      if (ex.dest === 'drive') driveRoot = await prepareDrive();
      for (var i = 0; i < p.jobs.length; i++) {
        if (ex.cancel) { status(i, 'Cancelled', null, 'bad'); continue; }
        var j = p.jobs[i], f = j.f;
        try {
          var out = j.kind === 'anim'
            ? await buildAnimated(j, function (t, pct) { status(i, t, pct); }, assetCache)
            : await buildStatic(j, function (t, pct) { status(i, t, pct); });
          var names = folderNames(f);
          if (ex.dest === 'zip') {
            names.forEach(function (n) { zip[n + '/' + n + '.' + out.ext] = [out.bytes, { level: /^(svg|pdf)$/.test(out.ext) ? 6 : 0 }]; });
          } else {
            for (var k = 0; k < names.length; k++) {
              status(i, 'Uploading to Drive' + (names.length > 1 ? ' (' + (k + 1) + '/' + names.length + ')' : '') + '…', 0.95);
              await uploadOne(driveRoot, names[k], names[k] + '.' + out.ext, MIME[out.ext], out.bytes);
            }
          }
          status(i, out.summary + (j.fallback ? ' · no GIF, still image' : ''), 1, 'good');
          results.push({ ok: true, f: f, out: { ext: out.ext, size: out.bytes.length } });
          out = null;                      // release the bytes we no longer need before the next frame
        } catch (e) {
          if (ex.cancel && e && e.cancelled) { status(i, 'Cancelled', null, 'bad'); continue; }
          status(i, errorText(e), null, 'bad');
          results.push({ ok: false, f: f, error: errorText(e) });
        }
      }
      var ok = results.filter(function (r) { return r.ok; }).length, bad = results.length - ok;
      if (ex.dest === 'zip' && ok) {
        var d = new Date(), p2 = function (x) { return (x < 10 ? '0' : '') + x; };   // local time, as the user reads it
        var stamp = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + '.' + p2(d.getMinutes());
        var zbytes = fflate.zipSync(zip);
        var link = files.save(zbytes, 'application/zip', 'A+ export ' + stamp + '.zip');
        $('ex-out').innerHTML = ui.note(bad ? 'pending' : 'info', 'Exported ' + ok + ' of ' + results.length,
          'ZIP · ' + files.fmtBytes(zbytes.length) + ' · one folder per style ID.<br>' + link);
      } else if (ex.dest === 'drive' && ok) {
        $('ex-out').innerHTML = ui.note(bad ? 'pending' : 'info', 'Uploaded ' + ok + ' of ' + results.length + ' to Drive',
          'Into <b>' + esc(driveRoot.name) + '</b>, one folder per style ID. ' +
          '<a href="https://drive.google.com/drive/folders/' + esc(driveRoot.id) + '" target="_blank" rel="noopener">Open the folder</a>');
      } else if (!ok) {
        $('ex-out').innerHTML = ui.note('warn', ex.cancel ? 'Export cancelled' : 'Nothing was exported', 'See each frame above for the reason.');
      }
    } catch (e) {
      $('ex-out').innerHTML = ui.note('warn', 'Export stopped', esc(errorText(e)));
    } finally {
      zip = null; assetCache = null;
      ex.running = false; ex.cancel = false; renderGo();
    }
  }

  // ---------------------------------------------------------------------------------------------
  // static: Figma renders it, that is the file
  // ---------------------------------------------------------------------------------------------
  async function buildStatic(j, progress) {
    var fmt = ex.mode === 'gif' ? 'PNG' : ex.format;
    progress('Rendering ' + fmt + ' in Figma…', 0.2);
    var r = await bridge.request('export-frame', Object.assign({ frameId: j.f.id, format: fmt }, sizeOpts(j.f, 'static')), { timeoutMs: 120000 });
    var ext = fmt.toLowerCase();
    return { bytes: r.bytes, ext: ext, summary: fmt + ' · ' + (ext === 'svg' || ext === 'pdf' ? '' : r.width + '×' + r.height + ' · ') + files.fmtBytes(r.bytes.length) };
  }

  // ---------------------------------------------------------------------------------------------
  // animated: A+ (static, top) + the category animation (full width, below), encoded on device
  // ---------------------------------------------------------------------------------------------
  async function buildAnimated(j, progress, cache) {
    var fmt = ex.format;                              // 'gif' | 'mp4'
    if (fmt === 'mp4' && typeof VideoEncoder === 'undefined') throw new Error('This version of Figma cannot encode MP4 (no WebCodecs). Choose GIF, or update the Figma desktop app.');
    var so = sizeOpts(j.f, 'anim'), W = so.width;
    progress('Rendering the A+ in Figma…', 0.03);
    var top = await bridge.request('export-frame', { frameId: j.f.id, format: 'PNG', width: W }, { timeoutMs: 120000 });
    var topBmp = await createImageBitmap(new Blob([top.bytes], { type: 'image/png' }));
    var file = j.match.file;
    var asset = cache[file.id];
    if (!asset) {
      progress('Downloading ' + file.name + ' from Drive…', 0.06);
      var bytes = await drive.download(file.id, { onProgress: function (l, t) { if (t) progress('Downloading ' + file.name + '… ' + Math.round(100 * l / t) + '%', 0.06 + 0.06 * l / t); } });
      asset = cache[file.id] = await openAnimation(bytes, file);
    }
    var topH = topBmp.height;
    var botH = Math.round(W * asset.height / asset.width / 2) * 2;
    var H = topH + botH; if (H % 2) { botH += 1; H += 1; }
    var fps = Math.min(DEFAULT_FPS, asset.fps || DEFAULT_FPS);
    var n = Math.max(1, Math.round(asset.duration * fps));
    var canvas = new OffscreenCanvas(W, H);
    var ctx = canvas.getContext('2d', { willReadFrequently: fmt === 'gif' });
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(topBmp, 0, 0, W, topH);
    topBmp.close();
    if (fmt === 'gif') progress('Choosing the GIF colours…', 0.12);
    var enc = fmt === 'mp4' ? await mp4Encoder(W, H, fps) : gifEncoder(W, H, topH, botH, fps, await gifPalettes(ctx, asset, W, topH, botH));
    for (var i = 0; i < n; i++) {
      if (ex.cancel) { enc.abort(); var ce = new Error('Cancelled'); ce.cancelled = true; throw ce; }
      var img = await asset.frameAt((i + 0.5) / fps);
      ctx.drawImage(img, 0, topH, W, botH);
      await enc.add(ctx, canvas, i);
      if (i % 3 === 0 || i === n - 1) {
        progress('Encoding ' + fmt.toUpperCase() + ' · frame ' + (i + 1) + ' of ' + n, 0.12 + 0.8 * (i + 1) / n);
        await new Promise(function (r) { setTimeout(r, 0); });   // let the panel repaint
      }
    }
    var out = await enc.finish();
    return { bytes: out, ext: fmt, summary: fmt.toUpperCase() + ' · ' + W + '×' + H + ' · ' + n + ' frames @ ' + fps + ' fps · ' + files.fmtBytes(out.length) };
  }

  // The animation asset: a video (MP4/MOV/WebM, decoded by a <video> element) or an animated
  // GIF/WebP (decoded by ImageDecoder). Exposes width/height/duration/fps and frameAt(seconds).
  async function openAnimation(bytes, meta) {
    var isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
    if (isGif || /image\/(gif|webp)/.test(meta.mimeType || '')) return openImageAnimation(bytes, isGif ? 'image/gif' : meta.mimeType);
    return openVideo(bytes, meta.mimeType || 'video/mp4');
  }
  function openVideo(bytes, mime) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(new Blob([bytes], { type: mime }));
      var v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
      v.onerror = function () { reject(new Error('This Figma app cannot play "' + mime + '" (' + ((v.error && v.error.message) || 'decode error') + ').')); };
      v.onloadeddata = function () {
        resolve({
          width: v.videoWidth, height: v.videoHeight, duration: v.duration, fps: DEFAULT_FPS,
          frameAt: function (t) {
            return new Promise(function (res, rej) {
              var target = Math.min(Math.max(0, t), Math.max(0, v.duration - 0.001));
              if (Math.abs(v.currentTime - target) < 1e-6 && v.readyState >= 2) return res(v);
              var done = false;
              var to = setTimeout(function () { if (!done) { done = true; rej(new Error('The animation stopped decoding at ' + target.toFixed(2) + ' s.')); } }, 15000);
              v.addEventListener('seeked', function h() { v.removeEventListener('seeked', h); if (!done) { done = true; clearTimeout(to); res(v); } });
              v.currentTime = target;
            });
          }
        });
      };
    });
  }
  async function openImageAnimation(bytes, mime) {
    if (typeof ImageDecoder === 'undefined') throw new Error('This Figma app cannot decode an animated ' + mime + ' (no ImageDecoder). Use an MP4 in the Gifs folder.');
    var dec = new ImageDecoder({ data: bytes, type: mime });
    await dec.tracks.ready;
    var count = dec.tracks.selectedTrack.frameCount, starts = [], t = 0, first = await dec.decode({ frameIndex: 0 });
    var w = first.image.displayWidth, h = first.image.displayHeight;
    for (var i = 0; i < count; i++) {
      var d = i === 0 ? first : await dec.decode({ frameIndex: i });
      starts.push(t); t += (d.image.duration || 100000) / 1e6;
      if (i) d.image.close();
    }
    first.image.close();
    var cur = null, curIdx = -1;
    return {
      width: w, height: h, duration: t, fps: DEFAULT_FPS,
      frameAt: async function (sec) {
        var k = 0; while (k + 1 < starts.length && starts[k + 1] <= sec) k++;
        if (k !== curIdx) { if (cur) cur.close(); cur = (await dec.decode({ frameIndex: k })).image; curIdx = k; }
        return cur;
      }
    };
  }

  // GIF, built for quality first and the team's size (~3-5 MB at 582 px, 30 fps) second:
  //  - TWO palettes. GIF allows a colour table per frame, and the A+ is only drawn in frame 1, so
  //    frame 1 carries a palette built from the A+ alone (all 256 colours for its greys, skin,
  //    fabric and type). Sharing one palette with the video left the A+ a handful of greys:
  //    banding, and orange "track" dots dithered into a lilac shirt.
  //  - The animation frames share a second palette (255 colours + transparent), sampled across
  //    the clip. Shared, so a pixel that does not change keeps its index and is written as
  //    transparent: the A+ costs nothing after frame 1 and each frame carries only what moved.
  //  - The A+ is dithered gently (Floyd–Steinberg at reduced strength): smooth gradients without
  //    the speckle that full-strength diffusion leaves on flat backgrounds and around type. The
  //    animation is not dithered, so still pixels stay still and compress away.
  // (A fresh palette per animation frame re-numbers every pixel every frame — nothing is ever
  //  unchanged — measured 21.3 MB vs ~3.4 MB for the same Running.mp4.)
  var GIF_TOP_DITHER = 0.75;
  async function gifPalettes(ctx, asset, W, topH, botH) {
    var top = ctx.getImageData(0, 0, W, topH).data;
    var topPal = gifenc.quantize(top, 256, { format: 'rgb565' });
    var SAMPLES = 8, parts = [], total = 0;
    for (var s = 0; s < SAMPLES; s++) {
      ctx.drawImage(await asset.frameAt((s + 0.5) * asset.duration / SAMPLES), 0, topH, W, botH);
      var d = ctx.getImageData(0, topH, W, botH).data; parts.push(d); total += d.length;
    }
    var all = new Uint8ClampedArray(total), o = 0;
    parts.forEach(function (p) { all.set(p, o); o += p.length; });
    return { top: topPal, anim: gifenc.quantize(all, 255, { format: 'rgb565' }) };
  }
  // Floyd–Steinberg onto a fixed palette. Nearest-colour lookups are cached on an RGB565 key,
  // so ~1 M pixels take tens of milliseconds.
  function ditherFS(rgba, w, h, pal, strength) {
    var k8 = strength === undefined ? 1 : strength;
    var out = new Uint8Array(w * h), cache = new Int16Array(65536).fill(-1);
    var cur = new Float32Array((w + 2) * 3), nxt = new Float32Array((w + 2) * 3);
    function nearest(r, g, b) {
      var key = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
      var c = cache[key];
      if (c >= 0) return c;
      var best = 0, bd = Infinity;
      for (var p = 0; p < pal.length; p++) {
        var dr = r - pal[p][0], dg = g - pal[p][1], db = b - pal[p][2], d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
        if (d < bd) { bd = d; best = p; }
      }
      cache[key] = best; return best;
    }
    function clamp(v) { return v < 0 ? 0 : v > 255 ? 255 : v | 0; }
    for (var y = 0; y < h; y++) {
      var t = cur; cur = nxt; nxt = t; nxt.fill(0);
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4, e = (x + 1) * 3;
        var r = clamp(rgba[i] + cur[e]), g = clamp(rgba[i + 1] + cur[e + 1]), b = clamp(rgba[i + 2] + cur[e + 2]);
        var k = nearest(r, g, b), col = pal[k];
        out[y * w + x] = k;
        var er = (r - col[0]) * k8, eg = (g - col[1]) * k8, eb = (b - col[2]) * k8;
        cur[e + 3] += er * 7 / 16; cur[e + 4] += eg * 7 / 16; cur[e + 5] += eb * 7 / 16;
        nxt[e - 3] += er * 3 / 16; nxt[e - 2] += eg * 3 / 16; nxt[e - 1] += eb * 3 / 16;
        nxt[e] += er * 5 / 16;     nxt[e + 1] += eg * 5 / 16; nxt[e + 2] += eb * 5 / 16;
        nxt[e + 3] += er / 16;     nxt[e + 4] += eg / 16;     nxt[e + 5] += eb / 16;
      }
    }
    return out;
  }
  function gifEncoder(W, H, topH, botH, fps, pals) {
    var G = gifenc, gif = G.GIFEncoder(), prevCs = 0;
    var topTable = pals.top.slice(); while (topTable.length < 256) topTable.push([0, 0, 0]);
    var anim = pals.anim, animTable = anim.slice(); while (animTable.length < 255) animTable.push([0, 0, 0]); animTable.push([0, 0, 0]); // 255 = transparent
    var out = new Uint8Array(W * H), prev = null;
    function delayMs(i) { var cs = Math.round((i + 1) * 100 / fps); var d = cs - prevCs; prevCs = cs; return d * 10; }
    return {
      add: async function (ctx, canvas, i) {
        if (i === 0) {
          // frame 1: the A+ (its own palette, gently dithered) + the first animation frame
          var all = new Uint8Array(W * H);
          all.set(ditherFS(ctx.getImageData(0, 0, W, topH).data, W, topH, pals.top, GIF_TOP_DITHER), 0);
          all.set(ditherFS(ctx.getImageData(0, topH, W, botH).data, W, botH, pals.top, GIF_TOP_DITHER), W * topH);
          gif.writeFrame(all, W, H, { palette: topTable, delay: delayMs(i), repeat: 0, dispose: 1 });
          out.fill(255, 0, W * topH);                        // the A+ area: transparent from now on
          return;
        }
        var cur = G.applyPalette(ctx.getImageData(0, topH, W, botH).data, anim, 'rgb565');
        var base = W * topH;
        // frame 2 redraws the whole strip in the animation palette; later frames only what changed
        for (var k = 0; k < cur.length; k++) out[base + k] = (prev && cur[k] === prev[k]) ? 255 : cur[k];
        prev = cur;
        gif.writeFrame(out, W, H, { palette: animTable, delay: delayMs(i), transparent: true, transparentIndex: 255, dispose: 1 });
      },
      finish: async function () { gif.finish(); return gif.bytes(); },
      abort: function () {}
    };
  }

  // MP4: WebCodecs H.264, muxed with mp4-muxer. Tries High, then Main, then Baseline profiles.
  async function mp4Encoder(W, H, fps) {
    var bitrate = Math.max(2e6, Math.min(20e6, Math.round(W * H * fps * 0.12)));
    var codecs = ['avc1.640034', 'avc1.640033', 'avc1.64002A', 'avc1.4D0034', 'avc1.4D0033', 'avc1.42E034', 'avc1.42E01F'];
    var config = null;
    for (var c = 0; c < codecs.length && !config; c++) {
      var cfg = { codec: codecs[c], width: W, height: H, bitrate: bitrate, framerate: fps, avc: { format: 'avc' } };
      try { var s = await VideoEncoder.isConfigSupported(cfg); if (s && s.supported) config = cfg; } catch (e) {}
    }
    if (!config) throw new Error('This Figma app cannot encode H.264 MP4 at ' + W + '×' + H + '. Choose GIF, or a smaller size.');
    var muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H, frameRate: fps }, fastStart: 'in-memory' });
    var failure = null;
    var encoder = new VideoEncoder({ output: function (chunk, meta) { muxer.addVideoChunk(chunk, meta); }, error: function (e) { failure = e; } });
    encoder.configure(config);
    var us = 1e6 / fps;
    return {
      add: async function (ctx, canvas, i) {
        if (failure) throw failure;
        var frame = new VideoFrame(canvas, { timestamp: Math.round(i * us), duration: Math.round(us) });
        encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
        frame.close();
        while (encoder.encodeQueueSize > 6) await new Promise(function (r) { setTimeout(r, 5); });
      },
      finish: async function () {
        await encoder.flush();
        if (failure) throw failure;
        encoder.close(); muxer.finalize();
        return new Uint8Array(muxer.target.buffer);
      },
      abort: function () { try { encoder.close(); } catch (e) {} }
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Google Drive destination
  // ---------------------------------------------------------------------------------------------
  async function prepareDrive() {
    var id = drive.parseId(ex.driveLink);
    if (!id) throw new Error('That is not a Google Drive folder link.');
    var info = auth.tokenInfo();
    if (!info) { await auth.getAccessToken(); info = auth.tokenInfo(); }
    if (info && info.driveAccess && info.driveAccess !== 'full') {
      throw new Error('Your Google sign-in can only read Drive. Use the Google button at the top: disconnect, then continue with Google again and allow Drive access. Then export again.');
    }
    var f = await drive.get(id);
    if (!f.isFolder) throw new Error('"' + f.name + '" is a file. Paste the link of a folder.');
    return f;
  }
  // One folder per style ID; a re-export replaces the file of the same name instead of piling up copies.
  async function uploadOne(root, folderName, fileName, mime, bytes) {
    var folder = await drive.findOrCreateFolder(root.id, folderName);
    var existing = await drive.query(drive.quote(folder.id) + ' in parents and name = ' + drive.quote(fileName) + ' and trashed = false', { pageSize: 5, max: 5 });
    return drive.upload(folder.id, fileName, mime, bytes, existing.length ? { fileId: existing[0].id } : {});
  }

  // ---------------------------------------------------------------------------------------------
  // events
  // ---------------------------------------------------------------------------------------------
  $('ex-mode').addEventListener('click', function (e) {
    var m = e.target.dataset && e.target.dataset.mode; if (!m || ex.running) return;
    ex.mode = m; renderControls(); renderFrames(); if (m === 'gif') matchAll(); saveConfig();
  });
  $('ex-dest').addEventListener('click', function (e) {
    var d = e.target.dataset && e.target.dataset.dest; if (!d || ex.running) return;
    ex.dest = d; renderControls(); saveConfig();
  });
  $('ex-gifnote').addEventListener('click', function (e) {
    var m = e.target.dataset && e.target.dataset.missing; if (!m) return;
    ex.missing = m; renderFrames(); saveConfig();
  });
  $('ex-format').onchange = function () { ex.format = this.value; renderControls(); saveConfig(); };
  $('ex-size').onchange = function () { ex.size = this.value; renderGo(); saveConfig(); };
  $('ex-drive').oninput = function () { ex.driveLink = this.value.trim(); renderGo(); saveConfig(); };
  $('ex-frames').addEventListener('change', function (e) {
    var id = e.target.dataset && e.target.dataset.cat; if (id === undefined) return;
    ex.cat[id] = e.target.value; renderFrames(); if (ex.mode === 'gif') matchAll();
  });
  $('ex-all').onclick = async function () {
    if (ex.running) return;
    try {
      var r = await bridge.request('export-select-all', {}, { timeoutMs: 20000 });
      if (!r.count) $('ex-frames').innerHTML = ui.note('info', 'No A+ frames on this page', 'An A+ frame is a top-level frame with a six-digit style ID in its name or next to it.');
      // the selection change triggers a scan through the core 'selection' message
    } catch (e) { ui.toast(errorText(e), 'warn'); }
  };
  $('ex-clear').onclick = function () { if (!ex.running) bridge.request('export-clear', {}).catch(function () {}); };
  $('ex-go').onclick = function () {
    if (ex.running) { ex.cancel = true; $('ex-go').textContent = 'Cancelling…'; $('ex-go').disabled = true; return; }
    run();
  };

  bus.on('selection', scheduleScan);
  bus.on('page', function () { ex.cat = {}; scheduleScan(); });
  bus.on('tab', function (name) { if (name === 'export') scheduleScan(); });
  bus.on('registry', function () { renderFrames(); });
  bus.on('auth', function () { ex.match = {}; if (ex.mode === 'gif') matchAll(); });
  bus.on('init', function (m) { loadConfig(m.exportConfig); renderControls(); scheduleScan(); });

  Panels.export = { rescan: scheduleScan, _state: ex };

  // first paint
  renderControls();
  renderFrames();
})();
