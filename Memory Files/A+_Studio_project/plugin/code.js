// ===== A+ Studio · manifest-driven renderer (aplus-standard-v1) =====
// Builds one A+ design from a TEMPLATE MANIFEST (served by the backend) and one sheet row.
// The design lives in the manifest; this file just interprets it. Text stays editable
// because every text box is rebuilt as a real Figma text node (never flattened to SVG).
var W_DEFAULT = 1572;
var GRADIENT_TRANSFORMS = {
  LR: [[1, 0, 0], [0, 1, 0]],
  RL: [[-1, 0, 1], [0, 1, 0]],
  TB: [[0, 1, 0], [-1, 0, 1]]
};

// ---------- colour + paint helpers ----------
function rgb255(a) { return { r: a[0] / 255, g: a[1] / 255, b: a[2] / 255 }; }
function col(M, v) { // v = palette role name OR [r,g,b]
  if (Array.isArray(v)) return rgb255(v);
  var p = M.palette && M.palette[v];
  return p ? rgb255(p) : { r: 0, g: 0, b: 0 };
}
function solid(c, opacity) { var p = { type: 'SOLID', color: c }; if (opacity !== undefined) p.opacity = opacity; return p; }
function grad(M, g) {
  var t = GRADIENT_TRANSFORMS[g.transform] || GRADIENT_TRANSFORMS.TB;
  return { type: 'GRADIENT_LINEAR', gradientTransform: t,
    gradientStops: g.stops.map(function (s) { var c = rgb255(s[1]); return { position: s[0], color: { r: c.r, g: c.g, b: c.b, a: s[2] } }; }) };
}
// A paint spec straight out of Figma, so a template can carry exactly what the real design has:
//   { solid: role|[r,g,b], opacity }
//   { stops: [[pos,[r,g,b],a], …], gt: [[..],[..]] | transform: 'TB'|'LR'|'RL', radial: true, opacity }
//   { image: '<imageHash>', scale: 'FILL', opacity }
// `gt` is a raw Figma gradientTransform matrix — that is what lets arbitrary gradient angles
// (the rotated washes on the Running A+) survive into the template instead of being flattened
// to one of three directions.
function paintOf(M, p) {
  if (!p) return null;
  if (p.solid !== undefined) return solid(col(M, p.solid), p.opacity);
  if (p.image) {
    // Carry the WHOLE image paint, not just the hash. Figma renders the same bitmap very
    // differently depending on scalingFactor (the Running halftone is drawn at 0.5, so its dots
    // are twice as fine) and filters (exposure -1 darkens it). Dropping these was why the
    // texture came out as "something different".
    var ip = { type: 'IMAGE', imageHash: p.image, scaleMode: p.scale || 'FILL',
      opacity: p.opacity === undefined ? 1 : p.opacity };
    if (p.scalingFactor !== undefined) ip.scalingFactor = p.scalingFactor;
    if (p.rotation !== undefined) ip.rotation = p.rotation;
    if (p.imageTransform) ip.imageTransform = p.imageTransform;
    if (p.blend) ip.blendMode = p.blend;
    if (p.filters) {
      ip.filters = { exposure: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0 };
      Object.keys(p.filters).forEach(function (k) { ip.filters[k] = p.filters[k]; });
    }
    return ip;
  }
  if (p.stops) {
    var paint = {
      type: p.radial ? 'GRADIENT_RADIAL' : 'GRADIENT_LINEAR',
      gradientTransform: p.gt || GRADIENT_TRANSFORMS[p.transform] || GRADIENT_TRANSFORMS.TB,
      gradientStops: p.stops.map(function (s) { var c = rgb255(s[1]); return { position: s[0], color: { r: c.r, g: c.g, b: c.b, a: s[2] } }; })
    };
    if (p.opacity !== undefined) paint.opacity = p.opacity;
    return paint;
  }
  return null;
}
function paintsOf(M, arr) {
  return (arr || []).map(function (p) { return paintOf(M, p); }).filter(Boolean);
}
// One decorative shape from a manifest layer spec.
// Image fills are dropped (with a warning) when that image is not in this Figma file —
// an imageHash only resolves inside the document that holds the bytes.
function shape(M, parent, L, warn) {
  var n = L.shape === 'ellipse' ? figma.createEllipse() : figma.createRectangle();
  n.resize(Math.max(L.w, 0.01), Math.max(L.h, 0.01));
  var fills = paintsOf(M, L.fills).filter(function (f) {
    if (f.type !== 'IMAGE') return true;
    var ok = false;
    try { ok = !!figma.getImageByHash(f.imageHash); } catch (e) {}
    if (!ok && warn) warn.push('Graphic "' + (L.name || 'texture') + '" is not in this Figma file — skipped');
    return ok;
  });
  n.fills = fills;
  if (L.strokes) { n.strokes = paintsOf(M, L.strokes); if (L.strokeWeight) n.strokeWeight = L.strokeWeight; }
  parent.appendChild(n);
  // `rt` is a full Figma relativeTransform. It is used instead of x/y/rotation because several
  // of the Running washes are FLIPPED as well as rotated (their matrix has a negative
  // determinant) — a rotation angle alone reproduces those mirrored, in the wrong corner.
  if (L.rt) {
    var m = [[L.rt[0][0], L.rt[0][1], L.rt[0][2]], [L.rt[1][0], L.rt[1][1], L.rt[1][2]]];
    if (L.yFromBottom !== undefined) m[1][2] = L.frameH - L.yFromBottom;
    n.relativeTransform = m;
  } else {
    n.x = L.x; n.y = L.y;
    if (L.rotation) n.rotation = L.rotation;
  }
  if (L.opacity !== undefined) n.opacity = L.opacity;
  if (L.radius) n.cornerRadius = L.radius;
  if (L.blur) setBlur(n, L.blur);
  if (L.visible === false) n.visible = false;   // some layers are switched off in the original
  if (L.name) n.name = L.name;
  return n;
}
// Draws an ordered stack of layers. An entry with a `role` is a hole in the stack where the
// renderer drops live content (the hero word, the model slot, the fabric close-up …), which is
// what keeps z-order in the manifest instead of hardcoded in this file.
// `yFromBottom` anchors a layer to the bottom edge and `hToFramePlus` stretches it to the frame,
// so both survive a 3-callout design and the taller fit-comparison one.
function drawLayers(M, parent, layers, roles, H, warn) {
  (layers || []).forEach(function (L) {
    if (L.role) { if (roles && roles[L.role]) roles[L.role](); return; }
    var y = L.yFromBottom !== undefined ? (H - L.yFromBottom) : L.y;
    var h = L.hToFramePlus !== undefined ? (H - y + L.hToFramePlus) : L.h;
    shape(M, parent, {
      shape: L.shape, x: L.x, y: y, w: L.w, h: h, rotation: L.rotation, opacity: L.opacity,
      radius: L.radius, blur: L.blur, name: L.name, rt: L.rt, yFromBottom: L.yFromBottom, frameH: H,
      visible: L.visible,
      fills: L.fills, strokes: L.strokes, strokeWeight: L.strokeWeight
    }, warn);
  });
}

function parseBold(s) {
  var plain = '', ranges = [];
  String(s || '').split('**').forEach(function (p, i) {
    if (i % 2 === 1 && p) ranges.push([plain.length, plain.length + p.length]);
    plain += p;
  });
  return { plain: plain, ranges: ranges };
}
function setBlur(node, radius) {
  try { node.effects = [{ type: 'LAYER_BLUR', radius: radius, visible: true }]; }
  catch (e) { try { node.effects = [{ type: 'LAYER_BLUR', blurType: 'NORMAL', radius: radius, visible: true }]; } catch (e2) {} }
}

// ---------- fonts ----------
async function loadFontsFromManifest(M) {
  var avail = await figma.listAvailableFontsAsync();
  function pick(family, style) {
    var re = new RegExp('^' + String(style).replace(/\s+/g, ' ?') + '$', 'i');
    var f = avail.find(function (a) { return a.fontName.family === family && re.test(a.fontName.style); });
    return f ? f.fontName : null;
  }
  var F = {}, missing = [];
  Object.keys(M.fonts).forEach(function (role) {
    var spec = M.fonts[role];
    var got = pick(spec.family, spec.style);
    if (!got) { missing.push(role + ' (' + spec.family + ' ' + spec.style + ')'); got = spec.fallback === 'bold' ? { family: 'Inter', style: 'Bold' } : { family: 'Inter', style: 'Regular' }; }
    F[role] = got;
  });
  var seen = {}, all = [];
  Object.keys(F).forEach(function (k) { var key = F[k].family + '|' + F[k].style; if (!seen[key]) { seen[key] = 1; all.push(F[k]); } });
  for (var i = 0; i < all.length; i++) await figma.loadFontAsync(all[i]);
  return { F: F, missing: missing };
}

// ---------- node helpers ----------
function txt(M, F, parent, o) {
  var t = figma.createText();
  t.fontName = F[o.font];
  var pb = parseBold(o.text);
  t.characters = pb.plain || ' ';
  t.fontSize = o.size;
  if (o.lhPct) t.lineHeight = { unit: 'PERCENT', value: o.lhPct };
  else if (o.lh) t.lineHeight = { unit: 'PIXELS', value: o.lh };
  if (o.ls !== undefined) t.letterSpacing = { unit: 'PIXELS', value: o.ls };
  if (o.upper) t.textCase = 'UPPER';
  t.textAlignHorizontal = o.align || 'LEFT';
  t.fills = o.fills || [solid(o.color || col(M, o.colorRole || 'ink'))];
  if (o.bold && F.bold) pb.ranges.forEach(function (r) { t.setRangeFontName(r[0], r[1], F.bold); });
  parent.appendChild(t);
  if (o.width) { t.resize(o.width, 100); t.textAutoResize = 'HEIGHT'; } else { t.textAutoResize = 'WIDTH_AND_HEIGHT'; }
  if (o.opacity !== undefined) t.opacity = o.opacity;
  if (o.name) t.name = o.name;
  t.x = o.x || 0; t.y = o.y || 0;
  return t;
}
function rect(parent, o) {
  var r = figma.createRectangle(); r.resize(o.w, o.h); r.fills = o.fills || [];
  parent.appendChild(r); r.x = o.x || 0; r.y = o.y || 0;
  if (o.radius) r.cornerRadius = o.radius;
  if (o.opacity !== undefined) r.opacity = o.opacity;
  if (o.rotation) r.rotation = o.rotation;
  if (o.name) r.name = o.name;
  return r;
}
function oval(parent, o) {
  var e = figma.createEllipse(); e.resize(o.w, o.h); e.fills = o.fills || [];
  parent.appendChild(e); e.x = o.x; e.y = o.y;
  if (o.opacity !== undefined) e.opacity = o.opacity;
  if (o.blur) setBlur(e, o.blur);
  if (o.name) e.name = o.name;
  return e;
}
function box(parent, o) {
  var f = figma.createFrame(); f.resize(o.w, o.h); f.fills = o.fills || []; f.clipsContent = !!o.clip;
  parent.appendChild(f); f.x = o.x || 0; f.y = o.y || 0;
  if (o.radius) f.cornerRadius = o.radius;
  if (o.opacity !== undefined) f.opacity = o.opacity;
  if (o.name) f.name = o.name;
  return f;
}
function stack(parent, dir, o) {
  var f = figma.createFrame(); f.fills = []; f.clipsContent = false;
  f.layoutMode = dir;
  if (o.fixedCross) f.resize(dir === 'VERTICAL' ? o.fixedCross : 100, dir === 'VERTICAL' ? 100 : o.fixedCross);
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = o.fixedCross ? 'FIXED' : 'AUTO';
  f.itemSpacing = o.gap || 0;
  f.counterAxisAlignItems = o.cross || 'MIN';
  parent.appendChild(f);
  if (o.name) f.name = o.name;
  return f;
}
// A clean photo placeholder.
// Circle slots are built as a REAL Figma mask group (Ellipse isMask + Photo rect + dashed ring + label),
// exactly like the 706524 template, so a dropped photo clips to the circle. Rectangular slots
// (hero model, fabric background) stay as a clipping frame.
function photoSlot(M, F, parent, o) {
  if (o.circle) {
    var mask = figma.createEllipse(); mask.resize(o.w, o.h); mask.fills = [solid(col(M, 'slotFill'))]; mask.isMask = true; mask.name = 'mask';
    parent.appendChild(mask); mask.x = o.x; mask.y = o.y;
    var photo = figma.createRectangle(); photo.resize(o.w, o.h); photo.fills = [solid(col(M, 'slotFill'))]; photo.name = 'Photo';
    parent.appendChild(photo); photo.x = o.x; photo.y = o.y;
    var tc = txt(M, F, parent, { text: '+ ' + o.label, font: 'medium', size: o.labelSize || 34, color: col(M, 'slotLabel'),
      align: 'CENTER', width: Math.min(o.w * 0.8, 620), name: 'placeholder label · delete after placing photo' });
    tc.x = o.x + (o.w - tc.width) / 2; tc.y = o.y + (o.h - tc.height) / 2;
    var g = figma.group([mask, photo, tc], parent); g.name = 'Mask group · ' + o.label;
    if (o.opacity !== undefined) g.opacity = o.opacity;
    return g;
  }
  var f = box(parent, { x: o.x, y: o.y, w: o.w, h: o.h, clip: true, name: 'PHOTO · ' + o.label,
    fills: [solid(col(M, 'slotFill'), o.fillOpacity === undefined ? 1 : o.fillOpacity)],
    radius: 0, opacity: o.opacity });
  var t = txt(M, F, f, { text: '+ ' + o.label, font: 'medium', size: o.labelSize || 34, color: col(M, 'slotLabel'), align: 'CENTER',
    width: Math.min(o.w * 0.8, 620), name: 'placeholder label · delete after placing photo' });
  if (o.labelCorner) { t.textAlignHorizontal = 'LEFT'; t.x = 40; t.y = 40; }
  else { t.x = (o.w - t.width) / 2; t.y = (o.h - t.height) / 2; }
  return f;
}

// ---------- icons: reuse icon groups already on this page ----------
function buildIconIndex() {
  var idx = {};
  var texts = figma.currentPage.findAllWithCriteria({ types: ['TEXT'] });
  for (var i = 0; i < texts.length; i++) {
    var t = texts[i], p = t.parent;
    if (!p || p.type === 'PAGE' || !('children' in p) || !p.visible) continue;
    var label = t.characters.trim(), key = label.toLowerCase();
    if (!label || label.length > 30 || idx[key]) continue;
    var kids = p.children;
    if (kids.length > 5 || kids.length < 3) continue;
    var hasRing = kids.some(function (k) { return k.type === 'ELLIPSE'; });
    var hasArt = kids.some(function (k) { return k !== t && k.type !== 'TEXT' && k.type !== 'ELLIPSE'; });
    if (hasRing && hasArt) idx[key] = p;
  }
  return idx;
}
function missingIcon(M, F, parent, label) {
  var g = stack(parent, 'VERTICAL', { gap: 6, cross: 'CENTER', name: 'ICON NOT FOUND · ' + label });
  var e = figma.createEllipse(); e.resize(150.86, 150.86); e.fills = []; e.strokes = [solid(col(M, 'white'))]; e.strokeWeight = 3; e.dashPattern = [10, 8];
  g.appendChild(e);
  txt(M, F, g, { text: label, font: 'regular', size: 40.23, colorRole: 'white', align: 'CENTER' });
  return g;
}

// ---------- sheet row -> content (driven by manifest.content) ----------
function rowFromManifest(M, cells) {
  var C = M.content;
  function lines(v) { return String(v || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean); }
  function cell(i) { return i === undefined ? '' : String(cells[i] === undefined || cells[i] === null ? '' : cells[i]).trim(); }
  var ids = String(cells[C.styleIdColumn] || '').match(/\d{6}/g) || [];

  // ---- hero ----
  // Live sheet: one "First Card Headline" cell holding "RUN UNSTOPPABLE" plus a separate
  // subtext cell. Older sheets: one cell with three lines. Both are supported.
  var hero;
  if (C.headlineColumn !== undefined) {
    var words = cell(C.headlineColumn).split(/\s+/).filter(Boolean);
    hero = [words.shift() || '', words.join(' '), cell(C.taglineColumn)];
  } else {
    hero = lines(cells[C.heroColumn]);
  }

  // ---- fabric ----
  // Live sheet keeps copy / composition / icons in three columns. Older sheets packed them
  // into one cell and found the composition by looking for a "%".
  var fab;
  if (C.fabricCopyColumn !== undefined) {
    fab = { copy: lines(cells[C.fabricCopyColumn]).join(' '), comp: cell(C.compositionColumn), icons: cell(C.iconsColumn) };
  } else {
    var fl = lines(cells[C.fabricColumn]);
    var marker = (C.fabric && C.fabric.compositionMarker) || '%';
    var ci = fl.findIndex(function (l) { return l.indexOf(marker) >= 0; });
    fab = ci >= 0
      ? { copy: fl.slice(0, ci).join(' '), comp: fl[ci], icons: (fl[ci + 1] || '') }
      : { copy: fl[0] || '', comp: fl[1] || '', icons: fl[2] || '' };
  }
  // "92% Polyester 8% Elastane" -> "92% Polyester | 8% Elastane", the way the designs set it
  if (C.compositionSeparator) {
    fab.comp = fab.comp.replace(/(\S)\s+(?=\d+(\.\d+)?%)/g, '$1' + C.compositionSeparator);
  }
  fab.icons = fab.icons.split(',').map(function (s) { return s.trim(); }).filter(Boolean);

  // ---- callout cards ----
  // Live sheet writes a feature as "TITLE: body" on one line; older sheets put the title on
  // its own line. Split on the separator when it appears before any line break.
  var sep = C.cardTitleSeparator;
  var cards = [];
  C.cardColumns.forEach(function (colIdx) {
    var raw = String(cells[colIdx] === undefined || cells[colIdx] === null ? '' : cells[colIdx]).trim();
    if (!raw) return;
    var l = lines(raw);
    if (sep) {
      var at = l[0].indexOf(sep);
      if (at > 0) {
        cards.push({ title: l[0].slice(0, at).trim(), copy: (l[0].slice(at + sep.length) + ' ' + l.slice(1).join(' ')).trim() });
        return;
      }
    }
    cards.push({ title: l[0], copy: l.slice(1).join(' ') });
  });
  // Fit comparison (optional): one line per side, e.g. "Regular fit" / "Slim fit".
  // Blank in the sheet is normal — the template's defaults are used instead.
  var cmpDefaults = (C.comparison && C.comparison.defaults) || ['Regular fit', 'Slim fit'];
  var cl = C.comparisonColumn === undefined ? [] : lines(cells[C.comparisonColumn]);
  var cmp = { labels: [cl[0] || cmpDefaults[0], cl[1] || cmpDefaults[1]], fromSheet: cl.length > 0 };
  var hd = C.heroDefaults || ['', '', ''];
  return { ids: ids, hero: [hero[0] || hd[0], hero[1] || hd[1], hero[2] || hd[2]], fab: fab, cards: cards, cmp: cmp };
}

// ---------- the fit comparison card (Regular fit vs Slim fit) ----------
// Lives at the bottom of the A+, below the callouts. Two labelled photo slots with the
// alignment guides the designers draw by hand, so the two fits can be read against each other.
// Returns the group, or null when the manifest has it switched off.
function buildComparison(M, F, parent, labels, topY) {
  var cp = M.comparison;
  if (!cp || !cp.enabled) return null;
  var g = box(parent, { x: cp.x, y: topY, w: cp.w, h: cp.h, name: cp.name });
  var ph = cp.photo, lb = cp.label;
  for (var i = 0; i < 2; i++) {
    txt(M, F, g, { text: labels[i], font: lb.font, size: lb.size, lh: lb.lh, upper: lb.upper,
      colorRole: lb.colorRole, align: 'CENTER', width: lb.w, x: lb.xs[i], y: lb.y || 0,
      name: 'Fit label ' + (i + 1) });
    photoSlot(M, F, g, { x: ph.xs[i], y: ph.y, w: ph.w, h: ph.h, label: labels[i] + ' photo', labelSize: 30 });
  }
  // alignment rules, drawn as thin rects: one vertical per fit and two horizontal rows,
  // each row made of two offset spans — the same construction the designers draw by hand
  var gd = cp.guides;
  if (gd) {
    var gc = [solid(col(M, gd.colorRole), gd.opacity)];
    (gd.vertical || []).forEach(function (v, k) {
      rect(g, { x: v.x, y: v.y, w: gd.thickness, h: v.h, fills: gc, name: 'Guide · vertical ' + (k + 1) });
    });
    (gd.horizontal || []).forEach(function (hz, k) {
      rect(g, { x: hz.x, y: hz.y, w: hz.w, h: gd.thickness, fills: gc, name: 'Guide · horizontal ' + (k + 1) });
    });
  }
  return g;
}

// Adds the fit comparison card to a frame that was already built (or drawn by hand).
// This is the manual escape hatch: the content sheet often does not carry the fit detail,
// so the designer selects the frame and adds the card here instead of rebuilding the A+.
// The frame grows, and the background gradient and the trailing export slice grow with it.
function addComparisonToFrame(M, F, fr, labels) {
  var cp = M.comparison;
  if (!cp) throw new Error('This template has no fit comparison block.');
  if (fr.findChild(function (n) { return n.name === cp.name; })) {
    throw new Error('"' + fr.name + '" already has a fit comparison card.');
  }
  var bottomPad = M.frame.bottomPad === undefined ? 108.76 : M.frame.bottomPad;
  var W = fr.width;
  var top = fr.height - bottomPad + cp.gap;
  var H = Math.round(top + cp.h + bottomPad);
  fr.resize(W, H);

  // stretch the layers that are pinned to the frame, and re-drop the ones pinned to its bottom
  (M.background.layers || []).forEach(function (L) {
    var node = fr.findChild(function (n) { return n.name === L.name; });
    if (!node) return;
    if (L.hToFramePlus !== undefined) node.resize(L.w, H - L.y + L.hToFramePlus);
    if (L.yFromBottom === undefined) return;
    if (L.rt) {
      // rewrite only the translation, so a rotated-and-flipped layer keeps its matrix
      var t = node.relativeTransform;
      node.relativeTransform = [[t[0][0], t[0][1], t[0][2]], [t[1][0], t[1][1], H - L.yFromBottom]];
    } else {
      node.y = H - L.yFromBottom;
    }
  });
  M.slices.forEach(function (s) {
    if (!s.hToEnd) return;
    var sl = fr.findChild(function (n) { return n.type === 'SLICE' && n.name === s.name; });
    if (sl) sl.resize(W, H - s.y);
  });

  var was = cp.enabled;
  cp.enabled = true;
  try { return buildComparison(M, F, fr, labels, top); }
  finally { cp.enabled = was; }
}

// ---------- the A+ ----------
async function buildFromManifest(M, row, opts) {
  var F = opts.F, icons = opts.icons, warn = [];
  var W = M.meta.width || W_DEFAULT;
  var n = row.cards.length;
  var cmin = M.content.callouts.min, cmax = M.content.callouts.max;
  if (n < cmin || n > cmax) throw new Error('Needs ' + cmin + '–' + cmax + ' callout cards (found ' + n + ')');

  var cf = M.callouts.frame;
  var calloutH = n === 4 ? cf.h4 : cf.h3;
  var bottomPad = M.frame.bottomPad === undefined ? 108.76 : M.frame.bottomPad;
  // the fit comparison card, when the template has it on, adds its own height below the callouts
  var cmpOn = !!(M.comparison && M.comparison.enabled);
  var cmpTop = cf.y + calloutH + (cmpOn ? M.comparison.gap : 0);
  var H = Math.round(cmpTop + (cmpOn ? M.comparison.h : 0) + bottomPad);

  var fr = figma.createFrame();
  fr.name = row.ids.length ? row.ids.join(', ') : (M.meta.categoryLabel + ' A+ (no style ID)');
  fr.resize(W, H); fr.fills = [solid(col(M, M.frame.fillRole || 'white'))]; fr.clipsContent = !!M.frame.clip;
  figma.currentPage.appendChild(fr); fr.x = opts.x; fr.y = opts.y;

  // ---- background washes and glows ----
  drawLayers(M, fr, M.background.layers, null, H, warn);

  // ---- Card 1 · Hero ----
  // Layer order (washes, texture, words, model slot, tagline) comes from hero.layers so the
  // stacking can be corrected in the manifest without touching this file.
  var hm = M.hero;
  var hero = box(fr, { x: hm.x, y: hm.y, w: hm.w, h: hm.h, clip: true, name: hm.name, fills: [solid(col(M, hm.fill))] });
  drawLayers(M, hero, hm.layers, {
    bgPhoto: function () {
      var bp = hm.bgPhoto;
      if (!bp) return;
      photoSlot(M, F, hero, { x: bp.x, y: bp.y, w: bp.w, h: bp.h, label: bp.label,
        fillOpacity: bp.fillOpacity, labelCorner: bp.labelCorner });
    },
    word: function () {
      var wd = hm.word;
      var word = txt(M, F, hero, { text: row.hero[0], font: wd.font, size: wd.size, lhPct: wd.lhPct, ls: wd.ls, upper: wd.upper,
        align: wd.align, opacity: wd.opacity, name: wd.name, fills: paintsOf(M, wd.fills) });
      if (word.width > wd.maxWidth) word.fontSize = word.fontSize * wd.maxWidth / word.width;
      word.x = (hm.w - word.width) / 2; word.y = wd.y;
    },
    italic: function () {
      var im = hm.italic;
      var it = txt(M, F, hero, { text: row.hero[1], font: im.font, size: im.size, lhPct: im.lhPct, ls: im.ls, upper: im.upper,
        align: im.align, colorRole: im.colorRole, opacity: im.opacity, name: im.name });
      if (it.width > im.maxWidth) it.fontSize = it.fontSize * im.maxWidth / it.width;
      it.x = (hm.w - it.width) / 2; it.y = im.y; if (im.blur) setBlur(it, im.blur);
    },
    model: function () {
      var md = hm.model;
      photoSlot(M, F, hero, { x: md.x, y: md.y, w: md.w, h: md.h, label: md.label, fillOpacity: md.fillOpacity });
    },
    tagline: function () {
      var tg = hm.tagline;
      txt(M, F, hero, { text: row.hero[2], font: tg.font, size: tg.size, upper: tg.upper, ls: tg.ls, colorRole: tg.colorRole,
        align: tg.align, width: tg.width, x: tg.x, y: tg.y, name: tg.name });
    }
  }, H, warn);

  // ---- Card 2 · Fabric in Focus ----
  var fb = M.fabric;
  var sec = box(fr, { x: fb.box.x, y: fb.box.y, w: fb.box.w, h: fb.box.h, clip: true, radius: fb.box.radius, name: fb.box.name,
    fills: [solid(col(M, fb.box.fillRole))] });
  drawLayers(M, sec, fb.layers, {
    bgPhoto: function () {
      photoSlot(M, F, sec, { x: fb.bgPhoto.x, y: fb.bgPhoto.y, w: fb.bgPhoto.w, h: fb.bgPhoto.h, label: fb.bgPhoto.label,
        opacity: fb.bgPhoto.opacity, labelCorner: fb.bgPhoto.labelCorner });
    },
    closeup: function () {
      photoSlot(M, F, sec, { x: fb.closeup.x, y: fb.closeup.y, w: fb.closeup.w, h: fb.closeup.h, circle: fb.closeup.circle,
        label: fb.closeup.label, labelSize: fb.closeup.labelSize });
    },
    // the women's layouts draw a thin white ring around the close-up; the men's do not
    ring: function () {
      var r = fb.ring;
      if (!r) return;
      var e = figma.createEllipse();
      e.resize(r.w, r.h);
      e.fills = [];
      e.strokes = [solid(col(M, r.strokeRole || 'white'), r.strokeOpacity)];
      e.strokeWeight = r.strokeWeight || 2;
      sec.appendChild(e);
      e.x = r.x; e.y = r.y; e.name = r.name;
    }
  }, H, warn);

  var ts = fb.textStack;
  var cols = stack(fr, 'VERTICAL', { gap: ts.gap, cross: ts.cross, name: ts.name });
  txt(M, F, cols, { text: ts.heading.text, font: ts.heading.font, size: ts.heading.size, upper: ts.heading.upper, colorRole: ts.heading.colorRole, align: 'CENTER', name: 'Heading' });
  txt(M, F, cols, { text: row.fab.copy, font: ts.copy.font, size: ts.copy.size, colorRole: ts.copy.colorRole, align: 'CENTER', width: ts.copy.width, bold: ts.copy.bold, name: 'Fabric copy' });
  rect(cols, { w: ts.divider.w, h: ts.divider.h, name: ts.divider.name,
    fills: ts.divider.fills ? paintsOf(M, ts.divider.fills) : [solid(col(M, ts.divider.colorRole), ts.divider.opacity)] });
  txt(M, F, cols, { text: row.fab.comp, font: ts.composition.font, size: ts.composition.size, colorRole: ts.composition.colorRole, align: 'CENTER', name: 'Composition' });
  var iconRow = stack(cols, 'HORIZONTAL', { gap: ts.iconRow.gap, cross: ts.iconRow.cross, name: ts.iconRow.name });
  row.fab.icons.slice(0, ts.iconRow.max).forEach(function (label) {
    var src = icons[label.toLowerCase()];
    if (src) iconRow.appendChild(src.clone());
    else { missingIcon(M, F, iconRow, label); warn.push('Icon "' + label + '" not found on this page'); }
  });
  if (!row.fab.icons.length) warn.push('No icons listed');
  cols.x = (W - cols.width) / 2; cols.y = ts.y;
  if (cols.y + cols.height > fb.overflowWarnY) warn.push('Fabric copy is long and runs past the fabric card');

  // ---- Cards 3-6 · Callouts (each card = bar + photo + text, grouped together) ----
  var co = M.callouts;
  var cfBox = box(fr, { x: cf.x, y: cf.y, w: cf.w, h: calloutH, name: cf.name });
  row.cards.forEach(function (c, i) {
    var L = co.cards[i];
    var bar = rect(cfBox, { x: L.bar.x, y: L.bar.y, w: L.bar.w, h: co.barHeight, name: co.bar.name,
      fills: [grad(M, { transform: L.bar.flip ? 'RL' : 'LR', stops: co.bar.gradientStops })] });
    var ph = photoSlot(M, F, cfBox, { x: L.photo.x, y: L.photo.y, w: L.photo.d, h: L.photo.d, circle: true, label: 'Card ' + (i + 3) + ' photo' });
    var blk = stack(cfBox, 'VERTICAL', { gap: co.textGap, fixedCross: L.text.w, cross: L.text.align === 'RIGHT' ? 'MAX' : 'MIN', name: 'Text' });
    var tt = txt(M, F, blk, { text: c.title, font: co.title.font, size: co.title.size, lh: co.title.lh, upper: co.title.upper, colorRole: co.title.colorRole, align: L.text.align, width: L.text.w, name: 'Title' });
    txt(M, F, blk, { text: c.copy, font: co.copy.font, size: co.copy.size, lh: co.copy.lh, colorRole: co.copy.colorRole, align: L.text.align, width: L.text.copyW, bold: co.copy.bold, name: 'Copy' });
    blk.x = L.text.left !== undefined ? L.text.left : L.text.right - L.text.w;
    blk.y = L.bar.y + co.barHeight / 2 - blk.height / 2;
    var g = figma.group([bar, ph, blk], cfBox); g.name = 'Card ' + (i + 3);
    if (tt.height > M.warnings.titleTallPx) warn.push('Card ' + (i + 3) + ' title runs to 3+ lines');
    if (blk.height > M.warnings.textTallerThanBarPx) warn.push('Card ' + (i + 3) + ' text is taller than its bar');
    if (!c.copy) warn.push('Card ' + (i + 3) + ' has no copy');
  });

  // ---- fit comparison (optional, below the callouts) ----
  if (cmpOn) {
    buildComparison(M, F, fr, row.cmp.labels, cmpTop);
    if (!row.cmp.fromSheet) warn.push('Fit comparison used the template defaults — column J was empty');
  }

  // ---- export slices ----
  M.slices.forEach(function (s) {
    var sl = figma.createSlice(); fr.appendChild(sl);
    sl.resize(W, s.hToEnd ? (H - s.y) : s.h); sl.x = 0; sl.y = s.y; sl.name = s.name;
  });

  // style ID label, top-right outside the frame (same convention as Page 2)
  var lbl = txt(M, F, figma.currentPage, { text: row.ids.join('\n') || '—', font: 'medium', size: 61, colorRole: 'label',
    x: fr.x + W + 82, y: fr.y + 10, name: 'Style IDs' });
  return { frame: fr, label: lbl, warnings: warn };
}

// ===== A+ Studio · bundled fallback (auto-generated from backend/templates) =====
// Used when the backend is unreachable, so the plugin always works offline.
// Manifest keys are "<category>/<gender>/<template>" and every "extends" is already resolved.
// Regenerate: node plugin-src/build-fallback.js
var FALLBACK_REGISTRY = {
  "schema": "aplus.registry/2",
  "updated": "2026-11-26",
  "sheet": {
    "comment": "Column layout of the live content sheet 'A+_Sheet_RUNNING_Template_1'. A Group · B Style IDs · C Category · D Subcategory · E Article Type · F Sub-family 2 · G First Card Headline · H First Card Subtext · I Fabric Subtext · J Composition · K Fabric Icons · L–O Feature 1–4 · P Last Slide Headline · Q Last Slide Body · R Status · S Flags · T Gender (to be added).",
    "styleIdColumn": 1,
    "categoryColumn": 2,
    "genderColumn": 19,
    "headlineColumn": 6,
    "taglineColumn": 7,
    "fabricCopyColumn": 8,
    "compositionColumn": 9,
    "iconsColumn": 10,
    "cardColumns": [
      11,
      12,
      13,
      14
    ],
    "statusColumn": 17,
    "cardTitleSeparator": ": ",
    "compositionSeparator": " | ",
    "headerRows": 1,
    "categoryAliases": {
      "run": "running",
      "running": "running",
      "train": "training",
      "training": "training",
      "lifestyle": "lifestyle",
      "comfort": "lifestyle",
      "seamless": "seamless",
      "flex": "seamless"
    },
    "genderAliases": {
      "m": "men",
      "men": "men",
      "mens": "men",
      "man": "men",
      "male": "men",
      "boys": "men",
      "w": "women",
      "women": "women",
      "womens": "women",
      "woman": "women",
      "female": "women",
      "ladies": "women",
      "girls": "women",
      "u": "unisex",
      "unisex": "unisex",
      "uni": "unisex",
      "all": "unisex"
    }
  },
  "categories": [
    {
      "id": "running",
      "label": "Running",
      "status": "active",
      "defaultGender": "men",
      "genders": [
        {
          "id": "men",
          "label": "Men",
          "status": "active",
          "hero": [
            "RUN",
            "UNSTOPPABLE"
          ],
          "templates": [
            {
              "id": "template-1",
              "label": "Standard",
              "sub": "Hero + Fabric + 3–4 callouts",
              "version": 2,
              "status": "active",
              "file": "running/men/template-1.json"
            },
            {
              "id": "template-2",
              "label": "With fit comparison",
              "sub": "Standard + Regular vs Slim card",
              "features": [
                "fitComparison"
              ],
              "version": 2,
              "status": "active",
              "file": "running/men/template-2.json"
            }
          ]
        },
        {
          "id": "women",
          "label": "Women",
          "status": "active",
          "hero": [
            "RUN",
            "UNSTOPPABLE"
          ],
          "templates": [
            {
              "id": "template-1",
              "label": "Standard",
              "sub": "Hero + Fabric + 3–4 callouts",
              "version": 2,
              "status": "active",
              "file": "running/women/template-1.json"
            },
            {
              "id": "template-2",
              "label": "With fit comparison",
              "sub": "Standard + Regular vs Slim card",
              "features": [
                "fitComparison"
              ],
              "version": 2,
              "status": "active",
              "file": "running/women/template-2.json"
            }
          ]
        }
      ]
    },
    {
      "id": "training",
      "label": "Training",
      "status": "coming-soon",
      "defaultGender": "men",
      "genders": [
        {
          "id": "men",
          "label": "Men",
          "status": "coming-soon",
          "hero": [
            "TRAIN",
            "FEARLESS"
          ],
          "templates": []
        },
        {
          "id": "women",
          "label": "Women",
          "status": "coming-soon",
          "hero": [
            "TRAIN",
            "FEARLESS"
          ],
          "templates": []
        }
      ]
    },
    {
      "id": "lifestyle",
      "label": "Lifestyle",
      "status": "coming-soon",
      "defaultGender": "men",
      "genders": [
        {
          "id": "men",
          "label": "Men",
          "status": "coming-soon",
          "hero": [
            "COMFORT",
            "REDEFINED"
          ],
          "templates": []
        },
        {
          "id": "women",
          "label": "Women",
          "status": "coming-soon",
          "hero": [
            "COMFORT",
            "REDEFINED"
          ],
          "templates": []
        }
      ]
    },
    {
      "id": "seamless",
      "label": "Seamless",
      "status": "coming-soon",
      "defaultGender": "women",
      "genders": [
        {
          "id": "women",
          "label": "Women",
          "status": "coming-soon",
          "hero": [
            "FLEX",
            "& FLOW"
          ],
          "templates": []
        }
      ]
    }
  ]
};

var FALLBACK_MANIFESTS = {
  "running/men/template-1": {
    "schema": "aplus.template/2",
    "renderer": "aplus-standard-v1",
    "meta": {
      "category": "running",
      "categoryLabel": "Running",
      "version": 2,
      "status": "active",
      "updated": "2026-11-26",
      "owner": "Rohit Ghosh, Catalog Design, Curefit / Cultstore",
      "notes": "The everyday men's Running A+: hero, Fabric in Focus, then 3 or 4 alternating callouts. Matches 706524 (shorts), 708518 (joggers), 706623 (tank) and 708520 (trackpants) on Page 2.",
      "width": 1572,
      "sliceSplitY": 2961,
      "gender": "men",
      "genderLabel": "Men",
      "label": "Running · Men · Standard"
    },
    "fonts": {
      "hero": {
        "family": "Poppins",
        "style": "Bold",
        "fallback": "bold"
      },
      "display": {
        "family": "Racing Sans One",
        "style": "Regular",
        "fallback": "bold"
      },
      "light": {
        "family": "Fustat",
        "style": "Light",
        "fallback": "regular"
      },
      "regular": {
        "family": "Fustat",
        "style": "Regular",
        "fallback": "regular"
      },
      "medium": {
        "family": "Fustat",
        "style": "Medium",
        "fallback": "regular"
      },
      "semibold": {
        "family": "Fustat",
        "style": "SemiBold",
        "fallback": "bold"
      },
      "bold": {
        "family": "Fustat",
        "style": "Bold",
        "fallback": "bold"
      }
    },
    "palette": {
      "ink": [
        21,
        0,
        0
      ],
      "white": [
        255,
        255,
        255
      ],
      "tag": [
        113,
        119,
        124
      ],
      "slotFill": [
        205,
        209,
        214
      ],
      "slotStroke": [
        110,
        116,
        124
      ],
      "slotLabel": [
        70,
        76,
        84
      ],
      "fabricBg": [
        92,
        86,
        88
      ],
      "label": [
        130,
        130,
        130
      ],
      "guide": [
        170,
        170,
        170
      ]
    },
    "frame": {
      "fillRole": "white",
      "clip": true,
      "bottomPad": 108.76
    },
    "background": {
      "comment": "Measured layer-for-layer off the real 706524. The glows are radial gradient ellipses (not blurred solids) and the two washes are large rotated rectangles — that is what gives the body its depth.",
      "layers": [
        {
          "name": "BG gradient",
          "x": -9.72,
          "y": 1619.51,
          "w": 1697.24,
          "hToFramePlus": 108,
          "fills": [
            {
              "gt": [
                [
                  0,
                  1.66,
                  -0.69
                ],
                [
                  -1.66,
                  0,
                  1.33
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    162,
                    173,
                    179
                  ],
                  1
                ],
                [
                  0.39,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    204,
                    209,
                    213
                  ],
                  1
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left upper",
          "shape": "ellipse",
          "x": -627.63,
          "y": 2121.09,
          "w": 1720.8,
          "h": 1734.97,
          "opacity": 0.61,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.21,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right lower",
          "shape": "ellipse",
          "x": 904.35,
          "y": 3912.2,
          "w": 1052.16,
          "h": 774.15,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    200,
                    199
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right upper",
          "shape": "ellipse",
          "x": 737.09,
          "y": 3171.14,
          "w": 1370.97,
          "h": 969.54,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.22,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left lower",
          "shape": "ellipse",
          "x": -498.93,
          "y": 3799.37,
          "w": 1720.8,
          "h": 1734.97,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.21,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · fabric",
          "rt": [
            [
              0.932,
              -0.363,
              194.096
            ],
            [
              -0.363,
              -0.932,
              3382.993
            ]
          ],
          "w": 2298.48,
          "h": 1808.04,
          "fills": [
            {
              "gt": [
                [
                  -0.56,
                  -0.4,
                  1.29
                ],
                [
                  3.47,
                  -11.67,
                  1.42
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    113,
                    113,
                    113
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · upper",
          "rt": [
            [
              0.909,
              0.417,
              162.27
            ],
            [
              -0.417,
              0.909,
              2152.15
            ]
          ],
          "w": 1083.76,
          "h": 2786.28,
          "fills": [
            {
              "opacity": 0.32,
              "gt": [
                [
                  -1.2,
                  0.36,
                  0.93
                ],
                [
                  0.5,
                  -25.56,
                  13.24
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    163,
                    172,
                    177
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · lower",
          "rt": [
            [
              -0.909,
              -0.417,
              1126.104
            ],
            [
              0.417,
              -0.909,
              5312.91
            ]
          ],
          "yFromBottom": 67.09,
          "w": 1083.76,
          "h": 2786.28,
          "fills": [
            {
              "gt": [
                [
                  -0.89,
                  -0.26,
                  1.22
                ],
                [
                  2.04,
                  -18.16,
                  9.39
                ]
              ],
              "stops": [
                [
                  0.32,
                  [
                    45,
                    44,
                    46
                  ],
                  0.6
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        }
      ]
    },
    "hero": {
      "name": "Card 1 · Hero",
      "x": 0,
      "y": 0,
      "w": 1575,
      "h": 1616,
      "fill": [
        250,
        250,
        251
      ],
      "comment": "Layer order is the real 706524 hero, in its own z-order. The two stacked model images in the original (`_C mot` / `_C bg`) collapse into the single `model` slot; everything else is layer for layer.",
      "layers": [
        {
          "name": "Hero glow",
          "shape": "ellipse",
          "x": 601.76,
          "y": -530.76,
          "w": 1572,
          "h": 1311.69,
          "opacity": 0.64,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0.13,
                  1.13,
                  -0.19
                ],
                [
                  -1.13,
                  0.07,
                  1
                ]
              ],
              "stops": [
                [
                  0.22,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    212,
                    212,
                    212
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Hero shade · right",
          "rt": [
            [
              0.95,
              -0.314,
              960.046
            ],
            [
              0.314,
              0.95,
              -237.721
            ]
          ],
          "w": 1205.98,
          "h": 1971.47,
          "fills": [
            {
              "gt": [
                [
                  -0.79,
                  -0.56,
                  1.48
                ],
                [
                  3.71,
                  -16.02,
                  8.09
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    28,
                    26,
                    31
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "role": "bgPhoto"
        },
        {
          "name": "Hero shade · bottom",
          "rt": [
            [
              0.745,
              0.668,
              -321.641
            ],
            [
              0.668,
              -0.745,
              1372.86
            ]
          ],
          "w": 1584.85,
          "h": 2361.4,
          "fills": [
            {
              "gt": [
                [
                  -1.74,
                  -0.21,
                  1.8
                ],
                [
                  0.25,
                  -2.84,
                  1.36
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    28,
                    27,
                    31
                  ],
                  0.5
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "image 396 · texture",
          "x": -1085.19,
          "y": -66.69,
          "w": 2961.45,
          "h": 1681.68,
          "fills": [
            {
              "image": "28773688fac2f933786c5bb29507ca5cefb5429b",
              "scale": "FILL",
              "opacity": 0.07,
              "scalingFactor": 0.5,
              "filters": {
                "exposure": -1
              }
            }
          ]
        },
        {
          "role": "tagline"
        },
        {
          "role": "word"
        },
        {
          "role": "italic"
        },
        {
          "role": "model"
        }
      ],
      "bgPhoto": {
        "name": "Hero background photo (full bleed)",
        "x": -125,
        "y": -226,
        "w": 1825,
        "h": 2102,
        "fillOpacity": 0.45,
        "labelCorner": true,
        "label": "Hero background photo (full bleed)"
      },
      "word": {
        "name": "Hero word",
        "font": "hero",
        "size": 754.68,
        "lhPct": 87,
        "ls": -45.28,
        "upper": true,
        "align": "CENTER",
        "opacity": 0.24,
        "maxWidth": 1500,
        "y": 17.21,
        "fills": [
          {
            "transform": "TB",
            "stops": [
              [
                0.22,
                [
                  8,
                  8,
                  8
                ],
                0.67
              ],
              [
                0.82,
                [
                  75,
                  92,
                  124
                ],
                0.67
              ]
            ]
          }
        ]
      },
      "italic": {
        "name": "Hero italic word",
        "font": "display",
        "size": 229.76,
        "lhPct": 87,
        "ls": -4.6,
        "upper": true,
        "align": "CENTER",
        "colorRole": "white",
        "opacity": 0.34,
        "maxWidth": 1440,
        "y": 611.58,
        "blur": 6
      },
      "model": {
        "comment": "Matches the footprint of the original's stacked `_C mot` / `_C bg` model images, which this single slot replaces.",
        "name": "Hero model photo · men's running",
        "x": 268,
        "y": 122,
        "w": 1039,
        "h": 1408,
        "fillOpacity": 0.35,
        "label": "Hero model photo · men's running"
      },
      "tagline": {
        "name": "Hero tagline",
        "font": "medium",
        "size": 35,
        "upper": true,
        "ls": 2.45,
        "colorRole": "tag",
        "align": "RIGHT",
        "width": 429,
        "x": 1092.9,
        "y": 825.95
      }
    },
    "fabric": {
      "box": {
        "name": "Card 2 · Fabric in Focus",
        "x": -4.99,
        "y": 1615,
        "w": 1578.76,
        "h": 1346.12,
        "radius": 5.67,
        "fillRole": "fabricBg"
      },
      "bgPhoto": {
        "name": "Fabric background photo",
        "x": 57.74,
        "y": 54.85,
        "w": 1467.34,
        "h": 1286.4,
        "opacity": 0.8,
        "labelCorner": true,
        "label": "Fabric background photo"
      },
      "closeup": {
        "name": "Fabric close-up",
        "x": 576,
        "y": 119,
        "w": 426,
        "h": 426,
        "circle": true,
        "labelSize": 30,
        "label": "Fabric close-up"
      },
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "Photo wash",
          "x": 55.67,
          "y": 54,
          "w": 1473.96,
          "h": 1288.03,
          "opacity": 0.35,
          "comment": "Switched off in the real 706524 — kept here, hidden, so the option is visible to the designer.",
          "visible": false,
          "fills": [
            {
              "solid": [
                217,
                217,
                217
              ]
            }
          ]
        },
        {
          "name": "Dark overlay",
          "x": 0,
          "y": 0,
          "w": 1578.76,
          "h": 1346.12,
          "radius": 5.67,
          "fills": [
            {
              "opacity": 0.52,
              "gt": [
                [
                  0.46,
                  0.34,
                  0.12
                ],
                [
                  -0.34,
                  0.33,
                  0.53
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    21,
                    0,
                    0
                  ],
                  1
                ],
                [
                  0.54,
                  [
                    21,
                    0,
                    0
                  ],
                  0.5
                ],
                [
                  1,
                  [
                    21,
                    0,
                    0
                  ],
                  1
                ]
              ]
            }
          ]
        },
        {
          "role": "closeup"
        }
      ],
      "textStack": {
        "name": "Card 2 · text",
        "y": 2205,
        "gap": 26,
        "cross": "CENTER",
        "heading": {
          "text": "Fabric in Focus",
          "font": "display",
          "size": 90,
          "upper": true,
          "colorRole": "white"
        },
        "copy": {
          "font": "regular",
          "size": 40,
          "colorRole": "white",
          "width": 1372,
          "bold": true
        },
        "divider": {
          "name": "Divider",
          "w": 613.4,
          "h": 1.67,
          "fills": [
            {
              "transform": "LR",
              "stops": [
                [
                  0,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ],
                [
                  0.47,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ]
              ]
            }
          ]
        },
        "composition": {
          "font": "semibold",
          "size": 41.93,
          "colorRole": "white"
        },
        "iconRow": {
          "name": "Icons",
          "gap": 40,
          "cross": "CENTER",
          "max": 4
        }
      },
      "overflowWarnY": 2950
    },
    "callouts": {
      "frame": {
        "name": "Callouts",
        "x": 70.18,
        "y": 3059.79,
        "w": 1431.64,
        "h4": 2211.45,
        "h3": 1652.21
      },
      "barHeight": 385.4,
      "bar": {
        "name": "Bar",
        "gradientStops": [
          [
            0,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            0.295,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            1,
            [
              255,
              255,
              255
            ],
            0
          ]
        ]
      },
      "title": {
        "font": "display",
        "size": 60,
        "lh": 60,
        "upper": true,
        "colorRole": "ink"
      },
      "copy": {
        "font": "light",
        "size": 40,
        "lh": 45,
        "colorRole": "ink",
        "bold": true
      },
      "textGap": 26,
      "cards": [
        {
          "bar": {
            "x": 247.12,
            "y": 71.31,
            "w": 1081.83,
            "flip": false
          },
          "photo": {
            "x": 67.82,
            "y": 0.21,
            "d": 517
          },
          "text": {
            "left": 733.82,
            "w": 655,
            "copyW": 595,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.5,
            "y": 601.21,
            "w": 1176.46,
            "flip": true
          },
          "photo": {
            "x": 849.23,
            "y": 545.21,
            "d": 517.24
          },
          "text": {
            "right": 672.2,
            "w": 635,
            "copyW": 635,
            "align": "RIGHT"
          }
        },
        {
          "bar": {
            "x": 266.55,
            "y": 1200.65,
            "w": 1052.68,
            "flip": false
          },
          "photo": {
            "x": 65.82,
            "y": 1133.21,
            "d": 519
          },
          "text": {
            "left": 733.82,
            "w": 605,
            "copyW": 605,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.66,
            "y": 1761.21,
            "w": 1176.46,
            "flip": true
          },
          "photo": {
            "x": 849.23,
            "y": 1694.21,
            "d": 517.24
          },
          "text": {
            "right": 674.82,
            "w": 653,
            "copyW": 653,
            "align": "RIGHT"
          }
        }
      ]
    },
    "comparison": {
      "comment": "The Regular-fit vs Slim-fit card, measured layer for layer off 706327. The two photo slots overlap by ~99px exactly as in the original, because the fit shots carry transparent padding. Off by default; a template turns it on with \"enabled\": true, and the designer can also add it to any finished frame from the plugin.",
      "enabled": false,
      "name": "Fit comparison",
      "gap": 62,
      "x": 236.7,
      "w": 1235.25,
      "h": 990,
      "label": {
        "font": "display",
        "size": 60,
        "lh": 76,
        "upper": true,
        "colorRole": "ink",
        "align": "CENTER",
        "y": 0,
        "w": 434.81,
        "xs": [
          108.95,
          657.99
        ]
      },
      "photo": {
        "y": 87.22,
        "w": 666.95,
        "h": 865.93,
        "xs": [
          0,
          568.3
        ]
      },
      "guides": {
        "comment": "Alignment rules the designers draw by hand: one vertical per fit, and two horizontal rows each drawn as two offset spans.",
        "colorRole": "guide",
        "opacity": 1,
        "thickness": 3.685,
        "vertical": [
          {
            "x": 125.72,
            "y": 101.96,
            "h": 888.04
          },
          {
            "x": 994.02,
            "y": 101.96,
            "h": 888.04
          }
        ],
        "horizontal": [
          {
            "x": 31.59,
            "y": 182.52,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 182.52,
            "w": 781.18
          },
          {
            "x": 31.59,
            "y": 909.42,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 909.42,
            "w": 781.18
          }
        ]
      }
    },
    "slices": [
      {
        "name": "1",
        "y": 0,
        "h": 2961
      },
      {
        "name": "2",
        "y": 2961,
        "hToEnd": true
      }
    ],
    "content": {
      "comment": "How one row of the live content sheet maps into this template. B=style IDs, C=category, G=headline ('RUN UNSTOPPABLE' — first word is the hero word, the rest the italic), H=tagline, I=fabric copy, J=composition, K=icons, L–O=the four features ('TITLE: body'), R=status, T=gender.",
      "styleIdColumn": 1,
      "categoryColumn": 2,
      "genderColumn": 19,
      "headlineColumn": 6,
      "taglineColumn": 7,
      "fabricCopyColumn": 8,
      "compositionColumn": 9,
      "iconsColumn": 10,
      "cardColumns": [
        11,
        12,
        13,
        14
      ],
      "statusColumn": 17,
      "cardTitleSeparator": ": ",
      "compositionSeparator": " | ",
      "heroDefaults": [
        "RUN",
        "UNSTOPPABLE",
        "Gear up to outrun the ordinary."
      ],
      "fabric": {
        "compositionMarker": "%"
      },
      "callouts": {
        "min": 3,
        "max": 4,
        "titleIsFirstLine": true
      },
      "comparison": {
        "defaults": [
          "Regular fit",
          "Slim fit"
        ]
      }
    },
    "warnings": {
      "titleTallPx": 125,
      "textTallerThanBarPx": 385
    }
  },
  "running/men/template-2": {
    "schema": "aplus.template/2",
    "renderer": "aplus-standard-v1",
    "meta": {
      "category": "running",
      "categoryLabel": "Running",
      "version": 2,
      "status": "active",
      "updated": "2026-11-26",
      "owner": "Rohit Ghosh, Catalog Design, Curefit / Cultstore",
      "notes": "Same as Men · Standard, plus the Regular-fit vs Slim-fit comparison card at the bottom. Use it for styles where the fit is the story.",
      "width": 1572,
      "sliceSplitY": 2961,
      "gender": "men",
      "genderLabel": "Men",
      "label": "Running · Men · With fit comparison"
    },
    "fonts": {
      "hero": {
        "family": "Poppins",
        "style": "Bold",
        "fallback": "bold"
      },
      "display": {
        "family": "Racing Sans One",
        "style": "Regular",
        "fallback": "bold"
      },
      "light": {
        "family": "Fustat",
        "style": "Light",
        "fallback": "regular"
      },
      "regular": {
        "family": "Fustat",
        "style": "Regular",
        "fallback": "regular"
      },
      "medium": {
        "family": "Fustat",
        "style": "Medium",
        "fallback": "regular"
      },
      "semibold": {
        "family": "Fustat",
        "style": "SemiBold",
        "fallback": "bold"
      },
      "bold": {
        "family": "Fustat",
        "style": "Bold",
        "fallback": "bold"
      }
    },
    "palette": {
      "ink": [
        21,
        0,
        0
      ],
      "white": [
        255,
        255,
        255
      ],
      "tag": [
        113,
        119,
        124
      ],
      "slotFill": [
        205,
        209,
        214
      ],
      "slotStroke": [
        110,
        116,
        124
      ],
      "slotLabel": [
        70,
        76,
        84
      ],
      "fabricBg": [
        92,
        86,
        88
      ],
      "label": [
        130,
        130,
        130
      ],
      "guide": [
        170,
        170,
        170
      ]
    },
    "frame": {
      "fillRole": "white",
      "clip": true,
      "bottomPad": 108.76
    },
    "background": {
      "comment": "Measured layer-for-layer off the real 706524. The glows are radial gradient ellipses (not blurred solids) and the two washes are large rotated rectangles — that is what gives the body its depth.",
      "layers": [
        {
          "name": "BG gradient",
          "x": -9.72,
          "y": 1619.51,
          "w": 1697.24,
          "hToFramePlus": 108,
          "fills": [
            {
              "gt": [
                [
                  0,
                  1.66,
                  -0.69
                ],
                [
                  -1.66,
                  0,
                  1.33
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    162,
                    173,
                    179
                  ],
                  1
                ],
                [
                  0.39,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    204,
                    209,
                    213
                  ],
                  1
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left upper",
          "shape": "ellipse",
          "x": -627.63,
          "y": 2121.09,
          "w": 1720.8,
          "h": 1734.97,
          "opacity": 0.61,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.21,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right lower",
          "shape": "ellipse",
          "x": 904.35,
          "y": 3912.2,
          "w": 1052.16,
          "h": 774.15,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    200,
                    199
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right upper",
          "shape": "ellipse",
          "x": 737.09,
          "y": 3171.14,
          "w": 1370.97,
          "h": 969.54,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.22,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left lower",
          "shape": "ellipse",
          "x": -498.93,
          "y": 3799.37,
          "w": 1720.8,
          "h": 1734.97,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.21,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · fabric",
          "rt": [
            [
              0.932,
              -0.363,
              194.096
            ],
            [
              -0.363,
              -0.932,
              3382.993
            ]
          ],
          "w": 2298.48,
          "h": 1808.04,
          "fills": [
            {
              "gt": [
                [
                  -0.56,
                  -0.4,
                  1.29
                ],
                [
                  3.47,
                  -11.67,
                  1.42
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    113,
                    113,
                    113
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · upper",
          "rt": [
            [
              0.909,
              0.417,
              162.27
            ],
            [
              -0.417,
              0.909,
              2152.15
            ]
          ],
          "w": 1083.76,
          "h": 2786.28,
          "fills": [
            {
              "opacity": 0.32,
              "gt": [
                [
                  -1.2,
                  0.36,
                  0.93
                ],
                [
                  0.5,
                  -25.56,
                  13.24
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    163,
                    172,
                    177
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · lower",
          "rt": [
            [
              -0.909,
              -0.417,
              1126.104
            ],
            [
              0.417,
              -0.909,
              5312.91
            ]
          ],
          "yFromBottom": 67.09,
          "w": 1083.76,
          "h": 2786.28,
          "fills": [
            {
              "gt": [
                [
                  -0.89,
                  -0.26,
                  1.22
                ],
                [
                  2.04,
                  -18.16,
                  9.39
                ]
              ],
              "stops": [
                [
                  0.32,
                  [
                    45,
                    44,
                    46
                  ],
                  0.6
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        }
      ]
    },
    "hero": {
      "name": "Card 1 · Hero",
      "x": 0,
      "y": 0,
      "w": 1575,
      "h": 1616,
      "fill": [
        250,
        250,
        251
      ],
      "comment": "Layer order is the real 706524 hero, in its own z-order. The two stacked model images in the original (`_C mot` / `_C bg`) collapse into the single `model` slot; everything else is layer for layer.",
      "layers": [
        {
          "name": "Hero glow",
          "shape": "ellipse",
          "x": 601.76,
          "y": -530.76,
          "w": 1572,
          "h": 1311.69,
          "opacity": 0.64,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0.13,
                  1.13,
                  -0.19
                ],
                [
                  -1.13,
                  0.07,
                  1
                ]
              ],
              "stops": [
                [
                  0.22,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    212,
                    212,
                    212
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Hero shade · right",
          "rt": [
            [
              0.95,
              -0.314,
              960.046
            ],
            [
              0.314,
              0.95,
              -237.721
            ]
          ],
          "w": 1205.98,
          "h": 1971.47,
          "fills": [
            {
              "gt": [
                [
                  -0.79,
                  -0.56,
                  1.48
                ],
                [
                  3.71,
                  -16.02,
                  8.09
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    28,
                    26,
                    31
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "role": "bgPhoto"
        },
        {
          "name": "Hero shade · bottom",
          "rt": [
            [
              0.745,
              0.668,
              -321.641
            ],
            [
              0.668,
              -0.745,
              1372.86
            ]
          ],
          "w": 1584.85,
          "h": 2361.4,
          "fills": [
            {
              "gt": [
                [
                  -1.74,
                  -0.21,
                  1.8
                ],
                [
                  0.25,
                  -2.84,
                  1.36
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    28,
                    27,
                    31
                  ],
                  0.5
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "image 396 · texture",
          "x": -1085.19,
          "y": -66.69,
          "w": 2961.45,
          "h": 1681.68,
          "fills": [
            {
              "image": "28773688fac2f933786c5bb29507ca5cefb5429b",
              "scale": "FILL",
              "opacity": 0.07,
              "scalingFactor": 0.5,
              "filters": {
                "exposure": -1
              }
            }
          ]
        },
        {
          "role": "tagline"
        },
        {
          "role": "word"
        },
        {
          "role": "italic"
        },
        {
          "role": "model"
        }
      ],
      "bgPhoto": {
        "name": "Hero background photo (full bleed)",
        "x": -125,
        "y": -226,
        "w": 1825,
        "h": 2102,
        "fillOpacity": 0.45,
        "labelCorner": true,
        "label": "Hero background photo (full bleed)"
      },
      "word": {
        "name": "Hero word",
        "font": "hero",
        "size": 754.68,
        "lhPct": 87,
        "ls": -45.28,
        "upper": true,
        "align": "CENTER",
        "opacity": 0.24,
        "maxWidth": 1500,
        "y": 17.21,
        "fills": [
          {
            "transform": "TB",
            "stops": [
              [
                0.22,
                [
                  8,
                  8,
                  8
                ],
                0.67
              ],
              [
                0.82,
                [
                  75,
                  92,
                  124
                ],
                0.67
              ]
            ]
          }
        ]
      },
      "italic": {
        "name": "Hero italic word",
        "font": "display",
        "size": 229.76,
        "lhPct": 87,
        "ls": -4.6,
        "upper": true,
        "align": "CENTER",
        "colorRole": "white",
        "opacity": 0.34,
        "maxWidth": 1440,
        "y": 611.58,
        "blur": 6
      },
      "model": {
        "comment": "Matches the footprint of the original's stacked `_C mot` / `_C bg` model images, which this single slot replaces.",
        "name": "Hero model photo · men's running",
        "x": 268,
        "y": 122,
        "w": 1039,
        "h": 1408,
        "fillOpacity": 0.35,
        "label": "Hero model photo · men's running"
      },
      "tagline": {
        "name": "Hero tagline",
        "font": "medium",
        "size": 35,
        "upper": true,
        "ls": 2.45,
        "colorRole": "tag",
        "align": "RIGHT",
        "width": 429,
        "x": 1092.9,
        "y": 825.95
      }
    },
    "fabric": {
      "box": {
        "name": "Card 2 · Fabric in Focus",
        "x": -4.99,
        "y": 1615,
        "w": 1578.76,
        "h": 1346.12,
        "radius": 5.67,
        "fillRole": "fabricBg"
      },
      "bgPhoto": {
        "name": "Fabric background photo",
        "x": 57.74,
        "y": 54.85,
        "w": 1467.34,
        "h": 1286.4,
        "opacity": 0.8,
        "labelCorner": true,
        "label": "Fabric background photo"
      },
      "closeup": {
        "name": "Fabric close-up",
        "x": 576,
        "y": 119,
        "w": 426,
        "h": 426,
        "circle": true,
        "labelSize": 30,
        "label": "Fabric close-up"
      },
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "Photo wash",
          "x": 55.67,
          "y": 54,
          "w": 1473.96,
          "h": 1288.03,
          "opacity": 0.35,
          "comment": "Switched off in the real 706524 — kept here, hidden, so the option is visible to the designer.",
          "visible": false,
          "fills": [
            {
              "solid": [
                217,
                217,
                217
              ]
            }
          ]
        },
        {
          "name": "Dark overlay",
          "x": 0,
          "y": 0,
          "w": 1578.76,
          "h": 1346.12,
          "radius": 5.67,
          "fills": [
            {
              "opacity": 0.52,
              "gt": [
                [
                  0.46,
                  0.34,
                  0.12
                ],
                [
                  -0.34,
                  0.33,
                  0.53
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    21,
                    0,
                    0
                  ],
                  1
                ],
                [
                  0.54,
                  [
                    21,
                    0,
                    0
                  ],
                  0.5
                ],
                [
                  1,
                  [
                    21,
                    0,
                    0
                  ],
                  1
                ]
              ]
            }
          ]
        },
        {
          "role": "closeup"
        }
      ],
      "textStack": {
        "name": "Card 2 · text",
        "y": 2205,
        "gap": 26,
        "cross": "CENTER",
        "heading": {
          "text": "Fabric in Focus",
          "font": "display",
          "size": 90,
          "upper": true,
          "colorRole": "white"
        },
        "copy": {
          "font": "regular",
          "size": 40,
          "colorRole": "white",
          "width": 1372,
          "bold": true
        },
        "divider": {
          "name": "Divider",
          "w": 613.4,
          "h": 1.67,
          "fills": [
            {
              "transform": "LR",
              "stops": [
                [
                  0,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ],
                [
                  0.47,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ]
              ]
            }
          ]
        },
        "composition": {
          "font": "semibold",
          "size": 41.93,
          "colorRole": "white"
        },
        "iconRow": {
          "name": "Icons",
          "gap": 40,
          "cross": "CENTER",
          "max": 4
        }
      },
      "overflowWarnY": 2950
    },
    "callouts": {
      "frame": {
        "name": "Callouts",
        "x": 70.18,
        "y": 3059.79,
        "w": 1431.64,
        "h4": 2211.45,
        "h3": 1652.21
      },
      "barHeight": 385.4,
      "bar": {
        "name": "Bar",
        "gradientStops": [
          [
            0,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            0.295,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            1,
            [
              255,
              255,
              255
            ],
            0
          ]
        ]
      },
      "title": {
        "font": "display",
        "size": 60,
        "lh": 60,
        "upper": true,
        "colorRole": "ink"
      },
      "copy": {
        "font": "light",
        "size": 40,
        "lh": 45,
        "colorRole": "ink",
        "bold": true
      },
      "textGap": 26,
      "cards": [
        {
          "bar": {
            "x": 247.12,
            "y": 71.31,
            "w": 1081.83,
            "flip": false
          },
          "photo": {
            "x": 67.82,
            "y": 0.21,
            "d": 517
          },
          "text": {
            "left": 733.82,
            "w": 655,
            "copyW": 595,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.5,
            "y": 601.21,
            "w": 1176.46,
            "flip": true
          },
          "photo": {
            "x": 849.23,
            "y": 545.21,
            "d": 517.24
          },
          "text": {
            "right": 672.2,
            "w": 635,
            "copyW": 635,
            "align": "RIGHT"
          }
        },
        {
          "bar": {
            "x": 266.55,
            "y": 1200.65,
            "w": 1052.68,
            "flip": false
          },
          "photo": {
            "x": 65.82,
            "y": 1133.21,
            "d": 519
          },
          "text": {
            "left": 733.82,
            "w": 605,
            "copyW": 605,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.66,
            "y": 1761.21,
            "w": 1176.46,
            "flip": true
          },
          "photo": {
            "x": 849.23,
            "y": 1694.21,
            "d": 517.24
          },
          "text": {
            "right": 674.82,
            "w": 653,
            "copyW": 653,
            "align": "RIGHT"
          }
        }
      ]
    },
    "comparison": {
      "comment": "The Regular-fit vs Slim-fit card, measured layer for layer off 706327. The two photo slots overlap by ~99px exactly as in the original, because the fit shots carry transparent padding. Off by default; a template turns it on with \"enabled\": true, and the designer can also add it to any finished frame from the plugin.",
      "enabled": true,
      "name": "Fit comparison",
      "gap": 62,
      "x": 236.7,
      "w": 1235.25,
      "h": 990,
      "label": {
        "font": "display",
        "size": 60,
        "lh": 76,
        "upper": true,
        "colorRole": "ink",
        "align": "CENTER",
        "y": 0,
        "w": 434.81,
        "xs": [
          108.95,
          657.99
        ]
      },
      "photo": {
        "y": 87.22,
        "w": 666.95,
        "h": 865.93,
        "xs": [
          0,
          568.3
        ]
      },
      "guides": {
        "comment": "Alignment rules the designers draw by hand: one vertical per fit, and two horizontal rows each drawn as two offset spans.",
        "colorRole": "guide",
        "opacity": 1,
        "thickness": 3.685,
        "vertical": [
          {
            "x": 125.72,
            "y": 101.96,
            "h": 888.04
          },
          {
            "x": 994.02,
            "y": 101.96,
            "h": 888.04
          }
        ],
        "horizontal": [
          {
            "x": 31.59,
            "y": 182.52,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 182.52,
            "w": 781.18
          },
          {
            "x": 31.59,
            "y": 909.42,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 909.42,
            "w": 781.18
          }
        ]
      }
    },
    "slices": [
      {
        "name": "1",
        "y": 0,
        "h": 2961
      },
      {
        "name": "2",
        "y": 2961,
        "hToEnd": true
      }
    ],
    "content": {
      "comment": "How one row of the live content sheet maps into this template. B=style IDs, C=category, G=headline ('RUN UNSTOPPABLE' — first word is the hero word, the rest the italic), H=tagline, I=fabric copy, J=composition, K=icons, L–O=the four features ('TITLE: body'), R=status, T=gender.",
      "styleIdColumn": 1,
      "categoryColumn": 2,
      "genderColumn": 19,
      "headlineColumn": 6,
      "taglineColumn": 7,
      "fabricCopyColumn": 8,
      "compositionColumn": 9,
      "iconsColumn": 10,
      "cardColumns": [
        11,
        12,
        13,
        14
      ],
      "statusColumn": 17,
      "cardTitleSeparator": ": ",
      "compositionSeparator": " | ",
      "heroDefaults": [
        "RUN",
        "UNSTOPPABLE",
        "Gear up to outrun the ordinary."
      ],
      "fabric": {
        "compositionMarker": "%"
      },
      "callouts": {
        "min": 3,
        "max": 4,
        "titleIsFirstLine": true
      },
      "comparison": {
        "defaults": [
          "Regular fit",
          "Slim fit"
        ]
      }
    },
    "warnings": {
      "titleTallPx": 125,
      "textTallerThanBarPx": 385
    }
  },
  "running/women/template-1": {
    "schema": "aplus.template/2",
    "renderer": "aplus-standard-v1",
    "meta": {
      "category": "running",
      "categoryLabel": "Running",
      "version": 2,
      "status": "active",
      "updated": "2026-11-26",
      "owner": "Rohit Ghosh, Catalog Design, Curefit / Cultstore",
      "notes": "The everyday women's Running A+: hero, Fabric in Focus, then 3 or 4 alternating callouts. Matches 706591 (tights), 706399 (graphic tee) and 706877 (sports bra) on Page 2.",
      "width": 1572,
      "sliceSplitY": 2961,
      "gender": "women",
      "genderLabel": "Women",
      "label": "Running · Women · Standard"
    },
    "fonts": {
      "hero": {
        "family": "Poppins",
        "style": "Bold",
        "fallback": "bold"
      },
      "display": {
        "family": "Racing Sans One",
        "style": "Regular",
        "fallback": "bold"
      },
      "light": {
        "family": "Fustat",
        "style": "Light",
        "fallback": "regular"
      },
      "regular": {
        "family": "Fustat",
        "style": "Regular",
        "fallback": "regular"
      },
      "medium": {
        "family": "Fustat",
        "style": "Medium",
        "fallback": "regular"
      },
      "semibold": {
        "family": "Fustat",
        "style": "SemiBold",
        "fallback": "bold"
      },
      "bold": {
        "family": "Fustat",
        "style": "Bold",
        "fallback": "bold"
      }
    },
    "palette": {
      "ink": [
        21,
        0,
        0
      ],
      "white": [
        255,
        255,
        255
      ],
      "tag": [
        113,
        119,
        124
      ],
      "slotFill": [
        205,
        209,
        214
      ],
      "slotStroke": [
        110,
        116,
        124
      ],
      "slotLabel": [
        70,
        76,
        84
      ],
      "fabricBg": [
        92,
        86,
        88
      ],
      "label": [
        130,
        130,
        130
      ],
      "guide": [
        170,
        170,
        170
      ]
    },
    "frame": {
      "fillRole": "white",
      "clip": true,
      "bottomPad": 108.76
    },
    "background": {
      "comment": "Measured layer-for-layer off the real 706524. The glows are radial gradient ellipses (not blurred solids) and the two washes are large rotated rectangles — that is what gives the body its depth.",
      "layers": [
        {
          "name": "BG gradient",
          "x": -9.72,
          "y": 1619.51,
          "w": 1697.24,
          "hToFramePlus": 108,
          "fills": [
            {
              "gt": [
                [
                  0,
                  1.66,
                  -0.69
                ],
                [
                  -1.66,
                  0,
                  1.33
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    162,
                    173,
                    179
                  ],
                  1
                ],
                [
                  0.39,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    204,
                    209,
                    213
                  ],
                  1
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left upper",
          "shape": "ellipse",
          "x": -627.63,
          "y": 2121.09,
          "w": 1720.8,
          "h": 1734.97,
          "opacity": 0.61,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.21,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right lower",
          "shape": "ellipse",
          "x": 904.35,
          "y": 3912.2,
          "w": 1052.16,
          "h": 774.15,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    200,
                    199
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right upper",
          "shape": "ellipse",
          "x": 737.09,
          "y": 3171.14,
          "w": 1370.97,
          "h": 969.54,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.22,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left lower",
          "shape": "ellipse",
          "x": -498.93,
          "y": 3799.37,
          "w": 1720.8,
          "h": 1734.97,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.21,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · fabric",
          "rt": [
            [
              0.932,
              -0.363,
              194.096
            ],
            [
              -0.363,
              -0.932,
              3382.993
            ]
          ],
          "w": 2298.48,
          "h": 1808.04,
          "fills": [
            {
              "gt": [
                [
                  -0.56,
                  -0.4,
                  1.29
                ],
                [
                  3.47,
                  -11.67,
                  1.42
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    113,
                    113,
                    113
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · upper",
          "rt": [
            [
              0.909,
              0.417,
              162.27
            ],
            [
              -0.417,
              0.909,
              2152.15
            ]
          ],
          "w": 1083.76,
          "h": 2786.28,
          "fills": [
            {
              "opacity": 0.32,
              "gt": [
                [
                  -1.2,
                  0.36,
                  0.93
                ],
                [
                  0.5,
                  -25.56,
                  13.24
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    163,
                    172,
                    177
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · lower",
          "rt": [
            [
              -0.909,
              -0.417,
              1126.104
            ],
            [
              0.417,
              -0.909,
              5312.91
            ]
          ],
          "yFromBottom": 67.09,
          "w": 1083.76,
          "h": 2786.28,
          "fills": [
            {
              "gt": [
                [
                  -0.63,
                  0.15,
                  0.99
                ],
                [
                  0.38,
                  -13.33,
                  7.13
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    31,
                    30,
                    31
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        }
      ]
    },
    "hero": {
      "name": "Card 1 · Hero",
      "x": 0,
      "y": 0,
      "w": 1575,
      "h": 1616,
      "fill": [
        250,
        250,
        251
      ],
      "comment": "The women's files stack the hero differently from the men's: the backing plate is the bottom-most layer, and the texture sits BELOW the bottom shade rather than above it. Order here is 706327's, layer for layer.",
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "Hero glow",
          "shape": "ellipse",
          "x": 601.76,
          "y": -530.76,
          "w": 1572,
          "h": 1311.69,
          "opacity": 0.64,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0.13,
                  1.13,
                  -0.19
                ],
                [
                  -1.13,
                  0.07,
                  1
                ]
              ],
              "stops": [
                [
                  0.22,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    212,
                    212,
                    212
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Hero shade · right",
          "rt": [
            [
              0.95,
              -0.314,
              960.046
            ],
            [
              0.314,
              0.95,
              -237.721
            ]
          ],
          "w": 1205.98,
          "h": 1971.47,
          "fills": [
            {
              "gt": [
                [
                  -0.82,
                  -0.54,
                  1.48
                ],
                [
                  3.55,
                  -16.71,
                  8.49
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    72,
                    72,
                    74
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "image 394 · texture",
          "x": -1085.19,
          "y": -66.69,
          "w": 2961.45,
          "h": 1681.68,
          "fills": [
            {
              "image": "28773688fac2f933786c5bb29507ca5cefb5429b",
              "scale": "FILL",
              "opacity": 0.07,
              "scalingFactor": 0.5,
              "filters": {
                "exposure": -1
              }
            }
          ]
        },
        {
          "name": "Hero shade · bottom",
          "rt": [
            [
              0.745,
              0.668,
              -321.641
            ],
            [
              0.668,
              -0.745,
              1372.86
            ]
          ],
          "w": 1584.85,
          "h": 2361.4,
          "fills": [
            {
              "gt": [
                [
                  -1.74,
                  -0.21,
                  1.8
                ],
                [
                  0.25,
                  -2.84,
                  1.36
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "role": "tagline"
        },
        {
          "role": "word"
        },
        {
          "role": "italic"
        },
        {
          "role": "model"
        }
      ],
      "bgPhoto": {
        "name": "Hero background plate (full bleed)",
        "x": -21,
        "y": -2,
        "w": 1614,
        "h": 1614,
        "fillOpacity": 0.45,
        "labelCorner": true,
        "label": "Hero background plate (full bleed)"
      },
      "word": {
        "name": "Hero word",
        "font": "hero",
        "size": 754.68,
        "lhPct": 87,
        "ls": -45.28,
        "upper": true,
        "align": "CENTER",
        "opacity": 0.24,
        "maxWidth": 1500,
        "y": 17.21,
        "fills": [
          {
            "transform": "TB",
            "stops": [
              [
                0.22,
                [
                  8,
                  8,
                  8
                ],
                0.67
              ],
              [
                0.82,
                [
                  75,
                  92,
                  124
                ],
                0.67
              ]
            ]
          }
        ]
      },
      "italic": {
        "name": "Hero italic word",
        "font": "display",
        "size": 229.76,
        "lhPct": 87,
        "ls": -4.6,
        "upper": true,
        "align": "CENTER",
        "colorRole": "white",
        "opacity": 0.34,
        "maxWidth": 1440,
        "y": 611.58,
        "blur": 6
      },
      "model": {
        "comment": "Matches the footprint of the original's stacked `_C mot` / `_C bg` model images, which this single slot replaces.",
        "name": "Hero model photo · women’s running",
        "x": 268,
        "y": 122,
        "w": 1039,
        "h": 1408,
        "fillOpacity": 0.35,
        "label": "Hero model photo · women’s running"
      },
      "tagline": {
        "name": "Hero tagline",
        "font": "medium",
        "size": 35,
        "upper": true,
        "ls": 2.45,
        "colorRole": "tag",
        "align": "RIGHT",
        "width": 429,
        "x": 1092.9,
        "y": 825.95
      }
    },
    "fabric": {
      "box": {
        "name": "Card 2 · Fabric in Focus",
        "x": -4.99,
        "y": 1615,
        "w": 1578.76,
        "h": 1346.12,
        "radius": 5.67,
        "fillRole": "fabricBg"
      },
      "bgPhoto": {
        "name": "Fabric background photo",
        "x": 57.74,
        "y": 54.85,
        "w": 1467.34,
        "h": 1286.4,
        "opacity": 0.8,
        "labelCorner": true,
        "label": "Fabric background photo"
      },
      "closeup": {
        "name": "Fabric close-up",
        "x": 539.18,
        "y": 51.94,
        "w": 503.63,
        "h": 503.63,
        "circle": true,
        "labelSize": 32,
        "label": "Fabric close-up"
      },
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "Photo wash",
          "x": 55.67,
          "y": 54,
          "w": 1473.96,
          "h": 1288.03,
          "opacity": 0.35,
          "visible": false,
          "fills": [
            {
              "solid": [
                217,
                217,
                217
              ]
            }
          ]
        },
        {
          "name": "Light overlay",
          "x": 0,
          "y": 0,
          "w": 1578.76,
          "h": 1346.12,
          "radius": 5.67,
          "fills": [
            {
              "opacity": 0.35,
              "gt": [
                [
                  0.56,
                  0.4,
                  -0.04
                ],
                [
                  -0.4,
                  0.4,
                  0.54
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  0.54,
                  [
                    255,
                    255,
                    255
                  ],
                  0.28
                ],
                [
                  1,
                  [
                    255,
                    255,
                    255
                  ],
                  0.51
                ]
              ]
            }
          ]
        },
        {
          "role": "closeup"
        },
        {
          "role": "ring"
        }
      ],
      "textStack": {
        "name": "Card 2 · text",
        "y": 2205,
        "gap": 26,
        "cross": "CENTER",
        "heading": {
          "text": "Fabric in Focus",
          "font": "display",
          "size": 90,
          "upper": true,
          "colorRole": "white"
        },
        "copy": {
          "font": "regular",
          "size": 40,
          "colorRole": "white",
          "width": 1372,
          "bold": true
        },
        "divider": {
          "name": "Divider",
          "w": 613.4,
          "h": 1.67,
          "fills": [
            {
              "transform": "LR",
              "stops": [
                [
                  0,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ],
                [
                  0.47,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ]
              ]
            }
          ]
        },
        "composition": {
          "font": "semibold",
          "size": 41.93,
          "colorRole": "white"
        },
        "iconRow": {
          "name": "Icons",
          "gap": 40,
          "cross": "CENTER",
          "max": 4
        }
      },
      "overflowWarnY": 2950,
      "ring": {
        "name": "Fabric close-up ring",
        "x": 539.18,
        "y": 51.94,
        "w": 503.63,
        "h": 503.63,
        "strokeRole": "white",
        "strokeOpacity": 0.47,
        "strokeWeight": 1.94
      }
    },
    "callouts": {
      "frame": {
        "name": "Callouts",
        "x": 70.18,
        "y": 3059.79,
        "w": 1431.64,
        "h4": 2211.45,
        "h3": 1652.21
      },
      "barHeight": 385.4,
      "bar": {
        "name": "Bar",
        "gradientStops": [
          [
            0,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            0.295,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            1,
            [
              255,
              255,
              255
            ],
            0
          ]
        ]
      },
      "title": {
        "font": "display",
        "size": 60,
        "lh": 60,
        "upper": true,
        "colorRole": "ink"
      },
      "copy": {
        "font": "light",
        "size": 40,
        "lh": 45,
        "colorRole": "ink",
        "bold": true
      },
      "textGap": 26,
      "cards": [
        {
          "bar": {
            "x": 247.12,
            "y": 71.31,
            "w": 1081.83,
            "flip": false
          },
          "photo": {
            "x": 67.82,
            "y": 0.21,
            "d": 517
          },
          "text": {
            "left": 733.82,
            "w": 655,
            "copyW": 595,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.5,
            "y": 601.21,
            "w": 1176.46,
            "flip": true
          },
          "photo": {
            "x": 849.23,
            "y": 545.21,
            "d": 517.24
          },
          "text": {
            "right": 672.2,
            "w": 635,
            "copyW": 635,
            "align": "RIGHT"
          }
        },
        {
          "bar": {
            "x": 266.55,
            "y": 1200.65,
            "w": 1052.68,
            "flip": false
          },
          "photo": {
            "x": 65.82,
            "y": 1133.21,
            "d": 519
          },
          "text": {
            "left": 733.82,
            "w": 605,
            "copyW": 605,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.66,
            "y": 1761.21,
            "w": 1176.46,
            "flip": true
          },
          "photo": {
            "x": 849.23,
            "y": 1694.21,
            "d": 517.24
          },
          "text": {
            "right": 674.82,
            "w": 653,
            "copyW": 653,
            "align": "RIGHT"
          }
        }
      ]
    },
    "comparison": {
      "comment": "The Regular-fit vs Slim-fit card, measured layer for layer off 706327. The two photo slots overlap by ~99px exactly as in the original, because the fit shots carry transparent padding. Off by default; a template turns it on with \"enabled\": true, and the designer can also add it to any finished frame from the plugin.",
      "enabled": false,
      "name": "Fit comparison",
      "gap": 62,
      "x": 236.7,
      "w": 1235.25,
      "h": 990,
      "label": {
        "font": "display",
        "size": 60,
        "lh": 76,
        "upper": true,
        "colorRole": "ink",
        "align": "CENTER",
        "y": 0,
        "w": 434.81,
        "xs": [
          108.95,
          657.99
        ]
      },
      "photo": {
        "y": 87.22,
        "w": 666.95,
        "h": 865.93,
        "xs": [
          0,
          568.3
        ]
      },
      "guides": {
        "comment": "Alignment rules the designers draw by hand: one vertical per fit, and two horizontal rows each drawn as two offset spans.",
        "colorRole": "guide",
        "opacity": 1,
        "thickness": 3.685,
        "vertical": [
          {
            "x": 125.72,
            "y": 101.96,
            "h": 888.04
          },
          {
            "x": 994.02,
            "y": 101.96,
            "h": 888.04
          }
        ],
        "horizontal": [
          {
            "x": 31.59,
            "y": 182.52,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 182.52,
            "w": 781.18
          },
          {
            "x": 31.59,
            "y": 909.42,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 909.42,
            "w": 781.18
          }
        ]
      }
    },
    "slices": [
      {
        "name": "1",
        "y": 0,
        "h": 2961
      },
      {
        "name": "2",
        "y": 2961,
        "hToEnd": true
      }
    ],
    "content": {
      "comment": "How one row of the live content sheet maps into this template. B=style IDs, C=category, G=headline ('RUN UNSTOPPABLE' — first word is the hero word, the rest the italic), H=tagline, I=fabric copy, J=composition, K=icons, L–O=the four features ('TITLE: body'), R=status, T=gender.",
      "styleIdColumn": 1,
      "categoryColumn": 2,
      "genderColumn": 19,
      "headlineColumn": 6,
      "taglineColumn": 7,
      "fabricCopyColumn": 8,
      "compositionColumn": 9,
      "iconsColumn": 10,
      "cardColumns": [
        11,
        12,
        13,
        14
      ],
      "statusColumn": 17,
      "cardTitleSeparator": ": ",
      "compositionSeparator": " | ",
      "heroDefaults": [
        "RUN",
        "UNSTOPPABLE",
        "Gear up to outrun the ordinary."
      ],
      "fabric": {
        "compositionMarker": "%"
      },
      "callouts": {
        "min": 3,
        "max": 4,
        "titleIsFirstLine": true
      },
      "comparison": {
        "defaults": [
          "Regular fit",
          "Slim fit"
        ]
      }
    },
    "warnings": {
      "titleTallPx": 125,
      "textTallerThanBarPx": 385
    }
  },
  "running/women/template-2": {
    "schema": "aplus.template/2",
    "renderer": "aplus-standard-v1",
    "meta": {
      "category": "running",
      "categoryLabel": "Running",
      "version": 2,
      "status": "active",
      "updated": "2026-11-26",
      "owner": "Rohit Ghosh, Catalog Design, Curefit / Cultstore",
      "notes": "Same as Women · Standard, plus the Regular-fit vs Slim-fit comparison card at the bottom. This is the 706327 layout, which is where the comparison geometry was measured from.",
      "width": 1572,
      "sliceSplitY": 2961,
      "gender": "women",
      "genderLabel": "Women",
      "label": "Running · Women · With fit comparison"
    },
    "fonts": {
      "hero": {
        "family": "Poppins",
        "style": "Bold",
        "fallback": "bold"
      },
      "display": {
        "family": "Racing Sans One",
        "style": "Regular",
        "fallback": "bold"
      },
      "light": {
        "family": "Fustat",
        "style": "Light",
        "fallback": "regular"
      },
      "regular": {
        "family": "Fustat",
        "style": "Regular",
        "fallback": "regular"
      },
      "medium": {
        "family": "Fustat",
        "style": "Medium",
        "fallback": "regular"
      },
      "semibold": {
        "family": "Fustat",
        "style": "SemiBold",
        "fallback": "bold"
      },
      "bold": {
        "family": "Fustat",
        "style": "Bold",
        "fallback": "bold"
      }
    },
    "palette": {
      "ink": [
        21,
        0,
        0
      ],
      "white": [
        255,
        255,
        255
      ],
      "tag": [
        113,
        119,
        124
      ],
      "slotFill": [
        205,
        209,
        214
      ],
      "slotStroke": [
        110,
        116,
        124
      ],
      "slotLabel": [
        70,
        76,
        84
      ],
      "fabricBg": [
        92,
        86,
        88
      ],
      "label": [
        130,
        130,
        130
      ],
      "guide": [
        170,
        170,
        170
      ]
    },
    "frame": {
      "fillRole": "white",
      "clip": true,
      "bottomPad": 108.76
    },
    "background": {
      "comment": "Measured layer-for-layer off the real 706524. The glows are radial gradient ellipses (not blurred solids) and the two washes are large rotated rectangles — that is what gives the body its depth.",
      "layers": [
        {
          "name": "BG gradient",
          "x": -9.72,
          "y": 1619.51,
          "w": 1697.24,
          "hToFramePlus": 108,
          "fills": [
            {
              "gt": [
                [
                  0,
                  1.66,
                  -0.69
                ],
                [
                  -1.66,
                  0,
                  1.33
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    162,
                    173,
                    179
                  ],
                  1
                ],
                [
                  0.39,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    204,
                    209,
                    213
                  ],
                  1
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left upper",
          "shape": "ellipse",
          "x": -627.63,
          "y": 2121.09,
          "w": 1720.8,
          "h": 1734.97,
          "opacity": 0.61,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.21,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right lower",
          "shape": "ellipse",
          "x": 904.35,
          "y": 3912.2,
          "w": 1052.16,
          "h": 774.15,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    200,
                    199
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · right upper",
          "shape": "ellipse",
          "x": 737.09,
          "y": 3171.14,
          "w": 1370.97,
          "h": 969.54,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.22,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Glow · left lower",
          "shape": "ellipse",
          "x": -498.93,
          "y": 3799.37,
          "w": 1720.8,
          "h": 1734.97,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0,
                  1,
                  0
                ],
                [
                  -1,
                  0,
                  1
                ]
              ],
              "stops": [
                [
                  0.21,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    191,
                    196,
                    200
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · fabric",
          "rt": [
            [
              0.932,
              -0.363,
              194.096
            ],
            [
              -0.363,
              -0.932,
              3382.993
            ]
          ],
          "w": 2298.48,
          "h": 1808.04,
          "fills": [
            {
              "gt": [
                [
                  -0.56,
                  -0.4,
                  1.29
                ],
                [
                  3.47,
                  -11.67,
                  1.42
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    113,
                    113,
                    113
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · upper",
          "rt": [
            [
              0.909,
              0.417,
              162.27
            ],
            [
              -0.417,
              0.909,
              2152.15
            ]
          ],
          "w": 1083.76,
          "h": 2786.28,
          "fills": [
            {
              "opacity": 0.32,
              "gt": [
                [
                  -1.2,
                  0.36,
                  0.93
                ],
                [
                  0.5,
                  -25.56,
                  13.24
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    163,
                    172,
                    177
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Wash · lower",
          "rt": [
            [
              -0.909,
              -0.417,
              1126.104
            ],
            [
              0.417,
              -0.909,
              5312.91
            ]
          ],
          "yFromBottom": 67.09,
          "w": 1083.76,
          "h": 2786.28,
          "fills": [
            {
              "gt": [
                [
                  -0.63,
                  0.15,
                  0.99
                ],
                [
                  0.38,
                  -13.33,
                  7.13
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    31,
                    30,
                    31
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        }
      ]
    },
    "hero": {
      "name": "Card 1 · Hero",
      "x": 0,
      "y": 0,
      "w": 1575,
      "h": 1616,
      "fill": [
        250,
        250,
        251
      ],
      "comment": "The women's files stack the hero differently from the men's: the backing plate is the bottom-most layer, and the texture sits BELOW the bottom shade rather than above it. Order here is 706327's, layer for layer.",
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "Hero glow",
          "shape": "ellipse",
          "x": 601.76,
          "y": -530.76,
          "w": 1572,
          "h": 1311.69,
          "opacity": 0.64,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0.13,
                  1.13,
                  -0.19
                ],
                [
                  -1.13,
                  0.07,
                  1
                ]
              ],
              "stops": [
                [
                  0.22,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    212,
                    212,
                    212
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "Hero shade · right",
          "rt": [
            [
              0.95,
              -0.314,
              960.046
            ],
            [
              0.314,
              0.95,
              -237.721
            ]
          ],
          "w": 1205.98,
          "h": 1971.47,
          "fills": [
            {
              "gt": [
                [
                  -0.82,
                  -0.54,
                  1.48
                ],
                [
                  3.55,
                  -16.71,
                  8.49
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    72,
                    72,
                    74
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "name": "image 394 · texture",
          "x": -1085.19,
          "y": -66.69,
          "w": 2961.45,
          "h": 1681.68,
          "fills": [
            {
              "image": "28773688fac2f933786c5bb29507ca5cefb5429b",
              "scale": "FILL",
              "opacity": 0.07,
              "scalingFactor": 0.5,
              "filters": {
                "exposure": -1
              }
            }
          ]
        },
        {
          "name": "Hero shade · bottom",
          "rt": [
            [
              0.745,
              0.668,
              -321.641
            ],
            [
              0.668,
              -0.745,
              1372.86
            ]
          ],
          "w": 1584.85,
          "h": 2361.4,
          "fills": [
            {
              "gt": [
                [
                  -1.74,
                  -0.21,
                  1.8
                ],
                [
                  0.25,
                  -2.84,
                  1.36
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    217,
                    217,
                    217
                  ],
                  0
                ]
              ]
            }
          ]
        },
        {
          "role": "tagline"
        },
        {
          "role": "word"
        },
        {
          "role": "italic"
        },
        {
          "role": "model"
        }
      ],
      "bgPhoto": {
        "name": "Hero background plate (full bleed)",
        "x": -21,
        "y": -2,
        "w": 1614,
        "h": 1614,
        "fillOpacity": 0.45,
        "labelCorner": true,
        "label": "Hero background plate (full bleed)"
      },
      "word": {
        "name": "Hero word",
        "font": "hero",
        "size": 754.68,
        "lhPct": 87,
        "ls": -45.28,
        "upper": true,
        "align": "CENTER",
        "opacity": 0.24,
        "maxWidth": 1500,
        "y": 17.21,
        "fills": [
          {
            "transform": "TB",
            "stops": [
              [
                0.22,
                [
                  8,
                  8,
                  8
                ],
                0.67
              ],
              [
                0.82,
                [
                  75,
                  92,
                  124
                ],
                0.67
              ]
            ]
          }
        ]
      },
      "italic": {
        "name": "Hero italic word",
        "font": "display",
        "size": 229.76,
        "lhPct": 87,
        "ls": -4.6,
        "upper": true,
        "align": "CENTER",
        "colorRole": "white",
        "opacity": 0.34,
        "maxWidth": 1440,
        "y": 611.58,
        "blur": 6
      },
      "model": {
        "comment": "Matches the footprint of the original's stacked `_C mot` / `_C bg` model images, which this single slot replaces.",
        "name": "Hero model photo · women’s running",
        "x": 268,
        "y": 122,
        "w": 1039,
        "h": 1408,
        "fillOpacity": 0.35,
        "label": "Hero model photo · women’s running"
      },
      "tagline": {
        "name": "Hero tagline",
        "font": "medium",
        "size": 35,
        "upper": true,
        "ls": 2.45,
        "colorRole": "tag",
        "align": "RIGHT",
        "width": 429,
        "x": 1092.9,
        "y": 825.95
      }
    },
    "fabric": {
      "box": {
        "name": "Card 2 · Fabric in Focus",
        "x": -4.99,
        "y": 1615,
        "w": 1578.76,
        "h": 1346.12,
        "radius": 5.67,
        "fillRole": "fabricBg"
      },
      "bgPhoto": {
        "name": "Fabric background photo",
        "x": 57.74,
        "y": 54.85,
        "w": 1467.34,
        "h": 1286.4,
        "opacity": 0.8,
        "labelCorner": true,
        "label": "Fabric background photo"
      },
      "closeup": {
        "name": "Fabric close-up",
        "x": 539.18,
        "y": 51.94,
        "w": 503.63,
        "h": 503.63,
        "circle": true,
        "labelSize": 32,
        "label": "Fabric close-up"
      },
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "Photo wash",
          "x": 55.67,
          "y": 54,
          "w": 1473.96,
          "h": 1288.03,
          "opacity": 0.35,
          "visible": false,
          "fills": [
            {
              "solid": [
                217,
                217,
                217
              ]
            }
          ]
        },
        {
          "name": "Light overlay",
          "x": 0,
          "y": 0,
          "w": 1578.76,
          "h": 1346.12,
          "radius": 5.67,
          "fills": [
            {
              "opacity": 0.35,
              "gt": [
                [
                  0.56,
                  0.4,
                  -0.04
                ],
                [
                  -0.4,
                  0.4,
                  0.54
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  0.54,
                  [
                    255,
                    255,
                    255
                  ],
                  0.28
                ],
                [
                  1,
                  [
                    255,
                    255,
                    255
                  ],
                  0.51
                ]
              ]
            }
          ]
        },
        {
          "role": "closeup"
        },
        {
          "role": "ring"
        }
      ],
      "textStack": {
        "name": "Card 2 · text",
        "y": 2205,
        "gap": 26,
        "cross": "CENTER",
        "heading": {
          "text": "Fabric in Focus",
          "font": "display",
          "size": 90,
          "upper": true,
          "colorRole": "white"
        },
        "copy": {
          "font": "regular",
          "size": 40,
          "colorRole": "white",
          "width": 1372,
          "bold": true
        },
        "divider": {
          "name": "Divider",
          "w": 613.4,
          "h": 1.67,
          "fills": [
            {
              "transform": "LR",
              "stops": [
                [
                  0,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ],
                [
                  0.47,
                  [
                    255,
                    255,
                    255
                  ],
                  1
                ],
                [
                  1,
                  [
                    201,
                    204,
                    244
                  ],
                  0
                ]
              ]
            }
          ]
        },
        "composition": {
          "font": "semibold",
          "size": 41.93,
          "colorRole": "white"
        },
        "iconRow": {
          "name": "Icons",
          "gap": 40,
          "cross": "CENTER",
          "max": 4
        }
      },
      "overflowWarnY": 2950,
      "ring": {
        "name": "Fabric close-up ring",
        "x": 539.18,
        "y": 51.94,
        "w": 503.63,
        "h": 503.63,
        "strokeRole": "white",
        "strokeOpacity": 0.47,
        "strokeWeight": 1.94
      }
    },
    "callouts": {
      "frame": {
        "name": "Callouts",
        "x": 70.18,
        "y": 3059.79,
        "w": 1431.64,
        "h4": 2211.45,
        "h3": 1652.21
      },
      "barHeight": 385.4,
      "bar": {
        "name": "Bar",
        "gradientStops": [
          [
            0,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            0.295,
            [
              255,
              255,
              255
            ],
            0.58
          ],
          [
            1,
            [
              255,
              255,
              255
            ],
            0
          ]
        ]
      },
      "title": {
        "font": "display",
        "size": 60,
        "lh": 60,
        "upper": true,
        "colorRole": "ink"
      },
      "copy": {
        "font": "light",
        "size": 40,
        "lh": 45,
        "colorRole": "ink",
        "bold": true
      },
      "textGap": 26,
      "cards": [
        {
          "bar": {
            "x": 247.12,
            "y": 71.31,
            "w": 1081.83,
            "flip": false
          },
          "photo": {
            "x": 67.82,
            "y": 0.21,
            "d": 517
          },
          "text": {
            "left": 733.82,
            "w": 655,
            "copyW": 595,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.5,
            "y": 601.21,
            "w": 1176.46,
            "flip": true
          },
          "photo": {
            "x": 849.23,
            "y": 545.21,
            "d": 517.24
          },
          "text": {
            "right": 672.2,
            "w": 635,
            "copyW": 635,
            "align": "RIGHT"
          }
        },
        {
          "bar": {
            "x": 266.55,
            "y": 1200.65,
            "w": 1052.68,
            "flip": false
          },
          "photo": {
            "x": 65.82,
            "y": 1133.21,
            "d": 519
          },
          "text": {
            "left": 733.82,
            "w": 605,
            "copyW": 605,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.66,
            "y": 1761.21,
            "w": 1176.46,
            "flip": true
          },
          "photo": {
            "x": 849.23,
            "y": 1694.21,
            "d": 517.24
          },
          "text": {
            "right": 674.82,
            "w": 653,
            "copyW": 653,
            "align": "RIGHT"
          }
        }
      ]
    },
    "comparison": {
      "comment": "The Regular-fit vs Slim-fit card, measured layer for layer off 706327. The two photo slots overlap by ~99px exactly as in the original, because the fit shots carry transparent padding. Off by default; a template turns it on with \"enabled\": true, and the designer can also add it to any finished frame from the plugin.",
      "enabled": true,
      "name": "Fit comparison",
      "gap": 62,
      "x": 236.7,
      "w": 1235.25,
      "h": 990,
      "label": {
        "font": "display",
        "size": 60,
        "lh": 76,
        "upper": true,
        "colorRole": "ink",
        "align": "CENTER",
        "y": 0,
        "w": 434.81,
        "xs": [
          108.95,
          657.99
        ]
      },
      "photo": {
        "y": 87.22,
        "w": 666.95,
        "h": 865.93,
        "xs": [
          0,
          568.3
        ]
      },
      "guides": {
        "comment": "Alignment rules the designers draw by hand: one vertical per fit, and two horizontal rows each drawn as two offset spans.",
        "colorRole": "guide",
        "opacity": 1,
        "thickness": 3.685,
        "vertical": [
          {
            "x": 125.72,
            "y": 101.96,
            "h": 888.04
          },
          {
            "x": 994.02,
            "y": 101.96,
            "h": 888.04
          }
        ],
        "horizontal": [
          {
            "x": 31.59,
            "y": 182.52,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 182.52,
            "w": 781.18
          },
          {
            "x": 31.59,
            "y": 909.42,
            "w": 744.33
          },
          {
            "x": 311.63,
            "y": 909.42,
            "w": 781.18
          }
        ]
      }
    },
    "slices": [
      {
        "name": "1",
        "y": 0,
        "h": 2961
      },
      {
        "name": "2",
        "y": 2961,
        "hToEnd": true
      }
    ],
    "content": {
      "comment": "How one row of the live content sheet maps into this template. B=style IDs, C=category, G=headline ('RUN UNSTOPPABLE' — first word is the hero word, the rest the italic), H=tagline, I=fabric copy, J=composition, K=icons, L–O=the four features ('TITLE: body'), R=status, T=gender.",
      "styleIdColumn": 1,
      "categoryColumn": 2,
      "genderColumn": 19,
      "headlineColumn": 6,
      "taglineColumn": 7,
      "fabricCopyColumn": 8,
      "compositionColumn": 9,
      "iconsColumn": 10,
      "cardColumns": [
        11,
        12,
        13,
        14
      ],
      "statusColumn": 17,
      "cardTitleSeparator": ": ",
      "compositionSeparator": " | ",
      "heroDefaults": [
        "RUN",
        "UNSTOPPABLE",
        "Gear up to outrun the ordinary."
      ],
      "fabric": {
        "compositionMarker": "%"
      },
      "callouts": {
        "min": 3,
        "max": 4,
        "titleIsFirstLine": true
      },
      "comparison": {
        "defaults": [
          "Regular fit",
          "Slim fit"
        ]
      }
    },
    "warnings": {
      "titleTallPx": 125,
      "textTallerThanBarPx": 385
    }
  }
};


// ===== plugin main: resolve a template manifest, build one A+ per sheet row =====
// Network (fetching manifests from the backend) happens in ui.html; this side renders.
// If the UI could not reach the backend, we fall back to the manifest bundled in this file.
figma.showUI(__html__, { width: 460, height: 760, themeColors: true });

function fallbackManifest(key) { return FALLBACK_MANIFESTS[key] || null; }

// ---------- what is selected right now ----------
// Used by the "build from the selected frame" flow: pick an A+ on the canvas and the
// plugin reads its style IDs, so the designer can rebuild that style on another template.
// The IDs come from the frame name (that is how the renderer names them) and, failing that,
// from any six-digit number in the frame or in a text label sitting just outside it.
function idsFromNode(node) {
  var found = (String(node.name).match(/\d{6}/g) || []);
  if (!found.length && 'findAllWithCriteria' in node) {
    var texts = node.findAllWithCriteria({ types: ['TEXT'] });
    for (var i = 0; i < texts.length && found.length < 6; i++) {
      var m = String(texts[i].characters).match(/\d{6}/g);
      if (m) found = found.concat(m);
    }
  }
  return found;
}
function nearbyLabelIds(node) {
  // the style-ID label the renderer drops to the right of each frame
  var p = node.parent;
  if (!p || !('children' in p)) return [];
  var out = [];
  for (var i = 0; i < p.children.length; i++) {
    var n = p.children[i];
    if (n.type !== 'TEXT') continue;
    if (n.x < node.x + node.width - 10 || n.x > node.x + node.width + 600) continue;
    if (n.y < node.y - 200 || n.y > node.y + 400) continue;
    var m = String(n.characters).match(/\d{6}/g);
    if (m) out = out.concat(m);
  }
  return out;
}
function describeSelection() {
  var sel = figma.currentPage.selection.filter(function (n) { return n.type === 'FRAME'; });
  var frames = sel.map(function (n) {
    var ids = idsFromNode(n);
    if (!ids.length) ids = nearbyLabelIds(n);
    var seen = {}, uniq = [];
    ids.forEach(function (i) { if (!seen[i]) { seen[i] = 1; uniq.push(i); } });
    return { id: n.id, name: n.name, w: Math.round(n.width), h: Math.round(n.height), ids: uniq };
  });
  var all = {}, ids = [];
  frames.forEach(function (f) { f.ids.forEach(function (i) { if (!all[i]) { all[i] = 1; ids.push(i); } }); });
  // pageId travels with every selection message so the UI can drop stale ones: the sender
  // guarantees the matching 'page' arrived first, but the UI still gets to check.
  return {
    type: 'selection',
    pageId: figma.currentPage.id,
    frames: frames,
    ids: ids,
    other: figma.currentPage.selection.length - sel.length
  };
}

// ---------- which page are we on right now ----------
// frameCount is "frames sitting on this page": the outermost frames, wherever they sit.
// We walk into SECTIONs and GROUPs (designers routinely park A+ frames in those) but stop
// at the first FRAME — its children are the parts of that A+, not frames "on the page" —
// so the walk never descends into an A+ subtree and stays cheap on a crowded page.
function countFrames(node) {
  var n = 0;
  for (var i = 0; i < node.children.length; i++) {
    var c = node.children[i];
    if (c.type === 'FRAME') n++;
    else if (c.type === 'SECTION' || c.type === 'GROUP') n += countFrames(c);
  }
  return n;
}
function describePage() {
  return {
    type: 'page',
    id: figma.currentPage.id,
    name: figma.currentPage.name,
    frameCount: countFrames(figma.currentPage)
  };
}

// ---------- keeping the UI's view of page + selection consistent ----------
// Two invariants, both enforced here rather than assumed:
//   1. nothing is posted before 'init' — the listeners below are registered while the async
//      startup block is still suspended on clientStorage, so a user action in that window
//      would otherwise post a selection stamped with a pageId the UI has never seen.
//   2. a 'selection' never reaches the UI before the 'page' it belongs to. postSelection
//      posts the page itself whenever the current page differs from the last one we sent,
//      so the order holds no matter which of the two Figma events fires first.
var ready = false;          // flipped on once init + the first page/selection pair are out
var lastPageId = null;      // id of the most recent 'page' message
var lastSelectionKey = null; // pageId + selected node ids of the most recent 'selection'

function selectionKey() {
  var sel = figma.currentPage.selection, ids = [];
  for (var i = 0; i < sel.length; i++) ids.push(sel[i].id);
  return figma.currentPage.id + '|' + ids.join(',');
}
function postPage() {
  lastPageId = figma.currentPage.id;
  figma.ui.postMessage(describePage());
}
function postSelection(force) {
  if (figma.currentPage.id !== lastPageId) postPage();   // invariant 2
  var key = selectionKey();
  // describeSelection() walks every selected frame's text subtree, so skip the repeat:
  // a page switch fires both 'selectionchange' and 'currentpagechange' and we land here twice.
  if (!force && key === lastSelectionKey) return;
  lastSelectionKey = key;
  figma.ui.postMessage(describeSelection());
}
// one handler for both events: whichever fires first does the work, the other is a no-op
function syncToUi() {
  if (!ready) return;      // invariant 1
  postSelection(false);
}

(async function () {
  var saved = await figma.clientStorage.getAsync('sheetLink');
  var backend = await figma.clientStorage.getAsync('backendUrl');
  var session = await figma.clientStorage.getAsync('googleSession');
  figma.ui.postMessage({
    type: 'init',
    sheetLink: saved || '',
    backendUrl: backend || '',
    session: session || '',
    registry: FALLBACK_REGISTRY,
    manifests: FALLBACK_MANIFESTS,   // so the UI can draw template previews with no backend
    page: figma.currentPage.name
  });
  postPage();                // same shape the UI gets on every later page change
  postSelection(true);
  ready = true;              // only now may the listeners below post anything
})();

// ---------- follow the user across pages and selections ----------
figma.on('selectionchange', syncToUi);
figma.on('currentpagechange', syncToUi);

// a page rename with no page switch is not pushed. The hook that would catch it,
// figma.on('documentchange'), requires figma.loadAllPagesAsync() first under
// "documentAccess": "dynamic-page", which loads every page of the file just to watch a
// title. Instead the UI refreshes the name itself with a 'ping-page' message, which is
// cheap and handled below — so a stale name only lasts until the UI next pings.

figma.ui.onmessage = async function (msg) {
  if (msg.type === 'save-link') { await figma.clientStorage.setAsync('sheetLink', msg.link || ''); return; }
  if (msg.type === 'save-backend') { await figma.clientStorage.setAsync('backendUrl', msg.url || ''); return; }
  if (msg.type === 'save-session') { await figma.clientStorage.setAsync('googleSession', msg.session || ''); return; }
  // the pings answer unconditionally — the UI asked, so the de-dup above must not swallow it
  if (msg.type === 'ping-selection') { postSelection(true); return; }
  if (msg.type === 'ping-page') { postPage(); return; }

  // ---------- add the fit comparison card to the frames that are selected ----------
  if (msg.type === 'add-comparison') {
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
    return;
  }

  if (msg.type !== 'run') return;

  // Per-row routing: the UI has already resolved each row's category (column B) and gender
  // (column C) to a manifest key ("running/women/template-1") in msg.keys[i], or an error
  // string in msg.errors[i] for rows it could not route. Backend manifests arrive in msg.manifests.
  var keys = msg.keys || [];
  var errors = msg.errors || [];
  var manifests = msg.manifests || {};
  function manifestFor(key) {
    if (!key) return null;
    var m = manifests[key] || fallbackManifest(key);
    if (m && m.renderer && m.renderer !== 'aplus-standard-v1') return null;
    return m;
  }
  if (!msg.rows || !msg.rows.length) {
    figma.ui.postMessage({ type: 'error', message: 'No rows to build.' });
    return;
  }

  try {
    var icons = buildIconIndex();
    var maxX = 0, minY = Infinity;
    figma.currentPage.children.forEach(function (n) { maxX = Math.max(maxX, n.x + n.width); minY = Math.min(minY, n.y); });
    var x = maxX + 600, y = isFinite(minY) ? minY : 0;
    var created = [], report = [], missingFonts = {}, lastLabel = '';
    for (var i = 0; i < msg.rows.length; i++) {
      var key = keys[i];
      var manifest = manifestFor(key);
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
          var res = await buildFromManifest(manifest, row, { F: fonts.F, icons: icons, x: x, y: y });
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
};
