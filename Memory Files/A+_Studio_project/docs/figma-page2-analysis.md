# Figma Page 2 analysis (29 Oct 2026)

File: https://www.figma.com/design/DyUWRDA1JPo75nWMj5UoJe · Page 2 (id 16:22)
Template: frame 616:2514 (now named "706524"), label "RUNNING - Template 1" (616:2659) above it, card labels "COLUMN A – F – Content" to its right.
Plugin test output: frames 631:2 (708587, 708589) and 631:67 (708133), to the right of the template.

## The A+ designs on Page 2

| Category | A+ count | Same layout as the template | Callout cards | Hero (same across the category) |
|---|---|---|---|---|
| Running | 7 | Yes | 4, except T-shirt Solid (3) | RUN / UNSTOPPABLE / "Gear up to outrun the ordinary." |
| Training | 5 | Yes | 3, except Tank Top Colourblock 2 (4) | TRAIN / FEARLESS / "For the bold and the relentless" |
| Lifestyle | 4 | Yes | 3 | COMFORT / REDEFINED / "Unwind in style with all-day comfort." |
| Seamless | 1 | Yes, hero mirrored (model left, words right) | 4 | FLEX / & FLOW / "Seamless comfort in every move." |
| Essentials | 2 | No – different design | 3 product tiles + "A shade for Every Mood!" | Group shot, "Fibres of the Fabric", 3 export slices |

Sizes: 4-card designs are about 5,380 px tall; 3-card designs about 4,740 px. All are 1,572 px wide and export as two slices (hero + fabric, then callouts).

## RUNNING – Template 1, card by card

| Card (your label) | Layers | Changes per product |
|---|---|---|
| Card 1 · Hero (COLUMN A) | Big "run" (Poppins Bold ~755 px, 24 % opacity, gradient), blurred "unstoppable" (Racing Sans One), tagline (Fustat Medium, caps), 7 % texture image, no model photo | No – fixed per category |
| Card 2 · Fabric in Focus (COLUMN B) | Fabric background photo (80 %), dark overlay, circle close-up photo, heading, copy (Fustat, bold words), divider, composition, icon row (auto-layout, 40 px gap) | Copy, composition, icons, both photos |
| Cards 3–6 · Callouts (COLUMN C–F) | White gradient bar, 517 px circle photo (left/right alternating), title (Racing Sans One 60), copy (Fustat Light 40 with bold) | Title, copy, photo |

Fonts: Poppins, Racing Sans One, Fustat – all Google Fonts, available in Figma without installing.

Icons: an icon group is a label text + a drawn circle + the artwork. The artwork is sometimes a PNG image ("image 3", "image 1"; one at 67 % opacity) and sometimes a vector frame ("Isolation_Mode" for Stretchy). Labels used on Page 2: Sweat-Wicking, Lightweight, Stretchy, Breathable, Odour-free, Soft, Hyper Soft, Super-Soft, Bio-Wash Treated, 4-Way Stretch.

## Things in the template that block exact automation

1. The template name is a separate text above the frame; the frame itself is named "706524".
2. Cards are not grouped – each callout's bar, photo, title and copy are loose in one big frame.
3. Every photo is from another style (706373, 706214, 706368, 706794, 706093); the masks of cards 4 and 6 hold two stacked photos.
4. The fabric copy box is fixed at 396 px with overflow hidden and an empty extra paragraph – longer copy would be cut off silently.
5. Titles and copy are placed by hand – a two-line title in another card would overlap its copy.
6. Small text issues: trailing spaces after the composition, a leading space in the Breathe Easy copy.
7. Layer names are stale in places ("COMFORT" layer shows "run"), so automation must read the actual text, never layer names.

The v0.1 plugin avoids all seven by drawing the layout itself: named cards, auto-layout title + copy, auto-height fabric copy, clean placeholders.

## How a template becomes a category button (planned for the next step)

1. Name the frame itself, e.g. `RUNNING – Template 1` (word before " – Template" = category).
2. Group each card and name it Card 1 … Card 6; name each photo layer "Photo".
3. One sheet tab per template, same name.
4. The plugin lists every frame named "… – Template …" as a category button, copies the frame for each sheet row and fills it.
