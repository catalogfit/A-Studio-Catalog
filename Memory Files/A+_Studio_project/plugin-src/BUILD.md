# Building code.js

`plugin/code.js` is three source files joined in order:

    node build-fallback.js          # refresh the bundled manifest from backend/templates
    cat renderer.js manifest-fallback.js main.js > ../plugin/code.js

- **renderer.js** — the manifest-driven renderer (`aplus-standard-v1`): reads a template manifest + one sheet row and builds the A+. Text stays editable (never flattened to SVG). Clean single-photo placeholders, grouped cards, auto-height text.
- **manifest-fallback.js** — auto-generated from `backend/templates/`. The offline copy of the registry and manifests, used when the backend is unreachable. Regenerate with `node build-fallback.js`; never edit by hand.
- **main.js** — resolves the chosen category to its active template manifest (fetched by the UI, or the bundled fallback) and builds one A+ per sheet row.
- **../plugin/ui.html** — the plugin window: categories from the registry, sheet link / paste, backend URL, Run A+.

The design itself lives in `backend/templates/<category>/<template>.json`, not in this code.
Change the design by editing the manifest, not the renderer.
