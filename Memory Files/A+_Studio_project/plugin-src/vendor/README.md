# Vendored browser libraries

These run **inside the plugin UI iframe** so export processing happens on the user's device
(docs/architecture-client-side.md). `plugin-src/build.js` inlines each one into `plugin/ui.html`
as its own `<script>` tag, before `platform.js`, so the globals below exist when panel code runs.
Figma loads `ui.html` as a string, so nothing can be fetched from a CDN at runtime.

| File | Package | Version | License | Browser global | Used for |
|---|---|---|---|---|---|
| `gifenc.js` | [gifenc](https://github.com/mattdesl/gifenc) | 1.0.3 | MIT (`LICENSE.gifenc.md`) | `window.gifenc` → `{ GIFEncoder, quantize, applyPalette, … }` | encoding the animated A+ GIF |
| `fflate.js` | [fflate](https://github.com/101arrowz/fflate) | 0.8.3 | MIT (`LICENSE.fflate`) | `window.fflate` → `{ zipSync, zip, strToU8, … }` | ZIP of a multi-file export |
| `mp4-muxer.js` | [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) | 5.2.2 | MIT (`LICENSE.mp4-muxer`) | `Mp4Muxer` → `{ Muxer, ArrayBufferTarget, … }` | MP4 container around WebCodecs `VideoEncoder` output |

Each file starts with a `/*! … */` header carrying the full MIT license text. The code below the
header is the package's published browser build, unmodified, except `gifenc.js`, whose CommonJS
build is wrapped in a two-line shim (`var exports = {}` … `window.gifenc = exports`) so it
defines a browser global.

## Updating one

```bash
mkdir /tmp/vend && cd /tmp/vend && npm init -y && npm install --ignore-scripts gifenc fflate mp4-muxer
# copy: gifenc/dist/gifenc.js, fflate/umd/index.js, mp4-muxer/build/mp4-muxer.js
# keep the header format above, bump the version in the header and in this table
node plugin-src/build.js && (cd plugin-src/test && npm test)
```

Choose a version that has been published for at least two weeks. Never add a library that phones
home or loads workers or WASM from a URL: the iframe has a `null` origin and the plugin manifest
allows only the domains it lists.
