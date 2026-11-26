# A+ Studio – project folder

Start here:
- **what-i-want.md** – every requirement, with Done / Partly / Not yet.
- **history.md** – what was asked, built and decided, step by step.

Folders:
| Folder | What is inside |
|---|---|
| **backend/** | The template backend: one JSON manifest per category/gender/template, served to the plugin. Run with `node server.js`. See backend/README.md |
| backend/manifests.js | Loads a manifest and resolves its `extends` chain (deep merge) before it is served |
| backend/templates/running/ | `_base.json` (shared geometry) + `men/` and `women/`, each with template-1 (Standard) and template-2 (With fit comparison) |
| plugin/ | The Figma plugin to install (manifest.json, code.js, ui.html, README.md) |
| plugin-src/ | Source of plugin/code.js (renderer.js + manifest-fallback.js + main.js). Build with `node build.js` |
| sheets/ | A+_Running_Content_Template_v2.xlsx – the current content-sheet format (A–J, with gender and fit comparison) |
| sheets/archive/ | Earlier sheet versions (superseded) |
| docs/ | Figma Page 2 analysis, link to the PRD, and `template-ingestion-plan.md` |
| docs/template-ingestion-plan.md | Proposal for letting designers upload their own templates: deterministic extraction, with OpenRouter used only for semantic labelling. Awaiting a greenlight |
| data/ | Text of every A+ on Figma Page 2, as read on 29 Oct 2026 |
| references/ | The A+ screenshots shared during the work |

## How it fits together (v0.3)

The **design lives in the backend as data**, not hardcoded in the plugin:

```
backend/templates/running/_base.json        ← the shared Running geometry
        └ men/template-1.json, women/template-2.json …  ← thin "extends" overrides
        ▲ resolved by manifests.js, served by server.js
        │  GET /api/templates/running/women/template-1
   plugin (A+ Studio) ── renderer.js fills the manifest from one sheet row
        │                 → builds a clean, editable A+ in Figma
   content sheet (columns A–J)
```

- Change a design → edit its manifest, not the plugin code.
- Change it for every gender at once → edit the category's `_base.json`.
- New category (Training, Lifestyle, Seamless) → new manifest files + registry entries.
- Backend unreachable → the plugin uses the copy bundled in code.js (auto-generated from the same manifests).

The clean master on Figma Page 2 is **RUNNING – Template 1 (FINAL)** (node `645:2`): single dashed photo
placeholders (no stacked mask layers), each callout grouped as Bar + photo + Text, auto-height copy.

Quick start:
1. `cd backend && node server.js`  (optional — the plugin also works offline)
2. Figma desktop → Plugins → Development → Import plugin from manifest → plugin/manifest.json
3. Open the A+ page, run A+ Studio. (Optional) open **Template backend**, enter `http://localhost:8787`, click Use.
4. Work down the four steps — Category, Gender, Template, Content — then paste the sheet rows (or a
   sheet link, or pick frames on the canvas and use the Selection source) and press Run A+.

Figma file: https://www.figma.com/design/DyUWRDA1JPo75nWMj5UoJe (Page 2)
