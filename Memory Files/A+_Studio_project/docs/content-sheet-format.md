# A+ content sheet — structure and mapping

The live sheet is **A+_Sheet_RUNNING_Template_1**, tab `RUNNING - Template 1`
([open](https://docs.google.com/spreadsheets/d/11R0w8SKs6T_WIdJZb6mUh6R5L4zP2obpbEMRwZe4u-8/edit?gid=2044009399)).

This is the sheet the plugin reads. It is the source of truth; the plugin was mapped onto it, not
the other way round.

---

## The columns

| Col | Header | Used by the plugin | Goes to |
|---|---|---|---|
| A | Group | no | — |
| **B** | **Style IDs** | yes | frame name + style ID label |
| **C** | **Category** | yes | picks the template family |
| D | Subcategory | no | — (Winter Wear / Travel only) |
| E | Article Type | no | — |
| F | Sub-family 2 | no | — |
| **G** | **First Card Headline** | yes | hero word + italic word |
| **H** | **First Card Subtext** | yes | hero tagline |
| **I** | **Fabric Subtext** | yes | Fabric in Focus copy |
| **J** | **Composition** | yes | the line under the fabric copy |
| **K** | **Fabric Icons** | yes | the icon row |
| **L–O** | **Feature 1–4** | yes | callout cards 3–6 |
| P | Last Slide Headline | not yet | no slot in the Running template |
| Q | Last Slide Body | not yet | no slot in the Running template |
| R | Status | advisory | flagged in the run report if not `OK` |
| S | Flags | no | reviewer notes |
| **T** | **Gender** | yes | picks men's or women's — **column not added yet** |

Row 1 is the header. Blank spacer rows between category blocks are ignored.

---

## How each cell is read

### B · Style IDs — `709517, 709518, 709519`

Any six-digit numbers in the cell are picked up, whatever separates them. Commas, new lines and
spaces all work. Several IDs = one A+ covering all those colourways.

### C · Category — `Running`

| Sheet value | Routes to | Status |
|---|---|---|
| `Running` | `running` | **built** |
| `Training` | `training` | registered, template not built |
| `Athleisure-Lifestyle` | `lifestyle` | registered, template not built |
| `Winter Wear` | — | **no mapping** — the row will error |
| `Travel` | — | **no mapping** — the row will error |

### G · First Card Headline — `RUN UNSTOPPABLE`

Split on the first space. **First word** becomes the giant hero word; **everything after** becomes
the italic word beneath it.

| Sheet value | Hero word | Italic word |
|---|---|---|
| `RUN UNSTOPPABLE` | RUN | UNSTOPPABLE |
| `TRAIN FEARLESS` | TRAIN | FEARLESS |
| `COMFORT REDEFINED` | COMFORT | REDEFINED |

### H · First Card Subtext — `GEAR UP TO OUTRUN THE ORDINARY.`

The small right-aligned tagline in the hero.

### I · Fabric Subtext

The Fabric in Focus paragraph. Several sentences in one cell are fine — they are joined.

### J · Composition — `92% Polyester 8% Elastane`

Rendered as **`92% Polyester | 8% Elastane`**. The plugin inserts the `|` automatically before each
percentage after the first, so you can keep writing it plainly.

`100% Polyester` stays as it is. `52% Cotton 46% Polyester 2% Lycra` becomes
`52% Cotton | 46% Polyester | 2% Lycra`.

### K · Fabric Icons — `Sweat-Wicking, Lightweight, Breathable`

Comma-separated, up to 4. Each name must match an icon label that already exists on your Figma
page — the plugin clones the real icon off the canvas. Anything it can't find is listed in the run
report.

### L–O · Feature 1 to 4 — `MADE TO MOVE: With these seams for mobility, nothing holds you back.`

Split on the **first colon**. Before it is the callout title, after it the body.

Use **3 or 4 features**. That controls the page height:

| Features filled | Callouts | Page size |
|---|---|---|
| L, M, N, O | 4 | 1572 × 5380 |
| L, M, N | 3 | 1572 × 4821 |

Fewer than 3 and the row is rejected.

### R · Status

Anything other than `OK` is shown next to the row in the plugin, but does not block the build.

---

## How a row picks its template

```
C = Running   +   T = men     →   Running · Men · Standard
C = Running   +   T = women   →   Running · Women · Standard
C = Running   +   T blank     →   Running · Men  (the category default)
```

**Column A (Group) is not used for routing.** It restarts at "Group 1" inside each
Category + Article Type + Sub-family block, so it is not unique across the sheet — rows 2, 3 and 4
are all "Group 1". The style IDs in column B are the real key.

Rows route one at a time, so a single tab can hold every category at once, as yours does.

---

## The four Running rows today

All four parse cleanly:

| Style IDs | Sub-family | Composition rendered | Icons | Features | Page |
|---|---|---|---|---|---|
| 709045, 709046 | Self Design | 100% Polyester | 3 | 3 | 1572 × 4821 |
| 710009 | Solid | 100% Polyester | 3 | **4** | 1572 × 5380 |
| 709517, 709518, 709519 | Graphic | 92% Polyester \| 8% Elastane | 2 | 3 | 1572 × 4821 |
| 710015 | Graphic | 100% Polyester | 3 | 3 | 1572 × 4821 |

---

## Known gaps

**1 · No Gender column.** The Running template has men's and women's variants and nothing in the
sheet distinguishes them, so every row currently defaults to men's. This is missing data, not a
mapping problem — a `Gender` column is needed.

**2 · Winter Wear and Travel have no category mapping.** Those rows will report
*Unknown category* until templates exist for them.

**3 · Last Slide (P/Q) has nowhere to go.** The Running template has no last slide — neither does
the real 706524 design it was measured from. The copy is being written but not used.

**4 · The Last Slide columns are used inconsistently.** Running rows put the line in **P**
(Headline); Training and Athleisure-Lifestyle rows put theirs in **Q** (Body) with P blank. Winter
Wear uses both correctly.

**5 · No bold.** The finished designs bold the key phrase in each callout — *"the **elasticated
waistband** keeps everything in place"*. The sheet carries no bold markers, so all callout copy
renders flat. Wrapping the phrase in `**double asterisks**` in the cell is all it takes.

**6 · No fit comparison.** The Regular-fit vs Slim-fit card has no column. It is only used by the
706327 layout, so this matters only when a Running style needs that card.

---

## Checklist before running the plugin

- [ ] Column C says a category the plugin knows (`Running` today)
- [ ] Column G has two or more words (`RUN UNSTOPPABLE`)
- [ ] Columns I, J, K are all filled
- [ ] 3 or 4 of L–O are filled, in order, with a colon in each
- [ ] Icon names in K match the labels on the Figma page
- [ ] Column R says `OK`
