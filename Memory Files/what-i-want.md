# What I want – A+ Studio

Everything asked for so far in the A+ automation work, collected in one place, with where each item stands today (29 Oct 2026).
Status: **Done** = working in v0.1 · **Partly** = started or simplified · **Not yet** = still to build or decide.

## 1. The tool

| What I want | Status | Notes |
|---|---|---|
| A Figma plugin for A+ automation, for the catalog design team | Done | A+ Studio v0.1, in `plugin/` |
| Share it with the team through the manifest file | Done | Figma desktop → Plugins → Development → Import plugin from manifest |
| Choose a category button (e.g. **Run A+**) and it builds the A+ in that category's template | Partly | Run A+ works; Train, Lifestyle and Seamless buttons are greyed out |
| Plugin works on the page it is opened on, where the style IDs are | Partly | Builds on the current page; it doesn't yet scan the page for style IDs |
| Zero cost, using the designer's own machine (no cloud processing of designs) | Done | Everything runs inside Figma; no server at all in v0.1 |

## 2. Templates

| What I want | Status | Notes |
|---|---|---|
| 6–7 templates made by the designers (Running, Training, Plus/xtended, Seamless, …) | Partly | Running only; the other categories on Page 2 use the same layout |
| Output keeps frames, groups, layers, icons and vectors exactly like the template | Partly | v0.1 rebuilds a *similar* layout from code; copying your exact frame is the next step |
| Template defined by renaming a frame in Figma (e.g. "RUNNING – Template 1") | Not yet | Planned: the plugin finds templates by frame name |
| Add, refresh, replace or delete templates (e.g. a new Run design in six months) | Not yet | Approach agreed: a new frame named "… – Template 2", old one retired |
| No SVG upload | Done | Decided: SVG loses editable text and auto-layout |

## 3. Content sheet

| What I want | Status | Notes |
|---|---|---|
| Very simple: one row per A+ | Done | `sheets/A+_Sheet_RUNNING_Template_1.xlsx` |
| Column A = the style IDs that are grouped together (colourways) | Done | Frame is named with these IDs; label added top-right |
| Content split by card: first card, second card … sixth card | Done | Columns B–G = Cards 1–6, matching your COLUMN A–F labels |
| A sheet structure the content person can follow | Done | Same file; one line per text box, `**bold**` |
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

## Next, in order

1. **Clone your real template.** The Run A+ button copies the RUNNING – Template 1 frame itself, for exact layers and vectors, instead of rebuilding it from code.
2. **Add Train, Lifestyle and Seamless,** each a named template frame.
3. **Place images:** select photos on canvas and drop them into the placeholders.
4. **Export:** slices out, plus the category GIF, plus Google Drive. This needs Google sign-in and the Render backend.
5. **Detect the page:** scan the page for style IDs and match them to sheet rows.

## Things only I can answer or send

- [ ] Is my "grouping code" the Order Group in the NPDs tracker?
- [ ] Which categories need a GIF, and is it a separate file or part of the image?
- [ ] Which channels get these A+ designs, and what size and format each needs?
- [ ] Name a template frame for each category (Training, Lifestyle, Seamless), plus a 3-card version where used.
- [ ] Add an icon once for any new label (circle + icon + label, grouped) on the page.
- [ ] Does our Figma plan allow publishing team libraries?
