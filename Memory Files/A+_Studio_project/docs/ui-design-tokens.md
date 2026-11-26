# A+ Studio — UI design tokens

The visual system for the **plugin UI chrome**. Not the A+ designs themselves — those are driven by
the template manifests in `backend/templates/` and are unaffected by anything here.

Follows the `curefit-visual` skill, narrowed by the warm palette and the cult mark the user supplied
on 2026-11-26.

> **Hex values below are sampled by eye from a PNG, not read from source.** The skill is explicit
> that sampled values are working approximations, not official brand tokens. Replace them with the
> real values from the cultstore Figma variable set before this is treated as canonical.

---

## Foundation

Black is the ground, exactly as in both reference images. Everything else sits on it.

| Token | Value | Use |
|---|---|---|
| `--bg` | `#000000` | page ground |
| `--surface` | `#0D0D0E` | panels, cards |
| `--surface-2` | `#161618` | inputs, raised rows |
| `--line` | `#242428` | hairlines, dividers |
| `--text` | `#FFFFFF` | headings |
| `--text-2` | `#A6A6AD` | body, secondary |
| `--text-3` | `#6B6B73` | hints, disabled |

## Warm accent ramp

The five swatches, left to right. These carry the product's identity — used for emphasis, state and
section coding, never for long body copy.

| Token | Value | Sampled from |
|---|---|---|
| `--warm-cream` | `#FDF6EC` | swatch 1, light end |
| `--warm-blush` | `#EDB79B` | swatch 1, top |
| `--warm-coral` | `#E2603C` | swatch 2 |
| `--warm-peach` | `#E8A882` | swatch 2, lower |
| `--warm-sienna` | `#6E2E1E` | swatch 3, dark end |
| `--warm-clay` | `#8A4332` | swatch 3, upper |
| `--warm-orange` | `#E8742F` | swatch 4, top |
| `--warm-gold` | `#F2C94C` | swatch 4, lower |
| `--warm-red` | `#E2563A` | swatch 5 |

**Primary action gradient** — swatch 4, the most energetic of the five:

```css
--grad-primary: linear-gradient(180deg, var(--warm-orange) 0%, var(--warm-gold) 100%);
```

**Accent assignments**

| Token | Value | Meaning |
|---|---|---|
| `--accent` | `--warm-coral` | primary interactive |
| `--accent-hot` | `--warm-gold` | highlights, key figures, active state |
| `--accent-deep` | `--warm-sienna` | pressed states, deep fills |

## Cult mark accents

From the logo's three coloured rays. Reserved for **status and panel coding** so they never compete
with the warm ramp for emphasis.

| Token | Value | Use |
|---|---|---|
| `--cult-pink` | `#E8456B` | errors, destructive |
| `--cult-blue` | `#5BB8E8` | information, links |
| `--cult-yellow` | `#F5D04E` | warnings, "needs review" |
| `--ok` | `#4ADE80` | success (not in the mark — added, flag if wrong) |

### Panel colour coding

One accent per panel, so the user always knows where they are:

- **Automate A+** → `--warm-coral`
- **Add Design** → `--cult-blue`
- **Export** → `--warm-gold`

---

## Typography

**Sora** for display and headings — geometric, confident, matches the skill's "bold geometric sans".
**Inter** for UI and body — built for small sizes and dense data, which the review table needs.

```css
--font-display: 'Sora', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-ui:      'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono:    ui-monospace, 'SF Mono', Menlo, monospace;  /* style IDs, dimensions */
```

| Role | Family | Size | Weight | Tracking |
|---|---|---|---|---|
| Panel title | Sora | 19px | 700 | -0.02em |
| Section label | Sora | 10px | 600 | **uppercase**, +0.12em |
| Body | Inter | 12px | 400 | 0 |
| Field label | Inter | 11px | 500 | +0.01em |
| Hint | Inter | 10.5px | 400 | 0 |
| Numeric / style ID | mono | 11px | 500 | 0 |

Uppercase for compact section labels only, per the skill. Sentence case for anything longer.

### Loading the fonts — constraint

Neither Sora nor Inter is installed on this machine, and the plugin UI is a sandboxed iframe.
Two options, in order of preference:

1. **Self-host as base64 `@font-face`** inside `ui.html`. No network, no FOUT, works offline and
   survives any future tightening of `networkAccess`. Costs ~40–120KB of inlined woff2 per family
   if subset to Latin. **This is the right choice for a plugin.**
2. **Google Fonts `<link>`.** Works today only because `plugin/manifest.json` sets
   `allowedDomains: ["*"]`. That wildcard is already flagged in the manifest as something to tighten
   before any public publish — so this option quietly breaks later. If used, `fonts.googleapis.com`
   and `fonts.gstatic.com` must be named explicitly.

Either way the fallback stack above must be real, so the panel stays legible if the faces fail.

**Separate concern:** fonts used *inside generated A+ designs* are loaded via `figma.loadFontAsync`
and must be installed in Figma itself. Nothing here changes that — see `missingFonts` in the run
report.

---

## Theme

Figma injects `--figma-color-*` into the iframe and the plugin sets `themeColors: true`. This system
is **black-first by design** and does not invert for Figma's light theme — that is deliberate, it is
how both reference images read. Keep contrast ratios ≥ 4.5:1 for body text; the warm ramp on black
clears this comfortably except `--warm-sienna`, which must never carry text.

## The logo — blocked

The cult mark should be placed as **source artwork**, not redrawn. The skill is explicit: *"do not
redraw logos from memory."* No vector of it exists in this project.

Needed: `plugin/assets/cult-mark.svg`, exported from the cultstore design system. Until it arrives
the header uses a typographic lockup, not an approximated mark.
