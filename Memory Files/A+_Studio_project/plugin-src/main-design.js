// ===== sandbox handlers: Add design — OWNED BY THE DESIGN PANEL =====
// UI counterpart: plugin-src/ui/design.js. Capture engine: plugin-src/capture.js.
// Hooks from main.js (core): onUiMessage, onInit, replyTo/replyError.
// Messages handled:  capture-template {frameId, frameName, width, height, styleIds, pageId, template, semanticLabelling, backend}
// Messages posted:   capture-progress {step, done, total} · capture-result {...} · capture-error {message}
// Init contribution: init.captured — index of templates captured from frames (clientStorage today;
//                    moving to the user's Drive via platform templateStore is this panel's job).

onInit(async function (init) {
  // Templates captured from a frame live in clientStorage. They are folded into the same
  // registry and manifest map the bundled Running templates use, so they show up in the
  // category → gender → template picker and route from the sheet with no special casing.
  var captured = { index: [], manifests: {} };
  try { captured = await capLoadTemplates(); }
  catch (e) { figma.notify('A+: saved templates could not be read (' + (e && e.message) + ')'); }
  Object.keys(captured.manifests).forEach(function (k) { FALLBACK_MANIFESTS[k] = captured.manifests[k]; });
  capMergeIntoRegistry(FALLBACK_REGISTRY, captured.index);
  init.captured = captured.index;   // which of the registry's templates came from a captured frame
});

// ---------- capture the selected frame as a reusable template ----------
onUiMessage('capture-template', async function (msg) { await capHandleCaptureTemplate(msg); });
