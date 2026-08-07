/**
 * Visual page editor runtime — wired by ../editor.js
 * Split from the former monolithic editor.js; behavior preserved.
 */
import { apiFetch } from '../lib/api.js';
import { deepClone, getByPath, setByPath, escapeHtml, pagesEqual } from '../lib/utils.js';
import {
  isTrustedEditorMessage,
  postToFrame as postToFrameWin,
} from '../lib/messaging.js';
import {
  defaultSection,
  SECTION_FORM,
  LIST_SPECS,
  SKIP_LEAF,
} from './catalog.js';
import { icon } from './icons.js';
import {
  humanizePath,
  fieldLabel,
  editableLeafPaths,
  pathToFieldId,
  pathCoveredByLists,
} from './paths.js';
import { createVisualEditorFacade } from './facade.js';
import { createMediaPicker, openMediaPickerModal } from './media-picker.js';

export function bootEditor() {
  const root = document.getElementById('app');
  if (!root) {
    console.error('[tb-editor] Missing #app root');
    return;
  }
  let boot;
  try {
    boot = JSON.parse(root.dataset.initial || 'null');
  } catch (err) {
    console.error('[tb-editor] Invalid data-initial JSON', err);
    root.innerHTML = '<p class="status-line error">Editor failed to boot: invalid initial payload.</p>';
    return;
  }
  if (!boot || typeof boot !== 'object' || !boot.page) {
    console.error('[tb-editor] Incomplete boot payload');
    root.innerHTML = '<p class="status-line error">Editor failed to boot: incomplete payload.</p>';
    return;
  }
  const missingKinds = (boot.sectionKinds || []).filter((k) => !SECTION_FORM[k]);
  if (missingKinds.length) {
    console.warn('[tb-editor] SECTION_FORM missing kinds:', missingKinds.join(', '));
  }
  const liveUrl = boot.liveUrl || boot.previewUrl.replace(/[?&]edit=1/, '').replace(/\?$/, '') || '/';
  const slugPath = String(liveUrl).replace(/^https?:\/\/[^/]+/, '') || '/';

  /** Last version saved to the cms branch (or boot load). */
  let savedSnapshot = deepClone(boot.page);
  let draft = deepClone(boot.page);
  let dirty = false;
  let selectedPath = null;
  let selectedSection = 0;
  let iframeWin = null;
  /** @type {null | 'inspector' | 'page' | 'media'} */
  let primary = 'inspector';
  let inspectorTab = 'layers';
  let pageTab = 'info';
  /** @type {ReturnType<typeof createMediaPicker> | null} */
  let mediaPickerInstance = null;
  let pendingInsertAt = null;
  let pendingHighlight = null;
  let pendingScroll = null;
  let deviceMode = 'full';
  let fieldEditCheckpointed = false;
  let dragFromIndex = null;

  const undoStack = [];
  const redoStack = [];
  const HISTORY_LIMIT = 50;


  root.innerHTML = `
    <header class="topbar">
      <div class="brand">
        <a class="back" href="/admin">${icon('chevronLeft', 'icon icon-sm')} Pages</a>
        <div class="page-meta">
          <h1>${boot.id}</h1>
          <span class="slug">${slugPath}</span>
        </div>
      </div>
      <div class="devices" role="group" aria-label="Preview width">
        <button type="button" data-device="desktop" title="Desktop">${icon('desktop', 'icon icon-sm')} Desktop</button>
        <button type="button" data-device="mobile" title="Mobile">${icon('mobile', 'icon icon-sm')} Mobile</button>
        <button type="button" data-device="full" class="active" title="Full width">${icon('full', 'icon icon-sm')} Full</button>
      </div>
      <div class="actions">
        <div class="history-btns" role="group" aria-label="History">
          <button type="button" id="undo-btn" title="Undo (⌘Z)" aria-label="Undo" disabled>${icon('undo', 'icon icon-sm')}</button>
          <button type="button" id="redo-btn" title="Redo (⇧⌘Z)" aria-label="Redo" disabled>${icon('redo', 'icon icon-sm')}</button>
        </div>
        <span class="chip" id="dirty-chip">Saved</span>
        <a class="open-live" href="${liveUrl}" target="_blank" rel="noopener">${icon('external', 'icon icon-sm')} Open live</a>
        <a class="open-live" href="/admin/changes" title="Review &amp; publish">Changes</a>
        <button type="button" class="primary" id="save" disabled title="Save to cms (⌘S)">Save</button>
      </div>
    </header>

    <div class="preview">
      <div class="preview-frame is-full" id="preview-frame">
        <iframe id="frame" src="${boot.previewUrl}" title="Preview"></iframe>
      </div>
      <div class="status-line" id="status">Loading preview…</div>
    </div>

    <aside class="form-rail" id="form-panel">
      <div class="form-inner">
        <div class="panel-header">
          <span class="panel-title" id="inspector-title">Layers</span>
        </div>
        <div class="form-body layers-pane" id="layers-pane">
          <div class="layers-scroll">
            <ul class="section-list" id="sections"></ul>
          </div>
          <div class="add-row">
            <select id="add-kind" aria-label="Section kind"></select>
            <button type="button" id="add-section">${icon('plus', 'icon icon-sm')} Add</button>
          </div>
        </div>
        <div class="form-body" id="section-pane" hidden>
          <div class="section-heading" id="section-heading"></div>
          <div id="section-fields"></div>
        </div>
        <div class="form-body" id="meta-pane" hidden>
          <div id="meta-fields"></div>
        </div>
      </div>
    </aside>

    <aside class="page-rail" id="page-panel" hidden>
      <div class="form-inner">
        <div class="panel-header">
          <span class="panel-title" id="page-title">Info</span>
        </div>
        <div class="form-body" id="info-pane">
          <div class="info-stack" id="info-fields">
            <p class="hint">Loading…</p>
          </div>
        </div>
        <div class="form-body" id="history-pane" hidden>
          <div class="history-stack" id="history-fields">
            <p class="hint">Loading…</p>
          </div>
        </div>
      </div>
    </aside>

    <aside class="media-rail" id="media-panel" hidden>
      <div class="form-inner media-rail-inner">
        <div class="panel-header">
          <span class="panel-title">Media</span>
          <a class="panel-link hint" href="/admin/media" title="Open full Media desk">Desk</a>
        </div>
        <div class="media-rail-mount" id="media-mount"></div>
      </div>
    </aside>

    <aside class="agent-rail is-disabled" id="agent-panel" aria-label="Editor agent">
      <div class="agent-rail-inner" id="agent-mount"></div>
    </aside>

    <nav class="icon-rail" aria-label="Editor tools">
      <div class="rail-group" role="group" aria-label="Inspector">
        <button type="button" class="rail-toggle" data-primary="inspector" data-tab="layers" aria-pressed="true" title="Layers" aria-label="Layers">${icon('layers')}</button>
        <button type="button" class="rail-toggle" data-primary="inspector" data-tab="section" aria-pressed="false" title="Section" aria-label="Section">${icon('section')}</button>
        <button type="button" class="rail-toggle" data-primary="inspector" data-tab="meta" aria-pressed="false" title="Meta" aria-label="Meta">${icon('meta')}</button>
      </div>
      <div class="rail-group rail-divider" role="group" aria-label="Page">
        <button type="button" class="rail-toggle" data-primary="page" data-tab="info" aria-pressed="false" title="Info" aria-label="Info">${icon('info')}</button>
        <button type="button" class="rail-toggle" data-primary="page" data-tab="history" aria-pressed="false" title="Git history" aria-label="Git history">${icon('history')}</button>
      </div>
      <div class="rail-group rail-divider" role="group" aria-label="Media">
        <button type="button" class="rail-toggle" data-primary="media" data-tab="library" aria-pressed="false" title="Media library" aria-label="Media library">${icon('media')}</button>
      </div>
      <div class="rail-group rail-divider" role="group" aria-label="Agent" id="agent-rail-group" hidden>
        <button type="button" id="toggle-agent" class="rail-toggle" aria-pressed="false" title="Agent" aria-label="Toggle agent">
          ${icon('agent')}
        </button>
      </div>
      <div class="rail-spacer" aria-hidden="true"></div>
      <div class="rail-group rail-exit" role="group" aria-label="Leave editor">
        <a class="rail-link" href="/admin" title="All pages" aria-label="All pages">${icon('pages')}</a>
        <a class="rail-link" href="/admin/site" title="Site chrome" aria-label="Site chrome">${icon('chrome')}</a>
        <a class="rail-link" href="/admin/media" title="Media desk" aria-label="Media desk">${icon('media')}</a>
        <a class="rail-link" href="/admin/changes" title="Changes" aria-label="Changes">${icon('external')}</a>
      </div>
    </nav>

    <div class="modal-backdrop" id="insert-modal" hidden>
      <div class="modal" role="dialog" aria-labelledby="insert-title">
        <h3 id="insert-title">Insert section</h3>
        <p class="hint" id="insert-hint">Choose a block kind to insert.</p>
        <div class="add-row">
          <select id="insert-kind" aria-label="Section kind to insert"></select>
        </div>
        <div class="modal-actions">
          <button type="button" id="insert-cancel">Cancel</button>
          <button type="button" class="primary" id="insert-confirm">Insert</button>
        </div>
      </div>
    </div>
  `;

  const statusEl = document.getElementById('status');
  const dirtyChip = document.getElementById('dirty-chip');
  const saveBtn = document.getElementById('save');
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  const sectionsEl = document.getElementById('sections');
  const sectionFieldsEl = document.getElementById('section-fields');
  const sectionHeadingEl = document.getElementById('section-heading');
  const metaEl = document.getElementById('meta-fields');
  const addKind = document.getElementById('add-kind');
  const insertKind = document.getElementById('insert-kind');
  const frame = document.getElementById('frame');
  const previewFrame = document.getElementById('preview-frame');
  const insertModal = document.getElementById('insert-modal');
  const layersPane = document.getElementById('layers-pane');
  const sectionPane = document.getElementById('section-pane');
  const metaPane = document.getElementById('meta-pane');
  const formPanel = document.getElementById('form-panel');
  const pagePanel = document.getElementById('page-panel');
  const mediaPanel = document.getElementById('media-panel');
  const mediaMount = document.getElementById('media-mount');
  const infoPane = document.getElementById('info-pane');
  const historyPane = document.getElementById('history-pane');
  const infoFieldsEl = document.getElementById('info-fields');
  const historyFieldsEl = document.getElementById('history-fields');
  const inspectorTitleEl = document.getElementById('inspector-title');
  const pageTitleEl = document.getElementById('page-title');

  /** @type {null | object} */
  let historyCache = null;
  /** @type {null | object} */
  let changesCache = null;

  boot.sectionKinds.forEach((kind) => {
    for (const sel of [addKind, insertKind]) {
      const opt = document.createElement('option');
      opt.value = kind;
      opt.textContent = kind;
      sel.appendChild(opt);
    }
  });

  function setStatus(msg, cls = '') {
    statusEl.textContent = msg;
    statusEl.className = `status-line ${cls}`.trim();
  }

  function syncHistoryButtons() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
  }

  function syncActionButtons() {
    dirty = !pagesEqual(draft, savedSnapshot);
    saveBtn.disabled = !dirty;
  }

  function refreshChromeState(chipState) {
    syncActionButtons();
    syncHistoryButtons();
    if (chipState) {
      setDirtyChip(chipState);
      return;
    }
    setDirtyChip(dirty ? 'dirty' : 'saved');
  }

  function setDirtyChip(state) {
    dirtyChip.dataset.state = state;
    dirtyChip.className = 'chip';
    if (state === 'dirty') {
      dirtyChip.classList.add('dirty');
      dirtyChip.textContent = 'Unsaved';
    } else if (state === 'saved' || state === 'ok') {
      dirtyChip.classList.add('ok');
      dirtyChip.textContent = 'Saved on cms';
    } else if (state === 'error') {
      dirtyChip.classList.add('error');
      dirtyChip.textContent = 'Error';
    } else if (state === 'saving') {
      dirtyChip.textContent = 'Saving…';
    } else {
      dirtyChip.classList.add('ok');
      dirtyChip.textContent = 'Saved on cms';
    }
    syncInfoEditStatus();
  }

  function checkpoint() {
    undoStack.push(deepClone(draft));
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack.length = 0;
    syncHistoryButtons();
  }

  function restoreFromHistory(page) {
    draft = deepClone(page);
    fieldEditCheckpointed = false;
    if (selectedSection >= draft.sections.length) {
      selectedSection = Math.max(0, draft.sections.length - 1);
    }
    refreshChromeState();
    renderMeta();
    renderSections();
    renderSectionFields(selectedSection, selectedPath);
    persistPreview(selectedSection, 'Restoring preview…');
    setStatus('History restored · Save to cms when ready');
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(deepClone(draft));
    restoreFromHistory(undoStack.pop());
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(deepClone(draft));
    restoreFromHistory(redoStack.pop());
  }

  function markDirty() {
    refreshChromeState('dirty');
    setStatus('Unsaved changes · Save to cms, then publish from Changes');
  }

  function postToFrame(type, payload) {
    const win = iframeWin || frame.contentWindow;
    postToFrameWin(win, type, payload);
  }

  function pingFrame() {
    iframeWin = frame.contentWindow;
    postToFrame('ping', {});
    syncBridgeMeta();
  }

  function syncBridgeMeta() {
    postToFrame('setMeta', {
      kinds: draft.sections.map((s) => s.kind),
      selectedSection,
      selectedPath,
    });
  }

  function selectSection(index, opts = {}) {
    if (index < 0 || index >= draft.sections.length) return;
    selectedSection = index;
    if (!opts.keepPath) selectedPath = null;
    renderSections();
    renderSectionFields(index, opts.focusPath);
    if (opts.openSectionTab !== false) {
      openInspector('section');
    }
    postToFrame('highlightSection', {
      index,
      path: opts.focusPath || null,
      scroll: opts.scroll !== false,
    });
    syncBridgeMeta();
    mediaPickerInstance?.syncInsertTarget?.();
  }

  function moveSection(from, to) {
    if (to < 0 || to >= draft.sections.length) return;
    if (from === to) return;
    checkpoint();
    const [item] = draft.sections.splice(from, 1);
    draft.sections.splice(to, 0, item);
    selectedSection = to;
    markDirty();
    renderSections();
    persistPreview(to, 'Updating preview…');
  }

  function duplicateSection(index) {
    const section = draft.sections[index];
    if (!section) return;
    checkpoint();
    draft.sections.splice(index + 1, 0, deepClone(section));
    selectedSection = index + 1;
    markDirty();
    renderSections();
    persistPreview(selectedSection, 'Updating preview…');
  }

  function deleteSection(index) {
    const section = draft.sections[index];
    if (!section) return;
    if (!confirm(`Delete section ${index} (${section.kind})?`)) return;
    checkpoint();
    draft.sections.splice(index, 1);
    selectedSection = Math.max(0, Math.min(index, draft.sections.length - 1));
    markDirty();
    renderSections();
    persistPreview(selectedSection, 'Updating preview…');
  }

  function insertSectionAt(index, kind) {
    const clamped = Math.max(0, Math.min(index, draft.sections.length));
    checkpoint();
    draft.sections.splice(clamped, 0, defaultSection(kind));
    markDirty();
    selectSection(clamped, { openSectionTab: false });
    persistPreview(clamped, `Adding “${kind}” to preview…`);
  }

  function openInsertModal(atIndex) {
    pendingInsertAt = atIndex;
    document.getElementById('insert-hint').textContent =
      atIndex >= draft.sections.length
        ? `Append a block at the end.`
        : `Insert a block before section ${atIndex}.`;
    insertModal.hidden = false;
    insertKind.focus();
  }

  function closeInsertModal() {
    pendingInsertAt = null;
    insertModal.hidden = true;
  }

  function renderMeta() {
    metaEl.innerHTML = '';
    const labels = {
      title: 'Title',
      description: 'Description',
      keywords: 'Keywords',
      image: 'Social image',
    };
    for (const key of ['title', 'description', 'keywords', 'image']) {
      const val = draft.metadata?.[key] ?? '';
      const wrap = document.createElement('div');
      wrap.className = 'field';
      wrap.innerHTML = `<label>${labels[key]}<span class="field-path">metadata.${key}</span></label>`;
      if (key === 'image') {
        mountImageUrlField(wrap, 'metadata.image', val);
        const input = wrap.querySelector('input');
        if (input) {
          input.addEventListener('focus', () => {
            fieldEditCheckpointed = false;
          });
          input.addEventListener('input', () => {
            if (!fieldEditCheckpointed) {
              checkpoint();
              fieldEditCheckpointed = true;
            }
            if (!draft.metadata) draft.metadata = {};
            draft.metadata.image = input.value;
            markDirty();
          });
        }
      } else {
        const input = document.createElement(key === 'description' ? 'textarea' : 'input');
        input.value = val;
        input.addEventListener('focus', () => {
          fieldEditCheckpointed = false;
        });
        input.addEventListener('input', () => {
          if (!fieldEditCheckpointed) {
            checkpoint();
            fieldEditCheckpointed = true;
          }
          if (!draft.metadata) draft.metadata = {};
          draft.metadata[key] = input.value;
          markDirty();
        });
        wrap.appendChild(input);
      }
      metaEl.appendChild(wrap);
    }
  }


  function sectionLayerLabel(section) {
    const title = typeof section.title === 'string' ? section.title.trim() : '';
    return title || null;
  }

  function renderSections() {
    sectionsEl.innerHTML = '';
    draft.sections.forEach((section, i) => {
      const li = document.createElement('li');
      li.draggable = true;
      li.dataset.index = String(i);
      if (i === selectedSection) li.classList.add('active');
      const title = sectionLayerLabel(section);
      li.innerHTML = `
        <span class="drag-handle" title="Drag to reorder" aria-hidden="true">${icon('grip', 'icon icon-sm')}</span>
        <span class="kind-wrap">
          <span class="idx-line">
            <span class="idx">${String(i).padStart(2, '0')}</span>
            ${title ? `<span class="layer-title">${escapeHtml(title)}</span>` : ''}
          </span>
          <span class="kind">${section.kind}</span>
        </span>
        <span class="row-actions">
          <button type="button" data-up title="Move up" aria-label="Move up">${icon('up', 'icon icon-sm')}</button>
          <button type="button" data-down title="Move down" aria-label="Move down">${icon('down', 'icon icon-sm')}</button>
          <button type="button" data-dup title="Duplicate" aria-label="Duplicate">${icon('dup', 'icon icon-sm')}</button>
          <button type="button" data-del title="Delete" aria-label="Delete">${icon('del', 'icon icon-sm')}</button>
        </span>
      `;
      li.title = title ? `${section.kind} · ${title}` : section.kind;
      li.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('.drag-handle')) return;
        selectSection(i);
      });
      li.addEventListener('dragstart', (e) => {
        dragFromIndex = i;
        li.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(i));
      });
      li.addEventListener('dragend', () => {
        dragFromIndex = null;
        li.classList.remove('is-dragging');
        sectionsEl.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
      });
      li.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        sectionsEl.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
        li.classList.add('drag-over');
      });
      li.addEventListener('dragleave', () => {
        li.classList.remove('drag-over');
      });
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        li.classList.remove('drag-over');
        const from = dragFromIndex ?? Number(e.dataTransfer.getData('text/plain'));
        const to = i;
        if (!Number.isFinite(from) || from === to) return;
        moveSection(from, to);
      });
      li.querySelector('[data-up]').addEventListener('click', (e) => {
        e.stopPropagation();
        moveSection(i, i - 1);
      });
      li.querySelector('[data-down]').addEventListener('click', (e) => {
        e.stopPropagation();
        moveSection(i, i + 1);
      });
      li.querySelector('[data-dup]').addEventListener('click', (e) => {
        e.stopPropagation();
        duplicateSection(i);
      });
      li.querySelector('[data-del]').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSection(i);
      });
      sectionsEl.appendChild(li);
    });
  }

  function bindLiveInput(input, path, kind) {
    input.addEventListener('focus', () => {
      fieldEditCheckpointed = false;
      selectedPath = path;
      postToFrame('highlight', { path });
      highlightFieldInForm(path);
    });
    input.addEventListener('input', () => {
      if (!fieldEditCheckpointed) {
        checkpoint();
        fieldEditCheckpointed = true;
      }
      setByPath(draft, path, input.value);
      markDirty();
      if (kind === 'image' || path.endsWith('.src')) {
        postToFrame('setAttr', { path, attr: 'src', value: input.value });
      } else {
        postToFrame('setText', { path, value: input.value });
      }
      selectedPath = path;
      postToFrame('highlight', { path });
      highlightFieldInForm(path);
      if (/^sections\.\d+\.title$/.test(path)) renderSections();
    });
  }


  function applyCloudinaryAsset(path, asset) {
    if (!asset) return;
    const url = asset.secure_url || asset.url;
    if (!url) return;

    checkpoint();
    setByPath(draft, path, url);
    markDirty();

    // Fill sibling width/height when this is an image object field.
    if (path.endsWith('.src')) {
      const base = path.slice(0, -'.src'.length);
      if (asset.width != null) setByPath(draft, `${base}.width`, asset.width);
      if (asset.height != null) setByPath(draft, `${base}.height`, asset.height);
      const altPath = `${base}.alt`;
      const existingAlt = getByPath(draft, altPath);
      if ((existingAlt == null || existingAlt === '') && (asset.display_name || asset.public_id)) {
        setByPath(draft, altPath, asset.display_name || asset.public_id);
      }
    }

    if (path.endsWith('.src') || path.includes('.image')) {
      postToFrame('setAttr', { path, attr: 'src', value: url });
      if (asset.width != null) {
        postToFrame('setAttr', { path, attr: 'width', value: String(asset.width) });
      }
      if (asset.height != null) {
        postToFrame('setAttr', { path, attr: 'height', value: String(asset.height) });
      }
      postToFrame('highlight', { path });
      // Reload preview so Astro Image rebuilds srcset from the draft.
      const match = path.match(/^sections\.(\d+)/);
      const idx = match ? Number(match[1]) : selectedSection;
      schedulePersistPreview(idx, 'Updating image preview…');
    }

    selectedPath = path;
  }

  function mountImageUrlField(wrap, path, currentValue) {
    const row = document.createElement('div');
    row.className = 'image-field';

    const thumb = document.createElement('div');
    thumb.className = 'image-thumb';
    const img = document.createElement('img');
    img.alt = '';
    const syncThumb = (url) => {
      if (url) {
        img.src = url;
        thumb.classList.add('has-image');
        thumb.textContent = '';
        if (!img.isConnected) thumb.appendChild(img);
      } else {
        thumb.classList.remove('has-image');
        img.removeAttribute('src');
        img.remove();
        thumb.textContent = 'No image';
      }
    };
    syncThumb(currentValue || '');

    const controls = document.createElement('div');
    controls.className = 'image-controls';

    const input = document.createElement('input');
    input.type = 'url';
    input.id = pathToFieldId(path);
    input.value = currentValue == null ? '' : String(currentValue);
    input.placeholder = 'https://res.cloudinary.com/…';
    bindLiveInput(input, path, 'image');
    input.addEventListener('input', () => syncThumb(input.value));

    const browse = document.createElement('button');
    browse.type = 'button';
    browse.className = 'image-browse';
    browse.innerHTML = `${icon('media', 'icon icon-sm')} Browse`;
    browse.addEventListener('click', async () => {
      browse.disabled = true;
      setStatus('Opening media library…');
      try {
        const asset = await openMediaPickerModal({
          setStatus,
          getInsertTarget: () => ({ path, label: path }),
        });
        if (!asset) {
          setStatus('No image selected');
          return;
        }
        applyCloudinaryAsset(path, asset);
        const url = asset.secure_url || asset.url || '';
        input.value = url;
        syncThumb(url);
        const match = path.match(/^sections\.(\d+)/);
        if (match) renderSectionFields(Number(match[1]), path);
        else if (path.startsWith('metadata.')) renderMeta();
        setStatus('Image selected', 'ok');
      } catch (err) {
        setStatus(err.message || String(err), 'error');
      } finally {
        browse.disabled = false;
      }
    });

    controls.appendChild(input);
    controls.appendChild(browse);
    row.appendChild(thumb);
    row.appendChild(controls);
    wrap.appendChild(row);
    return input;
  }


  function coerceFieldValue(def, raw) {
    if (def.type === 'number' || def.coerce === 'number') {
      const n = Number(raw);
      return Number.isFinite(n) ? n : raw;
    }
    if (def.type === 'boolean' || def.coerce === 'boolean') {
      return raw === true || raw === 'true';
    }
    return raw;
  }

  function appendFieldControl(container, sectionIndex, def, opts = {}) {
    const path = `sections.${sectionIndex}.${def.key}`;
    const current = getByPath(draft, path);
    const wrap = document.createElement('div');
    wrap.className = 'field';
    if (opts.group) wrap.dataset.group = opts.group;

    const label = fieldLabel(def, sectionIndex);
    const shortPath = def.key;
    if (def.hint) {
      wrap.innerHTML = `<label for="${pathToFieldId(path)}">${label}<span class="field-path">${shortPath}</span></label><p class="field-hint">${def.hint}</p>`;
    } else {
      wrap.innerHTML = `<label for="${pathToFieldId(path)}">${label}<span class="field-path">${shortPath}</span></label>`;
    }

    const isQuery = opts.group === 'query';
    let control;

    if (def.type === 'select') {
      control = document.createElement('select');
      control.id = pathToFieldId(path);
      (def.options || []).forEach((opt) => {
        const o = document.createElement('option');
        o.value = String(opt);
        o.textContent = String(opt);
        control.appendChild(o);
      });
      control.value = current == null ? '' : String(current);
      control.addEventListener('change', () => {
        checkpoint();
        setByPath(draft, path, coerceFieldValue(def, control.value));
        markDirty();
        selectedPath = path;
        schedulePersistPreview(
          sectionIndex,
          isQuery ? 'Updating collection preview…' : 'Updating preview…',
        );
      });
      control.addEventListener('focus', () => {
        selectedPath = path;
        highlightFieldInForm(path);
      });
    } else if (def.type === 'number') {
      control = document.createElement('input');
      control.type = 'number';
      control.id = pathToFieldId(path);
      if (def.min != null) control.min = String(def.min);
      if (def.max != null) control.max = String(def.max);
      control.value = current == null ? '' : String(current);
      control.addEventListener('change', () => {
        checkpoint();
        setByPath(draft, path, coerceFieldValue(def, control.value));
        markDirty();
        selectedPath = path;
        schedulePersistPreview(sectionIndex, 'Updating collection preview…');
      });
      control.addEventListener('focus', () => {
        selectedPath = path;
        highlightFieldInForm(path);
      });
    } else if (def.type === 'markdown' || def.type === 'textarea') {
      control = document.createElement('textarea');
      control.id = pathToFieldId(path);
      control.value = current == null ? '' : String(current);
      if (def.type === 'markdown') control.classList.add('is-markdown');
      bindLiveInput(control, path, 'text');
    } else if (def.type === 'url' || path.endsWith('.src')) {
      mountImageUrlField(wrap, path, current == null ? '' : String(current));
      container.appendChild(wrap);
      return path;
    } else {
      control = document.createElement('input');
      control.type = 'text';
      control.id = pathToFieldId(path);
      control.value = current == null ? '' : String(current);
      bindLiveInput(control, path, 'text');
    }

    wrap.appendChild(control);
    container.appendChild(wrap);
    return path;
  }

  function listItemLabel(spec, item, index) {
    if (spec.itemKind === 'string') {
      const text = String(item ?? '').trim();
      return text || `Item ${index + 1}`;
    }
    for (const key of ['question', 'title', 'label', 'heading', 'term', 'name', 'company', 'alt']) {
      const val = item?.[key];
      if (typeof val === 'string' && val.trim()) return val.trim();
    }
    return `Item ${index + 1}`;
  }

  function appendListItemFields(container, basePath, fields, itemKind) {
    if (itemKind === 'string') {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const fieldPath = basePath;
      wrap.innerHTML = `<label for="${pathToFieldId(fieldPath)}">Label<span class="field-path">${fieldPath.split('.').slice(2).join('.')}</span></label>`;
      const input = document.createElement('input');
      input.type = 'text';
      input.id = pathToFieldId(fieldPath);
      input.value = getByPath(draft, fieldPath) ?? '';
      bindLiveInput(input, fieldPath, 'text');
      wrap.appendChild(input);
      container.appendChild(wrap);
      return;
    }
    fields.forEach((def) => {
      const key = def.key;
      const path = key ? `${basePath}.${key}` : basePath;
      const current = getByPath(draft, path);
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const label = def.label || key;
      wrap.innerHTML = `<label for="${pathToFieldId(path)}">${label}<span class="field-path">${path.split('.').slice(2).join('.')}</span></label>`;
      if (def.type === 'select') {
        const control = document.createElement('select');
        control.id = pathToFieldId(path);
        (def.options || []).forEach((opt) => {
          const o = document.createElement('option');
          o.value = String(opt);
          o.textContent = String(opt);
          control.appendChild(o);
        });
        control.value = current == null ? '' : String(current);
        control.addEventListener('change', () => {
          checkpoint();
          setByPath(draft, path, coerceFieldValue(def, control.value));
          markDirty();
        });
        wrap.appendChild(control);
      } else if (def.type === 'url' || (key && key.endsWith('src')) || key === 'src') {
        mountImageUrlField(wrap, path, current == null ? '' : String(current));
      } else if (def.type === 'textarea' || def.type === 'markdown') {
        const control = document.createElement('textarea');
        control.id = pathToFieldId(path);
        control.value = current == null ? '' : String(current);
        bindLiveInput(control, path, 'text');
        wrap.appendChild(control);
      } else {
        const control = document.createElement('input');
        control.type = 'text';
        control.id = pathToFieldId(path);
        control.value = current == null ? '' : String(current);
        bindLiveInput(control, path, 'text');
        wrap.appendChild(control);
      }
      container.appendChild(wrap);
    });
  }

  function renderNestedList(container, sectionIndex, parentPath, nestedSpec) {
    const parent = getByPath(draft, parentPath);
    if (!parent || typeof parent !== 'object') return;
    if (!Array.isArray(parent[nestedSpec.key])) parent[nestedSpec.key] = [];
    const items = parent[nestedSpec.key];

    const nest = document.createElement('div');
    nest.className = 'list-editor is-nested';
    nest.innerHTML = `<div class="list-editor-head"><h5>${nestedSpec.label}</h5></div>`;
    const body = document.createElement('div');
    body.className = 'list-editor-body';

    items.forEach((item, itemIndex) => {
      const card = document.createElement('div');
      card.className = 'list-item';
      const itemPath = `${parentPath}.${nestedSpec.key}.${itemIndex}`;
      card.innerHTML = `
        <div class="list-item-head">
          <span class="list-item-title">${escapeHtml(listItemLabel(nestedSpec, item, itemIndex))}</span>
          <span class="list-item-actions">
            <button type="button" data-up title="Move up" aria-label="Move up">${icon('up', 'icon icon-sm')}</button>
            <button type="button" data-down title="Move down" aria-label="Move down">${icon('down', 'icon icon-sm')}</button>
            <button type="button" data-del title="Remove" aria-label="Remove">${icon('del', 'icon icon-sm')}</button>
          </span>
        </div>
      `;
      const fieldsWrap = document.createElement('div');
      fieldsWrap.className = 'list-item-fields';
      appendListItemFields(fieldsWrap, itemPath, nestedSpec.fields, nestedSpec.itemKind);
      card.appendChild(fieldsWrap);

      card.querySelector('[data-up]').addEventListener('click', () => {
        if (itemIndex <= 0) return;
        checkpoint();
        const arr = getByPath(draft, `${parentPath}.${nestedSpec.key}`);
        const [moved] = arr.splice(itemIndex, 1);
        arr.splice(itemIndex - 1, 0, moved);
        markDirty();
        renderSectionFields(sectionIndex);
        persistPreview(sectionIndex, 'Updating preview…');
      });
      card.querySelector('[data-down]').addEventListener('click', () => {
        const arr = getByPath(draft, `${parentPath}.${nestedSpec.key}`);
        if (itemIndex >= arr.length - 1) return;
        checkpoint();
        const [moved] = arr.splice(itemIndex, 1);
        arr.splice(itemIndex + 1, 0, moved);
        markDirty();
        renderSectionFields(sectionIndex);
        persistPreview(sectionIndex, 'Updating preview…');
      });
      card.querySelector('[data-del]').addEventListener('click', () => {
        const arr = getByPath(draft, `${parentPath}.${nestedSpec.key}`);
        const min = nestedSpec.min ?? 0;
        if (arr.length <= min) {
          setStatus(`Keep at least ${min} ${nestedSpec.label.toLowerCase()}`, 'error');
          return;
        }
        checkpoint();
        arr.splice(itemIndex, 1);
        markDirty();
        renderSectionFields(sectionIndex);
        persistPreview(sectionIndex, 'Updating preview…');
      });
      body.appendChild(card);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'list-add';
    addBtn.innerHTML = `${icon('plus', 'icon icon-sm')} Add ${nestedSpec.label.replace(/s$/, '')}`;
    addBtn.addEventListener('click', () => {
      checkpoint();
      const arr = getByPath(draft, `${parentPath}.${nestedSpec.key}`);
      arr.push(nestedSpec.create());
      markDirty();
      renderSectionFields(sectionIndex);
      persistPreview(sectionIndex, 'Updating preview…');
    });

    nest.appendChild(body);
    nest.appendChild(addBtn);
    container.appendChild(nest);
  }

  function renderListEditor(container, sectionIndex, spec) {
    const section = draft.sections[sectionIndex];
    const items = Array.isArray(section[spec.key]) ? section[spec.key] : [];

    const group = document.createElement('div');
    group.className = 'field-group is-list';
    group.innerHTML = `
      <div class="field-group-head">
        <h4>${spec.label}</h4>
        <p>Add, reorder, or remove items in this list.</p>
      </div>
    `;
    const body = document.createElement('div');
    body.className = 'field-group-body list-editor-body';

    items.forEach((item, itemIndex) => {
      const card = document.createElement('div');
      card.className = 'list-item';
      const itemPath = `sections.${sectionIndex}.${spec.key}.${itemIndex}`;
      card.innerHTML = `
        <div class="list-item-head">
          <span class="list-item-title">${escapeHtml(listItemLabel(spec, item, itemIndex))}</span>
          <span class="list-item-actions">
            <button type="button" data-up title="Move up" aria-label="Move up">${icon('up', 'icon icon-sm')}</button>
            <button type="button" data-down title="Move down" aria-label="Move down">${icon('down', 'icon icon-sm')}</button>
            <button type="button" data-del title="Remove" aria-label="Remove">${icon('del', 'icon icon-sm')}</button>
          </span>
        </div>
      `;
      const fieldsWrap = document.createElement('div');
      fieldsWrap.className = 'list-item-fields';
      appendListItemFields(fieldsWrap, itemPath, spec.fields, spec.itemKind);
      card.appendChild(fieldsWrap);

      if (spec.nested && spec.itemKind !== 'string') {
        renderNestedList(card, sectionIndex, itemPath, spec.nested);
      }

      card.querySelector('[data-up]').addEventListener('click', () => {
        if (itemIndex <= 0) return;
        checkpoint();
        const arr = draft.sections[sectionIndex][spec.key];
        const [moved] = arr.splice(itemIndex, 1);
        arr.splice(itemIndex - 1, 0, moved);
        markDirty();
        renderSectionFields(sectionIndex);
        persistPreview(sectionIndex, 'Updating preview…');
      });
      card.querySelector('[data-down]').addEventListener('click', () => {
        const arr = draft.sections[sectionIndex][spec.key];
        if (itemIndex >= arr.length - 1) return;
        checkpoint();
        const [moved] = arr.splice(itemIndex, 1);
        arr.splice(itemIndex + 1, 0, moved);
        markDirty();
        renderSectionFields(sectionIndex);
        persistPreview(sectionIndex, 'Updating preview…');
      });
      card.querySelector('[data-del]').addEventListener('click', () => {
        const arr = draft.sections[sectionIndex][spec.key];
        const min = spec.min ?? 0;
        if (arr.length <= min) {
          setStatus(`Keep at least ${min} ${spec.label.toLowerCase()}`, 'error');
          return;
        }
        checkpoint();
        arr.splice(itemIndex, 1);
        if (spec.optional && arr.length === 0) {
          delete draft.sections[sectionIndex][spec.key];
        }
        markDirty();
        renderSectionFields(sectionIndex);
        persistPreview(sectionIndex, 'Updating preview…');
      });

      body.appendChild(card);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'list-add';
    addBtn.innerHTML = `${icon('plus', 'icon icon-sm')} Add ${spec.label.replace(/s$/, '')}`;
    addBtn.addEventListener('click', () => {
      checkpoint();
      if (!Array.isArray(draft.sections[sectionIndex][spec.key])) {
        draft.sections[sectionIndex][spec.key] = [];
      }
      draft.sections[sectionIndex][spec.key].push(spec.create());
      markDirty();
      renderSectionFields(sectionIndex);
      persistPreview(sectionIndex, 'Updating preview…');
    });

    group.appendChild(body);
    group.appendChild(addBtn);
    container.appendChild(group);
  }

  function highlightFieldInForm(path) {
    sectionFieldsEl.querySelectorAll('.field.focused').forEach((el) => el.classList.remove('focused'));
    if (!path) return;
    const input = document.getElementById(pathToFieldId(path));
    if (!input) return;
    const wrap = input.closest('.field');
    if (wrap) wrap.classList.add('focused');
  }

  function focusFieldInForm(path) {
    const input = document.getElementById(pathToFieldId(path));
    if (!input) return;
    input.focus({ preventScroll: true });
    input.closest('.field')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    highlightFieldInForm(path);
  }

  function renderSectionFields(index, focusPath) {
    const section = draft.sections[index];
    if (!section) {
      sectionHeadingEl.innerHTML = '';
      sectionFieldsEl.innerHTML = '<p class="hint">No section selected.</p>';
      return;
    }
    sectionHeadingEl.innerHTML = `
      <p class="label">Section ${String(index).padStart(2, '0')}</p>
      <h3>${section.kind}</h3>
    `;
    sectionFieldsEl.innerHTML = '';

    const form = SECTION_FORM[section.kind] || { fields: [] };
    const covered = new Set();

    if (form.query?.length) {
      const group = document.createElement('div');
      group.className = 'field-group is-query';
      group.innerHTML = `
        <div class="field-group-head">
          <h4>Content query</h4>
          <p>Which collection items appear here. Save to refresh the preview.</p>
        </div>
      `;
      const body = document.createElement('div');
      body.className = 'field-group-body';
      form.query.forEach((def) => {
        covered.add(`sections.${index}.${def.key}`);
        appendFieldControl(body, index, def, { group: 'query' });
      });
      group.appendChild(body);
      sectionFieldsEl.appendChild(group);
    }

    if (form.fields?.length) {
      const group = document.createElement('div');
      group.className = 'field-group';
      if (form.query?.length) {
        group.innerHTML = `<div class="field-group-head"><h4>Copy &amp; media</h4></div>`;
      }
      const body = document.createElement('div');
      body.className = 'field-group-body';
      form.fields.forEach((def) => {
        covered.add(`sections.${index}.${def.key}`);
        appendFieldControl(body, index, def);
      });
      group.appendChild(body);
      sectionFieldsEl.appendChild(group);
    }

    const listSpecs = LIST_SPECS[section.kind] || [];
    listSpecs.forEach((spec) => {
      renderListEditor(sectionFieldsEl, index, spec);
    });

    const extraPaths = editableLeafPaths(section, `sections.${index}`).filter((p) => {
      if (covered.has(p)) return false;
      if (SKIP_LEAF.test(p)) return false;
      if (/\.variant$/.test(p)) return false;
      if (pathCoveredByLists(p, index, section.kind)) return false;
      for (const key of covered) {
        if (p === key) return false;
      }
      const val = getByPath(draft, p);
      return typeof val === 'string';
    });

    const variantPaths = editableLeafPaths(section, `sections.${index}`).filter(
      (p) => p.endsWith('.variant') && !pathCoveredByLists(p, index, section.kind),
    );

    if (extraPaths.length || variantPaths.length) {
      const group = document.createElement('div');
      group.className = 'field-group';
      group.innerHTML = `<div class="field-group-head"><h4>Items &amp; details</h4></div>`;
      const body = document.createElement('div');
      body.className = 'field-group-body';
      extraPaths.forEach((path) => {
        const val = getByPath(draft, path);
        const str = String(val ?? '');
        const { label, path: shortPath } = humanizePath(path, index);
        const wrap = document.createElement('div');
        wrap.className = 'field';
        wrap.innerHTML = `<label for="${pathToFieldId(path)}">${label}<span class="field-path">${shortPath}</span></label>`;
        if (path.endsWith('.src')) {
          mountImageUrlField(wrap, path, str);
        } else {
          const input = document.createElement(str.length > 80 ? 'textarea' : 'input');
          input.id = pathToFieldId(path);
          input.value = str;
          bindLiveInput(input, path, 'text');
          wrap.appendChild(input);
        }
        body.appendChild(wrap);
      });
      variantPaths.forEach((path) => {
        const options = section.kind === 'cta-strip' ? VARIANT_STRIP : VARIANT_CTA;
        appendFieldControl(body, index, {
          key: path.replace(`sections.${index}.`, ''),
          type: 'select',
          options,
          label: humanizePath(path, index).label,
        });
      });
      group.appendChild(body);
      sectionFieldsEl.appendChild(group);
    }

    if (!sectionFieldsEl.children.length) {
      sectionFieldsEl.innerHTML = '<p class="hint">No editable fields for this section.</p>';
    }

    if (focusPath) {
      requestAnimationFrame(() => focusFieldInForm(focusPath));
    } else if (selectedPath && selectedPath.startsWith(`sections.${index}.`)) {
      requestAnimationFrame(() => focusFieldInForm(selectedPath));
    }
  }

  function handlePreviewSelect(payload) {
    const sectionIndex =
      typeof payload.sectionIndex === 'number'
        ? payload.sectionIndex
        : Number(String(payload.path || '').match(/^sections\.(\d+)/)?.[1]);
    if (Number.isFinite(sectionIndex)) {
      selectedSection = sectionIndex;
    }
    selectedPath = payload.path || null;
    renderSections();
    renderSectionFields(selectedSection, selectedPath);
    openInspector('section');
    if (selectedPath) {
      focusFieldInForm(selectedPath);
    }
    syncBridgeMeta();
  }

  let previewPersistTimer = null;
  let previewPersistInFlight = null;

  async function persistPreview(highlightIndex, statusMsg) {
    const target =
      highlightIndex == null ? selectedSection : highlightIndex;
    setStatus(statusMsg || 'Updating preview…');
    try {
      await apiFetch(`/api/admin/pages/${boot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: draft, mode: 'preview' }),
        errorMessage: 'Preview sync failed',
      });
      reloadPreview(target);
      setStatus('Preview updated · Save to cms when ready', 'ok');
    } catch (err) {
      setStatus(err.message || String(err), 'error');
    }
  }

  function schedulePersistPreview(highlightIndex, statusMsg) {
    clearTimeout(previewPersistTimer);
    previewPersistTimer = setTimeout(() => {
      previewPersistInFlight = persistPreview(highlightIndex, statusMsg);
    }, 280);
  }

  function capturePreviewScroll() {
    try {
      const win = frame.contentWindow;
      if (!win) return null;
      return { x: win.scrollX || 0, y: win.scrollY || 0 };
    } catch {
      return null;
    }
  }

  function reloadPreview(highlightIndex) {
    pendingScroll = capturePreviewScroll();
    pendingHighlight =
      highlightIndex == null ? selectedSection : highlightIndex;
    setStatus('Refreshing preview…');
    // Only reload the iframe — never touch parent location (avoids wiping the editor).
    const url = new URL(boot.previewUrl, window.location.origin);
    url.searchParams.set('edit', '1');
    url.searchParams.set('t', String(Date.now()));
    if (frame.contentWindow) {
      frame.contentWindow.location.replace(url.pathname + url.search);
    } else {
      frame.src = url.pathname + url.search;
    }
  }

  function restorePreviewAfterReady() {
    const scroll = pendingScroll;
    pendingScroll = null;
    const idx = pendingHighlight != null ? pendingHighlight : selectedSection;
    pendingHighlight = null;

    // Highlight without scrolling — then restore the previous viewport.
    // Keep the current inspector tab (e.g. stay on Layers after reorder).
    selectSection(idx, {
      keepPath: true,
      focusPath: selectedPath,
      scroll: false,
      openSectionTab: false,
    });
    if (scroll) {
      postToFrame('restoreScroll', scroll);
      // Second pass after images/layout settle.
      setTimeout(() => postToFrame('restoreScroll', scroll), 120);
    }
  }

  const INSPECTOR_TITLES = { layers: 'Layers', section: 'Section', meta: 'Meta' };
  const PAGE_TITLES = { info: 'Info', history: 'History' };

  function syncPrimaryChrome() {
    root.classList.toggle('primary-collapsed', primary == null);
    root.dataset.primary = primary || '';

    formPanel.hidden = primary !== 'inspector';
    pagePanel.hidden = primary !== 'page';
    mediaPanel.hidden = primary !== 'media';

    if (primary === 'inspector') {
      inspectorTitleEl.textContent = INSPECTOR_TITLES[inspectorTab] || 'Inspector';
      layersPane.hidden = inspectorTab !== 'layers';
      sectionPane.hidden = inspectorTab !== 'section';
      metaPane.hidden = inspectorTab !== 'meta';
    }

    if (primary === 'page') {
      pageTitleEl.textContent = PAGE_TITLES[pageTab] || 'Page';
      infoPane.hidden = pageTab !== 'info';
      historyPane.hidden = pageTab !== 'history';
    }

    if (primary === 'media') {
      ensureMediaPicker();
      mediaPickerInstance?.syncInsertTarget?.();
    }

    document.querySelectorAll('.rail-toggle[data-primary]').forEach((btn) => {
      const match =
        primary === btn.dataset.primary &&
        ((primary === 'inspector' && btn.dataset.tab === inspectorTab) ||
          (primary === 'page' && btn.dataset.tab === pageTab) ||
          (primary === 'media' && btn.dataset.tab === 'library'));
      btn.setAttribute('aria-pressed', String(match));
    });
  }

  function getMediaInsertTarget() {
    return window.__tbVisualEditor?.resolveImageTarget?.() || null;
  }

  function ensureMediaPicker() {
    if (mediaPickerInstance || !mediaMount) return;
    mediaPickerInstance = createMediaPicker({
      mount: mediaMount,
      mode: 'manage',
      setStatus,
      getInsertTarget: getMediaInsertTarget,
      onInsert(mapped) {
        const target = getMediaInsertTarget();
        if (!target?.path) {
          setStatus('Select an image field in the inspector first', 'error');
          return;
        }
        applyCloudinaryAsset(target.path, mapped);
        const match = target.path.match(/^sections\.(\d+)/);
        if (match) renderSectionFields(Number(match[1]), target.path);
        else if (target.path.startsWith('metadata.')) renderMeta();
        setStatus(`Inserted into ${target.label || target.path}`, 'ok');
      },
    });
    mediaPickerInstance.refresh();
  }

  function openInspector(tab) {
    inspectorTab = tab;
    primary = 'inspector';
    syncPrimaryChrome();
  }

  function openPage(tab) {
    pageTab = tab;
    primary = 'page';
    syncPrimaryChrome();
    if (tab === 'info') refreshInfoPane();
    if (tab === 'history') refreshHistoryPanel();
  }

  function openMedia() {
    primary = 'media';
    syncPrimaryChrome();
  }

  function closePrimary() {
    primary = null;
    syncPrimaryChrome();
  }

  function togglePrimary(kind, tab) {
    if (kind === 'inspector') {
      if (primary === 'inspector' && inspectorTab === tab) closePrimary();
      else openInspector(tab);
      return;
    }
    if (kind === 'page') {
      if (primary === 'page' && pageTab === tab) closePrimary();
      else openPage(tab);
      return;
    }
    if (kind === 'media') {
      if (primary === 'media') closePrimary();
      else openMedia();
    }
  }

  function formatCommitDate(iso) {
    if (!iso) return '—';
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function editStatusLabel() {
    if (dirtyChip?.dataset.state === 'saving') return 'Saving…';
    if (dirtyChip?.dataset.state === 'error') return 'Save error';
    return dirty ? 'Unsaved' : 'Saved on cms';
  }

  async function fetchChangesStatus(force = false) {
    if (!force && changesCache) return changesCache;
    try {
      changesCache = await apiFetch('/api/admin/changes', {
        errorMessage: 'Could not load publish status',
      });
    } catch (err) {
      changesCache = {
        configured: false,
        error: err.message || String(err),
        aheadBy: 0,
        pages: [],
      };
    }
    return changesCache;
  }

  async function fetchHistory(force = false) {
    if (!force && historyCache) return historyCache;
    try {
      historyCache = await apiFetch(`/api/admin/pages/${boot.id}/history`, {
        errorMessage: 'Could not load history',
      });
    } catch (err) {
      historyCache = {
        configured: false,
        error: err.message || String(err),
        commits: [],
        lastPublish: null,
      };
    }
    return historyCache;
  }

  async function refreshInfoPane() {
    if (!infoFieldsEl) return;
    infoFieldsEl.innerHTML = '<p class="hint">Loading…</p>';
    const [changes, history] = await Promise.all([
      fetchChangesStatus(true),
      fetchHistory(false),
    ]);
    if (primary !== 'page' || pageTab !== 'info') return;

    const title = draft?.metadata?.title || boot.id;
    const path = slugPath;
    const pageChange = (changes.pages || []).find((p) => p.id === boot.id);
    let publishLabel = 'Unknown';
    if (!changes.configured) {
      publishLabel = 'GitHub not configured';
    } else if ((changes.aheadBy || 0) === 0) {
      publishLabel = 'In sync with main';
    } else if (pageChange) {
      publishLabel = `Pending publish · ${pageChange.change}`;
    } else {
      publishLabel = `${changes.aheadBy} commit${changes.aheadBy === 1 ? '' : 's'} ahead (other changes)`;
    }

    const last = history.lastPublish;
    const lastHtml = last
      ? last.htmlUrl
        ? `<a href="${escapeHtml(last.htmlUrl)}" target="_blank" rel="noopener">${escapeHtml(last.shortSha)}</a> · ${escapeHtml(formatCommitDate(last.date))}`
        : `${escapeHtml(last.shortSha)} · ${escapeHtml(formatCommitDate(last.date))}`
      : history.configured === false
        ? '—'
        : 'No commits on main yet';

    const mainB = changes.mainBranch || history.mainBranch || 'main';
    const cmsB = changes.cmsBranch || history.cmsBranch || 'cms';

    infoFieldsEl.innerHTML = `
      <dl class="info-dl">
        <div><dt>Page id</dt><dd><code>${escapeHtml(boot.id)}</code></dd></div>
        <div><dt>Title</dt><dd>${escapeHtml(title)}</dd></div>
        <div><dt>Path</dt><dd><code>${escapeHtml(path)}</code></dd></div>
        <div><dt>Live URL</dt><dd><a href="${escapeHtml(liveUrl)}" target="_blank" rel="noopener">${escapeHtml(liveUrl)}</a></dd></div>
        <div><dt>Edit status</dt><dd id="info-edit-status">${escapeHtml(editStatusLabel())}</dd></div>
        <div><dt>Publish status</dt><dd>${escapeHtml(publishLabel)}</dd></div>
        <div><dt>Last on main</dt><dd>${lastHtml}</dd></div>
        <div><dt>Branches</dt><dd><code>${escapeHtml(cmsB)}</code> → <code>${escapeHtml(mainB)}</code></dd></div>
      </dl>
      <p class="info-actions">
        <a class="open-live" href="/admin/changes">Review &amp; publish</a>
      </p>
    `;
  }

  function syncInfoEditStatus() {
    const el = document.getElementById('info-edit-status');
    if (el) el.textContent = editStatusLabel();
  }

  async function refreshHistoryPanel(force = false) {
    if (!historyFieldsEl) return;
    historyFieldsEl.innerHTML = '<p class="hint">Loading…</p>';
    const data = await fetchHistory(force);
    if (primary !== 'page' || pageTab !== 'history') return;

    if (!data.configured) {
      historyFieldsEl.innerHTML = `<p class="hint">${escapeHtml(data.error || 'GitHub is not configured. Set GITHUB_TOKEN and GITHUB_REPO to see commit history.')}</p>`;
      return;
    }

    const commits = data.commits || [];
    if (!commits.length) {
      historyFieldsEl.innerHTML = '<p class="hint">No commits touch pages.json on the cms branch yet.</p>';
      return;
    }

    const needle = `cms: update ${boot.id}`;
    historyFieldsEl.innerHTML = `
      <p class="hint history-path">Commits touching <code>${escapeHtml(data.path || 'src/content/pages.json')}</code> on <code>${escapeHtml(data.cmsBranch || 'cms')}</code></p>
      <ul class="commit-list">
        ${commits
          .map((c) => {
            const forPage = (c.message || '').includes(needle);
            const msg = escapeHtml(c.message || '(no message)');
            const meta = [
              escapeHtml(c.shortSha || ''),
              escapeHtml(formatCommitDate(c.date)),
              c.author ? escapeHtml(c.author) : null,
            ]
              .filter(Boolean)
              .join(' · ');
            const body = c.htmlUrl
              ? `<a href="${escapeHtml(c.htmlUrl)}" target="_blank" rel="noopener" class="commit-msg">${msg}</a>`
              : `<span class="commit-msg">${msg}</span>`;
            return `<li class="commit-row${forPage ? ' is-page' : ''}">${body}<div class="commit-meta">${meta}${forPage ? ' <span class="commit-badge">this page</span>' : ''}</div></li>`;
          })
          .join('')}
      </ul>
    `;
  }

  function setDevice(mode) {
    deviceMode = mode;
    previewFrame.classList.remove('is-desktop', 'is-mobile', 'is-full');
    previewFrame.classList.add(`is-${mode}`);
    document.querySelectorAll('.devices [data-device]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.device === mode);
    });
  }

  document.querySelectorAll('.rail-toggle[data-primary]').forEach((btn) => {
    btn.addEventListener('click', () => {
      togglePrimary(btn.dataset.primary, btn.dataset.tab);
    });
  });

  document.getElementById('toggle-agent')?.addEventListener('click', () => {
    setAgentOpen(!root.classList.contains('agent-open'));
  });

  document.querySelectorAll('.devices [data-device]').forEach((btn) => {
    btn.addEventListener('click', () => setDevice(btn.dataset.device));
  });

  document.getElementById('add-section').addEventListener('click', () => {
    insertSectionAt(draft.sections.length, addKind.value);
  });

  document.getElementById('insert-cancel').addEventListener('click', closeInsertModal);
  document.getElementById('insert-confirm').addEventListener('click', () => {
    if (pendingInsertAt == null) return;
    const at = pendingInsertAt;
    const kind = insertKind.value;
    closeInsertModal();
    insertSectionAt(at, kind);
  });
  insertModal.addEventListener('click', (e) => {
    if (e.target === insertModal) closeInsertModal();
  });

  async function saveToCms() {
    if (saveBtn.disabled) return;
    saveBtn.disabled = true;
    setDirtyChip('saving');
    setStatus('Saving to cms…');
    try {
      const data = await apiFetch(`/api/admin/pages/${boot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: draft }),
        errorMessage: 'Save failed',
      });
      savedSnapshot = deepClone(draft);
      dirty = false;
      undoStack.length = 0;
      redoStack.length = 0;
      historyCache = null;
      changesCache = null;
      refreshChromeState('saved');
      const branch = data.branch || 'cms';
      setStatus(`Saved to ${branch} · ${data.mode} · ${data.commit} · Publish from Changes`, 'ok');
      reloadPreview(selectedSection);
      if (primary === 'page' && pageTab === 'info') refreshInfoPane();
      if (primary === 'page' && pageTab === 'history') refreshHistoryPanel(true);
    } catch (err) {
      refreshChromeState('error');
      setStatus(err.message || String(err), 'error');
    }
  }

  saveBtn.addEventListener('click', () => {
    saveToCms();
  });
  undoBtn.addEventListener('click', () => undo());
  redoBtn.addEventListener('click', () => redo());

  window.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const key = e.key.toLowerCase();
    if (key === 's') {
      e.preventDefault();
      if (e.shiftKey) {
        window.location.href = '/admin/changes';
      } else {
        saveToCms();
      }
      return;
    }
    if (key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
  });

  frame.addEventListener('load', () => {
    iframeWin = frame.contentWindow;
    setTimeout(pingFrame, 50);
    setTimeout(pingFrame, 250);
    setTimeout(pingFrame, 800);
  });

  window.addEventListener('message', (e) => {
    if (!isTrustedEditorMessage(e)) return;
    const data = e.data;
    if (data.type === 'ready') {
      iframeWin = frame.contentWindow;
      setStatus(
        `Preview ready · ${data.payload?.count ?? 0} fields · ${draft.sections.length} blocks`,
        'ok',
      );
      syncBridgeMeta();
      if (pendingHighlight != null || pendingScroll) {
        restorePreviewAfterReady();
      } else {
        postToFrame('highlightSection', {
          index: selectedSection,
          path: selectedPath,
          scroll: false,
        });
      }
      return;
    }
    if (data.type === 'select') {
      handlePreviewSelect(data.payload || {});
      return;
    }
    if (data.type === 'blockAction') {
      const { action, sectionIndex } = data.payload || {};
      const i = Number(sectionIndex);
      if (!Number.isFinite(i)) return;
      if (action === 'up') moveSection(i, i - 1);
      else if (action === 'down') moveSection(i, i + 1);
      else if (action === 'dup') duplicateSection(i);
      else if (action === 'del') deleteSection(i);
      return;
    }
    if (data.type === 'addAt') {
      const index = Number(data.payload?.index);
      if (!Number.isFinite(index)) return;
      openInsertModal(index);
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  renderMeta();
  renderSections();
  renderSectionFields(0);
  setDevice('full');
  syncPrimaryChrome();
  refreshChromeState('saved');
  syncHistoryButtons();




  function syncWebMcpChip() {
    let chip = document.getElementById('webmcp-chip');
    if (!chip) {
      chip = document.createElement('span');
      chip.id = 'webmcp-chip';
      chip.className = 'chip webmcp-chip';
      statusEl.appendChild(chip);
    }
    const info = window.__tbWebMcp;
    if (!info) {
      chip.textContent = 'WebMCP…';
      chip.classList.remove('ok', 'error');
      return;
    }
    if (info.ready) {
      chip.textContent = `WebMCP · ${info.tools}`;
      chip.classList.add('ok');
      chip.classList.remove('error');
      chip.title = `Registered ${info.tools} tools on ${(info.contexts || []).map((c) => c.label).join(', ')}`;
    } else {
      chip.textContent = 'WebMCP off';
      chip.classList.add('error');
      chip.classList.remove('ok');
      chip.title = (info.errors || []).join(' · ') || 'No modelContext API';
    }
  }

  function setAgentOpen(open) {
    const panel = document.getElementById('agent-panel');
    const btn = document.getElementById('toggle-agent');
    if (!panel || !btn || btn.closest('#agent-rail-group')?.hidden) return;
    root.classList.toggle('agent-open', open);
    btn.setAttribute('aria-pressed', String(open));
    window.dispatchEvent(new CustomEvent('tb-agent-open', { detail: { open } }));
  }

  window.__tbEditorChrome = {
    enableAgentToggle() {
      const group = document.getElementById('agent-rail-group');
      const btn = document.getElementById('toggle-agent');
      if (group) group.hidden = false;
      if (btn) btn.hidden = false;
    },
    setAgentOpen,
    isAgentOpen() {
      return root.classList.contains('agent-open');
    },
  };

  function refreshAfterStructural(highlightIndex) {
    renderSections();
    renderSectionFields(highlightIndex ?? selectedSection);
    renderMeta();
    markDirty();
    return persistPreview(highlightIndex ?? selectedSection, 'Agent updated preview…');
  }

  function applyLiveLeaf(path, value) {
    const str = value == null ? '' : String(value);
    setByPath(draft, path, typeof value === 'number' || typeof value === 'boolean' ? value : str);
    if (path.startsWith('metadata.')) {
      const key = path.slice('metadata.'.length);
      postToFrame('setMeta', { key, value: str });
    } else if (/\.(src|href)$/.test(path)) {
      postToFrame('setAttr', { path, attr: path.endsWith('.src') ? 'src' : 'href', value: str });
    } else {
      postToFrame('setText', { path, value: str });
    }
    markDirty();
    const input = document.getElementById(pathToFieldId(path));
    if (input && 'value' in input) input.value = str;
  }

  const session = {
    get boot() { return boot; },
    get draft() { return draft; },
    set draft(v) { draft = v; },
    get dirty() { return dirty; },
    get liveUrl() { return liveUrl; },
    get selectedSection() { return selectedSection; },
    set selectedSection(v) { selectedSection = v; },
    get selectedPath() { return selectedPath; },
    set selectedPath(v) { selectedPath = v; },
    get deviceMode() { return deviceMode; },
    selectSection,
    insertSectionAt,
    moveSection,
    duplicateSection,
    deleteSection,
    checkpoint,
    refreshAfterStructural,
    applyLiveLeaf,
    applyCloudinaryAsset,
    renderSectionFields,
    renderMeta,
    markDirty,
    postToFrame,
    setDevice,
    undo,
    redo,
    saveToCms,
    persistPreview,
    clearPreviewPersistTimer() {
      clearTimeout(previewPersistTimer);
      previewPersistTimer = null;
    },
    setStatus,
    setByPath,
    getByPath,
  };

  window.__tbVisualEditor = createVisualEditorFacade(session);

  window.dispatchEvent(new CustomEvent('tb-visual-editor-ready', { detail: { pageId: boot.id } }));
  syncWebMcpChip();
  window.addEventListener('tb-webmcp-ready', syncWebMcpChip);
  setTimeout(syncWebMcpChip, 100);
  setTimeout(syncWebMcpChip, 500);

}
