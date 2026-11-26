# A+ Studio — template backend

Stores and serves the **template manifests** for each A+ category and gender. The Figma plugin (A+ Studio)
fetches a manifest and fills it from the content sheet. The design lives here, in data — not in
the plugin code — so a template can change without shipping a new plugin, and new categories are
just new files.

It also reads Google Sheets and Drive on the user's behalf, and composites the **export**
(A+ PNG + category GIF → one animated file) with ffmpeg.

Zero npm dependencies (pure Node `http`). The only non-Node requirement is **ffmpeg**, used by
`POST /api/compose` — which is why deployment is now Docker rather than a plain Render Node
service.

> ### Before you build a UI on the GIF export, read this
> **Amazon A+ Content does not accept animated GIFs.** Amazon's guidelines say, verbatim: *"The
> use of animated images (for example, GIF) is prohibited"*, and accept **JPG/PNG, max 2 MB**.
> Premium A+ puts motion in a separate **video** module (`.mp4`, ≥960×540, ≤200 MB, ≤180 s).
> This is a format rule — making the file smaller does not help.
> The composite is still built here because it is useful off Amazon (site, social, decks), and
> `format: "mp4"` produces the Premium A+ video asset. Measured sizes, the full reasoning and
> the open questions: **[`docs/export-pipeline.md`](../docs/export-pipeline.md)**.

## Run it locally

```bash
cd backend
node server.js            # http://localhost:8787
# PORT=3000 node server.js
```

Everything works without ffmpeg except `/api/compose`, which returns **503** with a message
saying so (`/health` reports `ffmpeg.available: false`). To get the export locally too, either
install ffmpeg (`brew install ffmpeg`) or run the Docker image:

```bash
docker build -t aplus-backend .                               # from the REPO ROOT
docker run --rm -p 8787:8787 --env-file backend/.env aplus-backend
```

Then in the plugin: open the **Template backend** section at the bottom, enter
`http://localhost:8787`, click **Use**. The dot turns green and the category list comes from the
backend. Leave it blank to use the copy bundled in the plugin.

## Endpoints

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | `{ ok, google, scopes, sessions, ffmpeg, anthropic }` — `anthropic` is presence only, never the key |
| GET | `/api/templates` | the registry — every category, its genders and their templates |
| GET | `/api/templates/:category` | one category's registry entry |
| GET | `/api/templates/:category/:gender` | one gender's entry (its template list) |
| GET | `/api/templates/:category/:gender/:template` | one resolved template manifest (the design file) |
| GET | `/api/templates/:category/:gender/:template/preview.svg` | reference SVG preview, if present (none shipped yet) |

Example: `GET /api/templates/running/women/template-1`.

Templates are routed **category → gender → template**. The registry (`templates/index.json`,
`"schema": "aplus.registry/2"`) gives each category a `genders[]` array, each gender a `templates[]`
array, and each category a `defaultGender` for rows that don't name one. A template entry may declare
`"features": ["fitComparison"]`, which is how the plugin finds a template that can draw the fit
comparison card. Manifest keys are `"<category>/<gender>/<template>"`, e.g. `running/women/template-1`.

Four Running templates are active: `running/men/template-1` (Standard), `running/men/template-2`
(With fit comparison), and the same pair under `running/women/`.

> Note: the A+ is generated with **empty photo placeholders (mask groups)**. Images are placed by
> the designer directly in Figma — drop a photo into a placeholder's mask group and it clips to shape.
> (An earlier automated model-cutout feature was removed in favour of manual, higher-quality placement.)

## Google sign-in (read Sheets without "Publish to web")

With Google connected, the plugin reads **any Google Sheet you can open** via your account — no
publishing, so a normal share link works. The backend holds the OAuth tokens; the plugin only keeps
an opaque session id.

| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/new` | start sign-in → `{ sessionId, authUrl }` (plugin opens `authUrl`) |
| GET | `/auth/callback` | Google redirect target; exchanges the code, shows a "done" page |
| GET | `/auth/status?session=` | `{ configured, connected, email }` (plugin polls this) |
| POST | `/auth/logout` | `{ session }` → disconnect |
| POST | `/api/sheet` | `{ session, url }` → reads that sheet → `{ rows, tab, email }` |

### ⚠ Everyone must connect Google again, once

The Drive scope changed from `drive.file` to **`drive.readonly`** (Nov 2026). `drive.file` only
ever sees files the app itself created, so it cannot list an existing team folder of GIFs — it
returns an empty list rather than an error, which is worse. Google has no "read just this folder"
scope, so `drive.readonly` is the narrowest one that works.

A token minted under the old scope does **not** gain the new one on refresh. The backend detects
this: `/auth/status` returns `needsReconsent: true`, and Drive calls return a message telling the
user to disconnect and connect again. Nothing else breaks in the meantime — Sheets keeps working.

`drive.readonly` is a Google *restricted* scope, which normally needs app verification. It does
not here because this Cloud project is **Internal to the curefit.com Workspace**. Keep it
Internal — switching to External makes verification mandatory.

### One-time setup (your Google Cloud project)
1. **console.cloud.google.com** → create/pick a project.
2. **APIs & Services → Enabled APIs** → enable **Google Sheets API** and **Google Drive API**.
3. **OAuth consent screen** → User type **Internal** (curefit.com Workspace).
4. **Credentials → Create credentials → OAuth client ID → Web application**
   → Authorised redirect URI: `http://localhost:8787/auth/callback` (add your Render URL's
   `/auth/callback` when you deploy).
5. Copy `backend/.env.example` to `backend/.env`, paste the **Client ID** and **Client secret**,
   and set **`SESSION_SECRET`** (`openssl rand -hex 32`).
6. `node server.js` → the log prints `Google sign-in: configured`.

In the plugin: open **Backend & connection**, set `http://localhost:8787`, then click **Connect
Google**, approve in the browser, and come back. Scopes requested: Sheets (read-only), **Drive
(read-only)**, and email (to show who's connected). Tokens refresh automatically.

### Sessions survive a redeploy now

Sessions used to live in `backend/.data/sessions.json`. Render's filesystem is ephemeral, so every
deploy and restart silently signed everyone out.

The refresh token is now **sealed** (AES-256-GCM, keyed by `SESSION_SECRET`) and handed back to
the plugin as its opaque session string, so the server keeps nothing it cannot afford to lose.
`GET /auth/status` returns the sealed blob in a new **`session`** field — a plugin should store
that value in place of the id it got from `/auth/new`. Old ids still resolve in-process, so
nothing breaks if it doesn't.

**Set `SESSION_SECRET` in production.** Without it the server generates a random key at boot,
warns loudly, and sign-ins still die on restart. Rotating it signs everyone out — that is the only
revocation lever. Treat it like a database password: it unseals long-lived Google refresh tokens
that carry read access to the user's whole Drive. Full write-up, including every security
implication: [`docs/export-pipeline.md`](../docs/export-pipeline.md).

## Drive: list and fetch the category GIFs

| Method | Path | Body / query | Returns |
|---|---|---|---|
| POST, GET | `/api/drive/list` | `{ session, folder, all?, mimeTypes? }` | `{ folderId, folderName, count, files: [{ id, name, mimeType, size, width, height, … }] }` |
| POST, GET | `/api/drive/file` | `{ session, fileId }` | that file's metadata |
| POST, GET | `/api/drive/download` | `{ session, fileId, base64? }` | the bytes (binary; `base64:true` → JSON) |

`folder` takes any Drive link shape or a bare id. `list` defaults to `image/gif` only and pages
through the whole folder, including shared drives.

## Export: `POST /api/compose`

Stacks the A+ PNG above an animated asset and encodes one animated GIF (or an MP4). Body is JSON
with base64 payloads — see [`docs/export-pipeline.md`](../docs/export-pipeline.md) for the full
parameter list, the verbatim two-pass `palettegen`/`paletteuse` chain, and **measured** output
sizes. Headlines for a 1572 × 5000 A+ over a 1572 × 700 / 24-frame GIF:

| Output | Size |
|---|---|
| GIF, 1572 px wide, 256 colours | **7.2 MB** (10.8 MB with photographic detail) |
| GIF, 970 px wide | 3.3 MB |
| GIF, 600 px wide | 1.5 MB |
| MP4, 1572 px wide, crf 18 | **0.77 MB** |

Pass `dryRun: true` to get the predicted geometry, a size range and both ffmpeg command lines
without encoding anything. Every response carries an `amazon` field stating plainly whether the
result is uploadable (for GIF: no).

## Folder layout

```
backend/
  server.js                      # the service
  manifests.js                   # loads a manifest and resolves its "extends" chain
  env.js                         # the tiny .env loader (required by every module that reads env)
  google.js                      # Google OAuth + Sheets + Drive
  session.js                     # sealed (encrypted) sessions — survives Render's ephemeral disk
  compose.js                     # the ffmpeg GIF/MP4 composite
  package.json
  scripts/validate.js            # checks the registry + every manifest  (npm run validate)
  templates/
    index.json                   # the registry: categories -> genders -> templates
    running/
      _base.json                 # the shared Running geometry (never served directly)
      men/
        template-1.json          # Standard
        template-2.json          # With fit comparison
      women/
        template-1.json
        template-2.json
    training/   ...               # add more categories here
    lifestyle/  ...
    seamless/   ...
```

## `extends` — shared geometry, thin templates

A manifest may inherit from another one. The shared Running design lives in
`templates/running/_base.json`; each gender template is a thin file that sets
`"extends": "running/_base"` and overrides only what differs — `meta`, the hero model slot label,
and `comparison.enabled`:

```json
{
  "extends": "running/_base",
  "meta": { "gender": "men", "label": "Running · Men · With fit comparison" },
  "hero": { "model": { "label": "Hero model photo · men's running" } },
  "comparison": { "enabled": true }
}
```

`manifests.js` resolves the chain with a **deep merge**: objects merge key by key, arrays and
scalars are replaced wholesale (so a template can redefine `callouts.cards` without inheriting
leftovers). It exposes `load`, `resolve`, `registry`, `findCategory`, `findGender` and
`findTemplate`. The plugin and the renderer only ever see one flat, fully resolved manifest —
`extends` never reaches them.

A file beginning with `_` is a base only; it is not listed in the registry and is not served.

## Add a new template

1. Create `templates/<category>/<gender>/<template>.json`. If the category already has a
   `_base.json`, start with `"extends": "<category>/_base"` and override only what differs;
   otherwise copy `running/_base.json` as a starting point.
2. Add it to `templates/index.json` under that category's **gender**, with `"status": "active"`.
   Add `"features": ["fitComparison"]` if it draws the fit comparison card.
3. A new category or gender also needs its `genders[]` entry (and the category's `defaultGender`).
4. `npm run validate`.
5. Refresh the bundled offline copy for the plugin: `node ../plugin-src/build.js`.

A manifest is a full A+ design as data: `meta` (category, gender, hero words, width, slice split),
`fonts`, `palette`, `frame`, `background`, `hero`, `fabric`, `callouts`, `comparison` (the optional
fit comparison card, off unless a template sets `enabled`), `slices`, and `content`
(how a sheet row maps into the slots). `background`, `hero` and `fabric` each carry a `layers`
array — the ordered stack of decorative graphics and live-content slots that makes up that band,
described below. The renderer `aplus-standard-v1` understands the standard
A+ anatomy (hero + Fabric in Focus + 3–4 callouts), which Running, Training and Lifestyle all
share. A different structure (e.g. Essentials) gets a new `renderer` value and a renderer to match.

## Paints and layer stacks

**Paint spec.** Anywhere a manifest gives a fill or a stroke, it is one of three shapes — and
`fills` / `strokes` always take an *array* of them:

```json
{ "solid": "ink", "opacity": 0.4 }
{ "stops": [[0, [162, 173, 179], 1], [1, [204, 209, 213], 1]],
  "gt": [[0, 1.66, -0.69], [-1.66, 0, 1.33]], "radial": true, "opacity": 1 }
{ "image": "28773688fac2f933786c5bb29507ca5cefb5429b", "scale": "FILL", "opacity": 0.07 }
```

- `solid` is a `palette` role name or a literal `[r, g, b]` (0–255).
- `stops` are `[position, [r, g, b], alpha]`. `gt` is a raw Figma `gradientTransform` matrix, which
  is what lets arbitrary gradient angles survive into the template; `"transform": "TB"|"LR"|"RL"`
  still works as a shorthand in its place. `"radial": true` makes it a `GRADIENT_RADIAL`.
- An `image` hash only resolves inside the Figma file that holds the image bytes. The renderer
  checks with `figma.getImageByHash` and drops the fill with a warning when it isn't there.

**Layer stacks.** `background.layers`, `hero.layers` and `fabric.layers` are ordered arrays, drawn
bottom to top. They replace the old `background.gradientRect`, `background.glows`, `hero.shade` and
`fabric.overlay` fields, which no longer exist. An entry is either a decorative shape:

```json
{ "name": "Wash · upper", "shape": "ellipse", "x": 0, "y": 0, "w": 1720.8, "h": 1734.97,
  "rt": [[0.95, -0.314, 960.05], [0.314, 0.95, -237.72]], "rotation": 0,
  "opacity": 0.61, "radius": 0, "yFromBottom": 67.09, "hToFramePlus": 108,
  "fills": [ … ], "strokes": [ … ], "strokeWeight": 2 }
```

- `shape` is `"ellipse"`; omit it for a rectangle.
- `rt` is a full Figma `relativeTransform`. **Prefer it over `x`/`y`/`rotation` for any rotated
  layer** — several of the Running washes are flipped as well as rotated (their matrix has a
  negative determinant), and a rotation angle alone renders those mirrored into the wrong corner.
- `yFromBottom` anchors the layer to the frame's bottom edge (it overrides the matrix's `ty`), and
  `hToFramePlus` stretches its height to the frame plus that many pixels. Both exist so a layer
  survives a 3-callout design and the taller fit-comparison one alike.

…or a **role marker** — a hole in the stack where the renderer drops live content:

```json
{ "role": "word" }
```

Valid roles are `word`, `italic`, `model` and `tagline` in `hero.layers`, and `bgPhoto` and
`closeup` in `fabric.layers`. This is what puts z-order in the manifest rather than hardcoded in
`renderer.js`.

Two slots outside the stacks take paint specs too: `hero.word` has `fills` (an array) instead of
the old `gradient`, and `fabric.textStack.divider` has `fills` instead of `colorRole`/`opacity` —
it is a gradient that fades out at both ends. The old `colorRole`/`opacity` form still works there
as a fallback.

Renderer side, in `plugin-src/renderer.js`: `paintOf(M, spec)`, `paintsOf(M, specs)`,
`shape(M, parent, layerSpec, warn)` and `drawLayers(M, parent, layers, roles, H, warn)`.

## Deploy to Render

`/api/compose` needs **ffmpeg**, which Render's Node runtime does not have — so this deploys as a
**Docker** service, not a plain Node one. Two files at the repo root do it:

- **`Dockerfile`** — `node:20-bookworm-slim` + ffmpeg (with libx264) + CA certs, running as the
  non-root `node` user, with a `HEALTHCHECK` on `/health`. There is no `npm install` step because
  there are still no npm dependencies.
- **`render.yaml`** — a Blueprint. Render dashboard → **New → Blueprint** → pick this repo.

Steps:

1. Push the repo, then create the Blueprint. Render builds the Dockerfile from the repo root.
2. Fill in the prompted secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
   `SESSION_SECRET` is generated by Render (`generateValue: true`) and stays stable across
   deploys — that is what keeps people signed in. Don't overwrite it.
3. Add `https://<service>.onrender.com/auth/callback` to the OAuth client's **Authorised redirect
   URIs** in Google Cloud, and set `GOOGLE_REDIRECT_URI` to exactly that string.
4. Put the live URL in the plugin's **Template backend** field.

Render sets `PORT`; the server already reads it. `healthCheckPath` is `/health`.

**Plan / memory.** Measured in this exact image: a 1572 × 5700 / 24-frame compose finishes in
**3.1 s on 1 GB** and **9.0 s on 512 MB**, so the 512 MB `starter` plan works — concurrent compose
jobs are what would push you to `standard`.

**No persistent disk is needed or configured.** Sessions are sealed tokens held by the plugin, so
the service is stateless. (`SESSION_DIR` exists as an escape hatch if you ever do mount one.)

**Without Docker**, `node backend/server.js` still works for everything except `/api/compose`,
which returns 503 unless ffmpeg is on your `PATH`.

## AI-assisted template labelling (not implemented)

`ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` are plumbed through `.env` and reported by `/health` as a
boolean, for the feature described in [`docs/add-to-template-plan.md`](../docs/add-to-template-plan.md).
No AI calls are made yet.

**The key must never appear in `plugin/` or `plugin-src/`.** Figma plugin code ships as a readable
file on the designer's machine; anything in it is public. The only correct shape is
plugin → this backend → Anthropic.
