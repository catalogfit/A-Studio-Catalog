// ===== renderer.js =====
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

// ---------- icons: resolve a sheet icon name to real artwork on this page ----------
// Two populations of fabric icons live on the page and they are NOT the same set:
//   * PRODUCTION — the full-size icons (150.86px ring, 40.23px label) that sit inside the real
//     A+ designs. Right scale, and what actually ships today.
//   * ICON BANK — the reference catalogue near x60022 / y17406 (label node 1105:2130). 19px
//     icons, each labelled "<Name>: <description>". Exactly an 8x reduction of production
//     scale, so its artwork can be scaled back up when production has no icon of that name.
// Both are catalogued, with node ids, shared-glyph rules, the known bank-vs-production
// conflicts and the sheet cross-check, in backend/icons/index.json.
//
// The previous index could never see the bank at all: it keyed on the whole text of a label and
// threw away anything over 30 characters, and every bank label reads "<Name>: <description>".
var ICON_RING_D = 150.86;              // production ring diameter
var ICON_BANK_RING_MIN = 8;            // smallest ring we will treat as a bank icon
var ICON_PRODUCTION_RING_MIN = 100;    // at or above this, a ring is production scale
var ICON_BANK_SCALE = 8.016;           // 150.86 / 18.820038
var ICON_LABEL_GAP = 5.04;             // production: label top - ring bottom
var ICON_RING_FILL = [255, 253, 250];
var ICON_RING_STROKE = [103, 103, 103];
var ICON_RING_STROKE_W = 3.380645;
var ICON_LABEL_SIZE = 40.228325;

// Sheet spelling -> canonical icon name, for the cases normalisation alone cannot reach.
// Every entry is either written down inside the bank or is an unambiguous morphological
// variant of a single bank name. Ambiguous values are deliberately absent so that they are
// reported rather than guessed: "Soft" could be Super-Soft, Hyper Soft, Ultra-Soft or Soft
// Cotton-Lycra, and "Stretchy" must not be bent onto Super Stretch / Multi Stretch / High
// Lycra. Shipping a plausible-but-wrong glyph to Amazon is worse than shipping a visible gap.
var ICON_ALIASES = {
  // bank node 1105:2101: "Super-Soft, buttery soft, lightweight - have same feather icon"
  'buttery soft': 'super soft',
  'bio washed': 'bio wash treated',
  'bio wash': 'bio wash treated',
  'ribbed': 'ribbed texture',
  'ripstop': 'ripstop fabric',
  'comflex': 'comflex fabric',
  'cotton lycra': 'soft cotton lycra'
};

function iconKey(s) {
  return String(s === undefined || s === null ? '' : s)
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/^\s+|\s+$/g, '');
}
// "Sweat-Wicking: Stays dry, no matter how hard you push" -> "Sweat-Wicking"
function iconNameFromLabel(s) {
  var t = String(s === undefined || s === null ? '' : s).replace(/\s+/g, ' ');
  var at = t.indexOf(':');
  if (at > 0) t = t.slice(0, at);
  return t.replace(/^\s+|\s+$/g, '');
}
function iconBox(n) { return n && n.absoluteBoundingBox ? n.absoluteBoundingBox : null; }
function iconCentreDist(a, b) {
  var dx = (a.x + a.width / 2) - (b.x + b.width / 2);
  var dy = (a.y + a.height / 2) - (b.y + b.height / 2);
  return Math.sqrt(dx * dx + dy * dy);
}
function iconInside(inner, outer) {
  var cx = inner.x + inner.width / 2, cy = inner.y + inner.height / 2;
  return cx >= outer.x && cx <= outer.x + outer.width &&
         cy >= outer.y && cy <= outer.y + outer.height &&
         inner.width <= outer.width && inner.height <= outer.height;
}
function iconIsAncestor(a, n) {
  for (var p = n.parent; p; p = p.parent) if (p === a) return true;
  return false;
}
// The glyph is whatever non-text, non-ellipse art sits inside the ring. It is a sibling of the
// ring in most icons, but a sibling of the ring's PARENT in a few (COMFlex Fabric), so both
// levels are tried. Ancestors of the ring are skipped — a wrapper group shares the ring's
// bounding box and would otherwise look like a glyph.
function iconGlyphsFor(ring) {
  var rb = iconBox(ring);
  if (!rb) return [];
  var levels = [ring.parent, ring.parent ? ring.parent.parent : null];
  for (var i = 0; i < levels.length; i++) {
    var p = levels[i];
    if (!p || !('children' in p)) continue;
    var found = [];
    for (var j = 0; j < p.children.length; j++) {
      var k = p.children[j];
      if (k === ring || k.type === 'TEXT' || k.type === 'ELLIPSE') continue;
      if (k.visible === false || iconIsAncestor(k, ring)) continue;
      var kb = iconBox(k);
      if (kb && iconInside(kb, rb)) found.push(k);
    }
    if (found.length) return found;
  }
  return [];
}
// The label can be a sibling of the ring (production), a sibling of the ring's wrapper group,
// or nested several levels away (Premium Cotton, Multi Stretch). Walk outwards and take the
// nearest text the first time any is in reach.
function iconLabelFor(ring) {
  var rb = iconBox(ring);
  if (!rb) return null;
  var maxD = rb.width * 14;
  var node = ring;
  for (var lvl = 0; lvl < 4; lvl++) {
    node = node.parent;
    if (!node || !('children' in node)) break;
    var cands = [];
    for (var j = 0; j < node.children.length; j++) {
      if (node.children[j].type === 'TEXT') cands.push(node.children[j]);
    }
    if (!cands.length && typeof node.findAll === 'function') {
      var nb = iconBox(node);
      if (nb && nb.width <= rb.width * 30 && nb.height <= rb.height * 30) {
        cands = node.findAll(function (n) { return n.type === 'TEXT'; });
      }
    }
    var best = null, bestD = Infinity;
    for (var m = 0; m < cands.length; m++) {
      var tb = iconBox(cands[m]);
      if (!tb) continue;
      var d = iconCentreDist(rb, tb);
      if (d < bestD) { bestD = d; best = cands[m]; }
    }
    if (best && bestD <= maxD) return best;
  }
  return null;
}
// Index every icon on the page, production and bank alike, under both its exact label and a
// normalised key. Production wins over bank for the same name.
function buildIconIndex() {
  var idx = {
    production: { exact: {}, norm: {} },
    bank: { exact: {}, norm: {} },
    names: []
  };
  var ellipses = figma.currentPage.findAllWithCriteria({ types: ['ELLIPSE'] });
  for (var i = 0; i < ellipses.length; i++) {
    var ring = ellipses[i];
    if (ring.visible === false) continue;
    var rb = iconBox(ring);
    if (!rb) continue;
    var isProd = rb.width >= ICON_PRODUCTION_RING_MIN && rb.width <= ICON_RING_D * 1.2;
    var isBank = rb.width >= ICON_BANK_RING_MIN && rb.width < ICON_PRODUCTION_RING_MIN;
    if (!isProd && !isBank) continue;

    var glyphs = iconGlyphsFor(ring);
    if (!glyphs.length) continue;
    var lab = iconLabelFor(ring);
    if (!lab) continue;
    var name = iconNameFromLabel(lab.characters);
    // "+ Fabric close-up" and friends are photo placeholders, not icons
    if (!name || name.length < 2 || name.length > 34 || name.charAt(0) === '+') continue;
    var key = iconKey(name);
    if (!key) continue;

    var entry;
    if (isProd) {
      // The whole group (ring + glyph + label) is cloned, exactly as before, so a production
      // icon keeps its real artwork and typography untouched.
      var grp = ring.parent;
      var gb = iconBox(grp);
      if (!grp || lab.parent !== grp || !gb) continue;
      if (gb.width > rb.width * 4 || gb.height > rb.height * 3) continue;
      entry = { name: name, key: key, source: 'production', group: grp };
    } else {
      entry = { name: name, key: key, source: 'bank', ring: ring, glyphs: glyphs };
    }
    var bucket = isProd ? idx.production : idx.bank;
    if (!bucket.norm[key]) { bucket.norm[key] = entry; idx.names.push(name + ' (' + entry.source + ')'); }
    if (!bucket.exact[name]) bucket.exact[name] = entry;
  }
  return idx;
}
// Exact, then normalised, then alias — production first, bank second.
function resolveIcon(idx, label) {
  var raw = String(label === undefined || label === null ? '' : label).replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
  var key = iconKey(raw);
  if (!key) return null;
  var buckets = [idx.production, idx.bank];
  var passes = [
    { via: 'exact', pick: function (b) { return b.exact[raw]; } },
    { via: 'normalised', pick: function (b) { return b.norm[key]; } },
    { via: 'alias', pick: function (b) { return ICON_ALIASES[key] ? b.norm[ICON_ALIASES[key]] : null; } }
  ];
  for (var p = 0; p < passes.length; p++) {
    for (var b = 0; b < buckets.length; b++) {
      var hit = passes[p].pick(buckets[b]);
      if (hit) return { entry: hit, via: passes[p].via, source: hit.source };
    }
  }
  return null;
}
// Rebuild a production-scale icon from ICON BANK artwork. The ring and the label are drawn to
// the production spec (the bank's own 19px ring and "<Name>: <description>" label are reference
// art, not usable output); only the GLYPH comes from the bank, scaled up by ICON_BANK_SCALE.
// This is a real icon of the right name — not a stand-in — but every use is reported.
function bankIcon(M, F, parent, entry) {
  var g = stack(parent, 'VERTICAL', { gap: ICON_LABEL_GAP, cross: 'CENTER',
    name: 'Icon · ' + entry.name + ' · rebuilt from icon bank' });
  var holder = box(g, { w: ICON_RING_D, h: ICON_RING_D, name: 'Ring' });
  var e = figma.createEllipse();
  e.resize(ICON_RING_D, ICON_RING_D);
  e.fills = [solid(col(M, ICON_RING_FILL))];
  e.strokes = [solid(col(M, ICON_RING_STROKE))];
  e.strokeWeight = ICON_RING_STROKE_W;
  holder.appendChild(e); e.x = 0; e.y = 0; e.name = 'Ellipse 3';
  var rb = iconBox(entry.ring);
  for (var i = 0; i < entry.glyphs.length; i++) {
    var src = entry.glyphs[i];
    var sb = iconBox(src);
    var c = src.clone();
    holder.appendChild(c);
    if (typeof c.rescale === 'function') c.rescale(ICON_BANK_SCALE);
    else if (typeof c.resize === 'function' && sb) c.resize(sb.width * ICON_BANK_SCALE, sb.height * ICON_BANK_SCALE);
    if (sb && rb) { c.x = (sb.x - rb.x) * ICON_BANK_SCALE; c.y = (sb.y - rb.y) * ICON_BANK_SCALE; }
    c.name = 'Glyph · ' + entry.name;
  }
  txt(M, F, g, { text: entry.name, font: 'regular', size: ICON_LABEL_SIZE, colorRole: 'white',
    align: 'CENTER', name: entry.name });
  return g;
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
  var unresolvedIcons = [];
  row.fab.icons.slice(0, ts.iconRow.max).forEach(function (label) {
    var hit = resolveIcon(icons, label);
    if (!hit) {
      // Nothing is substituted. A wrong icon shipped to Amazon is worse than a visible gap,
      // so the row gets a labelled placeholder and the name is reported.
      missingIcon(M, F, iconRow, label);
      unresolvedIcons.push(label);
      warn.push('Icon "' + label + '" did not resolve — no icon of that name in the designs on ' +
        'this page or in the ICON BANK. A labelled gap was drawn; nothing was substituted.');
      return;
    }
    if (hit.source === 'production') {
      iconRow.appendChild(hit.entry.group.clone());
    } else {
      bankIcon(M, F, iconRow, hit.entry);
      warn.push('Icon "' + label + '" is not in any shipped design, so it was rebuilt from the ' +
        'ICON BANK glyph scaled up ' + ICON_BANK_SCALE + 'x (bank art is 19px reference art). ' +
        'Check it renders cleanly before publishing.');
    }
    if (hit.via === 'alias') {
      warn.push('Icon "' + label + '" resolved through an alias to "' + hit.entry.name + '".');
    } else if (hit.via === 'normalised' && hit.entry.name !== label) {
      warn.push('Icon "' + label + '" matched "' + hit.entry.name + '" (spelling differs).');
    }
  });
  if (row.fab.icons.length > ts.iconRow.max) {
    warn.push('The sheet lists ' + row.fab.icons.length + ' icons but the row holds ' +
      ts.iconRow.max + '; dropped: ' + row.fab.icons.slice(ts.iconRow.max).join(', '));
  }
  if (unresolvedIcons.length) {
    warn.push('Unresolved icon names on this row: ' + unresolvedIcons.join(', ') +
      '. See backend/icons/index.json for the full catalogue of names that do resolve.');
  }
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

// ===== manifest-fallback.js =====
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
      "status": "active",
      "defaultGender": "men",
      "genders": [
        {
          "id": "men",
          "label": "Men",
          "status": "active",
          "hero": [
            "TRAIN",
            "FEARLESS"
          ],
          "comment": "One template: the three men's designs (707041/42/44, 707564/65/66, 707175/76/77) are structurally identical and differ only in a two-layer accent colour, which is art direction — see meta.artDirection in training/_base.json. Callout count comes from the sheet, not the template.",
          "templates": [
            {
              "id": "template-1",
              "label": "Standard",
              "sub": "Hero + Fabric + 3–4 callouts",
              "version": 1,
              "status": "active",
              "file": "training/men/template-1.json"
            }
          ]
        },
        {
          "id": "women",
          "label": "Women",
          "status": "active",
          "hero": [
            "TRAIN",
            "FEARLESS"
          ],
          "comment": "Two templates: beyond the accent colour the two women's designs differ in close-up diameter, fabric text position, copy width, icon gap and both hero photo boxes — too much for one file.",
          "templates": [
            {
              "id": "template-1",
              "label": "All Over Print",
              "sub": "Hero + Fabric + 3–4 callouts",
              "version": 1,
              "status": "active",
              "file": "training/women/template-1.json"
            },
            {
              "id": "template-2",
              "label": "Solid",
              "sub": "Hero + Fabric + 3–4 callouts",
              "version": 1,
              "status": "active",
              "file": "training/women/template-2.json"
            }
          ]
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
  },
  "training/men/template-1": {
    "schema": "aplus.template/2",
    "renderer": "aplus-standard-v1",
    "meta": {
      "category": "training",
      "categoryLabel": "Training",
      "version": 1,
      "status": "active",
      "updated": "2026-11-27",
      "owner": "Rohit Ghosh, Catalog Design, Curefit / Cultstore",
      "notes": "The everyday men's Training A+: hero, Fabric in Focus, then 3 or 4 alternating callouts. Measured off all three men's Training designs on Page 2 — Compression Top Solid 2 (1097:1514, 707041/707042/707044), Trackpants Graphic (1097:1383, 707564/707565/707566) and Shorts Graphic 1 (1097:1633, 707175/707176/707177). Only one men's template exists because the three designs are structurally identical: same hero stack, same fabric card, same alternating callout rig, no extra block in any of them. What separates them is the accent colour (meta.artDirection) and how many features the sheet row fills, and neither is a template. THE MEN'S HERO HAS ONE PHOTO DROP, NOT TWO: training/_base.json's hero.layers carries no `model` role, so only `bgPhoto` is placed. That is the designer's decision, taken by hand on the approved frame (TEMPLATE · TRAINING · MEN · Standard, 1109:2) and reconciled into the manifest — it is NOT an oversight, and it has already been undone by mistake once. The full reasoning is in training/_base.json meta.knownDeviations. The women's hero is genuinely different and keeps its model slot.",
      "width": 1572,
      "sliceSplitY": 2960,
      "artDirection": {
        "comment": "What a template cannot fix, because it is per-style, not per-gender. Two layers carry each Training style's accent colour — the body 'Wash · lower' and the hero 'Hero shade · right'. All three men's designs share their geometry exactly and differ only in this colour. The base ships the Compression Top's maroon; the designer recolours those two layers per style.",
        "accentLayers": [
          "Wash · lower",
          "Hero shade · right"
        ],
        "measured": {
          "707041/707042/707044 · Compression Top Solid 2": {
            "wash": [
              170,
              72,
              89
            ],
            "heroShade": [
              170,
              82,
              96
            ]
          },
          "707564/707565/707566 · Trackpants Graphic": {
            "wash": [
              72,
              103,
              88
            ],
            "heroShade": [
              82,
              111,
              100
            ]
          },
          "707175/707176/707177 · Shorts Graphic 1": {
            "wash": [
              114,
              63,
              137
            ],
            "heroShade": [
              109,
              54,
              122
            ]
          }
        }
      },
      "notExpressible": [
        "The fabric card (`Frame 852`) carries a GLASS effect (radius 16.903) in all three designs. The renderer gives the fabric box a solid fill and no effects, so the effect is dropped; the card's gradient veil itself IS reproduced, as the 'Dark overlay' layer.",
        "The hero italic word is x-centred by the renderer. The originals place it ~35px right of centre (x 139.6 / 145 against a centred 105), which the manifest cannot express because hero.italic has no x.",
        "The callout bar is a single white gradient at paint opacity 0.58 on a rotated matrix; the renderer only builds bars with the fixed LR/RL directions, so it is approximated with three stops (unchanged from running/_base).",
        "The `Fabric in Focus` heading carries a disabled DROP_SHADOW in all three designs; the renderer's textStack has no effects field, so it is not reproduced (it is switched off anyway)."
      ],
      "knownDeviations": [
        "Rendered frame heights match the real designs exactly — 1572 x 4743 for a 3-feature row (Compression Top, Shorts) and 1572 x 5380 for a 4-feature one (Trackpants, real 5379.69). What does NOT match is the spacing WITHIN a 3-callout frame: the two hand-made 3-callout designs pack their three cards ~45px tighter than the Trackpants' four-card rig, and one `callouts.cards` array has to serve both, so the Trackpants spacing is used and the slack lands below card 3.",
        "'Wash · lower' is bottom-anchored (yFromBottom 66.78, the Trackpants/Running placement). The two 3-callout designs park it 211px lower on a fixed y with a different gradient matrix.",
        "Hidden leftovers NOT reproduced, as orphans the project set out to clean up: a hidden duplicate of 'Glow · right lower' (Ellipse 87), a hidden fabric photo (705963_C), a hidden wash entirely below the frame (Rectangle 42140, y 5685), and a hidden hero model photo (948a6666…). The hidden layers that ARE reproduced are the two alternate gradients and the fabric Photo wash.",
        "The men's hero has NO model slot — `hero.layers` ends at the `italic` role and carries no `model` marker, so the hero ships exactly one photo drop, `bgPhoto`. This is the designer's decision, taken on the canvas (frame 1109:2 on Page 2) and adopted here. The reasoning: in the men's hero `bgPhoto` is 1575 x 1599 at (0, -1) — the full hero box — and the measured model box is 1170 x 1586 at (237, 8), entirely INSIDE it. The two slots were therefore near-coincident placeholders over the same area, and in a skeleton the second one (a 35%-opacity plate sitting above the type, since `model` was the topmost role) greyed out the TRAIN / FEARLESS wordmarks. The men's photographic content is the full-bleed colourway stack that already collapses into `bgPhoto`, drawn UNDER the texture, the right-hand shade and the type — that is the men's composition. The only other model photo in the men's sources is the hidden orphan 948a6666, listed above as not reproduced. The WOMEN'S hero is different and keeps its model slot: there `bgPhoto` is 1730 x 2080 at (-77, -201) and is the bottom-most layer — an environmental backdrop — with a genuinely separate 1076 x 1438 model subject above the type. training/_women.json restates hero.layers with the `model` role intact, and the women's template frame on Page 2 (1110:2) still carries it."
      ],
      "gender": "men",
      "genderLabel": "Men",
      "label": "Training · Men · Standard",
      "hero": [
        "TRAIN",
        "FEARLESS"
      ]
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
      "comment": "ink and tag are read off the real Training text nodes (callout copy rgb(21,0,0), hero tagline rgb(113,119,124)). fabricBg is carried over from running/_base: the Training fabric card (Frame 852) has NO solid base fill at all, only the dark gradient that this manifest draws as the 'Dark overlay' layer, so a base colour had to be chosen — it is almost entirely covered by the fabric photo and the overlay.",
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
      "comment": "bottomPad is 0 and the padding below the last callout is folded into callouts.frame.h3 / h4 instead. It has to be: the two 3-callout Training designs leave 18.85px and 29.85px below their callouts frame and the 4-callout one leaves 101.18px, so no single bottomPad reproduces both real heights. Folding it in does — see callouts.frame.",
      "fillRole": "white",
      "clip": true,
      "bottomPad": 0
    },
    "background": {
      "comment": "Frame-level art, in the z-order of the real Training files (which differs from Running: the two body washes are drawn BEFORE the fabric wash, not after). The glows are radial-gradient ellipses and the washes are large rotated rectangles. All three washes carry a full `rt` matrix. Determinants, checked against the canvas: 'Wash · lower' and 'Wash · upper' are PURE ROTATIONS (det +1.0, about 155.4 deg and -24.6 deg); 'Wash · fabric' is the one that is FLIPPED as well as rotated (det -0.9985) and therefore cannot be expressed as a rotation at all. An earlier revision of this comment attributed the flip to 'Wash · lower', which is wrong — correcting it here so nobody 'simplifies' Wash · fabric into a rotation. Storing the full rt for all three is still correct and lossless.",
      "layers": [
        {
          "name": "BG gradient",
          "x": -10,
          "y": 1616,
          "w": 1697,
          "hToFramePlus": 0,
          "comment": "Compression Top / Shorts both run this to the frame bottom exactly (hToFramePlus 0). The Trackpants runs it 108.28 past, as Running does.",
          "fills": [
            {
              "gt": [
                [
                  0.0003,
                  1.6641,
                  -0.6867
                ],
                [
                  -1.6641,
                  0,
                  1.3319
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
                  0.3942,
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
                  0.2105,
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
          "name": "BG gradient · alternate",
          "x": -11.33,
          "y": 3008.42,
          "w": 1699.25,
          "h": 1784.86,
          "comment": "Switched off in the Compression Top and the Shorts (Rectangle 42153) and absent from the Trackpants. Kept here, hidden, so the option stays visible to the designer — same convention as the Running fabric Photo wash.",
          "visible": false,
          "fills": [
            {
              "gt": [
                [
                  0.0002,
                  0.8941,
                  -0.0001
                ],
                [
                  -0.8941,
                  0.0001,
                  0.9471
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    204,
                    209,
                    213
                  ],
                  1
                ],
                [
                  0.4332,
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
                  0.2223,
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
                  0.2105,
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
          "name": "Wash · lower",
          "rt": [
            [
              -0.90901,
              -0.41677,
              1126.1
            ],
            [
              0.41677,
              -0.90901,
              5312.91
            ]
          ],
          "yFromBottom": 66.78,
          "w": 1083.76,
          "h": 2786.28,
          "comment": "The accent wash — this is the layer that carries each style's colour. Anchored to the frame bottom, so it has to be the Trackpants/Running placement; the two 3-callout frames park it 211px lower with a slightly different gradient matrix. The stop colour here is the Compression Top's maroon; see meta.artDirection.",
          "fills": [
            {
              "gt": [
                [
                  -0.8881,
                  -0.2636,
                  1.2157
                ],
                [
                  2.0353,
                  -18.1559,
                  9.3857
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    170,
                    72,
                    89
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
              0.90901,
              0.41677,
              162.27
            ],
            [
              -0.41677,
              0.90901,
              2152.15
            ]
          ],
          "w": 1083.76,
          "h": 2786.28,
          "comment": "Byte-identical in all three Training designs and in running/_base.",
          "fills": [
            {
              "opacity": 0.32,
              "gt": [
                [
                  -1.2029,
                  0.3601,
                  0.9336
                ],
                [
                  0.4951,
                  -25.5645,
                  13.2355
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
          "name": "Wash · fabric",
          "rt": [
            [
              0.92133,
              -0.33749,
              194.09
            ],
            [
              -0.38878,
              -0.94133,
              3512.98
            ]
          ],
          "w": 2325.05,
          "h": 1942.02,
          "comment": "Flipped as well as rotated (determinant -0.9985), so it must keep its full rt matrix. Geometry is the Compression Top / Shorts one (2 of 3); the Trackpants uses the slightly smaller Running box 2298.81 x 1809.75 at ty 3383.",
          "fills": [
            {
              "gt": [
                [
                  -0.5553,
                  -0.4038,
                  1.2941
                ],
                [
                  3.4689,
                  -11.673,
                  1.4173
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
      "comment": "Only the two photo-slot labels are men's-specific; all geometry comes from training/_base.json. `model` is overridden here for its name and label ONLY — the slot is not drawn, because _base's hero.layers has no `model` role. The override is kept so the label is already correct if the slot is ever deliberately re-enabled, and because validate.js requires hero.model to exist. Adding the role back is a design decision, not a bug fix — read meta.notes first.",
      "layers": [
        {
          "name": "Hero backdrop · trr3",
          "x": -60,
          "y": -40,
          "w": 1696,
          "h": 1696,
          "visible": false,
          "comment": "Bottom-most layer in the Compression Top and the Shorts: the same imageHash in both, which is why it was first read as a shared backdrop graphic rather than a per-style photograph. It is a PHOTOGRAPH. In the finished designs it contributes nothing — the live model photo covers it completely — but in a skeleton, where the model is an empty 35%-opacity placeholder, it showed through as a full-bleed photo of a female athlete inside the MEN'S template. Shipping a baked-in photo also contradicts the brief that every photo area be a placeholder. Kept as data (it really is in the source) but hidden, the same convention as the fabric 'Photo wash'. The hero background slot directly above it is the real fill point. The Trackpants puts a style photo here instead.",
          "fills": [
            {
              "image": "ec31933d587a4a4f2f4fad740048399f56e09fe7",
              "scale": "FILL",
              "scalingFactor": 0.5
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
              0.7446,
              0.66751,
              -321.64
            ],
            [
              0.66751,
              -0.7446,
              1372.86
            ]
          ],
          "w": 1584.85,
          "h": 2361.4,
          "comment": "Flipped as well as rotated (determinant -1.0) — rt, not rotation. Identical box and gradient matrix in all three Training designs and in running/_base; only the first stop colour changes (near-white here, white on the Trackpants, near-black on Running men's).",
          "fills": [
            {
              "gt": [
                [
                  -1.7363,
                  -0.2115,
                  1.799
                ],
                [
                  0.2543,
                  -2.8369,
                  1.3611
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    237,
                    234,
                    233
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
          "name": "Hero shade · alternate",
          "rt": [
            [
              -0.94957,
              0.31356,
              1543.71
            ],
            [
              -0.31356,
              -0.94957,
              1757.41
            ]
          ],
          "w": 2104.41,
          "h": 1653.62,
          "comment": "Switched off in the Compression Top and the Shorts. Kept hidden so the designer can see the option.",
          "visible": false,
          "fills": [
            {
              "gt": [
                [
                  -1.6769,
                  -0.5822,
                  2.0699
                ],
                [
                  -1.8535,
                  -31.1008,
                  25.455
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    139,
                    139,
                    139
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
                  0.1339,
                  1.126,
                  -0.1929
                ],
                [
                  -1.126,
                  0.067,
                  0.996
                ]
              ],
              "stops": [
                [
                  0.2223,
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
          "role": "bgPhoto"
        },
        {
          "name": "image 395 · texture",
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
          "name": "Hero shade · right",
          "rt": [
            [
              0.94957,
              -0.31356,
              960.05
            ],
            [
              0.31356,
              0.94957,
              -237.72
            ]
          ],
          "w": 1205.98,
          "h": 1971.47,
          "comment": "The second accent layer. Same box in all three Training designs; the Compression Top and the Shorts share this gradient matrix, the Trackpants uses Running's. The stop colour is per-style art direction — see meta.artDirection.",
          "fills": [
            {
              "gt": [
                [
                  -0.6421,
                  -0.5016,
                  1.4194
                ],
                [
                  3.3802,
                  -13.1219,
                  6.6317
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    170,
                    82,
                    96
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
        }
      ],
      "bgPhoto": {
        "name": "Hero background photo · men's training",
        "x": 0,
        "y": -1,
        "w": 1575,
        "h": 1599,
        "fillOpacity": 0.45,
        "labelCorner": true,
        "label": "Hero background photo · men's training"
      },
      "word": {
        "name": "Hero word",
        "font": "hero",
        "size": 536.553,
        "lhPct": 87,
        "ls": -32.19,
        "upper": true,
        "align": "CENTER",
        "opacity": 0.24,
        "maxWidth": 1500,
        "y": 13.52,
        "comment": "ls is the original's -6% of 536.553px. At this size 'TRAIN' measures 1464 wide, exactly as in the originals; longer words are scaled down to maxWidth by the renderer.",
        "fills": [
          {
            "opacity": 0.67,
            "gt": [
              [
                0.0795,
                0.8811,
                0.2121
              ],
              [
                -8.6741,
                0.0795,
                5.2407
              ]
            ],
            "stops": [
              [
                0,
                [
                  8,
                  8,
                  8
                ],
                1
              ],
              [
                1,
                [
                  75,
                  92,
                  124
                ],
                1
              ]
            ]
          }
        ]
      },
      "italic": {
        "name": "Hero italic word",
        "font": "display",
        "size": 321.613,
        "lhPct": 87,
        "ls": -6.43,
        "upper": true,
        "align": "CENTER",
        "colorRole": "white",
        "opacity": 0.34,
        "maxWidth": 1440,
        "y": 412.46,
        "blur": 16.903
      },
      "model": {
        "comment": "DEFINED BUT NOT DRAWN in the men's hero — `hero.layers` carries no `model` role, so this slot is never placed. It is kept for three reasons: scripts/validate.js lists hero.model in RENDERER_REQUIRED, plugin-src/renderer.js reads hm.model inside the role closure with no guard, and training/_women.json overrides this object for the women's hero, which DOES place a model slot. It also preserves the measurement. Box is the Compression Top's; the Shorts uses (245, -3, 1157 x 1601) and the Trackpants (233, 0, 1192 x 1615). Re-enabling it means adding `{\"role\":\"model\"}` back to hero.layers — read meta.knownDeviations first; this has already been removed by the designer once and re-added by mistake.",
        "name": "Hero model photo · men's training",
        "x": 237,
        "y": 8,
        "w": 1170,
        "h": 1586,
        "fillOpacity": 0.35,
        "label": "Hero model photo · men's training"
      },
      "tagline": {
        "name": "Hero tagline",
        "font": "medium",
        "size": 35,
        "upper": true,
        "ls": 2.45,
        "colorRole": "tag",
        "align": "RIGHT",
        "width": 371,
        "x": 1140,
        "y": 706
      }
    },
    "fabric": {
      "box": {
        "name": "Card 2 · Fabric in Focus",
        "x": -3,
        "y": 1616,
        "w": 1578,
        "h": 1344,
        "radius": 5.672,
        "fillRole": "fabricBg"
      },
      "bgPhoto": {
        "name": "Fabric background photo",
        "x": 56,
        "y": 56,
        "w": 1467,
        "h": 1250,
        "labelCorner": true,
        "label": "Fabric background photo"
      },
      "closeup": {
        "name": "Fabric close-up",
        "x": 582,
        "y": 92,
        "w": 413,
        "h": 413,
        "circle": true,
        "labelSize": 30,
        "label": "Fabric close-up"
      },
      "comment": "fabric.box starts at y 1616 with height 1344, not the measured y 1599 / height 1361. The renderer draws the hero BEFORE the fabric card, so a box starting at 1599 would paint over the hero's bottom 17px — in the originals the hero is on top. Those 17px sit behind the hero either way, and the 'Dark overlay' layer carries y -17 so its gradient still covers exactly the original 1578 x 1361 box. The bottom still lands on 2960, the export slice boundary. Matches the convention in training/_women. The real Training fabric card (`Frame 852`) carries the dark veil as its OWN gradient fill plus a GLASS effect. The renderer fills the card with a solid palette role, so the veil is reproduced here as the full-size 'Dark overlay' layer (exactly as running/_base does) and the GLASS effect is dropped — see meta.notExpressible. Close-up diameters across the three designs are 443 / 413 / 378; all three are centred on the card's horizontal axis, and 413 (the Trackpants, and the median) is used.",
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "Photo wash",
          "x": 53.67,
          "y": 54.67,
          "w": 1473.96,
          "h": 1397.34,
          "opacity": 0.35,
          "comment": "Switched off in all three Training designs (Rectangle 42167) — kept here, hidden, so the option is visible to the designer.",
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
          "y": -17,
          "w": 1578,
          "h": 1361,
          "radius": 5.672,
          "fills": [
            {
              "opacity": 0.52,
              "gt": [
                [
                  0.4567,
                  0.3437,
                  0.1223
                ],
                [
                  -0.3437,
                  0.3301,
                  0.5301
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
                  0.5354,
                  [
                    21,
                    0,
                    0
                  ],
                  0.59
                ],
                [
                  1,
                  [
                    21,
                    0,
                    0
                  ],
                  0.51
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
        "y": 2192,
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
          "width": 1487,
          "bold": true
        },
        "divider": {
          "name": "Divider",
          "w": 613.4,
          "h": 1.671,
          "comment": "In the Training files this is a VECTOR line with a gradient STROKE (`Vector 87` / `Vector 88`), not a filled rectangle. Reproduced as a 1.671px rectangle carrying the identical gradient as a fill — same pixels.",
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
                  0.4723,
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
          "gap": 24,
          "cross": "CENTER",
          "max": 4,
          "comment": "24 is measured off the Trackpants' `Frame 861`, the only icon row in the three that is a real auto-layout hug (1077.26 = 304 + 243 + 304.26 + 154 + 3 x 24)."
        }
      },
      "overflowWarnY": 2950
    },
    "callouts": {
      "comment": "Card geometry is the Trackpants', the only men's Training design with four callouts. h4 = 2319.9 reproduces that frame at 1572 x 5380 (real 5379.69) and h3 = 1683.21 reproduces the Compression Top and the Shorts at 1572 x 4743 — both exactly, because frame.bottomPad is 0 and each height carries its own bottom padding. Both values still clear their last card (card 3 ends at 1656.21, card 4 at 2211.21), so nothing overhangs the box. The two 3-callout designs do pack their three cards ~45px tighter than the four-card rig; the card array here is the Trackpants', since one array has to serve both.",
      "frame": {
        "name": "Callouts",
        "x": 70.18,
        "y": 3059.79,
        "w": 1431.64,
        "h4": 2319.9,
        "h3": 1683.21
      },
      "barHeight": 385.44,
      "bar": {
        "name": "Bar",
        "comment": "The real bar is a single white gradient at paint opacity 0.58 on a rotated matrix. The renderer builds callout bars with the fixed LR/RL directions only, so the same ramp is expressed as three stops at 0.58 — the running/_base approximation, unchanged.",
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
        "lh": 75.71,
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
            "x": 64.82,
            "y": 4.21,
            "d": 519
          },
          "text": {
            "left": 733.82,
            "w": 655,
            "copyW": 622,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.5,
            "y": 612.68,
            "w": 1176.46,
            "flip": true
          },
          "photo": {
            "x": 849.82,
            "y": 542.21,
            "d": 519
          },
          "text": {
            "right": 673.82,
            "w": 593,
            "copyW": 559.71,
            "align": "RIGHT"
          }
        },
        {
          "bar": {
            "x": 266.55,
            "y": 1201.21,
            "w": 1052.68,
            "flip": false
          },
          "photo": {
            "x": 62.82,
            "y": 1131.21,
            "d": 525
          },
          "text": {
            "left": 734.82,
            "w": 621,
            "copyW": 621,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.66,
            "y": 1761.67,
            "w": 1176.46,
            "flip": true
          },
          "photo": {
            "x": 848.82,
            "y": 1692.21,
            "d": 519
          },
          "text": {
            "right": 673.82,
            "w": 647,
            "copyW": 647,
            "align": "RIGHT"
          }
        }
      ]
    },
    "comparison": {
      "comment": "NOT measured from any Training design — none of the three men's Training A+ files has a fit-comparison card. The geometry is carried over verbatim from running/_base (measured off the Running 706327) so that the plugin's manual 'add fit comparison to this frame' escape hatch still works on a Training frame. It stays off; re-measure it the day a Training design actually uses one.",
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
        "h": 2960
      },
      {
        "name": "2",
        "y": 2960,
        "hToEnd": true
      }
    ],
    "content": {
      "comment": "How one row of the live content sheet maps into this template. Columns are taken verbatim from the registry's sheet schema (backend/templates/index.json -> sheet), which is the single place the layout is defined: B=style IDs, C=category, G=headline ('TRAIN FEARLESS' — first word is the hero word, the rest the italic), H=tagline, I=fabric copy, J=composition, K=icons, L–O=the four features ('TITLE: body'), R=status, T=gender. Training rows already exist in that sheet.",
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
        "TRAIN",
        "FEARLESS",
        "For the bold and the relentless"
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
      "comment": "titleTallPx is 160 rather than Running's 125 because the Training callout title line height is 75.71px (126.176% of 60), so two lines are already 151px.",
      "titleTallPx": 160,
      "textTallerThanBarPx": 385
    }
  },
  "training/women/template-1": {
    "schema": "aplus.template/2",
    "renderer": "aplus-standard-v1",
    "meta": {
      "category": "training",
      "categoryLabel": "Training",
      "version": 1,
      "status": "active",
      "updated": "2026-11-27",
      "owner": "Rohit Ghosh, Catalog Design, Curefit / Cultstore",
      "notes": "The all-over-print women's Training A+: hero, Fabric in Focus, then 3 or 4 alternating callouts. Measured off 1097:1740 on Page 2 (styles 707841, 707842), the 3-callout 1572 x 4743 version. Every number is inherited from training/_women, which was measured from this frame — a row with four features renders 1572 x 5327 using the fourth callout slot taken from the Solid design.",
      "width": 1572,
      "sliceSplitY": 2956,
      "artDirection": {
        "comment": "Per-style, not per-gender. The two accent layers are the same ones the men's designs use — the body 'Wash · lower' and the hero 'Hero shade · right' — and the women's designs follow the same rule: the accent matches the garment. _women ships the All Over Print teal; template-2 ships the Solid crimson; the designer recolours those two layers for any other style.",
        "accentLayers": [
          "Wash · lower",
          "Hero shade · right"
        ],
        "measured": {
          "707041/707042/707044 · Compression Top Solid 2": {
            "wash": [
              170,
              72,
              89
            ],
            "heroShade": [
              170,
              82,
              96
            ]
          },
          "707564/707565/707566 · Trackpants Graphic": {
            "wash": [
              72,
              103,
              88
            ],
            "heroShade": [
              82,
              111,
              100
            ]
          },
          "707175/707176/707177 · Shorts Graphic 1": {
            "wash": [
              114,
              63,
              137
            ],
            "heroShade": [
              109,
              54,
              122
            ]
          },
          "707841/707842 · Shorts All Over Print (women)": {
            "wash": [
              94,
              161,
              146
            ],
            "heroShade": [
              71,
              153,
              130
            ]
          },
          "707835/707837/707838 · Shorts Solid (women)": {
            "wash": [
              154,
              28,
              54
            ],
            "heroShade": [
              143,
              24,
              50
            ]
          }
        }
      },
      "notExpressible": [
        "The fabric card (`Frame 852`) carries a GLASS effect (radius 16.903) in both women's designs. The renderer gives the fabric box a solid fill and no effects, so the effect is dropped; the card's gradient veil itself IS reproduced, as the 'Dark overlay' layer.",
        "The hero italic word is x-centred by the renderer. Both originals place it at x 139.6, about 35px right of a centred 105, which the manifest cannot express because hero.italic has no x. Same deviation the men's designs have.",
        "The callout bar's real paint is one white gradient at opacity 0.58 on the matrix [[1.391,0.014,-0.414],[-0.144,1.391,-0.153]]. Resolving that matrix gives solid 58% out to 29.8% of the width then a fade to ~1% — which is what training/_base's three-stop LR approximation already draws, so it is inherited unchanged. Only the matrix's slight shear is lost.",
        "The fabric close-up ring EXISTS in both women's designs (Ellipse 801, white stroke 1.937px at 47% opacity) but is SWITCHED OFF in both. The renderer's `ring` role has no hidden state — it draws the ring unconditionally — so `fabric.ring` is deliberately omitted rather than shipped visible. This is the one place the women's Running split does not carry over: Running women's rings are on, Training women's are off.",
        "The `Fabric in Focus` heading carries a disabled DROP_SHADOW in both designs; the renderer's textStack has no effects field, so it is not reproduced (it is switched off anyway)."
      ],
      "knownDeviations": [
        "fabric.box starts at y 1616 with height 1340, not at the original Frame 852's y 1595 / height 1361. The renderer draws the hero BEFORE the fabric card, so a box starting at 1595 would paint over the hero's bottom 21px — in the originals the hero is on top. Those 21px are hidden behind the hero either way, and the 'Dark overlay' layer is offset by -21 so its gradient covers exactly the original 1578 x 1361 box. Bottom lands on 2956, the export slice boundary. This is a different convention from training/_base, which keeps the men's box at its measured y.",
        "'Wash · lower' is bottom-anchored, but the two women's frames disagree about the anchor: All Over Print sits 144.758px BELOW its bottom edge and Solid 145.242px ABOVE it. There is no reconciling value, so each template carries its own. Its gradient matrix is also the 3-callout lineage's ([[-0.701,-0.083,1.107],[1.211,-14.502,7.637]]), not the Running/Trackpants matrix training/_base inherits.",
        "callouts.title.lh is 60, not the base's 75.71. The women's callout titles measure 60px on a single line and 53-54px on two; 60 is the single-line measurement and matches the Running templates. warnings.titleTallPx goes back to 125 to suit it.",
        "Hidden leftovers NOT reproduced, matching the base's choice: a hidden duplicate of 'Glow · right lower' (Ellipse 87), a hidden wash entirely below the frame (Rectangle 42140, y 5685), a hidden fabric photo belonging to an unrelated style (705963_C), and a second, duplicated close-up mask group in the fabric card. The hidden layers that ARE reproduced are the alternate BG gradient, the alternate hero shade and the fabric Photo wash."
      ],
      "gender": "women",
      "genderLabel": "Women",
      "label": "Training · Women · All Over Print"
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
      "comment": "ink and tag are read off the real Training text nodes (callout copy rgb(21,0,0), hero tagline rgb(113,119,124)). fabricBg is carried over from running/_base: the Training fabric card (Frame 852) has NO solid base fill at all, only the dark gradient that this manifest draws as the 'Dark overlay' layer, so a base colour had to be chosen — it is almost entirely covered by the fabric photo and the overlay.",
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
      "comment": "Both women's frames end flush: 3027 + 1694.148 callouts + 21.852 = 4743, and 3027 + 2300 + 0 = 5327. The dialect has one bottomPad, so it is 0 and the All Over Print frame's 21.852px trailing pad is folded into callouts.frame.h3 (1716). The callouts frame is unfilled and unclipped, so its height only ever sizes the page.",
      "fillRole": "white",
      "clip": true,
      "bottomPad": 0
    },
    "background": {
      "comment": "Frame-level art of 1097:1740, bottom to top. Same stack as training/_base — only 'Wash · lower' differs, in both placement and gradient matrix. Restated in full because `extends` replaces arrays rather than merging them.",
      "layers": [
        {
          "name": "BG gradient",
          "x": -10,
          "y": 1616,
          "w": 1697,
          "hToFramePlus": 0,
          "fills": [
            {
              "gt": [
                [
                  0,
                  1.664,
                  -0.687
                ],
                [
                  -1.664,
                  0,
                  1.332
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
                  0.394,
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
          "x": -627.635,
          "y": 2121.092,
          "w": 1720.796,
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
          "name": "BG gradient · alternate",
          "x": -11.328,
          "y": 3008.417,
          "w": 1699.25,
          "h": 1784.865,
          "comment": "Switched off in both women's designs (Rectangle 42153). Kept hidden so the option stays visible to the designer.",
          "visible": false,
          "fills": [
            {
              "gt": [
                [
                  0,
                  0.894,
                  0
                ],
                [
                  -0.894,
                  0,
                  0.947
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    204,
                    209,
                    213
                  ],
                  1
                ],
                [
                  0.433,
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
          "name": "Glow · right lower",
          "shape": "ellipse",
          "x": 904.35,
          "y": 3912.198,
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
          "x": 737.086,
          "y": 3171.139,
          "w": 1370.967,
          "h": 969.542,
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
                  0.222,
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
          "x": -498.934,
          "y": 3799.368,
          "w": 1720.796,
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
          "name": "Wash · lower",
          "rt": [
            [
              -0.909,
              -0.417,
              1190.389
            ],
            [
              0.417,
              -0.909,
              4887.758
            ]
          ],
          "yFromBottom": -144.758,
          "w": 1083.756,
          "h": 2786.279,
          "comment": "A PURE ROTATION of about 155.4 deg (determinant +1.0), NOT a flip — an earlier revision of this comment claimed a negative determinant, which is wrong. In this stack the flipped background layer is 'Wash · fabric' (det -0.998), as training/_base now records. The whole relativeTransform is stored regardless, which is correct and lossless. The accent layer — teal here, crimson on the Solid design. Bottom-anchored, but the original's ty is 4887.758 on a 4743-tall frame, i.e. 144.758px BELOW the bottom edge, hence the negative yFromBottom. Different gradient matrix from training/_base.",
          "fills": [
            {
              "gt": [
                [
                  -0.701,
                  -0.083,
                  1.107
                ],
                [
                  1.211,
                  -14.502,
                  7.637
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    94,
                    161,
                    146
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
              162.271
            ],
            [
              -0.417,
              0.909,
              2152.149
            ]
          ],
          "w": 1083.756,
          "h": 2786.279,
          "fills": [
            {
              "opacity": 0.32,
              "gt": [
                [
                  -1.203,
                  0.36,
                  0.934
                ],
                [
                  0.495,
                  -25.564,
                  13.235
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
          "name": "Wash · fabric",
          "rt": [
            [
              0.921,
              -0.337,
              194.04
            ],
            [
              -0.389,
              -0.941,
              3512.892
            ]
          ],
          "w": 2325.05,
          "h": 1942.022,
          "fills": [
            {
              "gt": [
                [
                  -0.555,
                  -0.404,
                  1.294
                ],
                [
                  3.469,
                  -11.673,
                  1.417
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
        }
      ]
    },
    "hero": {
      "name": "Card 1 · Hero",
      "x": 0,
      "y": 0,
      "w": 1575,
      "h": 1616,
      "fill": "white",
      "comment": "The women's hero stacks differently from the men's: the full-bleed backing plate is the BOTTOM-most layer, there is only ONE halftone texture (the men's designs carry image 394 AND image 395), there is no shared backdrop graphic, and the bottom shade is drawn BELOW the right-hand shade. Order here is 1097:1740's own, layer for layer. The real frame has NO fill — the dialect always paints one solid, so it is white, the same as the page frame underneath, and the backing-plate slot covers it edge to edge anyway.",
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "image 394 · texture",
          "x": -1085.187,
          "y": -66.687,
          "w": 2961.445,
          "h": 1681.681,
          "fills": [
            {
              "image": "28773688fac2f933786c5bb29507ca5cefb5429b",
              "scale": "FILL",
              "opacity": 0.07,
              "scalingFactor": 0.5,
              "rotation": 0,
              "imageTransform": [
                [
                  1,
                  0,
                  0
                ],
                [
                  0,
                  1,
                  0
                ]
              ],
              "filters": {
                "exposure": -1,
                "contrast": 0,
                "saturation": 0,
                "temperature": 0,
                "tint": 0,
                "highlights": 0,
                "shadows": 0
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
          "w": 1584.847,
          "h": 2361.402,
          "comment": "Flipped as well as rotated. Box, matrix and the off-white first stop are identical to the men's designs.",
          "fills": [
            {
              "gt": [
                [
                  -1.736,
                  -0.212,
                  1.799
                ],
                [
                  0.254,
                  -2.837,
                  1.361
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    237,
                    234,
                    233
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
          "name": "Hero shade · right",
          "rt": [
            [
              0.95,
              -0.314,
              960.047
            ],
            [
              0.314,
              0.95,
              -237.722
            ]
          ],
          "w": 1205.983,
          "h": 1971.466,
          "comment": "Box and gradient matrix identical to the men's; only the stop colour is per-style. Teal on the All Over Print design because the garment is teal — see meta.artDirection.",
          "fills": [
            {
              "gt": [
                [
                  -0.642,
                  -0.502,
                  1.419
                ],
                [
                  3.38,
                  -13.122,
                  6.632
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    71,
                    153,
                    130
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
          "name": "Hero shade · alternate",
          "rt": [
            [
              -0.95,
              0.314,
              1543.709
            ],
            [
              -0.314,
              -0.95,
              1757.408
            ]
          ],
          "w": 2104.408,
          "h": 1653.617,
          "comment": "Switched off in both women's designs, as in the men's. Kept hidden so the designer can see the option.",
          "visible": false,
          "fills": [
            {
              "gt": [
                [
                  -1.677,
                  -0.582,
                  2.07
                ],
                [
                  -1.853,
                  -31.101,
                  25.455
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    139,
                    139,
                    139
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
          "name": "Hero glow",
          "shape": "ellipse",
          "x": 601.756,
          "y": -530.762,
          "w": 1572,
          "h": 1311.69,
          "opacity": 0.64,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0.134,
                  1.126,
                  -0.193
                ],
                [
                  -1.126,
                  0.067,
                  0.996
                ]
              ],
              "stops": [
                [
                  0.222,
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
        "x": -77,
        "y": -201,
        "w": 1730,
        "h": 2080,
        "fillOpacity": 0.45,
        "labelCorner": true,
        "label": "Hero background photo (full bleed)"
      },
      "word": {
        "name": "Hero word",
        "font": "hero",
        "size": 536.553,
        "lhPct": 87,
        "ls": -32.19,
        "upper": true,
        "align": "CENTER",
        "opacity": 0.24,
        "maxWidth": 1500,
        "y": 13.52,
        "comment": "ls is the original's -6% of 536.553px. At this size 'TRAIN' measures 1464 wide, exactly as in the originals; longer words are scaled down to maxWidth by the renderer.",
        "fills": [
          {
            "opacity": 0.67,
            "gt": [
              [
                0.0795,
                0.8811,
                0.2121
              ],
              [
                -8.6741,
                0.0795,
                5.2407
              ]
            ],
            "stops": [
              [
                0,
                [
                  8,
                  8,
                  8
                ],
                1
              ],
              [
                1,
                [
                  75,
                  92,
                  124
                ],
                1
              ]
            ]
          }
        ]
      },
      "italic": {
        "name": "Hero italic word",
        "font": "display",
        "size": 321.613,
        "lhPct": 87,
        "ls": -6.43,
        "upper": true,
        "align": "CENTER",
        "colorRole": "white",
        "opacity": 0.34,
        "maxWidth": 1440,
        "y": 412.46,
        "blur": 16.903
      },
      "model": {
        "comment": "Measured off 705540_D bg 1. The women's heroes carry a single model photograph, not the men's stack.",
        "name": "Hero model photo · women's training",
        "x": 250,
        "y": 120,
        "w": 1076,
        "h": 1438,
        "fillOpacity": 0.35,
        "label": "Hero model photo · women's training"
      },
      "tagline": {
        "name": "Hero tagline",
        "font": "medium",
        "size": 35,
        "upper": true,
        "ls": 2.45,
        "colorRole": "tag",
        "align": "RIGHT",
        "width": 371,
        "x": 1140,
        "y": 706
      }
    },
    "fabric": {
      "box": {
        "name": "Card 2 · Fabric in Focus",
        "x": -3,
        "y": 1616,
        "w": 1578,
        "h": 1340,
        "radius": 5.672,
        "fillRole": "fabricBg"
      },
      "bgPhoto": {
        "name": "Fabric background photo",
        "x": 55.686,
        "y": 38.611,
        "w": 1467.337,
        "h": 1395.578,
        "labelCorner": true,
        "label": "Fabric background photo"
      },
      "closeup": {
        "name": "Fabric close-up",
        "x": 537,
        "y": 51,
        "w": 460.055,
        "h": 460.055,
        "circle": true,
        "labelSize": 30,
        "label": "Fabric close-up"
      },
      "comment": "Same construction as training/_base — the real card is a transparent frame whose own FILL is the dark veil — but the women's box is started at 1616 instead of its measured 1595 so the renderer does not paint over the hero; see meta.knownDeviations. The 'Dark overlay' layer carries y -21 to compensate, so its gradient covers exactly the original 1578 x 1361 box.",
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "Photo wash",
          "x": 53.628,
          "y": 37.675,
          "w": 1473.961,
          "h": 1397.341,
          "opacity": 0.35,
          "comment": "Switched off in both women's designs (Rectangle 42167) — kept hidden so the option is visible to the designer.",
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
          "y": -21,
          "w": 1578,
          "h": 1361,
          "radius": 5.672,
          "fills": [
            {
              "opacity": 0.52,
              "gt": [
                [
                  0.457,
                  0.344,
                  0.122
                ],
                [
                  -0.344,
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
                  0.535,
                  [
                    21,
                    0,
                    0
                  ],
                  0.6
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
        "y": 2152.009,
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
          "width": 1193,
          "bold": true
        },
        "divider": {
          "name": "Divider",
          "w": 613.4,
          "h": 1.671,
          "comment": "In the Training files this is a VECTOR line with a gradient STROKE (`Vector 87` / `Vector 88`), not a filled rectangle. Reproduced as a 1.671px rectangle carrying the identical gradient as a fill — same pixels.",
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
                  0.4723,
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
          "gap": 58,
          "cross": "CENTER",
          "max": 4,
          "comment": "24 is measured off the Trackpants' `Frame 861`, the only icon row in the three that is a real auto-layout hug (1077.26 = 304 + 243 + 304.26 + 154 + 3 x 24)."
        }
      },
      "overflowWarnY": 2950
    },
    "callouts": {
      "comment": "Cards 1-3 are the All Over Print frame's (1097:1752). Card 4 is the Solid frame's, because the All Over Print design has only three — it is the only measurement of a fourth women's Training callout that exists. h3 carries the All Over Print frame's 21.852px trailing pad (see frame.bottomPad); h4 is the Solid frame's callout frame exactly. Unlike training/_base, these reproduce BOTH real page sizes: 4743 on three cards and 5327 on four.",
      "frame": {
        "name": "Callouts",
        "x": 70.305,
        "y": 3027,
        "w": 1431.634,
        "h4": 2300,
        "h3": 1716
      },
      "barHeight": 385.442,
      "bar": {
        "name": "Bar",
        "comment": "The real bar is a single white gradient at paint opacity 0.58 on a rotated matrix. The renderer builds callout bars with the fixed LR/RL directions only, so the same ramp is expressed as three stops at 0.58 — the running/_base approximation, unchanged.",
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
            "x": 247.119,
            "y": 71.312,
            "w": 1081.83,
            "flip": false
          },
          "photo": {
            "x": 68.303,
            "y": 7.542,
            "d": 517.239
          },
          "text": {
            "left": 729.695,
            "w": 663,
            "copyW": 634,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.493,
            "y": 612.674,
            "w": 1176.464,
            "flip": true
          },
          "photo": {
            "x": 849.23,
            "y": 545,
            "d": 517.239
          },
          "text": {
            "right": 693.695,
            "w": 626,
            "copyW": 626,
            "align": "RIGHT"
          }
        },
        {
          "bar": {
            "x": 266.553,
            "y": 1200.646,
            "w": 1052.679,
            "flip": false
          },
          "photo": {
            "x": 68.301,
            "y": 1133,
            "d": 517.239
          },
          "text": {
            "left": 730.695,
            "w": 598,
            "copyW": 598,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 125.798,
            "y": 1746,
            "w": 1176.464,
            "flip": true
          },
          "photo": {
            "x": 862,
            "y": 1680,
            "d": 517.239
          },
          "text": {
            "right": 697,
            "w": 622,
            "copyW": 612,
            "align": "RIGHT"
          }
        }
      ]
    },
    "comparison": {
      "comment": "NOT measured from any Training design — none of the three men's Training A+ files has a fit-comparison card. The geometry is carried over verbatim from running/_base (measured off the Running 706327) so that the plugin's manual 'add fit comparison to this frame' escape hatch still works on a Training frame. It stays off; re-measure it the day a Training design actually uses one.",
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
        "h": 2956
      },
      {
        "name": "2",
        "y": 2956,
        "hToEnd": true
      }
    ],
    "content": {
      "comment": "How one row of the live content sheet maps into this template. Columns are taken verbatim from the registry's sheet schema (backend/templates/index.json -> sheet), which is the single place the layout is defined: B=style IDs, C=category, G=headline ('TRAIN FEARLESS' — first word is the hero word, the rest the italic), H=tagline, I=fabric copy, J=composition, K=icons, L–O=the four features ('TITLE: body'), R=status, T=gender. Training rows already exist in that sheet.",
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
        "TRAIN",
        "FEARLESS",
        "For the bold and the relentless"
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
      "comment": "titleTallPx is 160 rather than Running's 125 because the Training callout title line height is 75.71px (126.176% of 60), so two lines are already 151px.",
      "titleTallPx": 125,
      "textTallerThanBarPx": 385
    }
  },
  "training/women/template-2": {
    "schema": "aplus.template/2",
    "renderer": "aplus-standard-v1",
    "meta": {
      "category": "training",
      "categoryLabel": "Training",
      "version": 1,
      "status": "active",
      "updated": "2026-11-27",
      "owner": "Rohit Ghosh, Catalog Design, Curefit / Cultstore",
      "notes": "The solid-colour women's Training A+, measured layer for layer off 1097:1861 on Page 2 (styles 707835, 707837, 707838) — the 4-callout, 1572 x 5327 version. It is not a structural variant of All Over Print: hero, Fabric in Focus and the callouts are the same construction, and the 4743 / 5327 difference is just 3 vs 4 callouts. What genuinely differs, and is restated here, is the art direction (crimson accent instead of teal, and a harder middle stop on the fabric veil), the hero backing-plate and model boxes, a larger fabric close-up, a lower and wider fabric text block, a wider icon row, and the four callout cards' own geometry. background.layers and hero.layers are restated in full because `extends` replaces arrays rather than merging them.",
      "width": 1572,
      "sliceSplitY": 2956,
      "artDirection": {
        "comment": "This template ships the Solid design's crimson on the two accent layers ('Wash · lower' and 'Hero shade · right'). See training/_women for the All Over Print teal and for the rule.",
        "accentLayers": [
          "Wash · lower",
          "Hero shade · right"
        ],
        "measured": {
          "707041/707042/707044 · Compression Top Solid 2": {
            "wash": [
              170,
              72,
              89
            ],
            "heroShade": [
              170,
              82,
              96
            ]
          },
          "707564/707565/707566 · Trackpants Graphic": {
            "wash": [
              72,
              103,
              88
            ],
            "heroShade": [
              82,
              111,
              100
            ]
          },
          "707175/707176/707177 · Shorts Graphic 1": {
            "wash": [
              114,
              63,
              137
            ],
            "heroShade": [
              109,
              54,
              122
            ]
          },
          "707841/707842 · Shorts All Over Print (women)": {
            "wash": [
              94,
              161,
              146
            ],
            "heroShade": [
              71,
              153,
              130
            ]
          },
          "707835/707837/707838 · Shorts Solid (women)": {
            "wash": [
              154,
              28,
              54
            ],
            "heroShade": [
              143,
              24,
              50
            ]
          }
        }
      },
      "notExpressible": [
        "The fabric card (`Frame 852`) carries a GLASS effect (radius 16.903) in both women's designs. The renderer gives the fabric box a solid fill and no effects, so the effect is dropped; the card's gradient veil itself IS reproduced, as the 'Dark overlay' layer.",
        "The hero italic word is x-centred by the renderer. Both originals place it at x 139.6, about 35px right of a centred 105, which the manifest cannot express because hero.italic has no x. Same deviation the men's designs have.",
        "The callout bar's real paint is one white gradient at opacity 0.58 on the matrix [[1.391,0.014,-0.414],[-0.144,1.391,-0.153]]. Resolving that matrix gives solid 58% out to 29.8% of the width then a fade to ~1% — which is what training/_base's three-stop LR approximation already draws, so it is inherited unchanged. Only the matrix's slight shear is lost.",
        "The fabric close-up ring EXISTS in both women's designs (Ellipse 801, white stroke 1.937px at 47% opacity) but is SWITCHED OFF in both. The renderer's `ring` role has no hidden state — it draws the ring unconditionally — so `fabric.ring` is deliberately omitted rather than shipped visible. This is the one place the women's Running split does not carry over: Running women's rings are on, Training women's are off.",
        "The `Fabric in Focus` heading carries a disabled DROP_SHADOW in both designs; the renderer's textStack has no effects field, so it is not reproduced (it is switched off anyway)."
      ],
      "knownDeviations": [
        "fabric.box starts at y 1616 with height 1340, not at the original Frame 852's y 1595 / height 1361. The renderer draws the hero BEFORE the fabric card, so a box starting at 1595 would paint over the hero's bottom 21px — in the originals the hero is on top. Those 21px are hidden behind the hero either way, and the 'Dark overlay' layer is offset by -21 so its gradient covers exactly the original 1578 x 1361 box. Bottom lands on 2956, the export slice boundary. This is a different convention from training/_base, which keeps the men's box at its measured y.",
        "'Wash · lower' is bottom-anchored, but the two women's frames disagree about the anchor: All Over Print sits 144.758px BELOW its bottom edge and Solid 145.242px ABOVE it. There is no reconciling value, so each template carries its own. Its gradient matrix is also the 3-callout lineage's ([[-0.701,-0.083,1.107],[1.211,-14.502,7.637]]), not the Running/Trackpants matrix training/_base inherits.",
        "callouts.title.lh is 60, not the base's 75.71. The women's callout titles measure 60px on a single line and 53-54px on two; 60 is the single-line measurement and matches the Running templates. warnings.titleTallPx goes back to 125 to suit it.",
        "Hidden leftovers NOT reproduced, matching the base's choice: a hidden duplicate of 'Glow · right lower' (Ellipse 87), a hidden wash entirely below the frame (Rectangle 42140, y 5685), a hidden fabric photo belonging to an unrelated style (705963_C), and a second, duplicated close-up mask group in the fabric card. The hidden layers that ARE reproduced are the alternate BG gradient, the alternate hero shade and the fabric Photo wash."
      ],
      "gender": "women",
      "genderLabel": "Women",
      "label": "Training · Women · Solid"
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
      "comment": "ink and tag are read off the real Training text nodes (callout copy rgb(21,0,0), hero tagline rgb(113,119,124)). fabricBg is carried over from running/_base: the Training fabric card (Frame 852) has NO solid base fill at all, only the dark gradient that this manifest draws as the 'Dark overlay' layer, so a base colour had to be chosen — it is almost entirely covered by the fabric photo and the overlay.",
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
      "comment": "Both women's frames end flush: 3027 + 1694.148 callouts + 21.852 = 4743, and 3027 + 2300 + 0 = 5327. The dialect has one bottomPad, so it is 0 and the All Over Print frame's 21.852px trailing pad is folded into callouts.frame.h3 (1716). The callouts frame is unfilled and unclipped, so its height only ever sizes the page.",
      "fillRole": "white",
      "clip": true,
      "bottomPad": 0
    },
    "background": {
      "comment": "Frame-level art of 1097:1740, bottom to top. Same stack as training/_base — only 'Wash · lower' differs, in both placement and gradient matrix. Restated in full because `extends` replaces arrays rather than merging them.",
      "layers": [
        {
          "name": "BG gradient",
          "x": -10,
          "y": 1616,
          "w": 1697,
          "hToFramePlus": 0,
          "fills": [
            {
              "gt": [
                [
                  0,
                  1.664,
                  -0.687
                ],
                [
                  -1.664,
                  0,
                  1.332
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
                  0.394,
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
          "x": -627.635,
          "y": 2121.094,
          "w": 1720.796,
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
          "name": "BG gradient · alternate",
          "x": -11.328,
          "y": 3008.414,
          "w": 1699.25,
          "h": 1784.865,
          "visible": false,
          "fills": [
            {
              "gt": [
                [
                  0,
                  0.894,
                  0
                ],
                [
                  -0.894,
                  0,
                  0.947
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    204,
                    209,
                    213
                  ],
                  1
                ],
                [
                  0.433,
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
          "name": "Glow · right lower",
          "shape": "ellipse",
          "x": 904.35,
          "y": 3912.195,
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
          "x": 737.086,
          "y": 3171.141,
          "w": 1370.967,
          "h": 969.542,
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
                  0.222,
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
          "x": -498.934,
          "y": 3799.367,
          "w": 1720.796,
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
          "name": "Wash · lower",
          "rt": [
            [
              -0.909,
              -0.417,
              1124.389
            ],
            [
              0.417,
              -0.909,
              5181.758
            ]
          ],
          "yFromBottom": 145.242,
          "w": 1083.756,
          "h": 2786.279,
          "comment": "Crimson here, teal on the All Over Print design — the accent follows the garment. Bottom-anchored: the original's ty is 5181.758 on a 5327-tall frame, i.e. 145.242px above the bottom edge. The two women's frames do not agree on this anchor (All Over Print sits 144.758px BELOW its bottom edge), so each template carries its own.",
          "fills": [
            {
              "gt": [
                [
                  -0.701,
                  -0.083,
                  1.107
                ],
                [
                  1.211,
                  -14.502,
                  7.637
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    154,
                    28,
                    54
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
              162.271
            ],
            [
              -0.417,
              0.909,
              2152.148
            ]
          ],
          "w": 1083.756,
          "h": 2786.279,
          "fills": [
            {
              "opacity": 0.32,
              "gt": [
                [
                  -1.203,
                  0.36,
                  0.934
                ],
                [
                  0.495,
                  -25.564,
                  13.235
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
          "name": "Wash · fabric",
          "rt": [
            [
              0.921,
              -0.337,
              194.08
            ],
            [
              -0.389,
              -0.941,
              3512.977
            ]
          ],
          "w": 2325.05,
          "h": 1942.022,
          "fills": [
            {
              "gt": [
                [
                  -0.555,
                  -0.404,
                  1.294
                ],
                [
                  3.469,
                  -11.673,
                  1.417
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
        }
      ]
    },
    "hero": {
      "name": "Card 1 · Hero",
      "x": 0,
      "y": 0,
      "w": 1575,
      "h": 1616,
      "fill": "white",
      "comment": "Same stack as All Over Print, layer for layer; only the right-hand shade's colour and the two photo boxes differ.",
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "image 394 · texture",
          "x": -1085.187,
          "y": -66.687,
          "w": 2961.445,
          "h": 1681.681,
          "fills": [
            {
              "image": "28773688fac2f933786c5bb29507ca5cefb5429b",
              "scale": "FILL",
              "opacity": 0.07,
              "scalingFactor": 0.5,
              "rotation": 0,
              "imageTransform": [
                [
                  1,
                  0,
                  0
                ],
                [
                  0,
                  1,
                  0
                ]
              ],
              "filters": {
                "exposure": -1,
                "contrast": 0,
                "saturation": 0,
                "temperature": 0,
                "tint": 0,
                "highlights": 0,
                "shadows": 0
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
          "w": 1584.847,
          "h": 2361.402,
          "fills": [
            {
              "gt": [
                [
                  -1.736,
                  -0.212,
                  1.799
                ],
                [
                  0.254,
                  -2.837,
                  1.361
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    237,
                    234,
                    233
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
          "name": "Hero shade · right",
          "rt": [
            [
              0.95,
              -0.314,
              960.047
            ],
            [
              0.314,
              0.95,
              -237.719
            ]
          ],
          "w": 1205.983,
          "h": 1971.466,
          "fills": [
            {
              "gt": [
                [
                  -0.642,
                  -0.502,
                  1.419
                ],
                [
                  3.38,
                  -13.122,
                  6.632
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    143,
                    24,
                    50
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
          "name": "Hero shade · alternate",
          "rt": [
            [
              -0.95,
              0.314,
              1543.709
            ],
            [
              -0.314,
              -0.95,
              1757.406
            ]
          ],
          "w": 2104.408,
          "h": 1653.617,
          "visible": false,
          "fills": [
            {
              "gt": [
                [
                  -1.677,
                  -0.582,
                  2.07
                ],
                [
                  -1.853,
                  -31.101,
                  25.455
                ]
              ],
              "stops": [
                [
                  0,
                  [
                    139,
                    139,
                    139
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
          "name": "Hero glow",
          "shape": "ellipse",
          "x": 601.756,
          "y": -530.758,
          "w": 1572,
          "h": 1311.69,
          "opacity": 0.64,
          "fills": [
            {
              "radial": true,
              "gt": [
                [
                  0.134,
                  1.126,
                  -0.193
                ],
                [
                  -1.126,
                  0.067,
                  0.996
                ]
              ],
              "stops": [
                [
                  0.222,
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
        "x": -142,
        "y": -178,
        "w": 1859,
        "h": 2026,
        "fillOpacity": 0.45,
        "labelCorner": true,
        "label": "Hero background photo (full bleed)"
      },
      "word": {
        "name": "Hero word",
        "font": "hero",
        "size": 536.553,
        "lhPct": 87,
        "ls": -32.19,
        "upper": true,
        "align": "CENTER",
        "opacity": 0.24,
        "maxWidth": 1500,
        "y": 13.52,
        "comment": "ls is the original's -6% of 536.553px. At this size 'TRAIN' measures 1464 wide, exactly as in the originals; longer words are scaled down to maxWidth by the renderer.",
        "fills": [
          {
            "opacity": 0.67,
            "gt": [
              [
                0.0795,
                0.8811,
                0.2121
              ],
              [
                -8.6741,
                0.0795,
                5.2407
              ]
            ],
            "stops": [
              [
                0,
                [
                  8,
                  8,
                  8
                ],
                1
              ],
              [
                1,
                [
                  75,
                  92,
                  124
                ],
                1
              ]
            ]
          }
        ]
      },
      "italic": {
        "name": "Hero italic word",
        "font": "display",
        "size": 321.613,
        "lhPct": 87,
        "ls": -6.43,
        "upper": true,
        "align": "CENTER",
        "colorRole": "white",
        "opacity": 0.34,
        "maxWidth": 1440,
        "y": 412.46,
        "blur": 16.903
      },
      "model": {
        "comment": "Measured off 705540_D bg 1. The women's heroes carry a single model photograph, not the men's stack.",
        "name": "Hero model photo · women's training",
        "x": 251,
        "y": 120,
        "w": 1074,
        "h": 1431,
        "fillOpacity": 0.35,
        "label": "Hero model photo · women's training"
      },
      "tagline": {
        "name": "Hero tagline",
        "font": "medium",
        "size": 35,
        "upper": true,
        "ls": 2.45,
        "colorRole": "tag",
        "align": "RIGHT",
        "width": 371,
        "x": 1140,
        "y": 706
      }
    },
    "fabric": {
      "box": {
        "name": "Card 2 · Fabric in Focus",
        "x": -3,
        "y": 1616,
        "w": 1578,
        "h": 1340,
        "radius": 5.672,
        "fillRole": "fabricBg"
      },
      "bgPhoto": {
        "name": "Fabric background photo",
        "x": 55.727,
        "y": 38.617,
        "w": 1467.337,
        "h": 1395.578,
        "labelCorner": true,
        "label": "Fabric background photo"
      },
      "closeup": {
        "name": "Fabric close-up",
        "x": 531.001,
        "y": 58.999,
        "w": 503.634,
        "h": 503.634,
        "circle": true,
        "labelSize": 32,
        "label": "Fabric close-up"
      },
      "comment": "Same construction as training/_base — the real card is a transparent frame whose own FILL is the dark veil — but the women's box is started at 1616 instead of its measured 1595 so the renderer does not paint over the hero; see meta.knownDeviations. The 'Dark overlay' layer carries y -21 to compensate, so its gradient covers exactly the original 1578 x 1361 box.",
      "layers": [
        {
          "role": "bgPhoto"
        },
        {
          "name": "Photo wash",
          "x": 53.668,
          "y": 37.68,
          "w": 1473.961,
          "h": 1397.341,
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
          "name": "Dark overlay",
          "x": 0,
          "y": -21,
          "w": 1578,
          "h": 1361,
          "radius": 5.672,
          "comment": "Same veil as All Over Print except the middle stop, which here is opaque pure black rather than 60% of the ink colour — the Solid design's fabric band is noticeably darker through the middle.",
          "fills": [
            {
              "opacity": 0.52,
              "gt": [
                [
                  0.457,
                  0.344,
                  0.122
                ],
                [
                  -0.344,
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
                  0.535,
                  [
                    0,
                    0,
                    0
                  ],
                  1
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
        "y": 2212,
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
          "width": 1315,
          "bold": true
        },
        "divider": {
          "name": "Divider",
          "w": 613.4,
          "h": 1.671,
          "comment": "In the Training files this is a VECTOR line with a gradient STROKE (`Vector 87` / `Vector 88`), not a filled rectangle. Reproduced as a 1.671px rectangle carrying the identical gradient as a fill — same pixels.",
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
                  0.4723,
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
          "gap": 88,
          "cross": "CENTER",
          "max": 4,
          "comment": "24 is measured off the Trackpants' `Frame 861`, the only icon row in the three that is a real auto-layout hug (1077.26 = 304 + 243 + 304.26 + 154 + 3 x 24)."
        }
      },
      "overflowWarnY": 2950
    },
    "callouts": {
      "comment": "All four cards measured off 1097:1873. Reproduces the real 1572 x 5327 page exactly.",
      "frame": {
        "name": "Callouts",
        "x": 70,
        "y": 3027,
        "w": 1432,
        "h4": 2300,
        "h3": 1716
      },
      "barHeight": 385.442,
      "bar": {
        "name": "Bar",
        "comment": "The real bar is a single white gradient at paint opacity 0.58 on a rotated matrix. The renderer builds callout bars with the fixed LR/RL directions only, so the same ramp is expressed as three stops at 0.58 — the running/_base approximation, unchanged.",
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
            "x": 247.119,
            "y": 71.313,
            "w": 1081.83,
            "flip": false
          },
          "photo": {
            "x": 68.303,
            "y": 7.539,
            "d": 517.239
          },
          "text": {
            "left": 732.695,
            "w": 685,
            "copyW": 685,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 105.493,
            "y": 612,
            "w": 1176.464,
            "flip": true
          },
          "photo": {
            "x": 841.695,
            "y": 546,
            "d": 517.239
          },
          "text": {
            "right": 697,
            "w": 665,
            "copyW": 665,
            "align": "RIGHT"
          }
        },
        {
          "bar": {
            "x": 266.553,
            "y": 1208,
            "w": 1052.679,
            "flip": false
          },
          "photo": {
            "x": 68.695,
            "y": 1142,
            "d": 517.239
          },
          "text": {
            "left": 733,
            "w": 661,
            "copyW": 661,
            "align": "LEFT"
          }
        },
        {
          "bar": {
            "x": 125.798,
            "y": 1746,
            "w": 1176.464,
            "flip": true
          },
          "photo": {
            "x": 862,
            "y": 1680,
            "d": 517.239
          },
          "text": {
            "right": 697,
            "w": 622,
            "copyW": 612,
            "align": "RIGHT"
          }
        }
      ]
    },
    "comparison": {
      "comment": "NOT measured from any Training design — none of the three men's Training A+ files has a fit-comparison card. The geometry is carried over verbatim from running/_base (measured off the Running 706327) so that the plugin's manual 'add fit comparison to this frame' escape hatch still works on a Training frame. It stays off; re-measure it the day a Training design actually uses one.",
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
        "h": 2956
      },
      {
        "name": "2",
        "y": 2956,
        "hToEnd": true
      }
    ],
    "content": {
      "comment": "How one row of the live content sheet maps into this template. Columns are taken verbatim from the registry's sheet schema (backend/templates/index.json -> sheet), which is the single place the layout is defined: B=style IDs, C=category, G=headline ('TRAIN FEARLESS' — first word is the hero word, the rest the italic), H=tagline, I=fabric copy, J=composition, K=icons, L–O=the four features ('TITLE: body'), R=status, T=gender. Training rows already exist in that sheet.",
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
        "TRAIN",
        "FEARLESS",
        "For the bold and the relentless"
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
      "comment": "titleTallPx is 160 rather than Running's 125 because the Training callout title line height is 75.71px (126.176% of 60), so two lines are already 151px.",
      "titleTallPx": 125,
      "textTallerThanBarPx": 385
    }
  }
};

// ===== capture.js =====
// ===== A+ Studio · frame capture (aplus-capture-v1) =====
// Select a finished A+ frame, get a reusable template manifest back.
//
// This file is the INVERSE of renderer.js. Where renderer.js turns a manifest into Figma nodes,
// this turns Figma nodes into a manifest — and then renders that manifest back into a throwaway
// frame and diffs the two trees property by property before it will claim success.
//
// The one rule that governs the whole file, learned the hard way four times over (history.md
// §19–§22): FIDELITY FAILS IN THE PROPERTIES YOU DID NOT THINK TO COPY. A missing
// `scalingFactor`, a missing `filters.exposure`, a flip that `rotation` cannot express, an
// inverted z-order — every one of those was a property that existed on the node and was not in
// somebody's allow-list. So capture never uses an allow-list as a ceiling. It unions three
// sources of property names (a known-key floor, `for…in` over the node, and the node's prototype
// chain) and copies every readable value it finds. An unknown property that survives the round
// trip is strictly better than a tidy schema that silently drops it.

var CAP_SCHEMA = 'aplus.template/2';
var CAP_RENDERER = 'aplus-capture-v1';
var CAP_PROBE_TAG = '__aplus-capture-probe__';
var CAP_MAX_MISMATCHES = 240;          // keep the postMessage payload sane
var CAP_MAX_MANIFEST_BYTES = 4000000;  // above this we report stats but withhold the body

// ---------------------------------------------------------------------------
// 1. Property name sources
// ---------------------------------------------------------------------------

// The FLOOR, not the ceiling. If Figma's sandbox ever stops enumerating node properties the
// capture still gets everything that matters; when it does enumerate (it does today) this list
// is simply absorbed into the union and costs nothing.
var CAP_KNOWN_KEYS = [
  // identity / structure
  'name', 'visible', 'locked', 'type',
  // geometry
  'relativeTransform', 'x', 'y', 'rotation', 'width', 'height',
  'constrainProportions', 'constraints', 'clipsContent',
  'cornerRadius', 'cornerSmoothing',
  'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius',
  // appearance
  'opacity', 'blendMode', 'isMask', 'maskType', 'effects', 'effectStyleId',
  'fills', 'fillStyleId', 'strokes', 'strokeStyleId', 'strokeWeight', 'strokeAlign',
  'strokeCap', 'strokeJoin', 'strokeMiterLimit', 'dashPattern',
  'strokeTopWeight', 'strokeBottomWeight', 'strokeLeftWeight', 'strokeRightWeight',
  // auto layout
  'layoutMode', 'layoutWrap', 'layoutAlign', 'layoutGrow', 'layoutPositioning',
  'layoutSizingHorizontal', 'layoutSizingVertical',
  'primaryAxisSizingMode', 'counterAxisSizingMode',
  'primaryAxisAlignItems', 'counterAxisAlignItems', 'counterAxisAlignContent',
  'itemSpacing', 'counterAxisSpacing', 'itemReverseZIndex', 'strokesIncludedInLayout',
  'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom',
  'layoutGrids', 'gridStyleId', 'overflowDirection', 'numberOfFixedChildren',
  // text
  'characters', 'fontName', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
  'paragraphIndent', 'paragraphSpacing', 'listSpacing', 'hangingPunctuation', 'hangingList',
  'textCase', 'textDecoration', 'textDecorationStyle', 'textDecorationOffset',
  'textDecorationThickness', 'textDecorationColor', 'textDecorationSkipInk',
  'textAlignHorizontal', 'textAlignVertical', 'textAutoResize', 'textTruncation', 'maxLines',
  'autoRename', 'hyperlink', 'openTypeFeatures', 'leadingTrim', 'textStyleId',
  // shapes
  'arcData', 'pointCount', 'innerRadius', 'starInnerRadius', 'vectorPaths', 'handleMirroring',
  'booleanOperation',
  // misc
  'exportSettings', 'description', 'expanded'
];

// Never read these: derived, enormous, or they throw under documentAccess: dynamic-page.
var CAP_SKIP_READ = capSet([
  'parent', 'children', 'removed', 'id',
  'absoluteTransform', 'absoluteBoundingBox', 'absoluteRenderBounds',
  'fillGeometry', 'strokeGeometry', 'vectorNetwork', 'inferredAutoLayout',
  'mainComponent', 'masterComponent', 'instances', 'exposedInstances', 'consumers',
  'componentPropertyDefinitions', 'componentProperties', 'overrides', 'variantProperties',
  'variantGroupProperties', 'key', 'remote', 'documentationLinks', 'isAsset',
  'attachedConnectors', 'stuckNodes', 'reactions',
  'boundVariables', 'inferredVariables', 'explicitVariableModes', 'resolvedVariableModes',
  'componentPropertyReferences', 'backgrounds', 'background', 'backgroundStyleId'
]);

// Captured, kept in the manifest for reference and for the diff — but never written back,
// because they are read-only, derived from something else we do write, or need an async setter
// that would drag library resolution into a pure-geometry rebuild.
var CAP_NO_APPLY = capSet([
  'id', 'type', 'parent', 'children', 'removed', 'width', 'height',
  'x', 'y', 'rotation',                 // derived from relativeTransform — see history.md §19
  'relativeTransform',                  // applied last, by hand
  'characters', 'fontName',             // applied first, by hand, after the font is loaded
  'fontWeight', 'hasMissingFont', 'isAsset', 'autoRename', 'expanded',
  'fillStyleId', 'strokeStyleId', 'effectStyleId', 'gridStyleId', 'textStyleId',
  'backgroundStyleId', 'background', 'backgrounds',
  'vectorNetwork', 'fillGeometry', 'strokeGeometry', 'inferredAutoLayout',
  'reactions', 'boundVariables', 'inferredVariables', 'explicitVariableModes',
  'resolvedVariableModes', 'componentPropertyReferences', 'componentPropertyDefinitions',
  'overrides', 'variantProperties', 'key', 'remote', 'consumers', 'instances',
  'exposedInstances', 'mainComponent', 'masterComponent', 'documentationLinks',
  'attachedConnectors', 'stuckNodes', 'absoluteTransform', 'absoluteBoundingBox',
  'absoluteRenderBounds', 'guides'
]);

// Auto-layout settings have to be in place BEFORE children arrive, or the children land in the
// wrong slots and every position below is wrong.
var CAP_PRE_APPLY = capSet([
  'clipsContent', 'layoutMode', 'layoutWrap',
  'primaryAxisSizingMode', 'counterAxisSizingMode',
  'primaryAxisAlignItems', 'counterAxisAlignItems', 'counterAxisAlignContent',
  'itemSpacing', 'counterAxisSpacing', 'itemReverseZIndex', 'strokesIncludedInLayout',
  'paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom'
]);

// Only applied once the node is sitting inside its final parent.
var CAP_PARENT_DEPENDENT = capSet([
  'layoutAlign', 'layoutGrow', 'layoutPositioning',
  'layoutSizingHorizontal', 'layoutSizingVertical'
]);

// Not worth diffing: volatile between two different nodes by definition, or knowingly dropped
// (style links) and reported once as a manifest-level warning instead of N per-node mismatches.
var CAP_NO_DIFF = capSet([
  'id', 'parent', 'children', 'removed', 'key', 'remote', 'consumers', 'instances',
  'exposedInstances', 'mainComponent', 'masterComponent', 'attachedConnectors', 'stuckNodes',
  'absoluteTransform', 'absoluteBoundingBox', 'absoluteRenderBounds',
  'fillGeometry', 'strokeGeometry', 'vectorNetwork', 'inferredAutoLayout',
  'reactions', 'boundVariables', 'inferredVariables', 'explicitVariableModes',
  'resolvedVariableModes', 'componentPropertyReferences', 'componentPropertyDefinitions',
  'overrides', 'variantProperties', 'variantGroupProperties', 'documentationLinks',
  'description', 'isAsset', 'autoRename', 'expanded', 'guides',
  'fillStyleId', 'strokeStyleId', 'effectStyleId', 'gridStyleId', 'textStyleId',
  'backgroundStyleId', 'background', 'backgrounds'
]);

var CAP_SEGMENT_FIELD_SETS = [
  ['fontSize', 'fontName', 'textDecoration', 'textDecorationStyle', 'textDecorationOffset',
    'textDecorationThickness', 'textDecorationColor', 'textDecorationSkipInk', 'textCase',
    'lineHeight', 'letterSpacing', 'fills', 'listOptions', 'indentation', 'hyperlink',
    'paragraphIndent', 'paragraphSpacing', 'openTypeFeatures', 'textStyleId', 'fillStyleId'],
  ['fontSize', 'fontName', 'textDecoration', 'textCase', 'lineHeight', 'letterSpacing',
    'fills', 'listOptions', 'indentation', 'hyperlink'],
  ['fontSize', 'fontName', 'textCase', 'lineHeight', 'letterSpacing', 'fills']
];
var CAP_RANGE_SETTERS = {
  fontSize: 'setRangeFontSize', fontName: 'setRangeFontName',
  textDecoration: 'setRangeTextDecoration', textDecorationStyle: 'setRangeTextDecorationStyle',
  textDecorationOffset: 'setRangeTextDecorationOffset',
  textDecorationThickness: 'setRangeTextDecorationThickness',
  textDecorationColor: 'setRangeTextDecorationColor',
  textDecorationSkipInk: 'setRangeTextDecorationSkipInk',
  textCase: 'setRangeTextCase', lineHeight: 'setRangeLineHeight',
  letterSpacing: 'setRangeLetterSpacing', fills: 'setRangeFills',
  listOptions: 'setRangeListOptions', indentation: 'setRangeIndentation',
  hyperlink: 'setRangeHyperlink'
};

function capSet(list) {
  var o = {};
  for (var i = 0; i < list.length; i++) o[list[i]] = true;
  return o;
}

// ---------------------------------------------------------------------------
// 2. Generic value reading
// ---------------------------------------------------------------------------

function capIsMixed(v) { try { return v === figma.mixed; } catch (e) { return false; } }

// Deep-copies anything Figma hands back into plain JSON. `figma.mixed` becomes a marker object
// rather than vanishing, so "this property varies across the node" stays visible in the manifest
// instead of being silently normalised to one value.
function capClone(v, depth) {
  if (v === null || v === undefined) return v;
  if (capIsMixed(v)) return { __mixed: true };
  var t = typeof v;
  if (t === 'number') return isFinite(v) ? v : null;
  if (t === 'string' || t === 'boolean') return v;
  if (t === 'function' || t === 'symbol') return undefined;
  if (t !== 'object') return undefined;
  if (depth > 14) return undefined;
  if (typeof v.byteLength === 'number') return undefined;   // image bytes etc. never go inline
  var i, out;
  if (Array.isArray(v)) {
    out = [];
    for (i = 0; i < v.length; i++) {
      var cv;
      try { cv = capClone(v[i], depth + 1); } catch (e) { cv = undefined; }
      out.push(cv === undefined ? null : cv);
    }
    return out;
  }
  out = {};
  for (var k in v) {
    var c;
    try { c = capClone(v[k], depth + 1); } catch (e) { continue; }
    if (c !== undefined) out[k] = c;
  }
  return out;
}

// Three sources of property names, unioned. The known list is a floor; `for…in` and the
// prototype chain are what catch the property nobody remembered (and the property Figma adds
// next year).
function capKeyUnion(node) {
  var seen = {}, keys = [], i;
  function add(k) {
    if (!k || seen[k] || k.charAt(0) === '_') return;
    seen[k] = true; keys.push(k);
  }
  for (i = 0; i < CAP_KNOWN_KEYS.length; i++) add(CAP_KNOWN_KEYS[i]);
  try { for (var k in node) add(k); } catch (e) {}
  try {
    var p = Object.getPrototypeOf(node), guard = 0;
    while (p && guard++ < 8) {
      var own = Object.getOwnPropertyNames(p);
      for (i = 0; i < own.length; i++) if (own[i] !== 'constructor') add(own[i]);
      p = Object.getPrototypeOf(p);
    }
  } catch (e) {}
  return keys;
}

// Every readable property of one node, as plain JSON. Reads that throw (deprecated getters,
// dynamic-page restrictions) are skipped and noted rather than aborting the capture.
function capReadProps(node, notes) {
  var keys = capKeyUnion(node), props = {};
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (CAP_SKIP_READ[k]) continue;
    var v;
    try { v = node[k]; } catch (e) {
      if (notes) notes.push('could not read "' + k + '" on "' + capName(node) + '"');
      continue;
    }
    if (v === undefined) continue;
    var c;
    try { c = capClone(v, 0); } catch (e) { continue; }
    if (c === undefined) continue;
    props[k] = c;
  }
  return props;
}

function capName(node) { try { return String(node.name); } catch (e) { return '(unnamed)'; } }

function capSegments(node, notes) {
  for (var s = 0; s < CAP_SEGMENT_FIELD_SETS.length; s++) {
    try {
      var segs = node.getStyledTextSegments(CAP_SEGMENT_FIELD_SETS[s]);
      return capClone(segs, 0) || [];
    } catch (e) { /* this Figma build does not know one of the fields — try a narrower set */ }
  }
  if (notes) notes.push('no styled text segments could be read from "' + capName(node) + '"');
  return [];
}

// ---------------------------------------------------------------------------
// 3. Capture
// ---------------------------------------------------------------------------

function capBoxOf(node, rootBox) {
  var b = null;
  try { b = node.absoluteBoundingBox; } catch (e) {}
  if (!b || !rootBox) return null;
  return {
    x: capR(b.x - rootBox.x, 2), y: capR(b.y - rootBox.y, 2),
    w: capR(b.width, 2), h: capR(b.height, 2)
  };
}
function capR(n, dp) {
  if (typeof n !== 'number' || !isFinite(n)) return n;
  var f = Math.pow(10, dp);
  var r = Math.round(n * f) / f;
  return r === 0 ? 0 : r;   // kill -0, which stringifies differently
}

// Walks one node and everything under it. `ctx` accumulates fonts, image hashes, style
// references and notes for the whole capture.
function capNode(node, path, rootBox, ctx) {
  var spec = { type: String(node.type), path: path, props: capReadProps(node, ctx.notes) };
  spec.box = capBoxOf(node, rootBox);
  ctx.count++;

  if (spec.type === 'TEXT') {
    ctx.texts++;
    spec.segments = capSegments(node, ctx.notes);
    capCollectFonts(spec, ctx);
  }
  // A boolean operation has no vectorPaths of its own; its resolved outline is fillGeometry.
  // Read it explicitly (it is on the skip-read list because it is huge on ordinary nodes).
  if (spec.type === 'BOOLEAN_OPERATION') {
    try { spec.geometry = capClone(node.fillGeometry, 0); } catch (e) {}
  }
  capCollectPaints(spec, ctx);
  capCollectStyleRefs(spec, ctx);

  var kids = null;
  try { kids = ('children' in node) ? node.children : null; } catch (e) {}
  // Do not descend into a boolean operation: we rebuild it from its resolved outline, and its
  // children would be drawn a second time on top.
  if (kids && spec.type !== 'BOOLEAN_OPERATION') {
    spec.children = [];
    for (var i = 0; i < kids.length; i++) {
      spec.children.push(capNode(kids[i], path + '/' + i, rootBox, ctx));
    }
  }
  return spec;
}

function capCollectFonts(spec, ctx) {
  function note(fn) {
    if (!fn || typeof fn !== 'object' || !fn.family) return;
    var key = fn.family + '|' + fn.style;
    if (!ctx.fonts[key]) ctx.fonts[key] = { family: fn.family, style: fn.style };
  }
  note(spec.props.fontName);
  (spec.segments || []).forEach(function (s) { note(s.fontName); });
}

// Records every image hash the design leans on, and keeps the texture-vs-slot distinction
// visible: a low-opacity or rescaled or filtered image fill is ART DIRECTION, not content
// (history.md §21 — "image 396" was never missing, it was a 7% texture over a white void).
function capCollectPaints(spec, ctx) {
  ['fills', 'strokes'].forEach(function (which) {
    var arr = spec.props[which];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (p) {
      if (!p || p.type !== 'IMAGE' || !p.imageHash) return;
      if (ctx.images.indexOf(p.imageHash) < 0) ctx.images.push(p.imageHash);
      if (capPaintIsTexture(p)) {
        ctx.textures.push({ path: spec.path, name: spec.props.name, hash: p.imageHash,
          opacity: p.opacity, scalingFactor: p.scalingFactor });
      }
    });
  });
}
function capPaintIsTexture(p) {
  if (p.opacity !== undefined && p.opacity < 0.9) return true;
  if (p.scalingFactor !== undefined && Math.abs(p.scalingFactor - 1) > 1e-6) return true;
  if (p.filters) {
    for (var k in p.filters) if (typeof p.filters[k] === 'number' && Math.abs(p.filters[k]) > 1e-6) return true;
  }
  if (p.blendMode && p.blendMode !== 'NORMAL' && p.blendMode !== 'PASS_THROUGH') return true;
  return false;
}
function capCollectStyleRefs(spec, ctx) {
  ['fillStyleId', 'strokeStyleId', 'effectStyleId', 'gridStyleId', 'textStyleId'].forEach(function (k) {
    var v = spec.props[k];
    if (typeof v === 'string' && v) ctx.styleRefs++;
  });
}

// ---------------------------------------------------------------------------
// 4. Skeletonising — slots, roles, callouts
// ---------------------------------------------------------------------------

function capWalk(spec, fn, parent, index) {
  fn(spec, parent, index === undefined ? 0 : index);
  (spec.children || []).forEach(function (c, i) { capWalk(c, fn, spec, i); });
}

function capLower(s) { return String(s === undefined || s === null ? '' : s).toLowerCase().trim(); }

// A mask group is the construction the renderer itself emits for a circular photo slot
// (Ellipse isMask + a Photo rect), and it is also how the real designs build their close-ups.
// Finding one is the single most reliable slot signal there is, so it is checked first.
function capFindMaskChild(spec) {
  var kids = spec.children || [];
  for (var i = 0; i < kids.length; i++) {
    if (kids[i].props && kids[i].props.isMask === true) return i;
  }
  return -1;
}
function capIsPhotoFill(p) {
  return p && p.type === 'IMAGE' && p.visible !== false;
}
function capVisiblePaints(arr) {
  return (Array.isArray(arr) ? arr : []).filter(function (p) { return p && p.visible !== false; });
}

function capDetectSlots(root, M, ctx) {
  var rootW = (root.box && root.box.w) || M.meta.width || 1572;
  capWalk(root, function (spec, parent) {
    if (spec.path === root.path) return;
    var name = capLower(spec.props && spec.props.name);
    var explicit = name.indexOf('@slot') >= 0 || name.indexOf('mask group') === 0 ||
      name.indexOf('photo') === 0;

    // (a) mask group → circular slot
    if ((spec.type === 'GROUP' || spec.type === 'FRAME') && spec.children && spec.children.length >= 2) {
      var mi = capFindMaskChild(spec);
      if (mi >= 0) {
        var mask = spec.children[mi];
        var photo = null;
        for (var j = mi + 1; j < spec.children.length; j++) {
          if (spec.children[j].type !== 'TEXT') { photo = spec.children[j]; break; }
        }
        spec.slot = {
          kind: mask.type === 'ELLIPSE' ? 'circle' : 'rect',
          label: capSlotLabel(spec, parent),
          maskPath: mask.path,
          photoPath: photo ? photo.path : null,
          w: mask.box ? mask.box.w : null, h: mask.box ? mask.box.h : null,
          why: 'mask group (' + mask.type + ' isMask)'
        };
        M.slots.push({ path: spec.path, kind: spec.slot.kind, label: spec.slot.label,
          w: spec.slot.w, h: spec.slot.h, why: spec.slot.why });
        return;
      }
    }

    // (b) a big, clean, fully opaque image rect → rectangular slot.
    //     A rescaled / filtered / translucent image fill is deliberately NOT a slot.
    var fills = capVisiblePaints(spec.props && spec.props.fills);
    var imageFills = fills.filter(capIsPhotoFill);
    if (imageFills.length === 1 && fills.length === 1 &&
        (spec.type === 'RECTANGLE' || spec.type === 'FRAME' || spec.type === 'ELLIPSE')) {
      var p = imageFills[0];
      var big = spec.box && spec.box.w >= 0.25 * rootW && spec.box.h >= 150;
      if (!capPaintIsTexture(p) && (big || explicit)) {
        spec.slot = { kind: spec.type === 'ELLIPSE' ? 'circle' : 'rect', label: capSlotLabel(spec, parent),
          photoPath: spec.path, w: spec.box ? spec.box.w : null, h: spec.box ? spec.box.h : null,
          why: 'single opaque IMAGE fill, ' + Math.round((spec.box ? spec.box.w : 0)) + 'px wide' };
        M.slots.push({ path: spec.path, kind: spec.slot.kind, label: spec.slot.label,
          w: spec.slot.w, h: spec.slot.h, why: spec.slot.why });
        return;
      }
      if (capPaintIsTexture(p)) {
        ctx.notes.push('"' + (spec.props.name || spec.path) + '" kept as a graphic, not a photo slot — ' +
          'its image fill is art direction (opacity ' + (p.opacity === undefined ? 1 : p.opacity) +
          ', scalingFactor ' + (p.scalingFactor === undefined ? 1 : p.scalingFactor) + ')');
      }
    }

    // (c) the renderer's own rectangular slot: a clipping frame named "PHOTO · …"
    if (spec.type === 'FRAME' && name.indexOf('photo ·') === 0) {
      spec.slot = { kind: 'rect', label: capSlotLabel(spec, parent), photoPath: spec.path,
        w: spec.box ? spec.box.w : null, h: spec.box ? spec.box.h : null, why: 'named PHOTO ·' };
      M.slots.push({ path: spec.path, kind: 'rect', label: spec.slot.label,
        w: spec.slot.w, h: spec.slot.h, why: spec.slot.why });
    }
  });
}

function capSlotLabel(spec, parent) {
  var n = String((spec.props && spec.props.name) || 'Photo');
  n = n.replace(/^mask group\s*·\s*/i, '').replace(/^photo\s*·\s*/i, '').replace(/@slot[:\s]*/i, '').trim();
  if (!n || /^(rectangle|ellipse|group|frame|image)\b/i.test(n)) {
    n = String((parent && parent.props && parent.props.name) || 'Photo') + ' photo';
  }
  return n;
}

// Role detection, in strict precedence: an explicit @role in the layer name, then the naming
// convention this project's own renderer emits, then geometry. Every assignment records WHERE it
// came from, because a heuristic guess the designer cannot see is how you get a template that is
// wrong for weeks.
var CAP_NAME_ROLES = {
  'hero word': 'hero.word',
  'hero italic word': 'hero.italic',
  'hero tagline': 'hero.tagline',
  'fabric copy': 'fabric.copy',
  'composition': 'fabric.composition',
  'fit label 1': 'comparison.label.0',
  'fit label 2': 'comparison.label.1'
};

function capDetectRoles(root, M, ctx) {
  var texts = [];
  capWalk(root, function (spec, parent) {
    if (spec.type !== 'TEXT') return;
    spec.__parent = parent;
    texts.push(spec);
  });

  // --- pass 1: explicit @role ---
  texts.forEach(function (t) {
    var m = String((t.props && t.props.name) || '').match(/@([A-Za-z0-9_.\[\]]+)/);
    if (m) capSetRole(t, m[1].replace(/\[(\d+)\]/g, '.$1'), 'name', M);
  });

  // --- pass 2: the convention the renderer already writes ---
  texts.forEach(function (t) {
    if (t.role) return;
    var n = capLower(t.props && t.props.name);
    if (CAP_NAME_ROLES[n]) { capSetRole(t, CAP_NAME_ROLES[n], 'convention', M); return; }
    if (n === 'title' || n === 'copy') {
      var card = capAncestorMatching(t, root, /^card\s*\d+/i);
      if (card) {
        var idx = parseInt(String(card.props.name).replace(/[^0-9]/g, ''), 10);
        if (isFinite(idx)) {
          card.calloutIndex = idx;
          capSetRole(t, 'callout.' + idx + '.' + (n === 'title' ? 'title' : 'body'), 'convention', M);
        }
      }
    }
  });

  // --- pass 3: geometry, only for what is still unassigned ---
  capHeuristicRoles(root, texts, M, ctx);

  // normalise callout indices to 0..n-1 in y order, so the sheet's four feature columns land
  // on the four cards regardless of how the designer numbered them
  capRenumberCallouts(root, M);
}

function capSetRole(spec, role, source, M) {
  if (spec.role) return;
  spec.role = role;
  spec.roleSource = source;
  if (spec.type === 'TEXT') {
    spec.fit = capFitSpec(spec);
    spec.sample = String((spec.props && spec.props.characters) || '').slice(0, 160);
  }
  M.roles[role] = { path: spec.path, source: source, name: (spec.props && spec.props.name) || '' };
}

// What has to be preserved when the text changes length: how wide it was allowed to get, and
// which edge stays put. A centred auto-width hero word that is not re-centred after the sheet
// swaps "RUN" for "SPRINT" lands off-axis, and nothing in the diff would ever catch it because
// the diff only sees the captured content.
function capFitSpec(spec) {
  var rt = spec.props && spec.props.relativeTransform;
  var axisAligned = !!(rt && Math.abs(rt[0][1]) < 1e-9 && Math.abs(rt[1][0]) < 1e-9);
  return {
    maxWidth: spec.props && typeof spec.props.width === 'number' ? capR(spec.props.width, 2) : null,
    width: spec.props && typeof spec.props.width === 'number' ? capR(spec.props.width, 2) : null,
    align: (spec.props && spec.props.textAlignHorizontal) || 'LEFT',
    autoResize: (spec.props && spec.props.textAutoResize) || 'NONE',
    anchorX: axisAligned && rt ? capR(rt[0][2], 3) : null,
    axisAligned: axisAligned
  };
}

function capAncestorMatching(spec, root, re) {
  var cur = spec.__parent;
  var guard = 0;
  while (cur && guard++ < 40) {
    if (cur.props && re.test(String(cur.props.name || ''))) return cur;
    cur = cur.__parent;
  }
  return null;
}

// Give every spec a __parent link once, so the ancestor walk above works at any depth.
function capLinkParents(root) {
  capWalk(root, function (spec, parent) { spec.__parent = parent || null; });
}

function capHeuristicRoles(root, texts, M, ctx) {
  var H = (root.box && root.box.h) || (root.props && root.props.height) || 1;
  var free = texts.filter(function (t) { return !t.role && String((t.props && t.props.characters) || '').trim(); });
  if (!free.length) return;

  function size(t) {
    var s = t.props && t.props.fontSize;
    if (typeof s === 'number') return s;
    var max = 0;
    (t.segments || []).forEach(function (sg) { if (typeof sg.fontSize === 'number' && sg.fontSize > max) max = sg.fontSize; });
    return max;
  }
  function top(t) { return t.box ? t.box.y : 0; }
  function chars(t) { return String((t.props && t.props.characters) || ''); }

  // ---- hero band: the top third ----
  var hero = free.filter(function (t) { return top(t) < 0.33 * H; })
    .sort(function (a, b) { return size(b) - size(a); });
  if (hero.length) {
    capSetRole(hero[0], 'hero.word', 'heuristic', M);
    if (hero.length > 1 && size(hero[1]) >= 0.2 * size(hero[0])) capSetRole(hero[1], 'hero.italic', 'heuristic', M);
    var small = hero.slice().sort(function (a, b) { return size(a) - size(b); })[0];
    if (small && !small.role) capSetRole(small, 'hero.tagline', 'heuristic', M);
  }

  // ---- fabric band ----
  var mid = free.filter(function (t) { return !t.role && top(t) >= 0.3 * H && top(t) < 0.62 * H; });
  var comp = mid.filter(function (t) { return chars(t).indexOf('%') >= 0 && chars(t).length < 80; })[0];
  if (comp) capSetRole(comp, 'fabric.composition', 'heuristic', M);
  var copy = mid.filter(function (t) { return !t.role; })
    .sort(function (a, b) { return chars(b).length - chars(a).length; })[0];
  if (copy && chars(copy).length > 25) capSetRole(copy, 'fabric.copy', 'heuristic', M);

  // ---- callouts: a container holding one circular slot and two or more texts ----
  var containers = [];
  capWalk(root, function (spec) {
    if (spec.path === root.path) return;
    if (spec.type !== 'GROUP' && spec.type !== 'FRAME') return;
    var slots = 0, txts = [];
    capWalk(spec, function (d) {
      if (d === spec) return;
      if (d.slot) slots++;
      if (d.type === 'TEXT' && String((d.props && d.props.characters) || '').trim()) txts.push(d);
    });
    if (slots === 1 && txts.length >= 2 && txts.length <= 4) containers.push({ spec: spec, texts: txts });
  });
  // keep only the outermost matches, then order them down the page
  containers = containers.filter(function (c) {
    return !containers.some(function (o) {
      return o !== c && o.spec !== c.spec && capIsAncestor(o.spec, c.spec);
    });
  }).sort(function (a, b) { return (a.spec.box ? a.spec.box.y : 0) - (b.spec.box ? b.spec.box.y : 0); });

  containers.forEach(function (c, i) {
    if (c.spec.calloutIndex === undefined) c.spec.calloutIndex = i;
    var ordered = c.texts.slice().sort(function (a, b) { return size(b) - size(a); });
    var title = ordered[0], body = ordered[1];
    if (title && !title.role) capSetRole(title, 'callout.' + c.spec.calloutIndex + '.title', 'heuristic', M);
    if (body && !body.role) capSetRole(body, 'callout.' + c.spec.calloutIndex + '.body', 'heuristic', M);
  });

  var guessed = [];
  capWalk(root, function (s) { if (s.role && s.roleSource === 'heuristic') guessed.push(s.role); });
  if (guessed.length) {
    ctx.notes.push(guessed.length + ' content role(s) were inferred from size and position, not from layer names: ' +
      guessed.join(', ') + '. Rename the layers (e.g. "@hero.word") to make them exact.');
  }
}

function capIsAncestor(maybeAncestor, spec) {
  var cur = spec.__parent, guard = 0;
  while (cur && guard++ < 60) { if (cur === maybeAncestor) return true; cur = cur.__parent; }
  return false;
}

// The sheet has four feature columns in order. Whatever the designer called the cards, the
// manifest exposes them as callout.0 … callout.n-1 top to bottom.
function capRenumberCallouts(root, M) {
  var containers = [];
  capWalk(root, function (s) { if (s.calloutIndex !== undefined) containers.push(s); });
  containers.sort(function (a, b) { return (a.box ? a.box.y : 0) - (b.box ? b.box.y : 0); });
  var remap = {};
  containers.forEach(function (c, i) { remap[c.calloutIndex] = i; c.calloutIndex = i; });

  var newRoles = {};
  Object.keys(M.roles).forEach(function (role) {
    var m = role.match(/^callout\.(\d+)\.(title|body)$/);
    if (!m) { newRoles[role] = M.roles[role]; return; }
    var to = remap[m[1]] === undefined ? m[1] : remap[m[1]];
    newRoles['callout.' + to + '.' + m[2]] = M.roles[role];
  });
  M.roles = newRoles;
  capWalk(root, function (s) {
    if (!s.role) return;
    var m = s.role.match(/^callout\.(\d+)\.(title|body)$/);
    if (m && remap[m[1]] !== undefined) s.role = 'callout.' + remap[m[1]] + '.' + m[2];
  });
  M.meta.calloutCount = containers.length;
}

// ---------------------------------------------------------------------------
// 5. The manifest
// ---------------------------------------------------------------------------

// The content block maps one row of the live sheet onto this template's roles. It is taken
// verbatim from the registry's sheet schema (backend/templates/index.json → `sheet`), which is
// the single place the column layout is defined, so a captured template routes off exactly the
// same columns the hand-built Running ones do.
function capContentBlock(root, M) {
  var sheet = (typeof FALLBACK_REGISTRY !== 'undefined' && FALLBACK_REGISTRY && FALLBACK_REGISTRY.sheet) || {};
  var C = {};
  Object.keys(sheet).forEach(function (k) {
    if (k === 'comment' || k === 'categoryAliases' || k === 'genderAliases' || k === 'headerRows') return;
    C[k] = sheet[k];
  });
  C.comment = 'Generated at capture from the registry sheet schema. Columns are the live sheet; ' +
    'roles are the ones detected in the captured frame.';
  var n = M.meta.calloutCount || 0;
  C.callouts = { min: Math.max(1, n), max: Math.max(1, n), titleIsFirstLine: true };
  if (Array.isArray(C.cardColumns) && n) C.cardColumns = C.cardColumns.slice(0, n);
  C.fabric = { compositionMarker: '%' };
  C.comparison = { defaults: ['Regular fit', 'Slim fit'] };
  C.heroDefaults = [
    capSampleFor(root, 'hero.word'),
    capSampleFor(root, 'hero.italic'),
    capSampleFor(root, 'hero.tagline')
  ];
  return C;
}
function capSampleFor(root, role) {
  var found = '';
  capWalk(root, function (s) { if (s.role === role && !found) found = String((s.props && s.props.characters) || ''); });
  return found;
}

// `fonts` is emitted in the shape loadFontsFromManifest() already expects (role -> {family,
// style, fallback}), with the role name being "Family|Style". That makes the resolved map it
// returns a direct family|style lookup for the builder, and reuses the existing
// missing-font reporting instead of inventing a second one.
function capFontsBlock(fonts) {
  var out = {};
  Object.keys(fonts).forEach(function (k) {
    var f = fonts[k];
    out[k] = { family: f.family, style: f.style, fallback: /bold|black|heavy|semi/i.test(f.style) ? 'bold' : 'regular' };
  });
  if (!Object.keys(out).length) out['Inter|Regular'] = { family: 'Inter', style: 'Regular', fallback: 'regular' };
  return out;
}

async function capCaptureFrame(frame, req, post) {
  var rootBox = null;
  try { rootBox = frame.absoluteBoundingBox; } catch (e) {}
  if (!rootBox) rootBox = { x: 0, y: 0, width: frame.width, height: frame.height };

  var ctx = { count: 0, texts: 0, fonts: {}, images: [], textures: [], notes: [], styleRefs: 0 };
  post('capture', 0, 1);
  var root = capNode(frame, '0', rootBox, ctx);
  post('capture', 1, 1);

  var tpl = req.template || {};
  var M = {
    schema: CAP_SCHEMA,
    renderer: CAP_RENDERER,
    meta: {
      category: tpl.categoryId || 'captured',
      categoryLabel: capTitle(tpl.categoryId || 'Captured'),
      gender: tpl.genderId || 'unisex',
      id: tpl.id || 'captured-1',
      key: (tpl.categoryId || 'captured') + '/' + (tpl.genderId || 'unisex') + '/' + (tpl.id || 'captured-1'),
      label: tpl.label || capName(frame),
      sub: 'Captured from "' + capName(frame) + '"',
      version: 1,
      status: tpl.status || 'draft',
      capturedAt: new Date().toISOString(),
      width: capR(rootBox.width, 2),
      height: capR(rootBox.height, 2),
      source: {
        fileName: (function () { try { return figma.root.name; } catch (e) { return ''; } })(),
        pageId: req.pageId || '', frameId: frame.id, frameName: capName(frame)
      },
      requiredFonts: Object.keys(ctx.fonts).map(function (k) { return ctx.fonts[k]; }),
      requiredImages: ctx.images.slice(),
      textures: ctx.textures.slice(0, 40)
    },
    fonts: capFontsBlock(ctx.fonts),
    palette: { slotFill: [205, 209, 214], slotLabel: [70, 76, 84], label: [130, 130, 130] },
    roles: {},
    slots: [],
    root: root,
    warnings: []
  };

  post('classify', 0, 3);
  capLinkParents(root);
  capDetectSlots(root, M, ctx);
  post('classify', 1, 3);
  capDetectRoles(root, M, ctx);
  post('classify', 2, 3);
  M.content = capContentBlock(root, M);
  post('classify', 3, 3);

  if (ctx.images.length) {
    ctx.notes.push(ctx.images.length + ' image fill(s) are referenced by hash. An imageHash only ' +
      'resolves inside the Figma file that holds the bytes, so this template renders those layers ' +
      'blank in another file until asset upload (plan §4 / phase 2) ships.');
  }
  if (ctx.styleRefs) {
    ctx.notes.push(ctx.styleRefs + ' node(s) referenced a shared style (fill/stroke/effect/text). ' +
      'The resolved values are captured, but the link to the library style is not — under ' +
      'documentAccess: dynamic-page those need async setters and a resolvable library.');
  }
  if (!Object.keys(M.roles).length) {
    ctx.notes.push('No content roles were detected. This template will rebuild the frame faithfully ' +
      'but will not take any text from the sheet.');
  }
  M.warnings = ctx.notes;
  M.stats = { layers: ctx.count, texts: ctx.texts, images: ctx.images.length, slots: M.slots.length,
    roles: Object.keys(M.roles).length, callouts: M.meta.calloutCount || 0 };
  capStrip(root);
  return M;
}

function capTitle(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
// __parent links are cyclic — they must not reach JSON.stringify or postMessage.
function capStrip(root) { capWalk(root, function (s) { delete s.__parent; }); }

// ---------------------------------------------------------------------------
// 6. Rebuild
// ---------------------------------------------------------------------------

function capCreateNode(spec, warn) {
  var t = spec.type, nm = (spec.props && spec.props.name) || spec.path;
  switch (t) {
    case 'RECTANGLE': return figma.createRectangle();
    case 'ELLIPSE': return figma.createEllipse();
    case 'LINE': return figma.createLine();
    case 'POLYGON': return figma.createPolygon();
    case 'STAR': return figma.createStar();
    case 'TEXT': return figma.createText();
    case 'SLICE': return figma.createSlice();
    case 'VECTOR': return figma.createVector();
    case 'BOOLEAN_OPERATION': return figma.createVector();
    case 'FRAME': return figma.createFrame();
    case 'COMPONENT': case 'INSTANCE': case 'COMPONENT_SET':
      warn.push('"' + nm + '" was a ' + t + ' — rebuilt as a plain frame, so it is no longer linked to its component');
      return figma.createFrame();
    case 'GROUP': return null;      // assembled from its children
    default:
      warn.push('"' + nm + '" is a ' + t + ', which cannot be recreated — rebuilt as an empty vector');
      return figma.createVector();
  }
}

function capApplyProps(node, props, phase, warn) {
  var keys = Object.keys(props);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (CAP_NO_APPLY[k]) continue;
    var isPre = !!CAP_PRE_APPLY[k], isParentDep = !!CAP_PARENT_DEPENDENT[k];
    if (phase === 'pre' && !isPre) continue;
    if (phase === 'post' && (isPre || isParentDep)) continue;
    if (phase === 'parent' && !isParentDep) continue;
    var v = props[k];
    if (v && typeof v === 'object' && v.__mixed) continue;   // genuinely varies; range setters handle text
    if (!(k in node)) continue;
    try { node[k] = v; } catch (e) { /* read-only here, or invalid for this node type */ }
  }
}

function capResize(node, props, warn) {
  var w = props.width, h = props.height;
  if (typeof w !== 'number' || typeof h !== 'number') return;
  try {
    if (node.type === 'LINE') node.resize(Math.max(w, 0.01), 0);
    else node.resize(Math.max(w, 0.01), Math.max(h, 0.01));
  } catch (e) {
    warn.push('could not resize "' + (props.name || node.type) + '" to ' + w + '×' + h + ' — ' + (e && e.message));
  }
}

function capFontFor(F, fn) {
  if (!fn || typeof fn !== 'object' || !fn.family) return null;
  var key = fn.family + '|' + fn.style;
  return (F && F[key]) || null;
}

async function capBuildText(node, spec, ctx) {
  var props = spec.props, F = ctx.F;
  var base = capFontFor(F, props.fontName) || ctx.fallbackFont;
  try { node.fontName = base; } catch (e) {}
  var chars = typeof props.characters === 'string' ? props.characters : '';
  if (ctx.row && spec.role) {
    var sub = capContentFor(spec.role, ctx.row, ctx);
    if (sub !== null && sub !== undefined) chars = String(sub);
  }
  try { node.characters = chars.length ? chars : ' '; } catch (e) {
    ctx.warn.push('could not set the text of "' + (props.name || '') + '" — ' + (e && e.message));
  }

  // node-level style first, then the per-range overrides on top (a bold run inside a paragraph
  // is a RANGE property; setting the node-level font after it would flatten it away)
  capApplyProps(node, props, 'post', ctx.warn);

  var segs = spec.segments || [];
  var sameLength = chars.length === (typeof props.characters === 'string' ? props.characters.length : -1);
  if (segs.length && sameLength) {
    for (var s = 0; s < segs.length; s++) {
      var sg = segs[s];
      var a = sg.start, b = sg.end;
      if (typeof a !== 'number' || typeof b !== 'number' || b <= a || b > chars.length) continue;
      for (var f in sg) {
        var setter = CAP_RANGE_SETTERS[f];
        if (!setter || typeof node[setter] !== 'function') continue;
        var val = sg[f];
        if (val === undefined || val === null) continue;
        if (f === 'fontName') { val = capFontFor(F, val) || base; }
        try { node[setter](a, b, val); } catch (e) {}
      }
    }
  } else if (segs.length && segs.length > 1) {
    ctx.warn.push('"' + (props.name || '') + '" had ' + segs.length + ' styled runs; the sheet text ' +
      'replaced its content so only the first run’s style was kept');
    var first = segs[0], fn = capFontFor(F, first.fontName) || base;
    try { node.fontName = fn; } catch (e) {}
    if (typeof first.fontSize === 'number') { try { node.fontSize = first.fontSize; } catch (e) {} }
    if (first.fills) { try { node.fills = first.fills; } catch (e) {} }
  }

  // size: a text node can only be resized while it is not auto-sizing
  var auto = props.textAutoResize || 'NONE';
  try { node.textAutoResize = 'NONE'; } catch (e) {}
  capResize(node, props, ctx.warn);
  try { node.textAutoResize = auto; } catch (e) {}
}

// Which cell of the sheet row feeds which role.
function capContentFor(role, row, ctx) {
  if (role === 'hero.word') return row.hero[0];
  if (role === 'hero.italic') return row.hero[1];
  if (role === 'hero.tagline') return row.hero[2];
  if (role === 'fabric.copy') return row.fab.copy;
  if (role === 'fabric.composition') return row.fab.comp;
  var m = role.match(/^callout\.(\d+)\.(title|body)$/);
  if (m) {
    var card = row.cards[parseInt(m[1], 10)];
    if (!card) return null;
    return m[2] === 'title' ? card.title : card.copy;
  }
  var c = role.match(/^comparison\.label\.(\d+)$/);
  if (c) return row.cmp.labels[parseInt(c[1], 10)];
  return null;
}

// Re-anchor a text node whose content just changed length, and shrink it to fit the width the
// original occupied. Only done on axis-aligned nodes — re-anchoring a rotated one by setting x
// would move it along the wrong axis.
function capRefitText(node, spec, ctx) {
  var fit = spec.fit;
  if (!fit || !fit.axisAligned || !ctx.row) return;
  if (fit.maxWidth && node.width > fit.maxWidth + 0.5 && typeof node.fontSize === 'number') {
    try { node.fontSize = node.fontSize * fit.maxWidth / node.width; } catch (e) {}
  }
  if (fit.autoResize !== 'WIDTH_AND_HEIGHT' || fit.anchorX === null || !fit.width) return;
  var left = fit.anchorX;
  if (fit.align === 'CENTER') left = fit.anchorX + (fit.width - node.width) / 2;
  else if (fit.align === 'RIGHT') left = fit.anchorX + (fit.width - node.width);
  try {
    var t = node.relativeTransform;
    node.relativeTransform = [[t[0][0], t[0][1], left], [t[1][0], t[1][1], t[1][2]]];
  } catch (e) {}
}

// A photo slot in production mode: keep the node exactly as captured, but swap its image fill
// for the flat placeholder grey and drop a label on top. Nothing structural is rewritten, so a
// mask group keeps masking and a clipping frame keeps clipping.
function capSlotFills(M) {
  var c = M.palette.slotFill;
  return [{ type: 'SOLID', color: { r: c[0] / 255, g: c[1] / 255, b: c[2] / 255 } }];
}
async function capSlotLabelNode(parent, spec, M, ctx) {
  var t = figma.createText();
  t.fontName = ctx.fallbackFont;
  t.characters = '+ ' + (spec.slot.label || 'Photo');
  t.fontSize = Math.max(18, Math.min(34, (spec.box && spec.box.w ? spec.box.w : 400) * 0.08));
  t.textAlignHorizontal = 'CENTER';
  var c = M.palette.slotLabel;
  t.fills = [{ type: 'SOLID', color: { r: c[0] / 255, g: c[1] / 255, b: c[2] / 255 } }];
  t.name = 'placeholder label · delete after placing photo';
  parent.appendChild(t);
  t.textAutoResize = 'WIDTH_AND_HEIGHT';
  return t;
}

async function capBuildNode(spec, parent, ctx) {
  var props = spec.props || {};

  if (spec.type === 'GROUP') {
    var made = [];
    for (var i = 0; i < (spec.children || []).length; i++) {
      var child = await capBuildNode(spec.children[i], parent, ctx);
      if (child) made.push(child);
    }
    if (!made.length) return null;
    var g;
    try { g = figma.group(made, parent); } catch (e) {
      ctx.warn.push('could not re-group "' + (props.name || '') + '" — its children were left loose');
      return made[0];
    }
    // a group's size and transform are derived from its children; only its own appearance applies
    capApplyProps(g, props, 'post', ctx.warn);
    ctx.made.push({ spec: spec, node: g });
    return g;
  }

  var node = capCreateNode(spec, ctx.warn);
  if (!node) return null;
  try { parent.appendChild(node); } catch (e) {
    ctx.warn.push('could not place "' + (props.name || spec.type) + '" inside "' + parent.name + '"');
    try { node.remove(); } catch (e2) {}
    return null;
  }

  if (spec.type === 'BOOLEAN_OPERATION' && spec.geometry) {
    try { node.vectorPaths = spec.geometry; } catch (e) {
      ctx.warn.push('"' + (props.name || '') + '" was a boolean operation and its outline could not be rebuilt');
    }
  }

  if (spec.type === 'TEXT') {
    await capBuildText(node, spec, ctx);
  } else {
    capResize(node, props, ctx.warn);
    capApplyProps(node, props, 'pre', ctx.warn);
    for (var j = 0; j < (spec.children || []).length; j++) {
      await capBuildNode(spec.children[j], node, ctx);
    }
    capApplyProps(node, props, 'post', ctx.warn);
    // auto-layout frames size themselves from their sizing modes; re-resizing one would force
    // it to FIXED and change the thing we are trying to reproduce
    if (!props.layoutMode || props.layoutMode === 'NONE') capResize(node, props, ctx.warn);
  }

  // production mode only: blank the photo and label it
  if (!ctx.fidelity && spec.slot && spec.slot.photoPath === spec.path) {
    try { node.fills = capSlotFills(ctx.M); } catch (e) {}
  }

  capApplyProps(node, props, 'parent', ctx.warn);

  // transform last: after every resize, so nothing moves the node afterwards
  if (props.relativeTransform && (!parent.layoutMode || parent.layoutMode === 'NONE')) {
    try {
      var rt = props.relativeTransform;
      node.relativeTransform = [[rt[0][0], rt[0][1], rt[0][2]], [rt[1][0], rt[1][1], rt[1][2]]];
    } catch (e) {}
  }
  if (spec.type === 'TEXT' && !ctx.fidelity && spec.role) capRefitText(node, spec, ctx);

  // isMask has to land after the fills, or Figma re-derives the mask from an empty shape
  if (props.isMask === true) { try { node.isMask = true; } catch (e) {} }

  ctx.made.push({ spec: spec, node: node });
  return node;
}

// Builds the whole captured tree. `fidelity: true` reproduces the captured content verbatim
// (that is what the round-trip diff compares); otherwise the sheet row drives the text and the
// photo slots come out as labelled placeholders.
async function capBuildTree(M, opts) {
  var fonts = await loadFontsFromManifest(M);
  var fallback = fonts.F[Object.keys(fonts.F)[0]] || { family: 'Inter', style: 'Regular' };
  try { await figma.loadFontAsync({ family: 'Inter', style: 'Regular' }); } catch (e) {}
  var ctx = {
    M: M, F: fonts.F, fallbackFont: fallback, fidelity: !!opts.fidelity,
    row: opts.row || null, warn: [], made: []
  };
  var root = await capBuildNode(M.root, opts.parent, ctx);
  if (!root) throw new Error('The captured template produced no nodes.');
  if (opts.name) { try { root.name = opts.name; } catch (e) {} }
  try {
    root.x = opts.x === undefined ? 0 : opts.x;
    root.y = opts.y === undefined ? 0 : opts.y;
  } catch (e) {}

  if (!ctx.fidelity) {
    // labels go on last, so they sit above the photo rect inside each slot's own parent
    for (var i = 0; i < ctx.made.length; i++) {
      var m = ctx.made[i];
      if (!m.spec.slot || m.spec.slot.photoPath !== m.spec.path) continue;
      var host = m.node.parent;
      if (!host || !('appendChild' in host)) continue;
      try {
        var lab = await capSlotLabelNode(host, m.spec, M, ctx);
        lab.x = m.node.x + (m.node.width - lab.width) / 2;
        lab.y = m.node.y + (m.node.height - lab.height) / 2;
      } catch (e) {}
    }
    // a captured template with more callouts than the sheet row filled: hide the empties
    // rather than ship a production A+ carrying the source design's copy
    if (opts.row) {
      for (var k = 0; k < ctx.made.length; k++) {
        var c = ctx.made[k];
        if (c.spec.calloutIndex === undefined) continue;
        if (c.spec.calloutIndex < opts.row.cards.length) continue;
        try { c.node.visible = false; } catch (e) {}
        ctx.warn.push('Callout ' + (c.spec.calloutIndex + 1) + ' was hidden — the sheet row has only ' +
          opts.row.cards.length + ' feature(s)');
      }
    }
  }
  return { node: root, warnings: ctx.warn, made: ctx.made };
}

// ---------------------------------------------------------------------------
// 7. Round-trip diff — the quality gate
// ---------------------------------------------------------------------------

// Canonical JSON: sorted keys, numbers rounded, -0 normalised. Two values are "the same" iff
// their canonical strings match.
function capCanon(v, dp) {
  if (v === null || v === undefined) return 'null';
  if (capIsMixed(v)) return '"__mixed__"';
  var t = typeof v;
  if (t === 'number') return String(capR(v, dp));
  if (t === 'boolean' || t === 'string') return JSON.stringify(v);
  if (t !== 'object') return '"' + t + '"';
  if (Array.isArray(v)) {
    var a = [];
    for (var i = 0; i < v.length; i++) a.push(capCanon(v[i], dp));
    return '[' + a.join(',') + ']';
  }
  if (v.__mixed) return '"__mixed__"';
  var keys = Object.keys(v).sort(), parts = [];
  for (var j = 0; j < keys.length; j++) {
    var cv = capCanon(v[keys[j]], dp);
    if (cv === 'null' && v[keys[j]] === undefined) continue;
    parts.push(JSON.stringify(keys[j]) + ':' + cv);
  }
  return '{' + parts.join(',') + '}';
}
function capShort(s) { s = String(s); return s.length > 260 ? s.slice(0, 257) + '…' : s; }

function capAbsBox(node, rootBox) {
  var b = null;
  try { b = node.absoluteBoundingBox; } catch (e) {}
  if (!b || !rootBox) return null;
  return { x: capR(b.x - rootBox.x, 2), y: capR(b.y - rootBox.y, 2), w: capR(b.width, 2), h: capR(b.height, 2) };
}

function capDiffNode(o, g, path, ctx, isRoot) {
  var po = capReadProps(o, null), pg = capReadProps(g, null);
  var seen = {}, keys = [], i;
  for (var a in po) if (!seen[a]) { seen[a] = 1; keys.push(a); }
  for (var b in pg) if (!seen[b]) { seen[b] = 1; keys.push(b); }

  var label = capName(o);
  for (i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (CAP_NO_DIFF[k]) continue;
    // The probe is deliberately renamed, parked below the original and locked, so a capture that
    // crashed before its cleanup leaves something identifiable and un-draggable. Those four are
    // therefore the only properties the root is excused from matching.
    if (isRoot && (k === 'name' || k === 'x' || k === 'y' || k === 'relativeTransform' || k === 'locked')) continue;
    var dp = (k === 'relativeTransform' || k === 'x' || k === 'y') ? 3 : 4;
    var ea = capCanon(po[k], dp), eb = capCanon(pg[k], dp);
    ctx.compared++;
    if (ea === eb) continue;
    ctx.mismatched++;
    if (ctx.mismatches.length < CAP_MAX_MISMATCHES) {
      ctx.mismatches.push({ path: path + ' · ' + k, node: label, property: k,
        expected: capShort(ea), actual: capShort(eb) });
    }
  }

  // position inside the frame, which is the thing a designer actually sees go wrong
  var ba = capAbsBox(o, ctx.rootBoxO), bb = capAbsBox(g, ctx.rootBoxG);
  ctx.compared++;
  if (capCanon(ba, 2) !== capCanon(bb, 2)) {
    ctx.mismatched++;
    if (ctx.mismatches.length < CAP_MAX_MISMATCHES) {
      ctx.mismatches.push({ path: path + ' · box', node: label, property: 'box',
        expected: capShort(capCanon(ba, 2)), actual: capShort(capCanon(bb, 2)) });
    }
  }

  // text runs: a bold span inside a paragraph is invisible to every node-level property
  if (o.type === 'TEXT' && g.type === 'TEXT') {
    var sa = capCanon(capSegments(o, null), 4), sb = capCanon(capSegments(g, null), 4);
    ctx.compared++;
    if (sa !== sb) {
      ctx.mismatched++;
      if (ctx.mismatches.length < CAP_MAX_MISMATCHES) {
        ctx.mismatches.push({ path: path + ' · styledSegments', node: label, property: 'styledSegments',
          expected: capShort(sa), actual: capShort(sb) });
      }
    }
  }

  var ko = null, kg = null;
  try { ko = ('children' in o) ? o.children : null; } catch (e) {}
  try { kg = ('children' in g) ? g.children : null; } catch (e) {}
  var no = ko ? ko.length : 0, ng = kg ? kg.length : 0;
  ctx.compared++;
  if (no !== ng) {
    ctx.mismatched++;
    if (ctx.mismatches.length < CAP_MAX_MISMATCHES) {
      ctx.mismatches.push({ path: path + ' · childCount', node: label, property: 'childCount',
        expected: String(no), actual: String(ng) });
    }
  }
  var n = Math.min(no, ng);
  for (i = 0; i < n; i++) capDiffNode(ko[i], kg[i], path + '/' + i, ctx, false);
}

// Capture → render the manifest back → walk both trees → report. Everything the probe creates is
// removed in a finally, so a failed diff never leaves artefacts on the canvas.
async function capRoundTrip(M, original, page, post) {
  var probe = null;
  var ctx = { compared: 0, mismatched: 0, mismatches: [], rootBoxO: null, rootBoxG: null };
  var warnings = [];
  try {
    capSweepProbes(page, warnings);
    // Seal whatever the user had pending into its own undo step first, so the probe's
    // create-and-delete (which nets to nothing) cannot be half-undone into their work.
    figma.commitUndo();
    post('render-probe', 0, 1);
    var built = await capBuildTree(M, {
      parent: page, fidelity: true,
      x: (original.x || 0), y: (original.y || 0) + (original.height || 0) + 4000,
      name: CAP_PROBE_TAG + ' ' + capName(original)
    });
    probe = built.node;
    try { probe.locked = true; } catch (e) {}
    warnings = warnings.concat(built.warnings);
    post('render-probe', 1, 1);

    post('diff', 0, 1);
    try { ctx.rootBoxO = original.absoluteBoundingBox; } catch (e) {}
    try { ctx.rootBoxG = probe.absoluteBoundingBox; } catch (e) {}
    capDiffNode(original, probe, '0', ctx, true);
    post('diff', 1, 1);
  } finally {
    if (probe) { try { probe.remove(); } catch (e) { warnings.push('the temporary capture probe could not be removed'); } }
  }
  var score = ctx.compared ? capR(1 - ctx.mismatched / ctx.compared, 4) : 0;
  return {
    score: score,
    compared: ctx.compared,
    mismatched: ctx.mismatched,
    truncated: ctx.mismatched > ctx.mismatches.length,
    mismatches: ctx.mismatches,
    warnings: warnings
  };
}

// A capture that crashed before its finally ran would leave a probe behind. Clear any from a
// previous run before making a new one, and say so.
function capSweepProbes(page, warnings) {
  var kids;
  try { kids = page.children; } catch (e) { return; }
  var removed = 0;
  for (var i = kids.length - 1; i >= 0; i--) {
    if (String(kids[i].name).indexOf(CAP_PROBE_TAG) !== 0) continue;
    try { kids[i].remove(); removed++; } catch (e) {}
  }
  if (removed) warnings.push('Removed ' + removed + ' leftover capture probe(s) from an earlier run.');
}

// ---------------------------------------------------------------------------
// 8. Mass production — one captured template, many style IDs
// ---------------------------------------------------------------------------

// The `run` loop's entry point for a captured manifest. Same signature contract as
// buildFromManifest: it returns { frame, label, warnings } and leaves the frame on the page.
async function capBuildFromManifest(M, row, opts) {
  var built = await capBuildTree(M, {
    parent: figma.currentPage, fidelity: false, row: row,
    x: opts.x, y: opts.y,
    name: row.ids.length ? row.ids.join(', ') : (M.meta.label + ' (no style ID)')
  });
  var lbl = null;
  try {
    lbl = figma.createText();
    lbl.fontName = { family: 'Inter', style: 'Regular' };
    lbl.characters = row.ids.join('\n') || '—';
    lbl.fontSize = 61;
    var c = M.palette.label;
    lbl.fills = [{ type: 'SOLID', color: { r: c[0] / 255, g: c[1] / 255, b: c[2] / 255 } }];
    lbl.name = 'Style IDs';
    figma.currentPage.appendChild(lbl);
    lbl.x = built.node.x + built.node.width + 82;
    lbl.y = built.node.y + 10;
  } catch (e) { lbl = null; }
  return { frame: built.node, label: lbl, warnings: built.warnings };
}

// ---------------------------------------------------------------------------
// 9. Persistence
// ---------------------------------------------------------------------------
// One clientStorage entry per template plus a small index, rather than one giant blob: a
// captured A+ manifest runs to hundreds of KB and rewriting every template on every save is how
// you hit the quota and lose all of them at once.

var CAP_INDEX_KEY = 'capturedTemplateIndex';
function capStoreKey(key) { return 'capturedTemplate:' + key; }

async function capSaveTemplate(M) {
  var idx = (await figma.clientStorage.getAsync(CAP_INDEX_KEY)) || [];
  var key = M.meta.key;
  var entry = {
    key: key, category: M.meta.category, categoryLabel: M.meta.categoryLabel,
    gender: M.meta.gender, id: M.meta.id, label: M.meta.label, sub: M.meta.sub,
    status: M.meta.status, version: M.meta.version, capturedAt: M.meta.capturedAt,
    source: M.meta.source
  };
  idx = idx.filter(function (e) { return e && e.key !== key; });
  idx.push(entry);
  await figma.clientStorage.setAsync(capStoreKey(key), M);
  await figma.clientStorage.setAsync(CAP_INDEX_KEY, idx);
  return entry;
}

async function capLoadTemplates() {
  var idx = (await figma.clientStorage.getAsync(CAP_INDEX_KEY)) || [];
  var out = { index: [], manifests: {} };
  for (var i = 0; i < idx.length; i++) {
    var e = idx[i];
    if (!e || !e.key) continue;
    var M = null;
    try { M = await figma.clientStorage.getAsync(capStoreKey(e.key)); } catch (err) {}
    if (!M) continue;
    out.index.push(e);
    out.manifests[e.key] = M;
  }
  return out;
}

// Folds captured templates into the registry the UI already renders, so they appear in the
// category/gender/template picker beside the hand-built Running ones with no UI change.
function capMergeIntoRegistry(reg, index) {
  if (!reg || !index || !index.length) return reg;
  index.forEach(function (e) {
    var cat = null, i;
    for (i = 0; i < reg.categories.length; i++) if (reg.categories[i].id === e.category) cat = reg.categories[i];
    if (!cat) {
      cat = { id: e.category, label: e.categoryLabel || capTitle(e.category), status: 'active',
        defaultGender: e.gender, genders: [] };
      reg.categories.push(cat);
    }
    if (cat.status !== 'active') cat.status = 'active';
    var gen = null;
    for (i = 0; i < cat.genders.length; i++) if (cat.genders[i].id === e.gender) gen = cat.genders[i];
    if (!gen) {
      gen = { id: e.gender, label: capTitle(e.gender), status: 'active', hero: ['', ''], templates: [] };
      cat.genders.push(gen);
    }
    if (gen.status !== 'active') gen.status = 'active';
    gen.templates = (gen.templates || []).filter(function (t) { return t.id !== e.id; });
    gen.templates.push({ id: e.id, label: e.label, sub: e.sub || 'Captured from a frame',
      version: e.version || 1, status: e.status || 'draft', captured: true });
  });
  return reg;
}

// ---------------------------------------------------------------------------
// 10. The message handler
// ---------------------------------------------------------------------------

async function capPageOf(node) {
  var cur = node, guard = 0;
  while (cur && cur.type !== 'PAGE' && guard++ < 200) cur = cur.parent;
  return cur && cur.type === 'PAGE' ? cur : null;
}

async function capHandleCaptureTemplate(msg) {
  function post(step, done, total) {
    figma.ui.postMessage({ type: 'capture-progress', step: step, done: done, total: total });
  }
  function fail(message) { figma.ui.postMessage({ type: 'capture-error', message: message }); }

  try {
    if (!msg.frameId) return fail('No frame id was sent — select a frame and try again.');
    post('scan', 0, 1);

    // dynamic-page: the page that holds the node has to be loaded before the node resolves
    if (msg.pageId) {
      for (var i = 0; i < figma.root.children.length; i++) {
        if (figma.root.children[i].id === msg.pageId) { await figma.root.children[i].loadAsync(); break; }
      }
    }
    var frame = await figma.getNodeByIdAsync(msg.frameId);
    if (!frame) return fail('That frame is no longer in the file. Re-select it and try again.');
    if (frame.type !== 'FRAME' && frame.type !== 'COMPONENT' && frame.type !== 'GROUP') {
      return fail('"' + capName(frame) + '" is a ' + frame.type + '. Select the A+ frame itself.');
    }
    var page = await capPageOf(frame);
    if (!page) return fail('That frame is not on a page any more.');
    await page.loadAsync();
    post('scan', 1, 1);

    var M = await capCaptureFrame(frame, msg, post);

    var diff = await capRoundTrip(M, frame, page, post);
    M.warnings = M.warnings.concat(diff.warnings);
    M.meta.roundTrip = { score: diff.score, compared: diff.compared, mismatched: diff.mismatched,
      checkedAt: new Date().toISOString() };

    post('save', 0, 1);
    var entry = null, saveError = null;
    try { entry = await capSaveTemplate(M); }
    catch (e) { saveError = String((e && e.message) || e); }
    if (saveError) M.warnings.push('Could not save to clientStorage (' + saveError +
      ') — the manifest is returned but will not survive a plugin reload.');
    post('save', 1, 1);

    // keep this session's in-memory registry and manifest map in step, so the captured
    // template is usable from the Automate tab immediately without a reload
    if (entry) {
      try {
        FALLBACK_MANIFESTS[M.meta.key] = M;
        capMergeIntoRegistry(FALLBACK_REGISTRY, [entry]);
      } catch (e) {}
    }

    var body = JSON.stringify(M);
    var tooBig = body.length > CAP_MAX_MANIFEST_BYTES;
    if (tooBig) {
      M.warnings.push('The manifest is ' + Math.round(body.length / 1024) + ' KB, too large to hand back ' +
        'through the plugin UI bridge. It is saved locally and usable; only the preview body is withheld.');
    }

    figma.ui.postMessage({
      type: 'capture-result',
      ok: true,
      key: M.meta.key,
      manifest: tooBig ? null : M,
      manifestBytes: body.length,
      registryEntry: entry,
      registry: FALLBACK_REGISTRY,
      stats: M.stats,
      diff: {
        score: diff.score, compared: diff.compared, mismatched: diff.mismatched,
        truncated: diff.truncated, mismatches: diff.mismatches
      },
      warnings: M.warnings
    });
    figma.notify('A+: captured "' + M.meta.label + '" · ' + M.stats.layers + ' layers · round-trip ' +
      Math.round(diff.score * 1000) / 10 + '%');
  } catch (e) {
    fail(String((e && e.stack) || (e && e.message) || e));
  }
}

// ===== main.js =====
// ===== plugin main (CORE) — OWNED BY THE PLATFORM =====
// The Figma-sandbox half of the platform: shows the UI, keeps the UI's view of page + selection
// consistent, owns figma.clientStorage, and routes UI messages to the panel handlers registered in
// main-automate.js / main-design.js / main-export.js (concatenated after this file by build.js).
//
// Panel files use exactly three hooks from here:
//   onUiMessage(type, async function (msg) { ... })      handle one UI message type
//   onInit(async function (initMsg) { initMsg.x = ... })  add fields to the 'init' message
//   replyTo(msg, result) / replyError(msg, err)           answer a bridge.request() from the UI
// plus the shared helpers idsFromNode(), nearbyLabelIds(), fallbackManifest().
figma.showUI(__html__, { width: 460, height: 760, themeColors: true });

function fallbackManifest(key) { return FALLBACK_MANIFESTS[key] || null; }

// ---------- message router ----------
var UI_HANDLERS = {};
function onUiMessage(type, fn) {
  if (UI_HANDLERS[type]) throw new Error('Two handlers registered for UI message "' + type + '"');
  UI_HANDLERS[type] = fn;
}
var INIT_CONTRIBUTORS = [];
function onInit(fn) { INIT_CONTRIBUTORS.push(fn); }
// Replies to the UI's bridge.request(type, payload): the UI waits for { type:'reply', reqId }.
function replyTo(msg, result) { if (msg && msg.reqId) figma.ui.postMessage({ type: 'reply', reqId: msg.reqId, ok: true, result: result === undefined ? null : result }); }
function replyError(msg, e, code) {
  if (msg && msg.reqId) figma.ui.postMessage({ type: 'reply', reqId: msg.reqId, ok: false, code: code || (e && e.code) || 'sandbox-error', error: String((e && e.message) || e) });
}

figma.ui.onmessage = async function (msg) {
  if (!msg || !msg.type) return;
  var fn = UI_HANDLERS[msg.type];
  if (!fn) {
    if (msg.reqId) replyError(msg, 'No handler for "' + msg.type + '" in this code.js — rebuild the plugin.', 'no-handler');
    return;
  }
  try { await fn(msg); }
  catch (e) {
    if (msg.reqId) replyError(msg, e);
    else figma.ui.postMessage({ type: 'error', message: String((e && e.message) || e) });
  }
};

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

// ---------- startup ----------
// Runs on a microtask, i.e. after this whole file (and the main-*.js files concatenated after it)
// has executed, so every onInit() contributor and onUiMessage() handler is registered first.
async function bootPlugin() {
  var backendOverride = await figma.clientStorage.getAsync('backendUrl');
  var session = await figma.clientStorage.getAsync('googleSession');
  var init = {
    type: 'init',
    backendUrl: backendOverride || '',   // developer override only; empty = the built-in constant
    session: session || '',
    registry: FALLBACK_REGISTRY,
    manifests: FALLBACK_MANIFESTS,       // so the UI can draw template previews with no backend
    page: figma.currentPage.name
  };
  for (var i = 0; i < INIT_CONTRIBUTORS.length; i++) {
    try { await INIT_CONTRIBUTORS[i](init); }
    catch (e) { figma.notify('A+: startup step failed (' + ((e && e.message) || e) + ')'); }
  }
  // contributors may have folded more templates into the FALLBACK_* maps
  init.registry = FALLBACK_REGISTRY;
  init.manifests = FALLBACK_MANIFESTS;
  figma.ui.postMessage(init);
  postPage();                // same shape the UI gets on every later page change
  postSelection(true);
  ready = true;              // only now may the listeners below post anything
}
Promise.resolve().then(bootPlugin).catch(function (e) { figma.notify('A+: could not start (' + ((e && e.message) || e) + ')'); });

// ---------- follow the user across pages and selections ----------
figma.on('selectionchange', syncToUi);
figma.on('currentpagechange', syncToUi);

// a page rename with no page switch is not pushed. The hook that would catch it,
// figma.on('documentchange'), requires figma.loadAllPagesAsync() first under
// "documentAccess": "dynamic-page", which loads every page of the file just to watch a
// title. Instead the UI refreshes the name itself with a 'ping-page' message, which is
// cheap and handled below — so a stale name only lasts until the UI next pings.

// ---------- core messages ----------
onUiMessage('save-session', async function (msg) { await figma.clientStorage.setAsync('googleSession', msg.session || ''); });
// developer override of the backend URL (no UI field; from the plugin console: aplusDev.setBackend(url))
onUiMessage('save-backend', async function (msg) { await figma.clientStorage.setAsync('backendUrl', msg.url || ''); });
// the pings answer unconditionally — the UI asked, so the de-dup above must not swallow it
onUiMessage('ping-selection', async function () { postSelection(true); });
onUiMessage('ping-page', async function () { postPage(); });
onUiMessage('notify', async function (msg) { figma.notify(String(msg.text || '').slice(0, 300), msg.error ? { error: true } : undefined); });

// Small per-user prefs for panels — always namespaced "ui:" so a panel can never overwrite the
// session, the backend override or the template cache. Values must be small (clientStorage quota).
var STORAGE_VALUE_MAX = 64 * 1024;
onUiMessage('storage-get', async function (msg) {
  replyTo(msg, await figma.clientStorage.getAsync('ui:' + String(msg.key || '')));
});
onUiMessage('storage-set', async function (msg) {
  var v = msg.value === undefined ? null : msg.value;
  if (JSON.stringify(v === null ? '' : v).length > STORAGE_VALUE_MAX) return replyError(msg, 'Value too large for clientStorage (max 64 KB). Store big things in Drive.', 'too-large');
  if (v === null) await figma.clientStorage.deleteAsync('ui:' + String(msg.key || ''));
  else await figma.clientStorage.setAsync('ui:' + String(msg.key || ''), v);
  replyTo(msg, true);
});

// ---------- template cache (clientStorage) ----------
// A CACHE of the user's Drive template library (templateStore in platform.js). Drive is the
// source of truth; this only makes the picker work offline and instantly. Manifests only — never
// image bytes — and bounded: one entry <= TPLCACHE_ENTRY_MAX, all entries <= TPLCACHE_TOTAL_MAX,
// oldest evicted first. An entry too big to cache keeps its index row (no body).
var TPLCACHE_INDEX = 'tplcache:index';
var TPLCACHE_ENTRY_MAX = 400 * 1024;
var TPLCACHE_TOTAL_MAX = 2 * 1024 * 1024;
function tplBodyKey(key) { return 'tplcache:m:' + key; }
async function tplIndex() { return (await figma.clientStorage.getAsync(TPLCACHE_INDEX)) || []; }
async function tplPut(key, entry, manifest) {
  var idx = (await tplIndex()).filter(function (e) { return e && e.key !== key; });
  var size = 0, body = null;
  if (manifest) { body = JSON.stringify(manifest); size = body.length; }
  var row = { key: key, entry: entry || null, cachedAt: Date.now(), bytes: body && size <= TPLCACHE_ENTRY_MAX ? size : 0 };
  if (row.bytes) await figma.clientStorage.setAsync(tplBodyKey(key), manifest);
  else await figma.clientStorage.deleteAsync(tplBodyKey(key));
  idx.push(row);
  // evict oldest bodies until the total fits
  idx.sort(function (a, b) { return a.cachedAt - b.cachedAt; });
  var total = idx.reduce(function (n, e) { return n + (e.bytes || 0); }, 0);
  for (var i = 0; i < idx.length && total > TPLCACHE_TOTAL_MAX; i++) {
    if (!idx[i].bytes || idx[i].key === key) continue;
    total -= idx[i].bytes; idx[i].bytes = 0;
    await figma.clientStorage.deleteAsync(tplBodyKey(idx[i].key));
  }
  await figma.clientStorage.setAsync(TPLCACHE_INDEX, idx);
  return { cached: !!row.bytes, bytes: size };
}
onUiMessage('tplcache-put', async function (msg) { replyTo(msg, await tplPut(String(msg.key), msg.entry, msg.manifest)); });
onUiMessage('tplcache-remove', async function (msg) {
  var key = String(msg.key);
  await figma.clientStorage.setAsync(TPLCACHE_INDEX, (await tplIndex()).filter(function (e) { return e && e.key !== key; }));
  await figma.clientStorage.deleteAsync(tplBodyKey(key));
  replyTo(msg, true);
});
// keep exactly the keys Drive reported; refresh their index rows, drop the rest
onUiMessage('tplcache-sync', async function (msg) {
  var keep = {}; (msg.keys || []).forEach(function (k) { keep[k] = 1; });
  var entries = {}; (msg.entries || []).forEach(function (e) { if (e && e.key) entries[e.key] = e; });
  var idx = await tplIndex(), out = [];
  for (var i = 0; i < idx.length; i++) {
    var e = idx[i];
    if (!e || !keep[e.key]) { if (e) await figma.clientStorage.deleteAsync(tplBodyKey(e.key)); continue; }
    if (entries[e.key]) e.entry = entries[e.key];
    out.push(e); delete entries[e.key];
  }
  Object.keys(entries).forEach(function (k) { out.push({ key: k, entry: entries[k], cachedAt: Date.now(), bytes: 0 }); });
  await figma.clientStorage.setAsync(TPLCACHE_INDEX, out);
  replyTo(msg, { count: out.length });
});
onUiMessage('tplcache-list', async function (msg) {
  var idx = await tplIndex(), manifests = {};
  for (var i = 0; i < idx.length; i++) {
    if (!idx[i] || !idx[i].bytes) continue;
    var m = await figma.clientStorage.getAsync(tplBodyKey(idx[i].key));
    if (m) manifests[idx[i].key] = m;
  }
  replyTo(msg, { index: idx.map(function (e) { return { key: e.key, entry: e.entry, cachedAt: e.cachedAt, hasManifest: !!manifests[e.key] }; }), manifests: manifests });
});
onUiMessage('tplcache-clear', async function (msg) {
  var idx = await tplIndex();
  for (var i = 0; i < idx.length; i++) if (idx[i]) await figma.clientStorage.deleteAsync(tplBodyKey(idx[i].key));
  await figma.clientStorage.deleteAsync(TPLCACHE_INDEX);
  replyTo(msg, true);
});

// ===== main-automate.js =====
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
  function manifestFor(key) {
    if (!key) return null;
    var m = manifests[key] || fallbackManifest(key);
    if (m && m.renderer && m.renderer !== 'aplus-standard-v1' && m.renderer !== CAP_RENDERER) return null;
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
          var res = manifest.renderer === CAP_RENDERER
            ? await capBuildFromManifest(manifest, row, { x: x, y: y })
            : await buildFromManifest(manifest, row, { F: fonts.F, icons: icons, x: x, y: y });
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

// ===== main-design.js =====
// ===== sandbox handlers: Add design — OWNED BY THE DESIGN PANEL =====
// UI counterpart: plugin-src/ui/design.js. Capture engine: plugin-src/capture.js.
// Hooks from main.js (core): onUiMessage, onInit, replyTo/replyError.
// Messages handled:  capture-template {frameId, frameName, width, height, styleIds, pageId, template, semanticLabelling, backend}
// Messages posted:   capture-progress {step, done, total} · capture-result {...} · capture-error {message}
// Init contribution: init.captured — index of templates captured from frames (clientStorage today;
//                    moving to the user's Drive via platform templateStore is this panel's job).

onInit(async function (init) {
  // Templates captured from a frame live in clientStorage. They are folded into the same
  // registry and manifest map the bundled Running templates use, so they show up in the
  // category → gender → template picker and route from the sheet with no special casing.
  var captured = { index: [], manifests: {} };
  try { captured = await capLoadTemplates(); }
  catch (e) { figma.notify('A+: saved templates could not be read (' + (e && e.message) + ')'); }
  Object.keys(captured.manifests).forEach(function (k) { FALLBACK_MANIFESTS[k] = captured.manifests[k]; });
  capMergeIntoRegistry(FALLBACK_REGISTRY, captured.index);
  init.captured = captured.index;   // which of the registry's templates came from a captured frame
});

// ---------- capture the selected frame as a reusable template ----------
onUiMessage('capture-template', async function (msg) { await capHandleCaptureTemplate(msg); });

// ===== main-export.js =====
// ===== sandbox handlers: Export — OWNED BY THE EXPORT PANEL =====
// UI counterpart: plugin-src/ui/export.js.
// Hooks from main.js (core): onUiMessage, onInit, replyTo/replyError, idsFromNode, nearbyLabelIds.
// Messages handled:  export-style {reqId, styleId, pageId, format, composite, scale} · save-export-config {config}
// Messages posted:   export-bytes {reqId, styleId, format, composite, frameName, frameId, matches, width, height, bytes}
//                    export-error {reqId, styleId, message}
// Init contribution: init.exportConfig — the GIF folder + category→GIF rules saved from the Export tab.

onInit(async function (init) {
  init.exportConfig = (await figma.clientStorage.getAsync('exportConfig')) || null;
});

onUiMessage('save-export-config', async function (msg) { await figma.clientStorage.setAsync('exportConfig', msg.config || null); });

// ---------- export ----------
// Finds the A+ frame for a style ID on the current page and exports it with exportAsync.
// Figma can only emit PNG/JPG/SVG/PDF; animated output is composited from these bytes in the UI.
function styleFrameCandidates() {
  var pool = [];
  figma.currentPage.children.forEach(function (n) {
    if (n.type === 'FRAME') pool.push(n);
    else if (n.type === 'SECTION') n.children.forEach(function (c) { if (c.type === 'FRAME') pool.push(c); });
  });
  return pool;
}
function findStyleFrames(styleId) {
  // a selected frame wins, so "select the A+ and press Export" always exports what you selected
  var sel = figma.currentPage.selection.filter(function (n) { return n.type === 'FRAME'; });
  var pool = sel.concat(styleFrameCandidates().filter(function (n) { return sel.indexOf(n) < 0; }));
  var byName = pool.filter(function (n) { return (String(n.name).match(/\d{6}/g) || []).indexOf(styleId) >= 0; });
  if (byName.length) return byName;
  return pool.filter(function (n) {
    var ids = idsFromNode(n);
    if (!ids.length) ids = nearbyLabelIds(n);
    return ids.indexOf(styleId) >= 0;
  });
}
async function handleExportStyle(msg) {
  var reqId = msg.reqId;
  try {
    if (msg.pageId && msg.pageId !== figma.currentPage.id) {
      throw new Error('You changed pages after this list was drawn. Go back to the page holding style ' + msg.styleId + ', or refresh the Export tab.');
    }
    var hits = findStyleFrames(String(msg.styleId || ''));
    if (!hits.length) throw new Error('No frame for style ' + msg.styleId + ' on this page. Build it on the Automate tab first, or select its frame.');
    var frame = hits[0];
    var fmt = String(msg.format || 'PNG').toUpperCase();
    if (['PNG', 'JPG', 'SVG', 'PDF'].indexOf(fmt) < 0) throw new Error('Figma cannot export "' + fmt + '".');
    var scale = Math.max(1, Math.min(4, Number(msg.scale) || 1));
    var settings = (fmt === 'PNG' || fmt === 'JPG') ? { format: fmt, constraint: { type: 'SCALE', value: scale } } : { format: fmt };
    var bytes = await frame.exportAsync(settings);
    figma.ui.postMessage({
      type: 'export-bytes', reqId: reqId, styleId: msg.styleId, format: fmt, composite: msg.composite || null,
      frameName: frame.name, frameId: frame.id, matches: hits.length,
      width: Math.round(frame.width * (settings.constraint ? scale : 1)),
      height: Math.round(frame.height * (settings.constraint ? scale : 1)),
      bytes: bytes
    });
  } catch (e) {
    figma.ui.postMessage({ type: 'export-error', reqId: reqId, styleId: msg.styleId, message: String((e && e.message) || e) });
  }
}
onUiMessage('export-style', handleExportStyle);
