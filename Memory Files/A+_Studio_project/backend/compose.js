// ===== A+ Studio · GIF/MP4 composite service =====
//
// WHAT THIS DOES
// Takes the finished A+ design as a PNG (Figma can only export PNG/JPG/SVG/PDF, and it flattens
// an imported GIF to its first frame, so Figma cannot do this itself) plus an animated GIF asset,
// and stacks them vertically — A+ on top, GIF below — into one animated file.
//
// !! READ THIS BEFORE BUILDING A UI AROUND THE GIF OUTPUT !!
// Amazon's own A+ Content guidelines say, verbatim: "The use of animated images (for example,
// GIF) is prohibited." Accepted formats are JPG and PNG, max 2 MB per image. Premium A+ carries
// the same image rule and puts motion in a SEPARATE video module (.mp4, >=960x540, <=200 MB,
// <=180 s). So an animated GIF cannot be uploaded to Amazon A+ at all — not at any size.
// See docs/export-pipeline.md "The Amazon blocker" for the full picture and the options.
// The GIF path is still built and supported here because it is useful off-Amazon (site, social,
// decks, internal review); it is just not an Amazon A+ deliverable.
//
// Zero npm dependencies — ffmpeg is invoked via child_process.

require('./env');

var fs = require('fs');
var os = require('os');
var path = require('path');
var crypto = require('crypto');
var child = require('child_process');

var FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
var FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
var TMP_ROOT = process.env.APLUS_TMP_DIR || path.join(os.tmpdir(), 'aplus');
var TIMEOUT_MS = Number(process.env.COMPOSE_TIMEOUT_MS || 300000);        // 5 min
var MAX_INPUT_BYTES = Number(process.env.COMPOSE_MAX_INPUT_BYTES || 64 * 1024 * 1024);
var MAX_PIXELS = Number(process.env.COMPOSE_MAX_PIXELS || 40 * 1000 * 1000); // output w*h guard

// ---------------------------------------------------------------------------------------------
// ffmpeg availability
// ---------------------------------------------------------------------------------------------

var _probe = null;
function toolCheck() {
  if (_probe) return _probe;
  _probe = { available: false, version: null, encoders: {}, error: null };
  try {
    var r = child.spawnSync(FFMPEG, ['-hide_banner', '-version'], { encoding: 'utf8', timeout: 15000 });
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error('ffmpeg -version exited ' + r.status);
    _probe.available = true;
    _probe.version = (String(r.stdout || '').split('\n')[0] || '').replace(/^ffmpeg version\s*/, '').trim();
    var e = child.spawnSync(FFMPEG, ['-hide_banner', '-encoders'], { encoding: 'utf8', timeout: 15000 });
    var txt = String((e && e.stdout) || '');
    _probe.encoders.gif = /\sgif\s/.test(txt);
    _probe.encoders.libx264 = /\slibx264\s/.test(txt);
  } catch (err) {
    _probe.error = String((err && err.message) || err);
  }
  return _probe;
}
function resetToolCheck() { _probe = null; }

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------

// Strip an optional data: URL prefix and decode. Rejects anything that is not plausible base64.
function decodeB64(value, label) {
  if (Buffer.isBuffer(value)) return value;
  var s = String(value || '');
  var m = s.match(/^data:[^;,]*(?:;charset=[^;,]*)?;base64,/i);
  if (m) s = s.slice(m[0].length);
  s = s.replace(/\s+/g, '');
  if (!s) throw new Error('Missing ' + label + '.');
  if (!/^[A-Za-z0-9+/_-]+=*$/.test(s)) throw new Error(label + ' is not valid base64.');
  var buf = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (!buf.length) throw new Error(label + ' decoded to zero bytes.');
  if (buf.length > MAX_INPUT_BYTES) throw new Error(label + ' is ' + mb(buf.length) + ', over the ' + mb(MAX_INPUT_BYTES) + ' input limit.');
  return buf;
}
function mb(n) { return (n / 1048576).toFixed(2) + ' MB'; }

// PNG signature + IHDR. We need the real pixel dimensions to size the output and to refuse
// something absurd before handing it to ffmpeg.
function pngSize(buf) {
  if (buf.length < 24) throw new Error('The A+ PNG is too small to be a PNG.');
  var sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!buf.slice(0, 8).equals(sig)) throw new Error('aplusPng is not a PNG (Figma exportAsync with format "PNG").');
  if (buf.slice(12, 16).toString('ascii') !== 'IHDR') throw new Error('The A+ PNG has no IHDR chunk.');
  var w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  if (!w || !h) throw new Error('The A+ PNG reports a zero dimension.');
  return { width: w, height: h };
}

// GIF header: "GIF87a"/"GIF89a" + logical screen width/height (LE).
function gifSize(buf) {
  if (buf.length < 10 || buf.slice(0, 3).toString('ascii') !== 'GIF') return null;
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

function run(bin, args, opts) {
  opts = opts || {};
  return new Promise(function (resolve, reject) {
    var p = child.spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    var out = [], errOut = [], errLen = 0, done = false;
    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      try { p.kill('SIGKILL'); } catch (e) {}
      reject(new Error(path.basename(bin) + ' timed out after ' + Math.round((opts.timeout || TIMEOUT_MS) / 1000) + 's'));
    }, opts.timeout || TIMEOUT_MS);
    p.stdout.on('data', function (d) { out.push(d); });
    p.stderr.on('data', function (d) { if (errLen < 262144) { errOut.push(d); errLen += d.length; } });
    p.on('error', function (e) {
      if (done) return; done = true; clearTimeout(timer);
      reject(e.code === 'ENOENT' ? new Error(path.basename(bin) + ' is not installed on this host.') : e);
    });
    p.on('close', function (code) {
      if (done) return; done = true; clearTimeout(timer);
      var stderr = Buffer.concat(errOut).toString('utf8');
      if (code !== 0) return reject(new Error(path.basename(bin) + ' failed (exit ' + code + '):\n' + tailLines(stderr, 12)));
      resolve({ stdout: Buffer.concat(out).toString('utf8'), stderr: stderr });
    });
  });
}
function tailLines(s, n) { var a = String(s).trim().split('\n'); return a.slice(Math.max(0, a.length - n)).join('\n'); }

// ---------------------------------------------------------------------------------------------
// ffprobe: what is actually in the animated asset
// ---------------------------------------------------------------------------------------------

async function probeAnimation(file) {
  var r = await run(FFPROBE, [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-count_frames',
    '-show_entries', 'stream=width,height,nb_read_frames,avg_frame_rate,r_frame_rate:format=duration',
    '-of', 'json', file
  ], { timeout: 120000 });
  var j = {};
  try { j = JSON.parse(r.stdout); } catch (e) { throw new Error('Could not read the animation (ffprobe returned nothing usable).'); }
  var s = (j.streams && j.streams[0]) || {};
  var frames = Number(s.nb_read_frames || 0) || null;
  var duration = Number((j.format && j.format.duration) || 0) || null;
  var fr = ratio(s.avg_frame_rate) || ratio(s.r_frame_rate) || null;
  if (!duration && frames && fr) duration = frames / fr;
  if (!fr && frames && duration) fr = frames / duration;
  return {
    width: Number(s.width || 0) || null,
    height: Number(s.height || 0) || null,
    frames: frames,
    duration: duration,
    fps: fr ? Math.round(fr * 1000) / 1000 : null
  };
}
function ratio(v) {
  if (!v) return null;
  var p = String(v).split('/');
  var a = Number(p[0]), b = p.length > 1 ? Number(p[1]) : 1;
  if (!isFinite(a) || !isFinite(b) || !b) return null;
  return a / b;
}

// ---------------------------------------------------------------------------------------------
// the filter chain
//
// Both passes share the same source graph so the palette is generated from EXACTLY the pixels
// that get encoded — generating the palette from a different scale is the classic cause of the
// banding/dither mush this chain is meant to avoid.
//
//   [0:v] the A+ PNG, looped as a still video at the output frame rate
//   [1:v] the animated asset, resampled to the output frame rate
//   both scaled to the same width with lanczos, SAR forced to 1, then vstack'd
//
// Notes on the deliberate choices:
//   * scale=W:-2  keeps aspect and forces an even height (libx264 needs even; harmless for gif).
//   * flags=lanczos is sharper than the bilinear default on flat design art and type.
//   * setsar=1 — vstack refuses inputs with mismatched sample aspect ratios.
//   * vstack=shortest=1 ends the output when the (finite) GIF input ends, so the infinitely
//     looping PNG does not run away. No duration arithmetic needed.
//   * palettegen stats_mode=FULL, not diff. diff weights the palette toward the pixels that
//     CHANGE — i.e. the small animated strip — and would starve the big static A+ design of
//     colours. full is correct whenever most of the canvas is static, which is this case exactly.
//   * paletteuse diff_mode=rectangle is the single most important size lever: it confines each
//     frame's update to the bounding box of what changed, so frames 2..N carry only the animated
//     strip rather than a fresh 1572xH full frame. Combined with -gifflags +transdiff.
//   * dither sierra2_4a is ffmpeg's best error-diffusion for photographic gradients; bayer
//     (with bayer_scale) is offered because it is temporally stable — no crawling dither noise
//     on a static region — and compresses smaller, at the cost of visible crosshatch.
// ---------------------------------------------------------------------------------------------

function sourceGraph(width, fps, gap, background) {
  var g = [
    '[0:v]scale=' + width + ':-2:flags=lanczos,setsar=1[top]',
    '[1:v]fps=' + fps + ',scale=' + width + ':-2:flags=lanczos,setsar=1[bot]'
  ];
  if (gap > 0) {
    // A solid spacer band between the two, if the design wants breathing room.
    g.push('color=c=' + background + ':s=' + width + 'x' + gap + ':r=' + fps + ',setsar=1[gapband]');
    g.push('[top][gapband][bot]vstack=inputs=3:shortest=1[stacked]');
  } else {
    g.push('[top][bot]vstack=inputs=2:shortest=1[stacked]');
  }
  return g;
}

function paletteGenArgs(o) {
  return []
    .concat(['-y', '-hide_banner', '-nostdin'])
    .concat(['-loop', '1', '-framerate', String(o.fps), '-i', o.png])
    .concat(['-ignore_loop', '1', '-i', o.gif])
    .concat(['-filter_complex',
      sourceGraph(o.width, o.fps, o.gap, o.background).join(';') +
      ';[stacked]palettegen=max_colors=' + o.maxColors + ':stats_mode=full:reserve_transparent=0[pal]'])
    .concat(['-map', '[pal]', '-frames:v', '1', o.palette]);
}

function paletteUseArgs(o) {
  var dither = o.dither === 'none' ? 'dither=none'
    : o.dither === 'bayer' ? 'dither=bayer:bayer_scale=' + o.bayerScale
    : 'dither=' + o.dither;
  return []
    .concat(['-y', '-hide_banner', '-nostdin'])
    .concat(['-loop', '1', '-framerate', String(o.fps), '-i', o.png])
    .concat(['-ignore_loop', '1', '-i', o.gif])
    .concat(['-i', o.palette])
    .concat(['-filter_complex',
      sourceGraph(o.width, o.fps, o.gap, o.background).join(';') +
      ';[stacked][2:v]paletteuse=' + dither + ':diff_mode=rectangle:new=0[out]'])
    .concat(['-map', '[out]'])
    .concat(['-loop', String(o.loop), '-gifflags', '+transdiff', '-f', 'gif', o.out]);
}

function mp4Args(o) {
  return []
    .concat(['-y', '-hide_banner', '-nostdin'])
    .concat(['-loop', '1', '-framerate', String(o.fps), '-i', o.png])
    .concat(['-ignore_loop', '1', '-i', o.gif])
    .concat(['-filter_complex',
      sourceGraph(o.width, o.fps, o.gap, o.background).join(';') +
      ';[stacked]format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2[out]'])
    .concat(['-map', '[out]'])
    .concat(['-c:v', 'libx264', '-preset', String(o.preset), '-crf', String(o.crf),
             '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', o.out]);
}

// ---------------------------------------------------------------------------------------------
// options
// ---------------------------------------------------------------------------------------------

var DITHERS = ['sierra2_4a', 'floyd_steinberg', 'sierra2', 'sierra3', 'bayer', 'none'];
var PRESETS = ['ultrafast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'];
var HEX = /^#?[0-9a-fA-F]{6}$/;

function normalize(body, pngDim, gifDim) {
  var o = {};
  o.format = String(body.format || 'gif').toLowerCase();
  if (o.format !== 'gif' && o.format !== 'mp4') throw new Error('format must be "gif" or "mp4".');

  o.width = Math.round(Number(body.width || pngDim.width));
  if (!isFinite(o.width) || o.width < 16 || o.width > 8000) throw new Error('width must be between 16 and 8000.');
  o.width = o.width - (o.width % 2); // even, so scale=W:-2 and libx264 both behave

  o.fps = Number(body.fps || 0);
  if (body.fps != null && body.fps !== '' && (!isFinite(o.fps) || o.fps < 1 || o.fps > 50)) throw new Error('fps must be between 1 and 50.');
  if (!o.fps) o.fps = 0; // 0 = "use the asset's own rate", filled in by the caller after probing

  o.maxColors = Math.round(Number(body.maxColors || 256));
  if (!isFinite(o.maxColors) || o.maxColors < 4 || o.maxColors > 256) throw new Error('maxColors must be between 4 and 256.');

  o.dither = String(body.dither || 'sierra2_4a');
  if (DITHERS.indexOf(o.dither) < 0) throw new Error('dither must be one of: ' + DITHERS.join(', '));
  o.bayerScale = Math.round(Number(body.bayerScale != null ? body.bayerScale : 3));
  if (!isFinite(o.bayerScale) || o.bayerScale < 0 || o.bayerScale > 5) throw new Error('bayerScale must be 0-5.');

  o.loop = Math.round(Number(body.loop != null ? body.loop : 0));
  if (!isFinite(o.loop) || o.loop < -1 || o.loop > 65535) throw new Error('loop must be -1 (none), 0 (forever) or a count.');

  o.gap = Math.round(Number(body.gap || 0));
  if (!isFinite(o.gap) || o.gap < 0 || o.gap > 1000) throw new Error('gap must be 0-1000 px.');
  if (o.gap % 2) o.gap += 1;

  var bg = String(body.background || '#ffffff');
  if (!HEX.test(bg)) throw new Error('background must be a #rrggbb hex colour.');
  o.background = '0x' + bg.replace('#', '');

  o.crf = Math.round(Number(body.crf != null ? body.crf : 18));
  if (!isFinite(o.crf) || o.crf < 0 || o.crf > 51) throw new Error('crf must be 0-51.');
  o.preset = String(body.preset || 'slow');
  if (PRESETS.indexOf(o.preset) < 0) throw new Error('preset must be one of: ' + PRESETS.join(', '));

  // Predicted output geometry, from the real input dimensions.
  var topH = even(Math.round(pngDim.height * (o.width / pngDim.width)));
  var botH = gifDim && gifDim.width ? even(Math.round(gifDim.height * (o.width / gifDim.width))) : null;
  o.predicted = { width: o.width, topHeight: topH, bottomHeight: botH, gap: o.gap, height: botH != null ? topH + o.gap + botH : null };
  if (o.predicted.height && o.width * o.predicted.height > MAX_PIXELS) {
    throw new Error('Output would be ' + o.width + ' x ' + o.predicted.height + ' (' +
      (o.width * o.predicted.height / 1e6).toFixed(1) + ' Mpx), over the ' + (MAX_PIXELS / 1e6) +
      ' Mpx limit. Pass a smaller "width".');
  }
  return o;
}
function even(n) { return n - (n % 2); }

// ---------------------------------------------------------------------------------------------
// size estimate (dryRun) — deliberately a RANGE, not a single number
//
// GIF is LZW over an 8-bit palette index per pixel. On flat vector art LZW reaches roughly
// 6-12x; on dithered photographic gradients error diffusion destroys run-length coherence and it
// drops to roughly 1.5-3x. The first frame carries the whole canvas; thanks to
// diff_mode=rectangle every later frame carries only the changed rectangle (the animated strip).
// ---------------------------------------------------------------------------------------------

function estimateGifBytes(pred, frames) {
  var firstPx = pred.width * pred.height;
  var stripPx = pred.width * (pred.bottomHeight || 0);
  var n = Math.max(1, frames || 1);
  function at(ratio) { return Math.round(firstPx / ratio + (n - 1) * stripPx / ratio + 1024); }
  return { lowBytes: at(10), highBytes: at(2), note: 'LZW 10x (flat vector art) to 2x (dithered photographic gradients). First frame is full-canvas; later frames carry only the changed rectangle.' };
}

// ---------------------------------------------------------------------------------------------
// the job
// ---------------------------------------------------------------------------------------------

function tmpdir() {
  var d = path.join(TMP_ROOT, crypto.randomBytes(9).toString('hex'));
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function rmrf(d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} }

/**
 * body: {
 *   aplusPng   base64 (optionally a data: URL) of the A+ design exported from Figma  [required]
 *   gif        base64 of the animated asset                                           [one of]
 *   driveFileId / driveFile   a Drive file id or link (needs `session`)               [one of]
 *   session    sealed Google session (only needed for the Drive path)
 *   format     "gif" (default) | "mp4"
 *   width, fps, maxColors, dither, bayerScale, loop, gap, background, crf, preset
 *   dryRun     true -> return the predicted geometry and a size RANGE, encode nothing
 *   responseType "json" (default, { base64 }) | "binary"
 * }
 */
async function compose(body, deps) {
  var t0 = Date.now();
  var tool = toolCheck();
  if (!tool.available) {
    var e = new Error('ffmpeg is not available on this host' + (tool.error ? ' (' + tool.error + ')' : '') +
      '. /api/compose needs it. Run the Docker image, or install ffmpeg and set FFMPEG_PATH.');
    e.statusCode = 503;
    throw e;
  }

  var png = decodeB64(body.aplusPng || body.png, 'aplusPng');
  var pngDim = pngSize(png);

  // --- the animated asset: either uploaded inline, or pulled from Drive ---
  var gifBuf, gifName = 'asset.gif', gifSource;
  if (body.gif || body.gifBase64) {
    gifBuf = decodeB64(body.gif || body.gifBase64, 'gif');
    gifSource = 'upload';
  } else if (body.driveFileId || body.driveFile) {
    if (!deps || !deps.downloadDriveFile) throw new Error('Drive download is not wired up on this server.');
    if (!body.session) { var e2 = new Error('Connect Google first — a Drive file id needs a session.'); e2.statusCode = 401; throw e2; }
    var dl = await deps.downloadDriveFile(body.session, body.driveFileId || body.driveFile);
    gifBuf = dl.buffer; gifName = dl.name || gifName; gifSource = 'drive:' + (dl.name || '');
  } else {
    throw new Error('Provide either "gif" (base64) or "driveFileId".');
  }
  if (gifBuf.length > MAX_INPUT_BYTES) throw new Error('The animation is ' + mb(gifBuf.length) + ', over the ' + mb(MAX_INPUT_BYTES) + ' input limit.');

  var gdim = gifSize(gifBuf);
  var opts = normalize(body, pngDim, gdim);

  var dir = tmpdir();
  try {
    var pngFile = path.join(dir, 'aplus.png');
    var gifFile = path.join(dir, 'asset' + (path.extname(gifName) || '.gif'));
    fs.writeFileSync(pngFile, png);
    fs.writeFileSync(gifFile, gifBuf);

    var anim = await probeAnimation(gifFile);
    if (!anim.width || !anim.height) throw new Error('"' + gifName + '" has no readable video stream — is it really an animated image?');
    if (anim.frames === 1) throw new Error('"' + gifName + '" has only one frame — there is nothing to animate.');

    // Re-derive the geometry now that we have ffprobe's real dimensions (the GIF header's
    // logical screen size can differ from the stream's).
    opts = normalize(body, pngDim, { width: anim.width, height: anim.height });
    if (!opts.fps) opts.fps = clamp(Math.round(anim.fps || 12), 1, 30);
    var outFrames = anim.duration ? Math.max(1, Math.round(anim.duration * opts.fps)) : (anim.frames || 1);

    var estimate = estimateGifBytes(opts.predicted, outFrames);
    var report = {
      source: { aplusPng: { width: pngDim.width, height: pngDim.height, bytes: png.length },
                animation: { name: gifName, width: anim.width, height: anim.height, frames: anim.frames, fps: anim.fps, durationSec: anim.duration, bytes: gifBuf.length, from: gifSource } },
      output: { format: opts.format, width: opts.predicted.width, height: opts.predicted.height,
                topHeight: opts.predicted.topHeight, gap: opts.gap, bottomHeight: opts.predicted.bottomHeight,
                fps: opts.fps, frames: outFrames, megapixelsPerFrame: Math.round(opts.predicted.width * opts.predicted.height / 1e4) / 100 },
      settings: { maxColors: opts.maxColors, dither: opts.dither, bayerScale: opts.bayerScale, loop: opts.loop, crf: opts.crf, preset: opts.preset },
      amazon: amazonVerdict(opts.format)
    };

    if (body.dryRun) {
      report.estimate = opts.format === 'gif'
        ? { lowBytes: estimate.lowBytes, highBytes: estimate.highBytes, low: mb(estimate.lowBytes), high: mb(estimate.highBytes), note: estimate.note }
        : { note: 'MP4 size depends on crf; at crf ' + opts.crf + ' expect roughly 0.5-3 MB for a short loop at this resolution.' };
      report.ok = true;
      report.dryRun = true;
      report.ffmpeg = { palettegen: null, paletteuse: null };
      if (opts.format === 'gif') {
        var pv = Object.assign({}, opts, { png: pngFile, gif: gifFile, palette: path.join(dir, 'palette.png'), out: path.join(dir, 'out.gif') });
        report.ffmpeg = { palettegen: cmdline(FFMPEG, paletteGenArgs(pv)), paletteuse: cmdline(FFMPEG, paletteUseArgs(pv)) };
      } else {
        report.ffmpeg = { encode: cmdline(FFMPEG, mp4Args(Object.assign({}, opts, { png: pngFile, gif: gifFile, out: path.join(dir, 'out.mp4') }))) };
      }
      report.ms = Date.now() - t0;
      return report;
    }

    var outFile, cmds = {};
    if (opts.format === 'mp4') {
      if (!tool.encoders.libx264) throw new Error('This ffmpeg build has no libx264 encoder, so format "mp4" is unavailable.');
      outFile = path.join(dir, 'composite.mp4');
      var a = mp4Args(Object.assign({}, opts, { png: pngFile, gif: gifFile, out: outFile }));
      cmds.encode = cmdline(FFMPEG, a);
      await run(FFMPEG, a);
    } else {
      var paletteFile = path.join(dir, 'palette.png');
      outFile = path.join(dir, 'composite.gif');
      var shared = Object.assign({}, opts, { png: pngFile, gif: gifFile, palette: paletteFile, out: outFile });
      var a1 = paletteGenArgs(shared), a2 = paletteUseArgs(shared);
      cmds.palettegen = cmdline(FFMPEG, a1);
      cmds.paletteuse = cmdline(FFMPEG, a2);
      await run(FFMPEG, a1);                      // pass 1 — build the 256-colour palette
      if (!fs.existsSync(paletteFile)) throw new Error('palettegen produced no palette.');
      await run(FFMPEG, a2);                      // pass 2 — encode against it
    }

    if (!fs.existsSync(outFile)) throw new Error('ffmpeg produced no output file.');
    var out = fs.readFileSync(outFile);

    report.ok = true;
    report.ffmpeg = cmds;
    report.bytes = out.length;
    report.size = mb(out.length);
    report.estimateWas = opts.format === 'gif' ? { low: mb(estimate.lowBytes), high: mb(estimate.highBytes) } : undefined;
    report.ms = Date.now() - t0;
    report.mimeType = opts.format === 'gif' ? 'image/gif' : 'video/mp4';
    report.filename = 'aplus-composite.' + opts.format;
    report.amazon = amazonVerdict(opts.format, out.length);
    report.buffer = out; // the route turns this into base64 or a binary body
    return report;
  } finally {
    rmrf(dir);
  }
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

// Quote arguments so the returned command line is actually paste-able into a shell.
function cmdline(bin, args) {
  return [bin].concat(args.map(function (a) {
    a = String(a);
    return /^[A-Za-z0-9_\-.,:\/=+@]+$/.test(a) ? a : "'" + a.replace(/'/g, "'\\''") + "'";
  })).join(' ');
}

// The honest verdict, returned with every response so a UI cannot avoid showing it.
function amazonVerdict(format, bytes) {
  if (format === 'gif') {
    return {
      acceptedByAmazonAPlus: false,
      reason: 'Amazon A+ Content guidelines: "The use of animated images (for example, GIF) is prohibited." Accepted image formats are JPG and PNG, max 2 MB. This is a format rule, not a size rule — shrinking the file does not make it acceptable.',
      useInstead: 'Upload the A+ as a static PNG/JPG image module, and put the motion in a Premium A+ video module (.mp4, min 960x540, max 200 MB, max 180 s). This endpoint can produce that MP4 with format:"mp4".',
      source: 'https://kdp.amazon.com/en_US/help/topic/G4WB7VPPEAREHAAD'
    };
  }
  return {
    acceptedByAmazonAPlus: 'video-module-only',
    reason: 'MP4 is accepted by the Premium A+ VIDEO module (min 960x540, max 200 MB, max 180 s) — not by an image module. It is a separate module from the A+ image, so the stacked composite is for off-Amazon use; on Amazon, ship the A+ image and the video as two modules.',
    withinVideoLimits: bytes == null ? null : bytes <= 200 * 1024 * 1024,
    source: 'https://kdp.amazon.com/en_US/help/topic/G4WB7VPPEAREHAAD'
  };
}

module.exports = {
  compose: compose,
  toolCheck: toolCheck,
  resetToolCheck: resetToolCheck,
  pngSize: pngSize,
  gifSize: gifSize,
  decodeB64: decodeB64,
  normalize: normalize,
  estimateGifBytes: estimateGifBytes,
  paletteGenArgs: paletteGenArgs,
  paletteUseArgs: paletteUseArgs,
  mp4Args: mp4Args,
  cmdline: cmdline,
  amazonVerdict: amazonVerdict,
  MAX_INPUT_BYTES: MAX_INPUT_BYTES
};
