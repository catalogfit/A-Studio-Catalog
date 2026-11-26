# Template Ingestion — Implementation Plan

**How a designer uploads a hand-made A+ design into the plugin and gets a reusable template manifest back.**

Author: engineering notes for Rohit Ghosh (Catalog Design, Curefit / Cultstore)
Status: proposal — needs a greenlight decision
Scope: `plugin-src/`, `backend/server.js`, `backend/templates/`

---

## Contents

1. [The goal](#1-the-goal)
2. [Why this is mostly not an AI problem](#2-why-this-is-mostly-not-an-ai-problem)
3. [Stage 1 — Deterministic extraction (no AI)](#3-stage-1--deterministic-extraction-no-ai)
4. [Stage 2 — Structural inference (rules, no AI)](#4-stage-2--structural-inference-rules-no-ai)
5. [Stage 3 — Semantic labelling (where OpenRouter earns its place)](#5-stage-3--semantic-labelling-where-openrouter-earns-its-place)
6. [The OpenRouter integration, concretely](#6-the-openrouter-integration-concretely)
7. [Stage 4 — Manifest emission + round-trip verification](#7-stage-4--manifest-emission--round-trip-verification)
8. [Stage 5 — The designer's review UI](#8-stage-5--the-designers-review-ui)
9. [The cheaper alternative that should ship first](#9-the-cheaper-alternative-that-should-ship-first)
10. [Learning loop](#10-learning-loop)
11. [Phased plan and effort](#11-phased-plan-and-effort)
12. [Risks and honest limits](#12-risks-and-honest-limits)
13. [Open decisions for Rohit](#13-open-decisions-for-rohit)

---

## 1. The goal

Today a new A+ template only exists once an engineer hand-writes a manifest JSON like `backend/templates/running/_base.json` — ~180 lines of exact coordinates, gradient stops, font roles and column mappings. That is the bottleneck: Running is live, Training / Lifestyle / Seamless are all `"status": "coming-soon"` in `backend/templates/index.json` purely because nobody has transcribed them. The goal of this feature is that a designer who has drawn a new A+ by hand in Figma selects that frame, clicks **Ingest template** in A+ Studio, and within about a minute the system has read the design, worked out what each piece *is*, written a manifest to the backend, re-rendered it beside the original so the designer can confirm it matches, and registered it in the category index — with zero engineering involvement. New category in an afternoon instead of a sprint.

---

## 2. Why this is mostly not an AI problem

This is the single most important point in this document, and it should shape the budget decision.

**A Figma frame is already perfectly structured data.** It is not a picture. Inside the plugin sandbox, `figma.currentPage.selection[0]` gives a live object graph, and the Plugin API hands back exact values for everything the manifest schema needs:

| Manifest field | Where it comes from | Fidelity |
|---|---|---|
| `hero.x/y/w/h` | `node.x`, `node.y`, `node.width`, `node.height` | exact float |
| `background.layers[].fills[].stops` | `fill.gradientStops[].position` + `.color.{r,g,b,a}` | exact float |
| `hero.layers[].rt` | `node.relativeTransform` | exact matrix (rotation *and* flip) |
| `fonts.hero` | `textNode.fontName.{family, style}` | exact |
| `hero.word.size` / `lhPct` / `ls` | `fontSize`, `lineHeight`, `letterSpacing` | exact |
| `background.glows[].blur` | `node.effects[].radius` where `type === 'LAYER_BLUR'` | exact |
| circular photo slots | `node.isMask === true` on an `ELLIPSE` | exact boolean |
| `slices[]` | nodes where `node.type === 'SLICE'` | exact |

Compare that to the alternative people reach for first — "screenshot the frame, send it to a vision model, ask it for the JSON." A vision model looking at a 1572×5000 px PNG would be **guessing** that the hero shade is rotated 16°, that the glow blur is 160, that the gradient's second stop sits at 0.41, that the letter-spacing is −45.28. It would return plausible round numbers. Every one of those guesses is a visible defect in the regenerated A+, and every one of them is a number the API already knows to six decimal places.

So the rule for this pipeline is:

> **Deterministic extraction first. AI only for semantics.**

Concretely: roughly 95% of a manifest is geometry, colour and typography — all machine-readable with 100% fidelity and zero inference. The remaining 5% is *meaning*: the API can tell you there is a 517 px circular mask group at (67.82, 0.21), but it cannot tell you that circle is "the photo for callout card 1" rather than "a decorative ring". That residue — naming the parts — is the only place a language model belongs, and it is a cheap text classification job, not a vision job.

A corollary worth noting: **the renderer already names everything it builds.** `renderer.js` emits `Card 1 · Hero`, `Card 2 · Fabric in Focus`, `Hero word`, `Hero italic word`, `Hero tagline`, `Bar`, `Title`, `Copy`, `Glow`, `BG gradient`, `Mask group · <label>`. An A+ produced by the plugin would round-trip through this pipeline essentially losslessly with no model involved at all. That is the strongest hint about where to start — see §9.

---

## 3. Stage 1 — Deterministic extraction (no AI)

A pure walk of the selected frame, producing a raw **design dump**. No interpretation, no opinions, no network. This runs in the plugin sandbox (`code.js`), which is where the Figma API lives; the dump is then handed to `ui.html` via `figma.ui.postMessage` for any network work, matching how the plugin already splits render-side vs fetch-side.

New file: `plugin-src/extract.js`, bundled by `plugin-src/build.js` alongside `renderer.js`.

### Output shape

```ts
interface DesignDump {
  schema: "aplus.dump/1";
  source: { fileKey: string; pageName: string; frameId: string; frameName: string };
  frame: { w: number; h: number; fills: Fill[]; clipsContent: boolean };
  fontsUsed: Array<{ family: string; style: string; count: number }>;
  nodes: DumpNode[];           // flat list, depth-first; hierarchy via parentId
  slices: Array<{ id: string; name: string; x: number; y: number; w: number; h: number }>;
  unreadable: string[];        // e.g. "IMAGE fill on 'Card 3' — raster, no vector data"
}

interface DumpNode {
  id: string;                  // Figma node id, e.g. "12:345"
  parentId: string | null;     // null = direct child of the ingested frame
  depth: number;
  index: number;               // z-order within parent
  name: string;                // designer's layer name — load-bearing, see §9
  type: "FRAME" | "GROUP" | "RECTANGLE" | "ELLIPSE" | "TEXT" | "VECTOR"
      | "SLICE" | "COMPONENT" | "INSTANCE" | "LINE" | "BOOLEAN_OPERATION";

  // geometry, ALWAYS relative to the ingested frame's origin (not the parent)
  x: number; y: number; w: number; h: number;
  rotation: number;            // degrees — summary only; cannot express a flip
  relativeTransform: [[number, number, number], [number, number, number]];   // the full matrix
  opacity: number;             // 0..1
  visible: boolean;
  cornerRadius: number | null;
  isMask: boolean;             // the key signal for circular photo slots

  fills: Fill[]; strokes: Fill[]; effects: Effect[];
  strokeWeight: number | null; dashPattern: number[] | null;

  text?: {
    characters: string;
    fontName: { family: string; style: string };
    fontSize: number;
    lineHeight: { unit: "PIXELS" | "PERCENT" | "AUTO"; value?: number };
    letterSpacing: { unit: "PIXELS" | "PERCENT"; value: number };
    textCase: "ORIGINAL" | "UPPER" | "LOWER" | "TITLE";
    textAlignHorizontal: "LEFT" | "CENTER" | "RIGHT" | "JUSTIFIED";
    boldRanges: Array<[number, number]>;   // -> re-emitted as **bold** markers
  };

  autoLayout?: {               // present when layoutMode !== 'NONE'
    mode: "HORIZONTAL" | "VERTICAL";
    itemSpacing: number;
    counterAxisAlignItems: string;
    padding: [number, number, number, number];   // T R B L
  };
}

type Fill =                                           // rgb is 0-255, matching the manifest palette format
  | { type: "SOLID"; rgb: [number, number, number]; opacity: number }
  | { type: "GRADIENT_LINEAR";
      gradientTransform: [[number, number, number], [number, number, number]];
      direction: "TB" | "LR" | "RL" | "OTHER";        // classified from the matrix
      stops: Array<[number, [number, number, number], number]> }   // [position, rgb255, alpha]
  | { type: "IMAGE"; scaleMode: string; imageHash: string }
  | { type: "GRADIENT_RADIAL";
      gradientTransform: [[number, number, number], [number, number, number]];
      stops: Array<[number, [number, number, number], number]> }
  | { type: "GRADIENT_ANGULAR" | "GRADIENT_DIAMOND"; note: "unsupported-by-renderer" };

type Effect =
  | { type: "LAYER_BLUR" | "BACKGROUND_BLUR"; radius: number; visible: boolean }
  | { type: "DROP_SHADOW" | "INNER_SHADOW"; radius: number; offset: { x: number; y: number };
      rgba: [number, number, number, number]; visible: boolean };
```

### Notes on the walk

- **Frame-relative coordinates.** `node.x/y` are parent-relative in Figma. Normalise by accumulating ancestor offsets during the walk, or use `node.absoluteBoundingBox` minus the root frame's. The manifest mixes both conventions (hero children are hero-relative, top-level items are frame-relative), so the dump should be uniformly frame-relative and Stage 4 re-parents as needed.
- **Gradient transforms.** Keep the raw `gradientTransform`. The manifest's paint spec carries it verbatim as `gt`, so arbitrary angles and radial gradients survive extraction intact. Classifying a matrix against the three named directions (`GRADIENT_TRANSFORMS` in `renderer.js`: `TB`, `LR`, `RL`) with a small tolerance is only a convenience, so Stage 4 can emit the `"transform"` shorthand where it matches exactly; anything else is tagged `"OTHER"` and emitted as the matrix. **Never snap an unmatched angle to the nearest of the three.** Only `GRADIENT_ANGULAR` and `GRADIENT_DIAMOND` remain unreproducible and belong in `unreadable[]`.
- **Record `relativeTransform`, not just `rotation`.** A flipped layer reports the same `rotation` as an unflipped one, so an angle alone reproduces it mirrored into the wrong corner — the bug that cost a rebuild on the Running washes. Capture the full matrix on every node; Stage 4 emits it as the layer's `rt`, and `x`/`y`/`w`/`h`/`rotation` stay in the dump as the readable summary the inference rules match against.
- **Bold ranges.** Walk `getRangeFontName()` across the string; where the style resolves to the bold face, record the range. Stage 4 re-encodes those as the `**...**` markers `parseBold()` in `renderer.js` already understands.
- **Images.** An `IMAGE` fill means a real photo is placed. For ingestion that is *good news structurally* (it marks a photo slot) but the bytes are not part of the template — the manifest only stores the slot rectangle. Record the hash and discard the bytes. The hash is still worth keeping: a *decorative* image fill (the `image 396` hero texture, say) is carried in the manifest by hash and resolves in any file holding that image, so it is a graphic to reproduce rather than a slot to leave empty.
- **Size.** A full A+ frame is roughly 300–800 nodes. The dump is a few hundred KB of JSON — fine to post across the plugin bridge, and we never send all of it to a model (see §5).

**This code half-exists.** `renderer.js` already encodes every one of these concepts in the write direction; `buildIconIndex()` already demonstrates a filtered page walk with `findAllWithCriteria`. Stage 1 is the same vocabulary, read instead of write. Estimate: **2–3 days**.

---

## 4. Stage 2 — Structural inference (rules, no AI)

Pure functions over the dump that recognise the A+ anatomy. No network, deterministic, unit-testable.

New file: `plugin-src/infer-structure.js`.

### The rules

| Rule | Signal | Emits |
|---|---|---|
| **Circular photo slot** | `ELLIPSE` with `isMask === true`, plus a sibling `RECTANGLE` at the same x/y/w/h, inside the same `GROUP` | `{ kind: "photoSlot", shape: "circle", x, y, d }` |
| **Rectangular photo slot** | `FRAME` with `clipsContent`, a flat `slotFill`-ish solid, containing only a short `+ …` text child — or any node with an `IMAGE` fill | `{ kind: "photoSlot", shape: "rect", x, y, w, h }` |
| **Hero band** | Largest `FRAME`/`RECTANGLE` whose `y ≈ 0` and `w ≈ frame.w`, with the frame's biggest `fontSize` inside it | `{ kind: "heroBand", bounds }` |
| **Hero wordmark** | Largest `fontSize` in the whole frame (>300 px), gradient fill, centred | `{ kind: "displayText", rank: 1 }` |
| **Fabric band** | Full-width rounded box below the hero containing both a large `IMAGE`/rect slot and a full-bleed `GRADIENT_LINEAR` overlay rect at the same size | `{ kind: "fabricBand", bounds }` |
| **Icon row** | ≥2 sibling groups with near-identical widths, same y, even horizontal pitch, each containing an `ELLIPSE` + a non-text mark + a short (<30 char) `TEXT` | `{ kind: "iconRow", items: [...] }` — mirrors `buildIconIndex()` |
| **Callout cards** | ≥3 repeated clusters of (wide gradient `RECTANGLE` + circular photo slot + 2 stacked `TEXT`), at regular vertical pitch, circle x alternating left/right | `{ kind: "calloutCard", index, side, bar, photo, textBlock }` |
| **Text pairing** | Within a cluster: the text with the larger `fontSize` and `textCase === 'UPPER'` is the title; the longer one below it is the copy | `{ role: "title" \| "copy" }` (local, not global) |
| **Background gradient** | Largest `GRADIENT_LINEAR` rect at `depth === 1` extending to the frame bottom | `{ kind: "bgGradient" }` |
| **Glows** | `ELLIPSE`, no stroke, solid white-ish fill, `opacity < 1`, has a `LAYER_BLUR` effect | `{ kind: "glow" }` |
| **Export slices** | `node.type === 'SLICE'` | `{ kind: "slice", name, y, h }` |
| **Divider** | `RECTANGLE` with `h ≤ 4` and `w > 100` inside a vertical auto-layout stack | `{ kind: "divider" }` |

### What these rules will get right

Essentially all of the manifest body. Geometry, gradient stops, blur radii, font roles, corner radii, slot rectangles, slice boundaries, card count, left/right alternation, icon-row membership. For a design that follows the Running template's family — which is the stated point of a *template* — the rules alone produce a manifest that renders correctly.

### What these rules cannot do

They cannot tell you what a slot **means**:

- Is this circle `fabric.closeup` or `callout[1].photo`? Both are circular mask groups; only position relative to a band distinguishes them, and position rules break the moment a designer moves the fabric close-up lower.
- Is that 35 px uppercase right-aligned text the `hero.tagline`, or a legal disclaimer, or a size-chart note?
- This design has a fourth band the Running template doesn't have — two photos with labels under them. Is that a "comparison" block, and which label goes with which photo?
- Which sheet column should feed callout 3? The rules see a text block; they do not know column E from column G.
- What should `meta.label` say? What `category` is this? What `gender`?

**Recommendation:** ship Stage 2 as the production path and treat Stage 3 as an enrichment layer that is always allowed to fail. The rules are the floor; the model raises the ceiling.

Estimate: **3–4 days** including unit tests against the existing Running frame as a fixture.

---

## 5. Stage 3 — Semantic labelling (where OpenRouter earns its place)

The model's job is deliberately tiny: **assign a role string to each detected element.** It receives a compact JSON structural summary plus the text strings found. It does **not** receive an image, a screenshot, raw pixels, or the full node dump.

### Why text-only

Sending a rendered PNG would cost more, be slower, and add nothing — the model is not being asked to measure anything. It is being asked "given that there is a 517 px circle at y=1133 inside a repeating three-card band, and the nearby text reads 'ENGINEERED FOR SPEED', what is this?" That is a reading-comprehension question over about 40 short items.

### The role vocabulary

| Band | Roles | Applies to |
|---|---|---|
| Hero | `hero.word`, `hero.italic`, `hero.tagline` | text — giant gradient wordmark, display-face second word, small uppercase line |
| Hero | `hero.model`, `hero.layer` | rect photo slot; rotated/flipped gradient washes and textures |
| Fabric | `fabric.heading`, `fabric.copy`, `fabric.composition` | text — "Fabric in Focus", body paragraph, the `%` line |
| Fabric | `fabric.closeup`, `fabric.bgPhoto`, `fabric.layer` | circle slot, rect slot, gradient and wash rects |
| Fabric | `fabric.icon[n]` | icon group, ordered left→right |
| Callouts | `callout[n].title`, `callout[n].copy` | text, `n` 1-based per cluster |
| Callouts | `callout[n].photo`, `callout[n].bar` | circle slot, gradient rect |
| Global | `background.gradient`, `background.glow[n]`, `slice[n]`, `divider` | rect, blurred ellipse, SLICE node, thin rect |
| Global | `decoration` | explicit "this is not a content slot" |
| Global | `unknown` | triggers manual review |

Plus three document-level outputs: `meta.label`, `meta.category`, `meta.gender`, and a `contentMapping` that assigns each callout a sheet column index consistent with `index.json`'s `cardColumns: [5,6,7,8]`.

**Recommendation:** keep the vocabulary closed and versioned in `backend/templates/roles.json`, and reject any role the model invents. An open vocabulary guarantees drift and makes the compiler in Stage 4 unwritable.

---

## 6. The OpenRouter integration, concretely

### 6.1 Where the key lives

**In `backend/.env`. Never in the plugin.** Two hard reasons:

1. A Figma plugin ships as plain JavaScript. Anyone who installs it can open `code.js` / `ui.html` and read any string in it. A key embedded there is a published key.
2. `figma.clientStorage` is *not* a secret store — it is unencrypted per-user local storage readable by the plugin's own code, and by anyone inspecting it. It is the right place for `sheetLink` and `backendUrl` (which is exactly what `main.js` uses it for today) and the wrong place for a credential.

So the plugin never talks to OpenRouter. It talks to our own backend, which already has a `.env` loader at the top of `server.js` (lines 25–33) — adding `OPENROUTER_API_KEY` there is a one-line change.

```
Figma plugin (code.js)  --postMessage-->  ui.html  --fetch-->  A+ backend  --fetch-->  openrouter.ai
   extracts the dump                     does network        holds the key        does the inference
```

Note `plugin/manifest.json` already declares `networkAccess.allowedDomains: ["*"]`, so no manifest change is needed in dev — and the tightening note already in that file stays correct, because the plugin still only ever contacts Google and our backend.

### 6.2 The new endpoint

```http
POST /api/template/infer HTTP/1.1
Host: localhost:8787
Content-Type: application/json

{
  "schema": "aplus.infer/1",
  "structure": {
    "frame": { "w": 1572, "h": 5271 },
    "bands": [
      { "id": "b1", "kind": "heroBand",   "y": 0,    "h": 1616 },
      { "id": "b2", "kind": "fabricBand", "y": 1615, "h": 1346 },
      { "id": "b3", "kind": "calloutBand","y": 3060, "h": 2211, "cardCount": 4 }
    ],
    "elements": [
      { "id": "n12", "band": "b1", "kind": "text", "layerName": "Hero word",
        "chars": "TRAIN", "fontSize": 754.7, "upper": true, "align": "CENTER",
        "fillKind": "gradient", "x": 150, "y": 17, "w": 1270, "h": 660 },
      { "id": "n48", "band": "b3", "kind": "photoSlot", "shape": "circle",
        "layerName": "Ellipse 12", "x": 68, "y": 3131, "w": 517, "h": 517, "cluster": 1 }
    ]
  },
  "hints": { "pageName": "Training A+", "frameName": "TRAIN A+ v3 FINAL" },
  "fewShot": []
}
```

Note what is *absent*: no fills, no gradient stops, no blur radii, no exact floats beyond position. Those never leave the plugin, because the model is never asked about them. The backend renders this into the prompt shown in §6.4, calls OpenRouter, validates, and returns the role assignment; the plugin never sees the model name or the key.

### 6.3 The OpenRouter call

The non-negotiable part is `response_format` with a strict JSON schema. Without it you get prose, markdown fences, apologies, and a parser that fails on Fridays. With it, the reply is a JSON object matching the schema or the request errors — which is a clean, handleable failure.

```js
// backend/infer.js  (zero-dependency, matches the existing server style)
var https = require('https');

var ROLE_ENUM = [
  'hero.word','hero.italic','hero.tagline','hero.model','hero.layer',
  'fabric.heading','fabric.copy','fabric.composition','fabric.closeup',
  'fabric.bgPhoto','fabric.layer','fabric.icon',
  'callout.title','callout.copy','callout.photo','callout.bar',
  'background.gradient','background.glow','slice','divider','decoration','unknown'
];

var obj = function (props) {
  return { type: 'object', additionalProperties: false,
           required: Object.keys(props), properties: props };
};

var SCHEMA = {
  name: 'aplus_role_assignment',
  strict: true,
  schema: obj({
    meta: obj({
      label:      { type: 'string' },
      category:   { type: 'string', enum: ['running','training','lifestyle','seamless','other'] },
      gender:     { type: 'string', enum: ['men','women','unisex','unknown'] },
      confidence: { type: 'number' }
    }),
    assignments: { type: 'array', items: obj({
      id:         { type: 'string' },
      role:       { type: 'string', enum: ROLE_ENUM },
      index:      { type: 'integer' },   // 1-based for callout.* / glow / icon / slice; else 0
      confidence: { type: 'number' },    // 0..1
      why:        { type: 'string' }     // one short clause, shown in the review UI
    }) },
    contentMapping: obj({
      styleIdColumn: { type: 'integer' }, categoryColumn: { type: 'integer' },
      heroColumn:    { type: 'integer' }, fabricColumn:   { type: 'integer' },
      cardColumns:   { type: 'array', items: { type: 'integer' } }
    })
  })
};

function callOpenRouter(model, messages, timeoutMs) {
  var body = JSON.stringify({
    model: model, temperature: 0, max_tokens: 4000, messages: messages,
    response_format: { type: 'json_schema', json_schema: SCHEMA }
  });
  return new Promise(function (resolve, reject) {
    var req = https.request({
      hostname: 'openrouter.ai', path: '/api/v1/chat/completions', method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.OPENROUTER_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'HTTP-Referer': 'https://aplus-studio.curefit.internal',
        'X-Title': 'A+ Studio template ingestion'
      }
    }, function (res) {
      var chunks = [];
      res.on('data', function (d) { chunks.push(d); });
      res.on('end', function () {
        try {
          var json = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (json.error) return reject(new Error(json.error.message || 'OpenRouter error'));
          resolve(JSON.parse(json.choices[0].message.content));   // schema-guaranteed JSON
        } catch (e) { reject(new Error('Malformed model reply: ' + e.message)); }
      });
    });
    req.setTimeout(timeoutMs || 25000, function () { req.destroy(new Error('OpenRouter timeout')); });
    req.on('error', reject);
    req.end(body);
  });
}
```

### 6.4 Worked example — prompt

**System message:**

```
You label the parts of an Amazon A+ product page design for Cultstore apparel.

You are given a STRUCTURAL SUMMARY of one Figma frame: bands (hero / fabric / callout)
and the elements inside them, with layer name, geometry, and — for text — the exact
characters. Geometry has already been measured exactly; do not second-guess numbers.

Your ONLY job is to assign each element a role from the allowed list, plus a 1-based
index where the role repeats (callout.*, background.glow, fabric.icon, slice).

Rules:
- Every element id in the input must appear exactly once in `assignments`.
- A role+index pair must be unique, except for `decoration` and `unknown`.
- Each callout cluster has exactly one title, one copy, one photo, one bar.
- Use `decoration` for purely visual elements with no content slot behind them.
- Use `unknown` with confidence 0 when you genuinely cannot tell. This is expected
  and preferred over guessing; a human reviews every `unknown`.
- `confidence` is 0..1 and must be honest. `why` is one short clause, max 12 words.
- Infer meta.category and meta.gender from the copy's language, not from layer names.
```

**User message:**

```
FRAME: "TRAIN A+ v3 FINAL"  (1572 x 5271)  on page "Training A+"

BANDS
  b1 heroBand    y=0    h=1616
  b2 fabricBand  y=1615 h=1346
  b3 calloutBand y=3060 h=2211  (4 clusters)

ELEMENTS
  n12 b1  text       "Hero word"    "TRAIN"                           size=754.7 upper center gradient
  n13 b1  text       "Layer 30"     "FEARLESS"                        size=229.8 upper center solid
  n14 b1  text       "Layer 31"     "Built for the work that counts." size=35 upper right solid
  n21 b1  photoSlot  "Rectangle 8"  rect 640x1486 at (420,130)
  n30 b2  text       "Layer 40"     "Fabric in Focus"                 size=90 upper center
  n31 b2  text       "Layer 41"     "A four-way stretch knit that..." size=40 center
  n32 b2  text       "Layer 42"     "82% Polyester · 18% Elastane"    size=41.9 center
  n33 b2  photoSlot  "Ellipse 9"    circle d=426 at (576,1734)
  n34 b2  photoSlot  "Layer 43"     rect 1467x1286 at (58,1670)
  n40 b2  iconGroup  "Group 3"      labels: "Quick Dry","4-Way Stretch","Anti-Odour"
  n48 b3  photoSlot  "Ellipse 12"   circle d=517 at (68,3131)         cluster=1
  ... (remaining callout elements elided here; the real prompt lists all of them)

SHEET COLUMNS AVAILABLE: 0=style IDs, 1=category, 2=hero, 3=fabric, 4..7=cards
```

### 6.5 Worked example — response

```json
{
  "meta": {
    "label": "TRAINING – Template 1",
    "category": "training",
    "gender": "unisex",
    "confidence": 0.86
  },
  "assignments": [
    { "id": "n12", "role": "hero.word",          "index": 0, "confidence": 0.99, "why": "largest gradient wordmark in hero" },
    { "id": "n13", "role": "hero.italic",        "index": 0, "confidence": 0.97, "why": "display face below the wordmark" },
    { "id": "n14", "role": "hero.tagline",       "index": 0, "confidence": 0.95, "why": "small uppercase sentence, right aligned" },
    { "id": "n21", "role": "hero.model",         "index": 0, "confidence": 0.98, "why": "tall portrait slot inside hero" },
    { "id": "n30", "role": "fabric.heading",     "index": 0, "confidence": 0.99, "why": "literal Fabric in Focus heading" },
    { "id": "n32", "role": "fabric.composition", "index": 0, "confidence": 0.99, "why": "percentage composition line" },
    { "id": "n33", "role": "fabric.closeup",     "index": 0, "confidence": 0.94, "why": "circular slot inside fabric band" },
    { "id": "n40", "role": "fabric.icon",        "index": 1, "confidence": 0.93, "why": "labelled icon row under composition" },
    { "id": "n48", "role": "callout.photo",      "index": 1, "confidence": 0.97, "why": "circular slot in first callout cluster" }
  ],
  "contentMapping": {
    "styleIdColumn": 0, "categoryColumn": 1, "heroColumn": 2, "fabricColumn": 3,
    "cardColumns": [5, 6, 7, 8]
  }
}
```

### 6.6 Model choice

| Tier | Use | Why |
|---|---|---|
| **Primary** | A cheap, fast, structured-output-capable model — the small/mini tier of a major frontier family (e.g. a Gemini Flash, GPT-mini or Claude Haiku class model on OpenRouter) | This is 40-item text classification with a closed vocabulary and a strict schema. Frontier reasoning is not what's limiting here. |
| **Escalation** | A full-size frontier model | Re-run only when the primary returns any `confidence < 0.6`, an `unknown`, or fails validation. Expect this on well under a third of ingestions. |

**Recommendation:** start with the cheap tier, hard-code the model id in `.env` as `OPENROUTER_MODEL` / `OPENROUTER_MODEL_ESCALATE` so it can be swapped without a deploy, and compare on a fixture set of 5–10 real A+ frames before locking it in.

### 6.7 Cost

Order-of-magnitude arithmetic, not quoted prices:

- Structural summary for a full A+: ~2,500–4,000 input tokens. Response: ~1,000–1,500 output tokens. Call it **~5,000 tokens per ingestion**.
- Cheap-tier models on OpenRouter are generally priced in the region of cents per *million* tokens. 5,000 tokens is 0.005 of a million.
- That puts a single template ingestion at **a small fraction of one US cent**, even with an escalation retry and a few designer-triggered re-runs.
- Ingesting 100 templates — far more than Cultstore will ever have — lands in the range of **a few US cents to a few tens of cents, total.**

> **Verify the exact per-token rates on OpenRouter's pricing page when you build this.** The numbers above are deliberately expressed as magnitudes, not quotes, and model pricing moves.

**The conclusion is the point, and it is robust to being off by 100×:** API cost is not a factor in this decision. The real cost is the 15–25 engineer-days in §11. Budget the conversation accordingly — arguing about model tiers to save cents is wasted meeting time.

### 6.8 Error handling — the pipeline must never block on the model

| Failure | Detection | Response |
|---|---|---|
| Timeout / network error / OpenRouter 4xx-5xx | 25 s timeout; `json.error` present | Fall back to rules-only. Flag: "AI labelling unavailable — review all slots." |
| Malformed JSON | `JSON.parse` throws | One retry at `temperature: 0`, then fall back. |
| Role assigned twice | Post-validate `role+index` uniqueness | Keep the higher-confidence one; demote the other to `unknown`. |
| Required role missing (e.g. no `hero.word`) | Required-roles list per band kind | Use the Stage 2 rule result for that one slot; flag it. |
| Element id missing from the response | Set-difference against input ids | Those elements become `unknown`. |
| Hallucinated element id | Not in input | Discard silently; log. |
| Low confidence (`< 0.6`) | Threshold | Escalate once to the stronger model; if still low, mark for review. |

The contract `/api/template/infer` must honour: **every response is `{ ok: true, ... }`.** It returns either `source: "ai"` with validated assignments, or `source: "rules-only"` with the Stage 2 result plus a warning string. There is no error path that reaches the designer as a failure — a dead model is a degraded experience, never a failed ingestion.

---

## 7. Stage 4 — Manifest emission + round-trip verification

### Emission

A compiler (`backend/compile-manifest.js`) joins the exact geometry from Stage 1 with the roles from Stage 2/3 and writes a manifest in the existing `aplus.template/2` shape:

- Collect every distinct `{family, style}` into `fonts`, keyed by the role that uses it (`hero`, `display`, `light`, `regular`, `medium`, `semibold`, `bold`), with `fallback` set from the style name.
- Collect every distinct solid colour into `palette`, reusing existing role names (`ink`, `white`, `tag`, `slotFill`, …) when the RGB is within a small distance of the Running template's, otherwise minting `accent1`, `accent2`.
- Re-parent geometry: hero children become hero-relative, fabric children fabric-relative, callout children callout-frame-relative, matching how `renderer.js` reads them.
- Derive `frame.heightBase` and `heightPerCardMode` from the measured band heights and the callout pitch.
- Emit `content` from `contentMapping`, and `warnings` from the measured title height and bar height.
- `POST /api/templates/:category/:id` writes the file and inserts the entry into `index.json` with `"status": "draft"`.

Anything the schema cannot express (an angular gradient, a drop shadow, a blend mode, a rotated text node) goes into a `warnings.unsupported[]` array that surfaces in the UI. **Do not silently drop it.**

### Round-trip verification — the actual quality gate

Immediately after writing, the plugin fetches the new manifest back through the normal path and calls the **existing, unmodified** `buildFromManifest()` to render it 600 px to the right of the designer's original frame, using the same sample content.

This matters more than every heuristic above:

> **If the regenerated frame matches the original, the manifest is correct — regardless of how it was produced.** Whether a rule, a model, or a coin flip assigned a role, a pixel-matching round trip proves the template works. If it doesn't match, no amount of confident-sounding JSON saves it.

Add a cheap automated check alongside the visual one: `figma.union`-free bounding-box diff over corresponding nodes, reporting `maxDeltaPx` and a count of nodes over a 2 px threshold. Green badge under 2 px, amber 2–10 px, red above. The designer still eyeballs it — the number just tells them where to look.

Estimate: **4–5 days** (the compiler is the bulk; the round trip reuses the renderer wholesale).

---

## 8. Stage 5 — The designer's review UI

A new screen in `plugin/ui.html`, reached after ingestion, listing every detected element grouped by band:

```
INGESTED: "TRAIN A+ v3 FINAL"            [ 38 slots · 34 confident · 4 to review ]

  HERO
  ● "TRAIN"                    hero.word        99%   [ change ▾ ]
  ● "Built for the work..."    hero.tagline     95%   [ change ▾ ]
  ● rect 640×1486              hero.model       98%   [ change ▾ ]
  FABRIC
  ◐ circle d=426               fabric.closeup   58%   [ change ▾ ]   ← review
  ○ rect 300×300 @ (1180,2400) unknown           0%   [ change ▾ ]   ← review
  CALLOUTS (4)
  ● "LOCKED-IN SUPPORT"        callout 1 title  98%   [ change ▾ ]
  ...

  [ Re-render side by side ]        [ Save template ]
```

- `●` ≥0.85, `◐` 0.6–0.85, `○` below 0.6 or `unknown`. Review items sort to the top of their band.
- Hovering a row selects and zooms to that node in Figma (`figma.viewport.scrollAndZoomIntoView`) — the designer should never have to guess which circle is row 7.
- `change ▾` is a dropdown of the closed role vocabulary, so a correction can never produce an invalid role.
- **Save** is disabled while any `unknown` remains. That single constraint is what makes the feature trustworthy: nothing reaches `backend/templates/` that a human has not looked at.

**Recommendation:** build this in Phase 3 but design the data shape for it in Phase 1, so Stage 2's output already carries `confidence` and `why` fields even when they come from rules rather than a model.

Estimate: **3–4 days.**

---

## 9. The cheaper alternative that should ship first

If a designer names their layers with a prefix convention, the extractor needs **zero inference** and is **100% accurate**:

```
@hero.word           @fabric.closeup       @callout.1.photo
@hero.italic         @fabric.copy          @callout.1.title
@hero.tagline        @fabric.composition   @callout.1.copy
@hero.model          @fabric.bgPhoto       @callout.2.photo
@bg.gradient         @fabric.icon.1        ...
@bg.glow.1           @slice.1
```

The rule is one line of code: if a layer name starts with `@`, the rest of it *is* the role — skip Stages 2 and 3 for that node entirely.

Three honest arguments for shipping this first:

1. **The renderer already does this.** `renderer.js` names every node it creates (`Hero word`, `Card 2 · Fabric in Focus`, `Mask group · Card 3 photo`, `Bar`, `Title`, `Copy`). The convention is not a new discipline being imposed on the team — it is formalising a naming scheme the system already emits. A plugin-built A+ that a designer then modified round-trips with no inference at all.
2. **It is days, not weeks.** Phase 0 is the extractor plus a name parser. No backend changes, no API key, no prompt engineering, no model evaluation, no cost line item.
3. **It makes the AI work better, not redundant.** With the convention in place, the model's job shrinks to *only the unnamed layers* — which means fewer items, a tighter prompt, higher accuracy, and a much smaller blast radius when it is wrong. Every layer the designer names is one the model cannot mislabel.

The failure mode is real and should be stated: designers will forget, or will inherit a file from someone who never knew the convention. That is precisely why the AI pass exists — as the fallback for unnamed layers, not as the primary mechanism.

**Recommendation: ship the convention first, unconditionally.** Even if the answer on OpenRouter is eventually "no", Phase 0 alone unblocks Training, Lifestyle and Seamless. Treat a convention-only pipeline as the product and the AI pass as an accelerant.

A helper worth 2 hours: an **"Apply naming"** button in the plugin that takes a selection and bulk-renames it to the convention based on the Stage 2 rules — so adopting the convention on an existing file is one click, not an hour of manual renaming.

---

## 10. Learning loop

Every correction a designer makes in the review UI is a free labelled training example. Capture it:

```json
// backend/.data/corrections.jsonl  — one object per line, append-only
{ "ts": "2026-11-26T10:14:02Z", "template": "training/template-1",
  "element": { "kind": "photoSlot", "shape": "circle", "band": "fabricBand",
               "layerName": "Ellipse 9", "w": 426, "h": 426, "nearbyText": "Fabric in Focus" },
  "predicted": "callout.photo", "predictedConfidence": 0.58,
  "corrected": "fabric.closeup", "by": "rohit.ghosh@curefit.com" }
```

On each subsequent inference call, select the 8–12 most recent corrections whose `element.kind` matches something in the current structure and inject them into the prompt as few-shot examples:

```
PREVIOUS CORRECTIONS BY THIS TEAM — match these patterns:
  circular slot, 426px, inside fabricBand, near "Fabric in Focus"  ->  fabric.closeup
  circular slot, 517px, inside calloutBand, cluster=2              ->  callout.photo (index 2)
```

This costs a few hundred extra input tokens per call — i.e. nothing — and attacks exactly the errors this team actually hits, rather than generic ones. It is also the cheapest possible version of improving a model: no fine-tuning, no training infra, no vendor lock-in, and it keeps working if you swap models.

**Recommendation:** implement the capture in Phase 3 even if the few-shot injection ships later. The data is worthless if you didn't start collecting it.

---

## 11. Phased plan and effort

| Phase | What gets built | Days | What Rohit gets at the end |
|---|---|---|---|
| **0 · Naming convention + extractor** | `plugin-src/extract.js`, `@role` name parser, "Apply naming" bulk-rename helper, dump viewer in the UI | **3–5** | A designer can name layers and ingest a frame. New categories unblocked without an engineer. No API key, no model, no new cost. |
| **1 · Rules inference + round trip** | `plugin-src/infer-structure.js`, `backend/compile-manifest.js`, `POST /api/templates/:cat/:gender/:id`, side-by-side re-render + bounding-box diff | **6–8** | Unnamed layers get inferred. Every ingestion is visually proven correct before it is saved. This is the phase that makes the feature trustworthy. |
| **2 · OpenRouter semantic pass** | `backend/infer.js`, `POST /api/template/infer`, strict JSON schema, escalation, full fallback chain, fixture evaluation on 5–10 real frames | **4–6** | Ingestion works on files that follow no convention at all. Fully optional — toggles off with one `.env` var. |
| **3 · Review UI + learning loop** | Review screen in `ui.html`, role dropdowns, hover-to-zoom, `corrections.jsonl`, few-shot injection | **4–6** | Designers correct and approve before anything is saved; accuracy improves with every template ingested. |
| | **Total** | **17–25** | |

Phases 0 and 1 are the ones that deliver the business outcome (new categories without engineering). Phases 2 and 3 are quality-of-life for messy input. **If the budget is half this, cut 2 and 3, not 0 and 1.**

---

## 12. Risks and honest limits

**Hand-drawn one-offs that aren't really templates.** The deepest risk is conceptual, not technical. A designer may have made a beautiful A+ for one product with bespoke, hand-tuned positions. Ingesting it produces a manifest that reproduces *that one design* and does not generalise — copy of a different length will overflow, a 3-card row will leave a hole. The system cannot detect this. Mitigation: require that a candidate template render correctly with **three different sheet rows** of varying copy length before `status` moves from `draft` to `active`. Build that into the round-trip screen.

**Flattened or rasterised layers.** If a band has been exported and re-placed as a PNG, or a text block has been outlined to vectors, there is nothing to extract — the API returns one image fill or a pile of path data. No pipeline, AI or otherwise, recovers the structure. The extractor must detect this (`IMAGE` fill covering a whole band, or a `VECTOR` cluster where text is expected) and say so plainly: *"this band is flattened — rebuild it with live text before ingesting."*

**Fonts.** Extraction records `{family, style}` exactly, but the manifest is only usable on a machine where those fonts are installed. `loadFontsFromManifest()` already handles this gracefully — it falls back to Inter and reports what was missing — but a template ingested on a machine with Racing Sans One will silently render in Inter for a designer who doesn't have it. Mitigation: record font availability at ingestion time into `meta.requiredFonts` and show a prominent warning on first render.

**Gradient and effect coverage.** The manifest's paint spec now covers solid fills, linear and radial gradients at any angle (it carries Figma's raw `gradientTransform`), image fills and layer blur, so most of what a designer actually reaches for survives. Angular and diamond gradients, drop shadows, blend modes and Figma's `GLASS` effect are still not in `aplus.template/2`. Designs using those will be flagged, not reproduced. Extending the schema further is possible but is a separate piece of work on `renderer.js`.

**A template is only as reusable as it is consistent.** If Training's A+ has the fabric band above the hero and Lifestyle has it below, these are two templates, not one with a variant. The system will happily produce both; it will not merge them. That is correct behaviour, but it means the number of manifests grows with design variety, and somebody has to own pruning `index.json`.

**What this will and will not do.** It will turn a well-built, live-layer, structurally conventional A+ frame into a working manifest in about a minute, with a visual proof. It will not rescue flattened artwork, will not invent a layout system where the design doesn't have one, and will not make an inconsistent design reusable. It replaces transcription, not design judgement.

---

## 13. Open decisions for Rohit

1. **Model tier.** Start on the cheap tier with escalation (recommended), or spend an extra fraction of a cent per call and go straight to a frontier model for maximum first-pass accuracy? This is a ~2-day evaluation either way; the cost difference is immaterial.
2. **Is the `@role` naming convention acceptable to the design team?** This is the biggest lever in the whole plan. If the team will adopt it, Phase 0 alone may be sufficient and Phases 2–3 become optional. If they won't, the AI pass moves from "nice to have" to "required", and the estimate goes to the top of the range. Worth asking the team before committing budget.
3. **Sharing model for ingested templates.** Three options: (a) org-wide immediately — fastest, but one bad ingestion affects everyone's output; (b) private drafts, promoted to `active` by you after review — matches the `status: draft/active` field already in `index.json`, and is the recommendation; (c) per-designer sandboxes, never shared — safest and least useful.
4. **Where does the backend live when this ships?** The `.env` key means this can no longer run only on a designer's laptop. A single Render instance with `OPENROUTER_API_KEY` set, reachable by the team, is the assumption in this plan — confirm that's the intent before Phase 2.
5. **Who owns template hygiene?** Someone has to decide when two ingested designs are really one template, and prune `index.json`. If that's not you, it needs a name.
