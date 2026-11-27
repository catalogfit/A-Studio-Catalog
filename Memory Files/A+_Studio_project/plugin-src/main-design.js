// ===== sandbox handlers: Add design — OWNED BY THE DESIGN PANEL =====
// UI counterpart: plugin-src/ui/design.js (+ the userTemplates library in ui/platform.js).
// Capture engine: plugin-src/capture.js. Storage on this computer: plugin-src/user-templates.js.
// Hooks from main.js (core): onUiMessage, onInit, replyTo/replyError.
//
// Messages handled:
//   capture-template {frameId, pageId, template:{id,label,categoryId,categoryLabel,genderId}, replace}
//   usertpl-list                      -> { index: [row], usage: {foreign, own, total, budget, quota} }
//   usertpl-get {key, assets}         -> { manifest, assets:[{hash,mime,name,width,height,bytes,data}], missing:[hash] } | null
//   usertpl-status {key}              -> { manifest: bool, missing: [hash] }
//   usertpl-put {manifest, assets, drive, replace} -> { entry, local }   (import, or a Drive download)
//   usertpl-stage {key, manifest, assets} -> { staged }                 (session memory only)
//   usertpl-mark-drive {key, drive}   -> { updated }
//   usertpl-remove {key}              -> { removed }
// Messages posted:   capture-progress {step, done, total} · capture-result {...} · capture-error {message, code}
// Init contribution: init.userTemplates = { index, usage } — the user's templates on this computer.
//                    They are folded into FALLBACK_REGISTRY (so init.registry lists them); their
//                    manifests are NOT put in init.manifests — the UI asks for one when it needs it.

onInit(async function (init) {
  var list = { index: [], usage: null };
  try { list = await utList(); }
  catch (e) { figma.notify('A+: your saved templates could not be read (' + (e && e.message) + ')'); }
  var local = list.index.filter(function (e) { return e.local && e.local.manifest; });
  capMergeIntoRegistry(FALLBACK_REGISTRY, utRegistryRows(local));
  init.userTemplates = list;
  init.captured = local;   // older UI builds read this name
});

onUiMessage('capture-template', async function (msg) { await capHandleCaptureTemplate(msg); });

onUiMessage('usertpl-list', async function (msg) { replyTo(msg, await utList()); });
onUiMessage('usertpl-get', async function (msg) { replyTo(msg, await utLoad(String(msg.key || ''), { assets: !!msg.assets })); });
onUiMessage('usertpl-status', async function (msg) { replyTo(msg, await utStatus(String(msg.key || ''))); });
onUiMessage('usertpl-stage', async function (msg) { replyTo(msg, utStage(String(msg.key || ''), msg.manifest || null, msg.assets || [])); });
onUiMessage('usertpl-mark-drive', async function (msg) { replyTo(msg, await utMarkDrive(String(msg.key || ''), msg.drive || null)); });
onUiMessage('usertpl-remove', async function (msg) { replyTo(msg, await utRemove(String(msg.key || ''))); });

// A template that arrives whole (import from a file, or downloaded from Drive on another machine).
// The manifest is checked here as well as in the UI: it is about to drive node creation.
onUiMessage('usertpl-put', async function (msg) {
  var M = msg.manifest;
  var problem = utValidateManifest(M);
  if (problem) return replyError(msg, problem, 'bad-template');
  var key = M.meta.key;
  if (capIsBundledKey(key)) return replyError(msg, '"' + key + '" is a template the plugin ships with and cannot be replaced.', 'bundled');
  if (!msg.replace) {
    var have = await utReadIndex();
    if (have.some(function (e) { return e.key === key; })) return replyError(msg, 'You already have a template saved as "' + key + '".', 'exists');
  }
  var res = await utSave(M, msg.assets || [], { drive: msg.drive === undefined ? undefined : msg.drive });
  replyTo(msg, { entry: utRegistryRows([res.entry])[0], local: res.local });
});

function utValidateManifest(M) {
  if (!M || typeof M !== 'object') return 'That is not a template.';
  if (M.schema !== CAP_SCHEMA) return 'Unsupported template schema "' + M.schema + '" (expected ' + CAP_SCHEMA + ').';
  if (M.renderer !== CAP_RENDERER) return 'This template needs renderer "' + M.renderer + '", which this plugin does not have.';
  if (!M.meta || !UT_KEY_RE.test(String(M.meta.key || ''))) return 'The template has no valid key (category/gender/id).';
  if (M.meta.key !== M.meta.category + '/' + M.meta.gender + '/' + M.meta.id) return 'The template key does not match its category, gender and id.';
  if (!M.root || typeof M.root !== 'object' || !M.root.type) return 'The template has no layers.';
  if (!M.fonts || typeof M.fonts !== 'object') return 'The template has no font table.';
  if (!M.content || typeof M.content !== 'object') return 'The template has no sheet mapping (content block).';
  return '';
}
