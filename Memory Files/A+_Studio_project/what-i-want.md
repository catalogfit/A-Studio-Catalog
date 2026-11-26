# What I want – A+ Studio

Everything asked for so far in the A+ automation work, collected in one place, with where each item stands today (26 Nov 2026).
Status: **Done** = working in v0.1 · **Partly** = started or simplified · **Not yet** = still to build or decide.

## 1. The tool

| What I want | Status | Notes |
|---|---|---|
| A Figma plugin for A+ automation, for the catalog design team | Done | A+ Studio v0.1, in `plugin/` |
| Share it with the team through the manifest file | Done | Figma desktop → Plugins → Development → Import plugin from manifest |
| Choose a category button (e.g. **Run A+**) and it builds the A+ in that category's template | Partly | Now a 4-step picker: Category → Gender → Template → Content. Running (Men and Women) is live; Training, Lifestyle and Seamless have no template yet |
| Plugin works on the page it is opened on, where the style IDs are | Partly | Builds on the current page. The **Selection** source reads the six-digit style IDs off the frames you select and rebuilds just those styles; it still doesn't scan the whole page unprompted |
| Zero cost, using the designer's own machine (no cloud processing of designs) | Done | Everything runs inside Figma; no server at all in v0.1 |

## 2. Templates

| What I want | Status | Notes |
|---|---|---|
| 6–7 templates made by the designers (Running, Training, Plus/xtended, Seamless, …) | Partly | Running only, but now four: Men and Women × Standard and With fit comparison. Training, Lifestyle and Seamless still have no template built |
| Templates split by gender, not just category | Done | Routing is Category → Gender → Template; men's and women's share one geometry via `extends` |
| See what a template looks like before building | Done | Step 3 draws a live preview from the manifest itself, so a thumbnail can't drift from the output |
| Output keeps frames, groups, layers, icons and vectors exactly like the template | Partly | v0.1 rebuilds a *similar* layout from code; copying your exact frame is the next step |
| Template defined by renaming a frame in Figma (e.g. "RUNNING – Template 1") | Not yet | Planned: the plugin finds templates by frame name |
| Add, refresh, replace or delete templates (e.g. a new Run design in six months) | Not yet | Approach agreed: a new frame named "… – Template 2", old one retired |
| No SVG upload | Done | Decided: SVG loses editable text and auto-layout |

## 3. Content sheet

| What I want | Status | Notes |
|---|---|---|
| Very simple: one row per A+ | Done | `sheets/A+_Running_Content_Template_v2.xlsx` |
| Column A = the style IDs that are grouped together (colourways) | Done | Frame is named with these IDs; label added top-right |
| Content split by card: first card, second card … sixth card | Done | Columns D–I = Cards 1–6, matching your COLUMN A–F labels |
| The sheet says which gender the row is | Done | Column C (men / women / unisex); it can also ride in column B, e.g. "Running Women" |
| A sheet structure the content person can follow | Done | Same file; one line per text box, `**bold**`, plus a "How to fill" tab and a FORMAT hint row |
| Plugin reads a Google Sheet link | Partly | Works with a "Publish to web → CSV" link or pasted rows; Google sign-in not built |
| Content filled into the design automatically | Done | Titles, copy with bold, composition, tagline |

## 4. Images and icons

| What I want | Status | Notes |
|---|---|---|
| Human / model images are placeholders the designer fills | Done | Dashed placeholders with labels |
| Icons filled automatically | Done | Copied by label from A+ designs already on the page |
| Pick images from the Figma file into placeholders | Not yet | e.g. select a photo, click Place |
| Some images need manual Photoshop work | Partly | They stay as placeholders; no Photoshop hand-off yet |

## 5. Export and QC

| What I want | Status | Notes |
|---|---|---|
| Export ready for upload | Partly | Slices 1 and 2 are created; exporting is still manual |
| Add the category GIF at the bottom where needed | Not yet | Need: which categories, and whether it's a separate file |
| Export to Google Drive | Not yet | Needs Google sign-in |
| QC step and manual review before export | Partly | Run report warns about missing icons, overflowing copy and empty cards |

## 6. Backend and access

| What I want | Status | Notes |
|---|---|---|
| Backend on Render now, Cloudflare in the end | Not yet | Not needed for v0.1; required once Drive and Sheets sign-in come in |
| Google Auth linked to everything | Not yet | Planned as a small sign-in-only backend |

## 7. Thinking and planning

| What I want | Status | Notes |
|---|---|---|
| PRD, brainstorm, roadmap, priorities, gaps | Done | Claude Doc (see `docs/PRD_v1.md`) – heavier than the current approach |
| Analysis of the Figma file: template, layers, icons, other A+ | Done | `docs/figma-page2-analysis.md` |

---

## Done in v0.2 (29 Oct 2026)

- **Clean FINAL Running template** on Page 2 (`RUNNING – Template 1 (FINAL)`, node `651:2`): real `image 396` texture + overlays + RUN treatment and real icons cloned from `706524`; every circle a **real Figma mask group** (drop a photo → it clips to the circle), one photo per mask, no stacked leftovers; cards grouped, copy auto-height, honest layer names.
- **Backend** (`backend/`) storing a design manifest per category/template, served over HTTP, with an offline fallback bundled into the plugin.
- **Column B = Category:** the sheet routes each row to the right category's template; mixed sheets work; unbuilt categories (Training…) are flagged per row.

## Done in v0.3 (26 Nov 2026)

- **Gender routing:** templates are picked Category → Gender → Template. The registry
  (`aplus.registry/2`) nests `genders[]` under each category; the sheet's column C (or column B,
  written as "Running Women") says which.
- **Four Running templates:** Men and Women, each with **Standard** and **With fit comparison**.
- **`extends`:** the shared Running geometry lives in `running/_base.json`; each gender template is
  a thin override file. `backend/manifests.js` resolves the chain before anything is served.
- **Template picker with a live preview:** step 3 draws each template as SVG from the manifest
  itself, so what you see is what gets built — and it works offline.
- **Select a frame and rebuild it:** the new **Selection** source reads the six-digit style IDs off
  the frames you have selected, matches them to the loaded sheet rows, and rebuilds those styles on
  the category/gender/template you picked.
- **Fit comparison card:** drawn automatically for rows that fill column J (such a row is routed to
  a template that has the feature), and addable by hand to any finished frame from the
  **✚ Add a block to the selected frame** panel, with editable labels.
- **Sheet v2:** `sheets/A+_Running_Content_Template_v2.xlsx` — A ids · B category · C gender ·
  D hero · E fabric · F–I cards · J fit comparison, with a "How to fill" tab.
- **Two skeleton template frames** generated onto Page 2 by the real renderer from the real
  manifests: `TEMPLATE · RUNNING · MEN · Standard` and
  `TEMPLATE · RUNNING · WOMEN · With fit comparison`.

## Next, in order

1. **Add Train, Lifestyle and Seamless** — still not built. One `_base.json` + a men's and women's
   template + registry entries each. They share the Running renderer; only numbers, fonts and hero
   words change.
2. **Place images:** select a photo on canvas and drop it into a mask group (plugin "Place" button).
3. **Export:** slices out, plus the category GIF, plus Google Drive. This needs Google sign-in and the Render backend.
4. **Detect the page:** scan the whole page for style IDs, rather than only the frames selected.
5. **Template previews as SVG files:** the backend serves `preview.svg` per template, but none has
   been drawn yet — the plugin renders its previews from the manifest instead.
6. **Designer-uploaded templates:** the proposal is written up in `docs/template-ingestion-plan.md`;
   it still needs a greenlight.

## Things only I can answer or send

- [ ] Is my "grouping code" the Order Group in the NPDs tracker?
- [ ] Which categories need a GIF, and is it a separate file or part of the image?
- [ ] Which channels get these A+ designs, and what size and format each needs?
- [ ] Name a template frame for each category (Training, Lifestyle, Seamless), plus a 3-card version where used.
- [ ] Add an icon once for any new label (circle + icon + label, grouped) on the page.
- [ ] Does our Figma plan allow publishing team libraries?
