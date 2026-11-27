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
// Keep the Fabric-in-Focus text stack (heading, copy, divider, composition, icon row) inside its
// card. The stack is placed at the design's y and grows downward, and the card has a fixed
// height, so long fabric copy used to push the icon row out of the card and into the callouts.
// In order, and only as far as needed:
//   1. the design position, when it fits (short copy renders exactly as designed)
//   2. lift the stack toward the close-up photo, never closer than FAB_MIN_GAP below it
//   3. step the copy size down 2 px at a time, never below 80 % of the design size
//   4. widen the copy, up to the background panel less FAB_SIDE_PAD each side
//   5. still too long: keep the best position and say so — the copy needs shortening
// The bottom limit is the card or the background panel, whichever ends first, less FAB_BOTTOM_PAD.
// The stack never moves LOWER than the design put it (the Training designs already sit it ~30 px
// under the close-up, closer than FAB_MIN_GAP).
var FAB_MIN_GAP = 40, FAB_BOTTOM_PAD = 48, FAB_SIDE_PAD = 80;
function fitFabricStack(fb, ts, cols, copyNode, warn) {
  var panelBottom = fb.bgPhoto ? fb.bgPhoto.y + fb.bgPhoto.h : fb.box.h;
  var limit = fb.box.y + Math.min(fb.box.h, panelBottom) - FAB_BOTTOM_PAD;
  var designY = cols.y;
  var minTop = Math.min(designY, fb.box.y + (fb.closeup ? fb.closeup.y + fb.closeup.h : 0) + FAB_MIN_GAP);
  function fits() { return minTop + cols.height <= limit; }
  function place() { cols.y = Math.max(minTop, Math.min(designY, limit - cols.height)); }
  if (designY + cols.height <= limit) return { moved: 0, size: ts.copy.size, fits: true };
  var size0 = ts.copy.size, floor = Math.round(size0 * 0.8), size = size0;
  var width0 = copyNode.width, maxW = Math.max(width0, (fb.bgPhoto ? fb.bgPhoto.w : fb.box.w) - 2 * FAB_SIDE_PAD), width = width0;
  while (!fits() && size - 2 >= floor) { size -= 2; copyNode.fontSize = size; }
  while (!fits() && width + 40 <= maxW) { width += 40; copyNode.resize(width, copyNode.height); copyNode.textAutoResize = 'HEIGHT'; }
  place();
  var what = [];
  if (designY - cols.y >= 1) what.push('moved the fabric text up ' + Math.round(designY - cols.y) + ' px');
  if (size !== size0) what.push('set the copy at ' + size + ' px (design ' + size0 + ' px)');
  if (width !== width0) what.push('widened the copy to ' + Math.round(width) + ' px (design ' + Math.round(width0) + ' px)');
  if (cols.y + cols.height <= limit) {
    warn.push('Fabric copy is long: ' + what.join(', ') + ' to keep the icons inside the card.');
    return { moved: designY - cols.y, size: size, width: width, fits: true };
  }
  warn.push('Fabric copy is too long for the card even after it ' + (what.join(', ') || 'was adjusted') + '. The icons run ' +
    Math.round(cols.y + cols.height - limit) + ' px past the card. Shorten the fabric copy in the sheet.');
  return { moved: designY - cols.y, size: size, width: width, fits: false };
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
// reported rather than guessed: "Stretchy" must not be bent onto Super Stretch / Multi Stretch /
// High Lycra. Shipping a plausible-but-wrong glyph to Amazon is worse than shipping a visible gap.
// "Soft" was in that ambiguous group (Super-Soft / Hyper Soft / Ultra-Soft / Soft Cotton-Lycra)
// until the product owner decided it on 2026-11-27: Soft = Super-Soft, the feather.
var ICON_ALIASES = {
  // product decision 2026-11-27 (Training 710042, Winter Wear 708665 write plain "Soft")
  'soft': 'super soft',
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
// Icons are looked up on the CURRENT page first, then on every other page of the file, so a bulk
// run on a fresh output page still finds the production icons and the ICON BANK that live on the
// design page. A name already found on an earlier page is never replaced by a later one.
// (documentAccess is "dynamic-page": other pages must be loaded before they can be searched.)
async function buildIconIndexAll() {
  var idx = buildIconIndex(figma.currentPage);
  idx.pages = [figma.currentPage.name];
  var pages = figma.root.children.filter(function (p) { return p !== figma.currentPage; });
  for (var i = 0; i < pages.length; i++) {
    try { await pages[i].loadAsync(); } catch (e) { continue; }
    var before = idx.names.length;
    buildIconIndex(pages[i], idx);
    if (idx.names.length > before) idx.pages.push(pages[i].name);
  }
  return idx;
}
function buildIconIndex(page, into) {
  var idx = into || {
    production: { exact: {}, norm: {} },
    bank: { exact: {}, norm: {} },
    names: []
  };
  var ellipses = (page || figma.currentPage).findAllWithCriteria({ types: ['ELLIPSE'] });
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
  // Last resort: the plugin's own copy of the catalogued glyph (icon-fallback.js, generated from
  // backend/icons). Same artwork, so still the right icon — used only when no page of this file
  // has an icon of that name the search can reach.
  var cat = (typeof ICON_FALLBACK !== 'undefined' && ICON_FALLBACK) || {};
  var ck = cat[key] ? key : (ICON_ALIASES[key] && cat[ICON_ALIASES[key]] ? ICON_ALIASES[key] : null);
  if (ck) {
    var c = cat[ck];
    return { entry: { name: c.name, key: ck, source: 'catalogue', svg: c.svg, file: c.file, glyphRatio: c.glyphRatio },
             via: ck === key ? 'normalised' : 'alias', source: 'catalogue' };
  }
  return null;
}
// Draw a catalogued glyph (SVG) inside a production ring: same ring, label and spacing as
// bankIcon, glyph centred at the proportion the designer drew it.
function catalogueIcon(M, F, parent, entry, labelText) {
  var g = stack(parent, 'VERTICAL', { gap: ICON_LABEL_GAP, cross: 'CENTER',
    name: 'Icon · ' + entry.name + ' · from plugin icon catalogue' });
  var holder = box(g, { w: ICON_RING_D, h: ICON_RING_D, name: 'Ring' });
  var e = figma.createEllipse();
  e.resize(ICON_RING_D, ICON_RING_D);
  e.fills = [solid(col(M, ICON_RING_FILL))];
  e.strokes = [solid(col(M, ICON_RING_STROKE))];
  e.strokeWeight = ICON_RING_STROKE_W;
  holder.appendChild(e); e.x = 0; e.y = 0; e.name = 'Ellipse 3';
  var glyph = figma.createNodeFromSvg(entry.svg);
  try { glyph.fills = []; glyph.clipsContent = false; } catch (e) { /* not a frame — nothing to clear */ }
  holder.appendChild(glyph);
  var target = ICON_RING_D * (entry.glyphRatio || 0.51);
  var s = target / Math.max(glyph.width, glyph.height);
  if (typeof glyph.rescale === 'function') glyph.rescale(s); else glyph.resize(glyph.width * s, glyph.height * s);
  glyph.x = (ICON_RING_D - glyph.width) / 2; glyph.y = (ICON_RING_D - glyph.height) / 2;
  glyph.name = 'Glyph · ' + entry.name;
  txt(M, F, g, { text: labelText || entry.name, font: 'regular', size: ICON_LABEL_SIZE, colorRole: 'white',
    align: 'CENTER', name: labelText || entry.name });
  return g;
}
// The label a rebuilt icon shows: the sheet's own spelling when it is the same name written
// differently ("Odour-Free" for the bank's "Odour Free", matching its hyphenated neighbours),
// the icon's name when the sheet reached it through an alias ("Soft" -> "Super-Soft").
function iconLabelText(hit, label) {
  var raw = String(label || '').replace(/\s+/g, ' ').trim();
  if (hit.via === 'alias' || !raw || raw !== raw.replace(/^[a-z]/, function (c) { return c.toUpperCase(); })) return hit.entry.name;
  return raw;
}
// Rebuild a production-scale icon from ICON BANK artwork. The ring and the label are drawn to
// the production spec (the bank's own 19px ring and "<Name>: <description>" label are reference
// art, not usable output); only the GLYPH comes from the bank, scaled up by ICON_BANK_SCALE.
// This is a real icon of the right name — not a stand-in — but every use is reported.
// How far a bank glyph has to be scaled up to sit correctly in a production ring. Derived from
// THIS icon's own ring rather than a constant: the original bank is drawn at 18.82px (giving
// 8.016x, the value that used to be hardcoded) but icons added later are not — the Odour-Free
// icon's ring is 33.75px, and scaling its glyph by 8.016 would overflow the ring.
function iconBankScale(entry) {
  var rb = iconBox(entry.ring);
  return rb && rb.width ? (ICON_RING_D / rb.width) : ICON_BANK_SCALE;
}
function bankIcon(M, F, parent, entry, labelText) {
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
  var scale = iconBankScale(entry);
  for (var i = 0; i < entry.glyphs.length; i++) {
    var src = entry.glyphs[i];
    var sb = iconBox(src);
    var c = src.clone();
    holder.appendChild(c);
    if (typeof c.rescale === 'function') c.rescale(scale);
    else if (typeof c.resize === 'function' && sb) c.resize(sb.width * scale, sb.height * scale);
    if (sb && rb) { c.x = (sb.x - rb.x) * scale; c.y = (sb.y - rb.y) * scale; }
    c.name = 'Glyph · ' + entry.name;
  }
  txt(M, F, g, { text: labelText || entry.name, font: 'regular', size: ICON_LABEL_SIZE, colorRole: 'white',
    align: 'CENTER', name: labelText || entry.name });
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
  var copyNode = txt(M, F, cols, { text: row.fab.copy, font: ts.copy.font, size: ts.copy.size, colorRole: ts.copy.colorRole, align: 'CENTER', width: ts.copy.width, bold: ts.copy.bold, name: 'Fabric copy' });
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
      warn.push('Icon "' + label + '" did not resolve — no icon of that name in the designs or the ' +
        'ICON BANK on any page searched (' + ((icons.pages || []).join(', ') || 'this page') + '), nor in ' +
        'the plugin\'s icon catalogue. A labelled gap was drawn; nothing was substituted.');
      return;
    }
    if (hit.source === 'production') {
      iconRow.appendChild(hit.entry.group.clone());
    } else if (hit.source === 'catalogue') {
      catalogueIcon(M, F, iconRow, hit.entry, iconLabelText(hit, label));
      warn.push('Icon "' + label + '" was not found on any page of this file (searched: ' +
        ((icons.pages || []).join(', ') || 'this page') + '), so it was drawn from the plugin\'s ' +
        'catalogue copy (backend/icons/' + hit.entry.file + '). Same artwork — but if the designer ' +
        'has updated it in Figma, check the ICON BANK copy has a ring, glyph and "' + hit.entry.name + '" label grouped together.');
    } else {
      bankIcon(M, F, iconRow, hit.entry, iconLabelText(hit, label));
      warn.push('Icon "' + label + '" is not in any shipped design, so it was rebuilt from the ' +
        'ICON BANK glyph scaled up ' + iconBankScale(hit.entry).toFixed(2) + 'x (bank art is ' +
        'reference art, drawn small). Check it renders cleanly before publishing.');
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
  fitFabricStack(fb, ts, cols, copyNode, warn);
  cols.x = (W - cols.width) / 2;

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
