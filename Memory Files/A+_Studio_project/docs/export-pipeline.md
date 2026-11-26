# Export pipeline — A+ PNG + category GIF → one animated file

How the Export feature works end to end, what every environment variable and Google scope is for,
and the one finding that changes the shape of the feature.

Status: backend implemented and measured (Nov 2026). Plugin side is owned by the plugin agents.

---

## Read this first — the Amazon blocker

**An animated GIF cannot be uploaded to Amazon A+ Content. Not at any file size.**

Amazon's A+ Content guidelines state, verbatim:

> "The use of animated images (for example, GIF) is prohibited."

and list the accepted image formats as **JPG and PNG, RGB, ≥72 dpi, max 2 MB per image**.
([Amazon A+ Content Guidelines](https://kdp.amazon.com/en_US/help/topic/G4WB7VPPEAREHAAD))

Premium A+ carries the same image rule. Motion in Premium A+ lives in a **separate video module**:
`.mp4`, minimum 960 × 540, max 200 MB, max 180 s.

This is a **format** rule, not a size rule. Every lever this service has — downscaling, fewer
colours, a shorter loop — makes the file smaller and still leaves it rejected.

So the originally requested deliverable, "the A+ design with the category GIF attached at the
bottom, exported as one high-quality animated GIF, uploaded to Amazon", **cannot ship as
described**. The composite is still built and supported here, because it is genuinely useful
*off* Amazon (brand site, social, decks, internal review and sign-off). It is just not an Amazon
A+ deliverable.

### What ships on Amazon instead

| Want | Deliverable | This service |
|---|---|---|
| The A+ design | static PNG or JPG, ≤ 2 MB, in an image module | Figma exports this directly; measured at **0.42 MB** as JPEG q2 for a 1572 × 5000 design — comfortably inside the limit |
| The motion | `.mp4` in a **Premium A+ video module** | `POST /api/compose` with `format: "mp4"` — measured **0.77 MB** at crf 18 |

Note the two are **separate modules**. There is no Amazon module that shows an image with an
animation welded to its bottom edge, so the stacked composite has no Amazon destination even as
MP4. On Amazon, ship the A+ image and the video as two modules; use the stacked composite
elsewhere.

**Open question for the user:** is the brand's Amazon account enrolled in **Premium A+**? It is
gated (brand registry + eligibility, historically invitation/spend-based). If it is not, there is
no video module either, and the honest answer is that Amazon A+ is a static-image surface for this
brand today. See [Open questions](#open-questions).

---

## The flow

```
Figma plugin                          backend (Render, Docker: node + ffmpeg)
───────────                           ──────────────────────────────────────
1. user picks a category
2. Connect Google  ───────────────►   POST /auth/new      -> { sessionId, authUrl }
   opens authUrl in a browser         GET  /auth/callback  <- Google redirect
   polls                        ───►  GET  /auth/status    -> { connected, email, session }
                                                                            ^ the sealed token:
                                                                              store THIS, not the
                                                                              sessionId (see §Sessions)
3. pick the category's GIF   ─────►   POST /api/drive/list   { session, folder }
                                      -> { files: [{ id, name, mimeType, size, width, height }] }

4. figma.exportAsync(frame,           (Figma can export PNG/JPG/SVG/PDF only, and it flattens an
     { format: 'PNG' })                imported GIF to its first frame — which is why the
   -> Uint8Array -> base64             compositing has to happen server-side at all)

5. compose                   ─────►   POST /api/compose
                                        { session, aplusPng, driveFileId, format }
                                      -> { ok, output:{w,h,frames}, bytes, base64, amazon:{...} }

6. plugin writes the file / hands it to the user
```

---

## Endpoints

### Drive

| Method | Path | Body / query | Returns |
|---|---|---|---|
| POST, GET | `/api/drive/list` | `{ session, folder, all?, mimeTypes? }` | `{ folderId, folderName, count, files: [{ id, name, mimeType, size, modifiedTime, width, height, webViewLink }] }` |
| POST, GET | `/api/drive/file` | `{ session, fileId }` | that file's metadata |
| POST, GET | `/api/drive/download` | `{ session, fileId, base64? }` | the bytes (binary by default; `base64:true` → JSON) |

`folder` accepts any shape of Drive link or a bare id:
`.../drive/folders/<id>`, `.../drive/u/0/folders/<id>`, `.../open?id=<id>`, or `<id>`.
A link with no folder id in it (e.g. `.../my-drive`) is rejected with a clear message.

`list` defaults to `mimeType = 'image/gif'` — the category assets — and pages through the whole
folder. Pass `all: true` to list everything, or `mimeTypes: [...]` to filter differently. Shared
drives are included (`supportsAllDrives` / `includeItemsFromAllDrives`).

### Compose

`POST /api/compose`

```jsonc
{
  "session":     "<sealed token>",   // only needed when using driveFileId
  "aplusPng":    "<base64>",         // required; a data: URL prefix is tolerated
  "gif":         "<base64>",         // either this…
  "driveFileId": "<id or link>",     // …or this

  "format":      "gif",              // "gif" (default) | "mp4"
  "width":       1572,               // output width; default = the PNG's own width
  "fps":         12,                 // default: the asset's own rate, clamped to 1..30
  "maxColors":   256,                // 4..256
  "dither":      "sierra2_4a",       // sierra2_4a | floyd_steinberg | sierra2 | sierra3 | bayer | none
  "bayerScale":  3,                  // 0..5, only with dither:"bayer"
  "loop":        0,                  // 0 = forever, -1 = play once, N = N extra loops
  "gap":         0,                  // px of solid background between the two
  "background":  "#ffffff",
  "crf":         18,                 // mp4 only, 0..51
  "preset":      "slow",             // mp4 only

  "dryRun":      false,              // true -> geometry + size RANGE + the exact ffmpeg commands, no encode
  "responseType":"json"              // "json" (default, { base64 }) | "binary"
}
```

Response (JSON) carries `source`, `output` (width, height, topHeight, bottomHeight, fps, frames),
`settings`, `bytes`, `size`, `ms`, `ffmpeg` (both command lines, verbatim), `base64`, and
**`amazon`** — the verdict above, attached to every single response so no UI can accidentally hide
it.

#### Why base64 JSON and not multipart

- Hand-rolling multipart parsing with zero dependencies is ~150 lines of boundary scanning and a
  classic source of both bugs and memory-exhaustion bugs. The rest of this backend is JSON; adding
  a second body protocol buys nothing.
- Figma's `exportAsync` returns a `Uint8Array` inside the sandbox, which has to cross `postMessage`
  to the UI iframe before any `fetch` can happen. Encoding it on that hop is natural; constructing
  a `FormData` with a `Blob` across the sandbox boundary is not.
- The cost is a ~33 % transfer inflation and the whole body in RAM. For a 1572 × 5000 PNG
  (measured 5.5 MB) that is ~7.7 MB of base64. `MAX_BODY_BYTES` (default 96 MB) caps it, and the
  cap is enforced while streaming, so a hostile body is destroyed rather than buffered.

### Health

`GET /health` reports `google` (configured), `scopes`, `sessions` (mode + whether
`SESSION_SECRET` is real or ephemeral), `ffmpeg` (availability, version, libx264), and
`anthropic` (**presence only, never the key**).

---

## The ffmpeg chain

Two genuine passes over a shared source graph. The palette must be generated from *exactly* the
pixels that get encoded — generating it at a different scale is the classic cause of the banding
and dither mush that naive GIF encoding produces.

**Pass 1 — palettegen**

```
ffmpeg -y -hide_banner -nostdin \
  -loop 1 -framerate 12 -i aplus.png \
  -ignore_loop 1 -i asset.gif \
  -filter_complex '[0:v]scale=1572:-2:flags=lanczos,setsar=1[top];[1:v]fps=12,scale=1572:-2:flags=lanczos,setsar=1[bot];[top][bot]vstack=inputs=2:shortest=1[stacked];[stacked]palettegen=max_colors=256:stats_mode=full:reserve_transparent=0[pal]' \
  -map '[pal]' -frames:v 1 palette.png
```

**Pass 2 — paletteuse**

```
ffmpeg -y -hide_banner -nostdin \
  -loop 1 -framerate 12 -i aplus.png \
  -ignore_loop 1 -i asset.gif \
  -i palette.png \
  -filter_complex '[0:v]scale=1572:-2:flags=lanczos,setsar=1[top];[1:v]fps=12,scale=1572:-2:flags=lanczos,setsar=1[bot];[top][bot]vstack=inputs=2:shortest=1[stacked];[stacked][2:v]paletteuse=dither=sierra2_4a:diff_mode=rectangle:new=0[out]' \
  -map '[out]' -loop 0 -gifflags +transdiff -f gif composite.gif
```

**MP4**

```
ffmpeg -y -hide_banner -nostdin \
  -loop 1 -framerate 12 -i aplus.png \
  -ignore_loop 1 -i asset.gif \
  -filter_complex '[0:v]scale=1572:-2:flags=lanczos,setsar=1[top];[1:v]fps=12,scale=1572:-2:flags=lanczos,setsar=1[bot];[top][bot]vstack=inputs=2:shortest=1[stacked];[stacked]format=yuv420p,scale=trunc(iw/2)*2:trunc(ih/2)*2[out]' \
  -map '[out]' -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart -an composite.mp4
```

### Why each flag

| Flag | Why |
|---|---|
| `-loop 1 -framerate N -i aplus.png` | turns the still into a video stream at the output rate |
| `-ignore_loop 1` | play the source GIF **once**; without it the asset loops forever and so does the output |
| `vstack=shortest=1` | ends the output when the finite GIF ends, so the infinitely-looping PNG cannot run away. No duration arithmetic, no `ffprobe` round-trip needed for correctness |
| `scale=W:-2` | preserve aspect, force an **even** height (libx264 requires it; harmless for GIF) |
| `flags=lanczos` | visibly sharper than the bilinear default on flat design art and type |
| `setsar=1` | `vstack` refuses inputs whose sample aspect ratios differ |
| `palettegen stats_mode=**full**` | **not `diff`.** `diff` weights the palette toward pixels that *change* — i.e. the small animated strip — which would starve the big static A+ design of colours. `full` is correct whenever most of the canvas is static, which is exactly this case. This is the single most consequential quality choice in the chain |
| `reserve_transparent=0` | nothing here is transparent; reclaims a palette entry |
| `paletteuse diff_mode=**rectangle**` + `-gifflags +transdiff` | **the size lever.** Confines each frame's update to the bounding box of what actually changed, so frames 2..N carry only the animated strip instead of a fresh full-canvas frame. Measured below: it is worth ~7× |
| `dither=sierra2_4a` | ffmpeg's best error diffusion for photographic gradients. `bayer` is offered as an alternative because it is *temporally stable* (no crawling dither noise on static regions), at the cost of visible crosshatch — measured 25 % **larger** here, so it is a look choice, not a size one |
| `new=0` | one palette for the whole animation; `new=1` would re-emit a local colour table per frame and bloat the file |

---

## Measured output size — real numbers

Method: the real A+ reference art (`references/03_running_A+_706524.png`) upscaled with lanczos to
a production-scale **1572 × 5000** PNG (5.5 MB), stacked above a **1572 × 700**, 24-frame, 12 fps
animated GIF. Run through the actual `/api/compose` endpoint inside the deployment Docker image
(ffmpeg 5.1.9).

Two variants, because the single biggest driver of GIF size is high-frequency detail:
**clean** (upscaled, smoother than a true full-res export → a *lower* bound) and **grain**
(the same plus fine noise, standing in for real photographic detail → an *upper* bound).

| Case | Output | Frames | **Size** | Encode |
|---|---|---|---|---|
| clean, 1572 w, 256 colours, sierra2_4a | 1572 × 5700 | 24 | **7.23 MB** | 3.1 s |
| clean, 1572 w, 256 colours, bayer | 1572 × 5700 | 24 | 9.03 MB | 3.0 s |
| clean, 1572 w, **128** colours | 1572 × 5700 | 24 | 6.58 MB | 3.2 s |
| clean, **970** w | 970 × 3516 | 24 | 3.34 MB | 3.0 s |
| clean, **600** w | 600 × 2174 | 24 | 1.52 MB | 2.1 s |
| **grain**, 1572 w, sierra2_4a | 1572 × 5700 | 24 | **10.83 MB** | 7.2 s |
| grain, 1572 w, bayer | 1572 × 5700 | 24 | 11.93 MB | 6.8 s |
| **mp4**, 1572 w, crf 18 | 1572 × 5700 | 24 | **0.77 MB** | 1.8 s |
| mp4, 1572 w, crf 23 | 1572 × 5700 | 24 | 0.43 MB | 1.5 s |

**So: a realistic full-height animated GIF is 7–11 MB.** Not the 200 MB catastrophe a naive
encoder would produce, but 3.5–5.5× over Amazon's 2 MB image limit — and, again, rejected on
format regardless.

### How size scales with loop length

Same canvas, same settings, varying only the asset's duration:

| Loop | Frames | Size |
|---|---|---|
| 0.5 s | 6 | 3.65 MB |
| 1 s | 12 | 4.83 MB |
| 2 s | 24 | 7.23 MB |
| 4 s | 48 | 11.82 MB |

Almost perfectly linear. Fitting it gives:

- **first frame ≈ 2.5 MB** — the full 1572 × 5700 canvas, paid once
- **every later frame ≈ 0.195 MB** — just the 1572 × 700 animated strip

That is `diff_mode=rectangle` working as intended. Without it each frame would cost a full
canvas (~1.6 MB), and the 48-frame case would be **~80 MB instead of 11.8 MB** — a ~7× saving, and
the difference between "large" and "unusable".

### What the levers are actually worth

- **Width** is the strongest lever and scales roughly with area: 1572 → 970 cuts 7.23 → 3.34 MB; 1572 → 600 cuts it to 1.52 MB.
- **Colours** barely move it: 256 → 128 saves only 9 %.
- **Dither** is a look choice, not a size one: `bayer` is 25 % *larger* than `sierra2_4a` here.
- **Loop length** costs ~0.2 MB/frame at this canvas and strip size.
- **MP4 is ~10× smaller than the GIF** at visually better quality. If the destination accepts video at all, it is not a close call.

### Is that viable for Amazon A+?

**No — and not for the size reason.** 2 MB is the image limit, so even the 600 px version (1.52 MB)
would squeak in on size — but an animated GIF is prohibited outright, so the size question never
gets asked. See [the blocker](#read-this-first--the-amazon-blocker).

For off-Amazon use (site, social, decks), 7–11 MB is heavy for a web page but fine for a Slack
share or a deck; 970 px at 3.3 MB is the sweet spot if it has to load in a browser.

### Caveats on these numbers

- The "clean" input is an **upscale** of a 410 × 1146 reference, so it has less high-frequency
  detail than a true 1572 × 5000 Figma export. The "grain" row is the honest upper bound; expect a
  real export with photography in it to land nearer **10 MB than 7 MB**.
- The synthetic asset animates its **entire** 1572 × 700 band every frame. A real category GIF
  where only part of the band moves will produce a smaller changed rectangle and a smaller file.
- H.264 note for the MP4 path: 1572 × 5700 is 35 937 macroblocks, just under the Level 5.2 cap of
  36 864. It encodes and plays, but a taller A+ **will** exceed it. The guard
  `COMPOSE_MAX_PIXELS` (40 Mpx) catches the extreme case; between the two there is a band where
  ffmpeg succeeds and some hardware decoders refuse. Untested against real devices.

---

## Google scopes

| Scope | Why |
|---|---|
| `openid`, `email` | identify who connected, so the plugin can show the address |
| `https://www.googleapis.com/auth/spreadsheets.readonly` | read the content sheet without "Publish to web" |
| `https://www.googleapis.com/auth/drive.readonly` | list the shared folder of category GIFs and download one |

### The scope change, and the re-consent

`drive.file` was replaced by **`drive.readonly`** (Nov 2026).

`drive.file` only ever grants access to files **the app itself created or the user explicitly
opened through a Google Picker**. Pointed at an existing team folder of GIFs it does not error —
it returns an empty list, which is worse. Google offers no "read exactly this one folder" scope,
so `drive.readonly` is the narrowest scope that can do the job at all.

**Every existing user must connect Google again, once.** A token minted under `drive.file` does
not acquire `drive.readonly` when it refreshes. The backend detects this rather than failing
obscurely:

- `GET /auth/status` returns **`needsReconsent: true`** for such a session.
- Drive calls return: *"This Google session predates the Drive change — please disconnect and
  connect Google again to grant Drive read access."*

The consent URL already sends `prompt=consent`, so reconnecting re-shows the new scope.

`drive.readonly` is a Google **restricted** scope and would normally require app verification and
an annual security assessment. It does not here, because the Cloud project is **Internal to the
curefit.com Workspace** — internal apps are exempt. **This is a hard constraint on the project's
shape:** if the consent screen is ever switched to External, or the app needs to serve a
non-curefit.com account, verification becomes mandatory. Keep it Internal.

---

## Sessions — surviving Render's ephemeral disk

**The problem.** Sessions lived in `backend/.data/sessions.json`. Render's filesystem is ephemeral:
every deploy, every restart, and every idle spin-down wipes it. Everyone is silently signed out,
with no error that explains why.

**The two options.**

1. **A Render persistent disk.** Works, but costs money, requires a paid instance, and — the real
   objection — pins the service to a single instance forever: a disk cannot be attached to two,
   so zero-downtime deploys and any future horizontal scaling are off the table permanently.
2. **An encrypted token handed back to the plugin.** Free, stateless, survives everything,
   scales horizontally.

**Chosen: option 2.** It is strictly better here, and it costs nothing. The backend stops being
the system of record.

**How it works** (`backend/session.js`):

```
sealed token = "v1.<iv>.<tag>.<ciphertext>"            all base64url
plaintext    = { rt, em, sc, iat }                     refresh token, email, scopes, issued-at
cipher       = AES-256-GCM
key          = scrypt(SESSION_SECRET, "aplus-studio/session/v1", 32)
```

The plugin already stores an opaque session string; it now stores this instead. It cannot read it
(no key), and a tampered blob fails the GCM auth tag and is rejected. Short-lived **access**
tokens are *not* sealed — they are cached in memory and re-minted from the refresh token after a
cold start, costing one extra round-trip to Google and nothing else.

**Backward compatible.** `GET /auth/status` returns the sealed blob in a new **`session`** field.
A plugin that knows about it should overwrite its stored id with that value — that is the whole
restart-survival mechanism. A plugin that ignores it keeps working exactly as before (in-process
ids still resolve) until the next restart, i.e. today's behaviour, no regression.

`SESSION_DIR` remains as an escape hatch: point it at a mounted disk and in-flight sessions are
also mirrored there. It is deliberately **unset** in `render.yaml`.

### Security implications of storing refresh tokens

Named explicitly, because this is the sharpest edge in the change:

- **The blob contains a long-lived Google refresh token** carrying `drive.readonly` and
  `spreadsheets.readonly` for a curefit.com account. Anyone holding **both** the blob and
  `SESSION_SECRET` can read that user's **entire Drive**, not just the GIF folder. That is the
  real cost of `drive.readonly`, and there is no narrower scope that does the job.
- **`SESSION_SECRET` is now as sensitive as a database password.** Render secret env var only.
  Never committed, never logged, never in the plugin. `render.yaml` uses `generateValue: true` so
  Render mints it once and keeps it stable — nobody ever handles it.
- **Rotating `SESSION_SECRET` invalidates every outstanding session.** There is no server-side
  session list to clear, so this is the *only* revocation lever. Know that before rotating; know
  it is available if a blob leaks.
- **Never log a sealed token**, and never let one reach a URL or an error message. Sessions may
  arrive as a query parameter for convenience; this service does not log requests, and it must
  stay that way.
- **Transport must be HTTPS.** Render terminates TLS. `GOOGLE_REDIRECT_URI` must be the `https://`
  URL in production.
- **The blob is at rest in `figma.clientStorage`**, i.e. on the designer's machine. It is opaque
  ciphertext and useless without the server secret — but a leaked blob *is* a credential if the
  secret ever leaks too. The two must not end up in the same place (e.g. never paste a session
  string into a bug report that also quotes env vars).
- **The ultimate kill switch is Google's**, not ours: revoking the app at
  `myaccount.google.com/permissions` kills the refresh token regardless of who holds the blob.

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | yes | — | OAuth client id |
| `GOOGLE_CLIENT_SECRET` | yes | — | OAuth client secret |
| `GOOGLE_REDIRECT_URI` | prod | `http://localhost:<PORT>/auth/callback` | must exactly match an Authorised redirect URI on the OAuth client; **https** on Render |
| `SESSION_SECRET` | prod | random per process | AES-256-GCM key for sealed sessions. Unset ⇒ sign-ins die on restart and the server warns loudly. `openssl rand -hex 32` |
| `PORT` | no | `8787` | Render sets this |
| `SESSION_DIR` | no | *(unset)* | optional disk mirror of in-flight sessions; set only if a writable disk is actually mounted |
| `FFMPEG_PATH` | no | `ffmpeg` | for running outside Docker |
| `FFPROBE_PATH` | no | `ffprobe` | ditto |
| `APLUS_TMP_DIR` | no | `<os tmp>/aplus` | per-job scratch, deleted after every request |
| `COMPOSE_TIMEOUT_MS` | no | `300000` | hard kill for a single ffmpeg pass |
| `COMPOSE_MAX_INPUT_BYTES` | no | `67108864` (64 MB) | per decoded input |
| `COMPOSE_MAX_PIXELS` | no | `40000000` | refuse an output canvas larger than this |
| `MAX_BODY_BYTES` | no | `100663296` (96 MB) | request body cap, enforced while streaming |
| `MAX_DRIVE_DOWNLOAD_BYTES` | no | `67108864` (64 MB) | Drive download cap |
| `ANTHROPIC_API_KEY` | no | — | **plumbing only, not implemented.** For the AI template labelling in [`add-to-template-plan.md`](add-to-template-plan.md). Backend-only — never in the plugin |
| `ANTHROPIC_MODEL` | no | `claude-sonnet-4-5` | ditto |
| `NODE_ENV` | no | — | — |

### On `ANTHROPIC_API_KEY`

Plumbed, documented, **deliberately unimplemented**. `/health` reports `anthropic.configured`
(a boolean) and never the value.

The key must never go anywhere near `plugin/` or `plugin-src/`. Figma plugin code ships as a
readable file on the designer's machine and is trivially extractable; a key placed there is a
public key. The only correct shape is: plugin → this backend → Anthropic. The same argument
applies to `OPENROUTER_API_KEY` in [`template-ingestion-plan.md`](template-ingestion-plan.md).

---

## Deployment

The backend is still zero-dependency Node, but `/api/compose` shells out to **ffmpeg**, which is
not on Render's Node image. Hence Docker.

- **`Dockerfile`** (repo root) — `node:20-bookworm-slim` + `ffmpeg` (with libx264) + CA certs.
  Runs as the non-root `node` user. Has a `HEALTHCHECK` against `/health`. No `npm install`,
  because there are no dependencies.
- **`render.yaml`** — a Blueprint: Docker web service, `healthCheckPath: /health`,
  `SESSION_SECRET` via `generateValue: true`, everything else `sync: false`.
- **`.dockerignore`** — keeps `.env`, `.data/`, `sheets/`, `references/` and `docs/` out of the
  build context.

After the first deploy, add `https://<service>.onrender.com/auth/callback` to the OAuth client's
Authorised redirect URIs **and** set `GOOGLE_REDIRECT_URI` to the same string.

**Local, without Docker:** `node backend/server.js` still works exactly as before. Without ffmpeg
on `PATH`, `/api/compose` returns **503** with a message saying so, and `/health` reports
`ffmpeg.available: false`. Everything else is unaffected.

**Memory.** Measured in the deployment image: the 1572 × 5700 / 24-frame job completes in **3.1 s
on 1 GB** and **9.0 s on 512 MB** — so Render's 512 MB `starter` works, with the caveat that
concurrent compose jobs will contend. Move to `standard` if that bites.

---

## Open questions

1. **Is the brand enrolled in Premium A+?** The entire MP4 answer depends on it. If not, Amazon
   A+ is a static-image surface for this brand and the animation has no Amazon home at all. This
   is the question to settle before any more work goes into the export feature.
2. **Where was the animated-GIF-on-Amazon idea verified?** Amazon's published guidelines are
   unambiguous that it is prohibited. If someone has seen a live listing with motion in an A+
   module, it was almost certainly a Premium A+ **video** module, not a GIF. Worth confirming
   against the actual listing that prompted the request.
3. **Given (1) and (2), what is the composite actually for?** If the answer is "off-Amazon
   channels", the requirements change: web wants ≤ 3 MB (≈ 970 px wide), social wants MP4 at a
   platform-specific aspect ratio, and a deck does not care. Nobody has specified the real
   destination yet.
4. **Which Drive folder, and how is it structured?** `/api/drive/list` takes a folder link, but
   nothing yet maps *category → folder*. Options: a column in the content sheet, a field in
   `templates/index.json`, or a per-category subfolder under one root. Needs a decision.
5. **H.264 level for tall canvases.** 1572 × 5700 is just inside Level 5.2. A taller A+ exceeds
   it and may be rejected by hardware decoders while ffmpeg reports success. Untested on real
   devices. If MP4 becomes the deliverable, this needs a real-device pass.
6. **No test fixtures are committed.** The measurements above were produced from
   `references/03_running_A+_706524.png` upscaled in a scratch directory. If these numbers need to
   be reproducible in CI, a small fixture set and a script belong in the repo.
7. **Concurrency and abuse.** `/api/compose` is unauthenticated when a GIF is uploaded inline
   (only the Drive path needs a session), and a single job can hold ~500 MB and 10 s of CPU.
   Fine for a handful of internal designers on a private URL; not fine if the URL leaks. A
   session requirement on compose, or a simple queue/concurrency limit, is the obvious hardening
   and has not been done.
8. **`prompt=consent` on every sign-in** guarantees a refresh token but also re-prompts users who
   have already consented. Acceptable now (it is also what forces the Drive re-consent); revisit
   once everyone has migrated.
