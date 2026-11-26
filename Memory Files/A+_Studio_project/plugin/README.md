# A+ Studio – Figma plugin (Run A+)

## Install (once per designer)
1. Unzip this folder somewhere permanent.
2. Figma desktop app → Plugins → Development → Import plugin from manifest… → pick `manifest.json`.

## Use
1. Open the Figma page where the A+ designs live (e.g. Page 2).
2. Plugins → Development → A+ Studio.
3. Work down the four steps: **1 Category → 2 Gender → 3 Template → 4 Content**.
4. Give it the content sheet (Sheet link, Paste rows, or Selection), press **Run A+**.
5. One A+ frame is built per sheet row, to the right of everything on the page, named with its style IDs.
6. Drop photos into the dashed placeholders, delete the placeholder labels, export slices `1` and `2`.

## The panel, step by step

**1 Category** · **2 Gender** · **3 Template** — Running is live for Men and Women, each with
**Standard** and **With fit comparison**. Step 3 shows a **live preview** of every template, drawn as
SVG straight from the manifest, so a thumbnail can never drift from what actually gets built.
Previews work with no backend running, from the copy bundled into the plugin.

**4 Content** — three sources:

| Source | What it does |
|---|---|
| Sheet link | Reads a Google Sheet link (any sheet you can open, once Google is connected) or a published CSV link |
| Paste rows | Paste the rows straight out of the sheet |
| Selection | Reads the six-digit style IDs off the frames you have selected on the canvas, matches them against the loaded sheet rows, and rebuilds just those styles |

In **Selection** mode the category/gender/template you picked in steps 1–3 wins — it overrides
columns B and C for the rows it rebuilds.

## Sheet format (one row = one A+)
| Column | Content |
|---|---|
| A | Style IDs, one per line |
| B | Category – e.g. `running`. May also carry the gender, e.g. "Running Women", with C left blank |
| C | Gender – `men` / `women` / `unisex` |
| D | Card 1 · Hero – optional; blank = RUN / UNSTOPPABLE / "Gear up to outrun the ordinary." |
| E | Card 2 · Fabric – line 1 copy, line 2 composition, line 3 icons (comma separated) |
| F–I | Cards 3–6 · Callouts – line 1 title, line 2 copy. Leave I blank for a 3-card A+. |
| J | Fit comparison – optional; line 1 the left label, line 2 the right (e.g. "Regular fit" / "Slim fit") |

Inside a cell, each line is one text box (Alt+Enter for a new line). Bold words: `**word**`.

A row with anything in **column J** is routed automatically to a template that has the
`fitComparison` feature, even if a different template is picked in the panel. Leave J blank and the
template's own defaults are used (and a template without the card simply doesn't draw one).

Current workbook: `sheets/A+_Running_Content_Template_v2.xlsx` — tabs **"RUNNING — content"** and
**"How to fill"**. Row 1 is the header and row 2 is a "FORMAT — …" hint row; the plugin skips both.

## Add a block to a finished frame
The collapsible **✚ Add a block to the selected frame** panel works on A+ frames that are already
built (or drawn by hand). **Add fit comparison** appends the card — with editable left/right labels —
growing the frame, its background gradient and the trailing export slice to match. This is the
escape hatch for when the content sheet doesn't carry the fit detail.

## Icons
The plugin copies the icon from any A+ already on the page that uses the same label
(e.g. "Sweat-Wicking"). A label it has never seen shows as a dashed circle – add that
icon once (circle + icon + label, grouped) anywhere on the page and it will be reused.
