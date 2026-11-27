# Your own templates

Anyone using the plugin can turn a finished A+ frame into a template. The template belongs to
**that user**. It is stored on their computer and in their own Google Drive, and they can export
it as a file. **Nothing is stored on the A+ backend**, so the backend does not grow with every
user's templates, and one user's templates are never visible to another unless they share the
file.

Code: `plugin-src/capture.js` (capture and rebuild), `plugin-src/user-templates.js` (storage on
this computer, plus re-creating images at build time), `plugin-src/main-design.js` (sandbox
messages), `plugin-src/ui/platform.js` (`templateStore` for Drive, `userTemplates` to merge the
three storage tiers), `plugin-src/ui/design.js` (the Add design panel).
Tests: `plugin-src/test/user-templates-sandbox.test.js` and `user-templates-ui.test.js`.

## Using it

1. Select one finished A+ frame.
2. **Name it.** Enter a template name. For category, pick an existing one or type a new one (for
   example "Yoga Pants"). The label is kept as typed and the id becomes `yoga-pants`. Pick a
   gender (Men, Women or Unisex). The template id is filled in from the name, and you can change
   it. The key is `category/gender/id`.
3. **Save as template.** The panel shows each stage: reading layers, copying images, rebuilding
   to check, saving on this computer, then uploading to Drive. If the key is already used, the
   panel asks you there whether to **Replace it** or **Save as new**. Built-in templates cannot
   be replaced, so for those only Save as new is offered.
4. The template appears right away in Automate's category, gender and template pickers, and in
   Export's category list. A sheet row whose column C reads "Yoga Pants" goes to it.
5. **My templates** lists every template you have, with its size and where it is stored (This
   computer, Drive, or both). Each one has **Export file** and **Delete**. If an upload failed,
   it also has **Retry upload** (or **Upload to Drive**). **Import template file…** brings a file
   back in.

## Where templates are stored

| Tier | Where | What | Survives |
|---|---|---|---|
| This computer | `figma.clientStorage` (per plugin, per computer) | index, manifests, image bytes within the budget | plugin restarts, every Figma file on this computer |
| Your Drive | `My Drive/Cult A+ Design Lab/Templates/<category>__<gender>__<id>/` | `manifest.json` envelope + one file per image (`<hash>.png`/`.jpg`…) | other computers, reinstalls, cleared plugin data |
| A file | `<category>_<gender>_<id>.aplus-template.json`, saved where you choose | manifest + every image (base64) | anything; it can be shared with anyone |

The Drive folder uses `__` in place of `/` because Drive names cannot be paths. Every file and
folder also carries private `appProperties` (`aplusKind`, `aplusKey`, label, category label,
size). Lookups use those properties, so renaming a folder in Drive breaks nothing.

## How the data moves

```
Save:    frame ──capture──> manifest + image bytes (sandbox)
                              ├─> this computer (clientStorage, budgeted)          ┐ registry refreshed,
                              └─> UI iframe ──user's own token──> Google Drive     ┘ pickers update
Use:     Automate run ──> sandbox has it?  yes ─> build
                                         no  ─> UI downloads manifest + images from Drive (progress),
                                               keeps them on this computer if they fit, then build
Build:   every imageHash in the manifest ──figma.createImage(bytes)──> new hash in THIS file
Export:  this computer (or Drive) ──> .aplus-template.json download
Import:  .aplus-template.json ──validate──> this computer + Drive
Delete:  this computer: removed · Drive: moved to the Drive bin (restorable for 30 days)
```

The Drive calls go straight from the plugin window to `googleapis.com` with a short-lived
access token. The backend only mints that token (`POST /auth/token`). Template bytes never pass
through the backend.

## Images: why bytes, not hashes

Figma identifies an image fill by an `imageHash`. A hash only works inside the Figma file that
holds the image, so a template that stored only hashes would build with blank photos in any
other file. Capture therefore reads every image's bytes (`figma.getImageByHash(h).getBytesAsync()`)
and records `{hash, name, mime, width, height, bytes}` in `manifest.meta.assets`. At build time,
`utMaterializeImages` re-creates each image with `figma.createImage(bytes)` and rewrites every
`imageHash` in the manifest (fills, strokes and text-run fills) to the new hash.

If an image's bytes are nowhere to be found (not on this computer, not staged from Drive, and not
already in this file), the layer gets a grey placeholder at the original paint's opacity and is
renamed `[image missing] <name>`. The run report lists those layers. The build never fails
because of a missing image.

Photo slots (large opaque photos, mask groups) are still swapped for labelled grey slots when
Automate builds an A+. That is intended: the slot is where the product photo goes. The image
bytes matter for everything else (textures, backgrounds, graphics) and for the copy check.

## Quotas

* **This computer.** Figma's documentation for `figma.clientStorage` says: "Each plugin gets a
  total of 5MB of storage". A value costs roughly the length of its key plus its JSON size, and a
  `Uint8Array` costs its byte length. A write that fails is rejected. The plugin treats the quota
  as 5,000,000 bytes and keeps **everything** in clientStorage under **4,400,000 bytes**, about
  12% headroom. It measures what other features store (sign-in, sheet link, export settings,
  preferences) before every save. Rules:
  * One template's manifest may use at most **1.5 MB**, so a single template cannot crowd out
    the rest.
  * Images are stored once each, keyed by hash, and shared between templates that use the same
    image. An image is deleted when the last template using it is deleted.
  * Images that do not fit are left out. The panel says how many, and they stay in Drive and in
    an exported file. If even the manifest does not fit, the template is not kept on this
    computer. The panel says so, the upload to Drive still runs, and **Download template file**
    is offered.
  * Each save is atomic: new keys are written, the index swap commits, and old keys are removed
    last. If Figma rejects a write, only what that save wrote is deleted. Other templates are
    never touched.
  * My templates shows "This computer: X used · Y free".
  * User templates do not go through the older Drive manifest cache (`tplcache:*` in `main.js`;
    `templateStore.save/load` are called with `cache: false`), so nothing is stored twice.
* **Drive.** This uses the user's own Drive quota. A "storage quota exceeded" error leaves the
  template saved on this computer, with a **Retry upload** button.
* **Files.** Import accepts files up to 60 MB.

## The template file format

```json
{
  "schema": "aplus.template-file/1",
  "app": "Cult A+ Design Lab",
  "exportedAt": "2026-11-27T10:00:00.000Z",
  "key": "yoga-pants/women/split-hero",
  "label": "Split hero",
  "manifest": { "schema": "aplus.template/2", "renderer": "aplus-capture-v1", "meta": { "key": "…", "assets": [ … ] }, "root": { … }, "content": { … }, "fonts": { … } },
  "assets": [ { "hash": "…", "name": "<hash>.png", "mime": "image/png", "width": 640, "height": 480, "bytes": 200000, "data": "<base64>" } ],
  "missingAssets": []
}
```

Import checks all of the following. **In the UI:** the schema, the manifest schema and renderer,
that the key matches `category/gender/id` (lower-case letters, digits and dashes) and agrees with
the meta fields, that layers, the sheet mapping and fonts are present, that there are no
`__proto__`/`constructor`/`prototype` keys anywhere, that every image is PNG, JPEG, GIF or WEBP,
and that every image decodes to its stated length. Bad images are skipped with a note. **Again
in the sandbox** (`usertpl-put`), before anything is stored: the schema, renderer, key, layers,
fonts and sheet mapping. An existing key is never overwritten silently: Replace has to be chosen.

## Privacy

* Templates exist only on the user's computer, in the user's Drive, and in files the user
  exports. The A+ backend never receives them. `POST /api/templates` now returns **410 Gone**.
  The old server-side store can only be turned back on with `SERVER_TEMPLATE_STORE=true` (legacy,
  off by default). The backend still serves the bundled templates (`GET /api/templates…`) and
  sign-in.
* The Google access token lives only in the plugin window's memory. It is never written to
  clientStorage, logged, or put in a URL.
* A template captures the frame's text and images. Before sharing an exported file, check that
  it contains nothing confidential.

## Another computer or another Figma file

* **Another Figma file, same computer.** Templates load from this computer at plugin start, and
  their images are re-created in the new file when they are built.
* **Another computer, same Google account.** After sign-in, the plugin lists your Drive templates
  and adds them to the pickers, marked "your Drive". The first time you build with one, its
  manifest and images download from Drive ("Getting … from your Drive", "Downloading image 2 of
  5…"). They are kept on that computer if they fit, so the next build works offline.
* **Not signed in.** Only templates on this computer are available. Templates that exist only in
  Drive cannot be used or deleted until you sign in.

## Limitations

* Drive uploads use one request per file (multipart). Images over 5 MB switch to Drive's
  resumable upload automatically.
* Links to shared library styles are not kept: the resolved values are captured instead (see the
  capture notes). Fonts must be installed on the computer that builds, otherwise Inter is used and
  the run report says so.
* Two computers saving the same key at the same time: the last upload wins in Drive. Each
  computer keeps its own local copy until it is replaced or deleted.
* Deleting a template on one computer moves it to the Drive bin, but another computer keeps its
  local copy until it is deleted there too.
* Templates saved before this change (the old `capturedTemplate:<key>` store) still load. They
  have no image bytes, so they render their images only in the file they were captured from.
  Capture them again, or replace them, to make them portable.
* The Automate preview of a captured template is a simplified sketch (boxes, colours and text
  samples). The real build is exact.
