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
