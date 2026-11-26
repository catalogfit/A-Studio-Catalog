# "Add to template" — select a frame, get a skeleton

**Implementation plan for: pick any Figma frame, press one button, and have every element become a reusable template skeleton.**

Status: proposal. Supersedes nothing — it is the concrete flow that sits on top of
[`template-ingestion-plan.md`](template-ingestion-plan.md), which covers the AI/OpenRouter side.
This document covers the part that matters more: **capture fidelity**.

---

## 1. Is it possible?

Yes — and we now have hard evidence of exactly what it takes, because this project just did the
job by hand four times and got it wrong three times in ways that were invisible until someone
looked closely.

That is the whole lesson. The structure is easy. **The fidelity is the hard part, and it fails
silently.**

---

## 2. What the Running work proved (read this before estimating)

Building the Running templates by hand produced four rounds of "it looks almost right". Every
single failure was a property that was *present in the original and not copied*:

| Round | Symptom | Actual cause |
|---|---|---|
| 1 | "a lot of graphical elements are missing" | the manifest's paint model only had 3 gradient directions — no radial, no image fills, no arbitrary angles. Seven layers had been silently dropped. |
| 2 | two washes in the wrong corner | the layers are **flipped** as well as rotated. `rotation` reads the same for a flipped and an unflipped node; only the `relativeTransform` matrix carries it. |
| 3 | "image 396 is missing" | it wasn't. It was byte-identical — but with no hero backing plate under it, a 7% texture over near-white is invisible, and the bottom shade was stacked over it. |
| 4 | "something different is coming" | the paint carried `scalingFactor: 0.5` and `filters.exposure: -1`. Same bitmap, half the dot size, dark instead of washed out. Neither was copied. |

Plus, from the layer-by-layer diff: a wash that is **`visible: false`** in the original and was
being rendered; a close-up circle 78px too small on the women's layouts; and the discovery that
men's and women's **do not share art direction** even though they share geometry.

**The conclusion for this feature:** a capture tool that copies "the obvious properties" will
produce templates that are wrong in exactly these ways, and nobody will notice for weeks. The
capture contract must be exhaustive, and the verification must be automatic.

---

## 3. The flow

```
Select a frame on the canvas
  └─ A+ Studio → "Add to template"
       ├─ 1. Capture      walk the frame, record EVERYTHING (§4)
       ├─ 2. Classify     rules first, AI only for names (see template-ingestion-plan.md)
       ├─ 3. Skeletonise  swap photos for labelled slots, text for content roles (§5)
       ├─ 4. Round-trip   re-render beside the original, auto-diff (§6)
       └─ 5. Save         write the manifest + register it (§7)
```

Steps 1, 3, 4 and 5 are deterministic and need no model at all. Step 2 is the only place
inference belongs, and even there, layer-name conventions beat it.

---

## 4. The capture contract

This is the part that must not be abbreviated. Per node:

**Identity & structure** — `id`, `name`, `type`, `visible`, `locked`, parent id, child order index.

**Geometry** — `relativeTransform` (**not** `x`/`y`/`rotation` — those cannot express a flip),
`width`, `height`, `constraints`, `layoutMode` and auto-layout props, `clipsContent`,
`cornerRadius` (and the four per-corner radii).

**Appearance** — `opacity`, `blendMode`, `isMask`, `maskType`, `effects[]` (full objects),
`strokes[]`, `strokeWeight`, `strokeAlign`, `dashPattern`.

**Every paint, every property.** Not a hand-picked subset. For each entry in `fills` and
`strokes`:

| Paint type | Must capture |
|---|---|
| all | `type`, `visible`, `opacity`, `blendMode` |
| `SOLID` | `color {r,g,b}` |
| `GRADIENT_*` | `gradientTransform` (the raw matrix), `gradientStops[]` with position + rgba |
| `IMAGE` | `imageHash`, `scaleMode`, **`scalingFactor`**, **`rotation`**, **`imageTransform`**, **`filters{exposure,contrast,saturation,temperature,tint,highlights,shadows}`** |

The four bolded ones are precisely what round 4 above got wrong. The safe implementation is not a
list at all — it is a generic copy:

```js
function capturePaint(p) {
  const o = {};
  for (const k in p) {                    // every enumerable key, no allow-list
    const v = p[k];
    o[k] = (v && typeof v === 'object') ? JSON.parse(JSON.stringify(v)) : v;
  }
  return o;
}
```

**Text** — `characters`, `fontName`, `fontSize`, `lineHeight`, `letterSpacing`, `textCase`,
`textDecoration`, `textAlignHorizontal`/`Vertical`, `textAutoResize`, `paragraphSpacing`, and the
**per-range** overrides (`getStyledTextSegments`) — bold runs inside a paragraph are a range
property and are lost if you only read the node-level font.

**Assets** — for every `imageHash`, call `getImageByHash(h).getBytesAsync()` and upload the bytes
to the backend keyed by hash. *An image hash only resolves inside the file that holds the bytes* —
a template captured in one file renders blank in another unless the bytes travel with it. This is
a real limitation of the current Running templates and must be fixed by this feature.

---

## 5. Skeletonising

Turning a finished design into a reusable one. Deterministic rules:

| In the original | Becomes |
|---|---|
| mask group (Ellipse `isMask` + image rect) | circular photo slot, same diameter and position |
| rect with a single `IMAGE` fill, >25% of its band | rectangular photo slot with a corner label |
| rect with an `IMAGE` fill at low opacity, or `scalingFactor` ≠ 1 | **keep as a graphic**, not a slot — it is a texture (this is what `image 396` is) |
| text node | content role (`hero.word`, `callout[n].title`, …) + its full style |
| everything else | a decorative layer, copied verbatim |

That texture-versus-slot rule is worth stating because it is the distinction round 3 got wrong:
*a low-opacity or scaled image fill is art direction, not content.*

**Keep hidden layers.** A `visible: false` layer is a decision the designer made. Carry it with
its flag, do not silently drop it.

---

## 6. Round-trip verification — the actual quality gate

Capture → re-render next to the original → **diff automatically**. This is what makes the feature
trustworthy, and it is cheap because it is pure comparison:

```js
// for every (original, regenerated) node pair
assert.deepEqual(round(orig.absoluteBoundingBox, 2), round(gen.absoluteBoundingBox, 2));
assert.deepEqual(orig.fills,   gen.fills);        // catches scalingFactor / exposure / stops
assert.deepEqual(orig.strokes, gen.strokes);
assert.equal(orig.visible, gen.visible);
assert.equal(parentIndex(orig), parentIndex(gen)); // catches z-order
```

Every one of the four failures above would have been caught on the first run by this diff. Two
subagents did it by hand in this session and found all of them in minutes; as code it is a few
hundred lines and runs in seconds.

The screen shows: ✅ *38 layers matched* / ⚠️ *2 differ* with a per-layer table, and **refuses to
save** until the designer either fixes the source or accepts the difference. Pixel comparison via
`exportAsync` is a useful secondary check but the property diff is the one that localises faults.

---

## 7. Saving

`POST /api/templates/:category/:gender/:id` with the manifest, plus
`POST /api/assets/:hash` for each image. Registered as `"status": "draft"`; you promote it to
`active`. Reuses the `extends` chain that already exists — a captured variant can extend an
existing base and store only its differences, which is how `running/_women.json` works today.

---

## 8. Phases

| Phase | Build | Days | Result |
|---|---|---|---|
| 0 | Capture + raw dump viewer | 3–4 | Any frame → complete JSON. No inference. |
| 1 | Skeletonise + emit manifest + **round-trip diff** | 5–7 | Add-to-template works end to end for A+-shaped frames, with proof. |
| 2 | Asset upload (image bytes by hash) | 2–3 | Templates work across files. Fixes a current limitation. |
| 3 | Review UI (slot roles, confidence, corrections) | 4–5 | Designers correct before saving. |
| 4 | AI role inference (OpenRouter) | 4–6 | Works on frames that follow no naming convention. |

**14–25 days.** Phases 0–2 deliver the business outcome; 3–4 handle messy input. If budget is
half, cut 3 and 4.

---

## 9. Honest limits

- **Flattened artwork.** If a band was exported and re-placed as a PNG, there is nothing to
  extract. Detect it and say so.
- **One-off designs.** A frame with hand-nudged positions produces a manifest that reproduces
  *that* design and does not generalise. Mitigation: require it to render correctly with three
  different content rows before `draft` → `active`.
- **Fonts** must exist on the machine; record `meta.requiredFonts` at capture.
- **Not supported by the renderer yet:** angular/diamond gradients, drop shadows, non-normal
  blend modes, Figma's `GLASS` effect. Flag, don't silently approximate — silent approximation is
  what caused every failure in §2.

---

## 10. Decisions needed

1. Layer-naming convention (`@hero.model`) first, or straight to inference? The convention makes
   Phase 4 optional.
2. Do captured templates go org-wide immediately, or stay `draft` until you approve? (Recommend
   draft.)
3. Where does the backend live once it holds assets and an API key — a shared Render instance?
