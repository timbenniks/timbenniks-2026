/**
 * Visual page editor runtime — wired by ../editor.js
 * Split from the former monolithic editor.js; behavior preserved.
 */
import { apiFetch } from '../lib/api.js';
import { deepClone, getByPath, setByPath, escapeHtml, pagesEqual } from '../lib/utils.js';
import {
  documentMetaPatch,
  readBridgeMessage,
  postToFrame as postToFrameWin,
} from '../lib/messaging.js';
import type { BridgeMessages, EditorMessages } from '../lib/messaging.js';
import {
  defaultSection,
  SECTION_FORM,
  LIST_SPECS,
  SKIP_LEAF,
  VARIANT_CTA,
  VARIANT_STRIP,
} from './catalog.js';
import { icon } from '../lib/icons.js';
import {
  humanizePath,
  editableLeafPaths,
  pathToFieldId,
  pathCoveredByLists,
} from './paths.js';
import { createVisualEditorFacade } from './facade.js';
import type { VisualEditorFacade } from './facade.js';
import { createMediaPicker, openMediaPickerModal } from './media-picker.js';
import { editorShellHtml } from './shell.js';
import { createHistory } from './history.js';
import { createFieldControls } from './field-controls.js';
import { createListEditor } from './list-editor.js';
import { createPreviewSync } from './preview-sync.js';
import { createPagePanels } from './page-panels.js';
import { bindStatus, bindStateChip } from '../lib/chrome.js';
import type { ChipState } from '../lib/chrome.js';
import { contentHash, getPageDraft, setPageDraft, listDraftPageIds } from '../lib/draft-store.js';
import type { PageMetadata, PageSection, SectionKind } from '../lib/content.js';
import type { DeviceMode, ImageTarget } from '../lib/facade.js';
import type { FieldDef } from './catalog.js';
import type {
  EditorBoot,
  EditorSession,
  InspectorTab,
  PageTab,
  SelectSectionOpts,
} from './session.js';

const META_KEYS = ['title', 'description', 'keywords', 'image'] as const;
type MetaKey = (typeof META_KEYS)[number];

/** Fields that only exist on some section kinds are read through this view. */
type LooseSection = Record<string, unknown> & { headline?: { lead?: string } };

function loose(section: PageSection): LooseSection {
  return section as unknown as LooseSection;
}

export function bootEditor() {
  const rootEl = document.getElementById('app');
  if (!rootEl) {
    console.error('[tb-editor] Missing #app root');
    return;
  }
  // Narrowed once: the hoisted function declarations below would otherwise see
  // the pre-guard `HTMLElement | null`.
  const root: HTMLElement = rootEl;
  let boot: EditorBoot | null;
  try {
    boot = JSON.parse(root.dataset.initial || 'null') as EditorBoot | null;
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

  /**
   * The session is assembled in three passes — initial state here, DOM refs
   * once the shell is mounted, then the factory methods via `Object.assign` —
   * so it is asserted into shape up front instead of being declared optional.
   * `satisfies` keeps this first pass checked against the real member types.
   */
  const s = {
    boot,
    liveUrl,
    slugPath,
    savedSnapshot: deepClone(boot.page),
    draft: deepClone(boot.page),
    dirty: false,
    selectedPath: null,
    inlineEditPath: null,
    selectedSection: 0,
    iframeWin: null,
    primary: 'inspector',
    inspectorTab: 'layers',
    pageTab: 'info',
    mediaPickerInstance: null,
    pendingInsertAt: null,
    pendingHighlight: null,
    pendingScroll: null,
    deviceMode: 'full',
    fieldEditCheckpointed: false,
    dragFromIndex: null,
    undoStack: [],
    redoStack: [],
    HISTORY_LIMIT: 50,
    historyCache: null,
    changesCache: null,
    previewPersistTimer: null,
  } satisfies Partial<EditorSession> as unknown as EditorSession;

  /** When true, the next preview `ready` highlight should scroll into view (URL deep link). */
  let deepLinkScroll = false;

  root.innerHTML = editorShellHtml({ boot, slugPath, icon });

  s.statusEl = document.getElementById('status');
  s.dirtyChip = document.getElementById('dirty-chip');
  s.saveBtn = document.getElementById('save') as HTMLButtonElement | null;
  s.undoBtn = document.getElementById('undo-btn') as HTMLButtonElement | null;
  s.redoBtn = document.getElementById('redo-btn') as HTMLButtonElement | null;
  s.sectionsEl = document.getElementById('sections');
  s.sectionFieldsEl = document.getElementById('section-fields');
  s.sectionHeadingEl = document.getElementById('section-heading');
  s.metaEl = document.getElementById('meta-fields');
  s.addKind = document.getElementById('add-kind') as HTMLSelectElement | null;
  s.insertKind = document.getElementById('insert-kind') as HTMLSelectElement | null;
  s.frame = document.getElementById('frame') as HTMLIFrameElement | null;
  s.previewFrame = document.getElementById('preview-frame');
  s.insertModal = document.getElementById('insert-modal');
  s.layersPane = document.getElementById('layers-pane');
  s.sectionPane = document.getElementById('section-pane');
  s.metaPane = document.getElementById('meta-pane');
  s.formPanel = document.getElementById('form-panel');
  s.pagePanel = document.getElementById('page-panel');
  s.mediaPanel = document.getElementById('media-panel');
  s.mediaMount = document.getElementById('media-mount');
  s.infoPane = document.getElementById('info-pane');
  s.historyPane = document.getElementById('history-pane');
  s.infoFieldsEl = document.getElementById('info-fields');
  s.historyFieldsEl = document.getElementById('history-fields');
  s.inspectorTitleEl = document.getElementById('inspector-title');
  s.pageTitleEl = document.getElementById('page-title');

  type PageListItem = { id: string; path: string; title?: string };
  let pageListCache: PageListItem[] | null = null;
  const pageSwitcherBtn = document.getElementById('page-switcher-btn') as HTMLButtonElement | null;
  const pageSwitcherMenu = document.getElementById('page-switcher-menu');
  const pageSwitcherList = document.getElementById('page-switcher-list');
  const pageSwitcherFilter = document.getElementById('page-switcher-filter') as HTMLInputElement | null;

  function closePageSwitcher() {
    if (!pageSwitcherMenu || !pageSwitcherBtn) return;
    pageSwitcherMenu.hidden = true;
    pageSwitcherBtn.setAttribute('aria-expanded', 'false');
  }

  function openPageSwitcher() {
    if (!pageSwitcherMenu || !pageSwitcherBtn) return;
    pageSwitcherMenu.hidden = false;
    pageSwitcherBtn.setAttribute('aria-expanded', 'true');
    void refreshPageSwitcherList();
    requestAnimationFrame(() => pageSwitcherFilter?.focus());
  }

  function navigateToPage(id: string) {
    if (!id || id === s.boot.id) {
      closePageSwitcher();
      return;
    }
    if (s.dirty) {
      const ok = confirm('You have unsaved changes. Leave this page without saving?');
      if (!ok) return;
    }
    window.location.href = `/admin/pages/${encodeURIComponent(id)}`;
  }

  function renderPageSwitcherList(pages: PageListItem[], draftIds: Set<string>, query = '') {
    if (!pageSwitcherList) return;
    const q = query.trim().toLowerCase();
    const filtered = q
      ? pages.filter((p) => {
          const hay = `${p.id} ${p.path} ${p.title || ''}`.toLowerCase();
          return hay.includes(q);
        })
      : pages;

    if (!filtered.length) {
      pageSwitcherList.innerHTML = `<p class="hint">${q ? 'No matching pages.' : 'No pages found.'}</p>`;
      return;
    }

    pageSwitcherList.innerHTML = filtered
      .map((p) => {
        const current = p.id === s.boot.id;
        const draft = draftIds.has(p.id);
        const title =
          p.title && p.title !== p.id
            ? `<span class="page-switcher-item-title">${escapeHtml(p.title)}</span>`
            : '';
        return `<button type="button" class="page-switcher-item" role="option" data-page-id="${escapeHtml(p.id)}" aria-current="${current ? 'page' : 'false'}">
          <span class="page-switcher-item-meta">
            <span class="page-switcher-item-id">${escapeHtml(p.id)}</span>
            <span class="page-switcher-item-path">${escapeHtml(p.path || '/')}</span>
            ${title}
          </span>
          ${draft ? '<span class="page-switcher-draft">Draft</span>' : ''}
        </button>`;
      })
      .join('');
  }

  async function refreshPageSwitcherList() {
    if (!pageSwitcherList) return;
    try {
      if (!pageListCache) {
        pageSwitcherList.innerHTML = '<p class="hint">Loading…</p>';
        const data = await apiFetch<{ pages: PageListItem[] }>('/api/admin/pages', {
          errorMessage: 'Failed to load pages',
        });
        pageListCache = Array.isArray(data.pages) ? data.pages : [];
        pageListCache.sort((a, b) => a.id.localeCompare(b.id));
      }
      const draftIds = new Set(await listDraftPageIds());
      renderPageSwitcherList(pageListCache, draftIds, pageSwitcherFilter?.value || '');
    } catch (err) {
      pageSwitcherList.innerHTML = `<p class="hint">${escapeHtml(err instanceof Error ? err.message : String(err))}</p>`;
    }
  }

  pageSwitcherBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (pageSwitcherMenu?.hidden === false) closePageSwitcher();
    else openPageSwitcher();
  });

  pageSwitcherFilter?.addEventListener('input', () => {
    if (!pageListCache) return;
    void listDraftPageIds().then((ids) => {
      renderPageSwitcherList(pageListCache || [], new Set(ids), pageSwitcherFilter.value);
    });
  });

  pageSwitcherList?.addEventListener('click', (e) => {
    const btn = e.target instanceof Element ? e.target.closest('[data-page-id]') : null;
    if (!(btn instanceof HTMLElement)) return;
    const id = btn.getAttribute('data-page-id');
    if (id) navigateToPage(id);
  });

  document.addEventListener('click', (e) => {
    if (!pageSwitcherMenu || pageSwitcherMenu.hidden) return;
    const t = e.target;
    if (t instanceof Node && document.getElementById('page-switcher')?.contains(t)) return;
    closePageSwitcher();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pageSwitcherMenu && !pageSwitcherMenu.hidden) {
      closePageSwitcher();
      pageSwitcherBtn?.focus();
    }
  });

  boot.sectionKinds.forEach((kind) => {
    for (const sel of [s.addKind, s.insertKind]) {
      const opt = document.createElement('option');
      opt.value = kind;
      opt.textContent = kind;
      sel?.appendChild(opt);
    }
  });

  Object.assign(s, createHistory(s));
  Object.assign(s, createPreviewSync(s));
  Object.assign(s, createFieldControls(s));
  Object.assign(s, createListEditor(s));
  Object.assign(s, createPagePanels(s));

  const {
    syncHistoryButtons,
    checkpoint,
    undo,
    redo,
    persistPreview,
    reloadPreview,
    restorePreviewAfterReady,
    clearPreviewPersistTimer,
    persistDraftLocal,
    applyLiveStructural,
    appendFieldControl,
    applyCloudinaryAsset,
    mountImageUrlField,
    bindLiveInput,
    focusFieldInForm,
    highlightFieldInForm,
    renderListEditor,
    refreshInfoPane,
    syncInfoEditStatus,
    refreshHistoryPanel,
  } = s;

  s.baseHash = contentHash(boot.page);
  s.publishedSnapshot = deepClone(boot.page);

  const setStatus = bindStatus(s.statusEl, { baseClass: 'status-line' });
  s.setStatus = setStatus;

  // Hydrate IndexedDB draft over the SSR baseline when present.
  void (async () => {
    try {
      const rec = await getPageDraft(boot.id);
      if (!rec?.page) return;
      if (pagesEqual(rec.page, s.draft)) return;
      s.draft = deepClone(rec.page);
      s.savedSnapshot = deepClone(rec.page);
      s.dirty = !pagesEqual(s.draft, s.publishedSnapshot);
      refreshChromeState(s.dirty ? 'dirty' : 'saved');
      setStatus('Restored local draft · Publish from Changes when ready', 'ok');
      renderSections();
      renderMeta();
      persistPreview(s.selectedSection, 'Applying local draft to preview…');
    } catch (err) {
      console.warn('[draft-hydrate]', err);
    }
  })();

  function syncActionButtons() {
    s.dirty = !pagesEqual(s.draft, s.savedSnapshot);
    if (s.saveBtn) s.saveBtn.disabled = !s.dirty;
  }

  const setChipBase = bindStateChip(s.dirtyChip);
  function setDirtyChip(state: ChipState) {
    setChipBase(state);
    syncInfoEditStatus();
  }

  function refreshChromeState(chipState?: ChipState) {
    syncActionButtons();
    syncHistoryButtons();
    if (chipState) {
      setDirtyChip(chipState);
      return;
    }
    setDirtyChip(s.dirty ? 'dirty' : 'saved');
  }
  s.refreshChromeState = refreshChromeState;

  function markDirty() {
    refreshChromeState('dirty');
    setStatus('Unsaved changes · Save draft, then publish from Changes');
    clearTimeout(s.draftAutosaveTimer);
    s.draftAutosaveTimer = setTimeout(() => {
      void persistDraftLocal();
    }, 400);
  }
  s.markDirty = markDirty;

  function postToFrame<K extends keyof EditorMessages>(type: K, payload: EditorMessages[K]) {
    const win = s.iframeWin || s.frame?.contentWindow;
    postToFrameWin(win, type, payload);
  }
  s.postToFrame = postToFrame;

  function pingFrame() {
    s.iframeWin = s.frame?.contentWindow ?? null;
    postToFrame('ping', {});
    syncBridgeMeta();
  }

  function syncBridgeMeta() {
    postToFrame('setSectionMeta', {
      kinds: s.draft.sections.map((sec) => sec.kind),
      selectedSection: s.selectedSection,
      selectedPath: s.selectedPath,
    });
  }

  function selectSection(index: number, opts: SelectSectionOpts = {}) {
    if (index < 0 || index >= s.draft.sections.length) return;
    s.selectedSection = index;
    if (!opts.keepPath) s.selectedPath = null;
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
    s.mediaPickerInstance?.syncInsertTarget?.();
  }
  s.selectSection = selectSection;

  function moveSection(from: number, to: number) {
    if (to < 0 || to >= s.draft.sections.length) return;
    if (from === to) return;
    checkpoint();
    const [item] = s.draft.sections.splice(from, 1);
    s.draft.sections.splice(to, 0, item);
    s.selectedSection = to;
    markDirty();
    renderSections();
    void applyLiveStructural('move', {
      from,
      to,
      highlightIndex: to,
      statusMsg: `Moved ${from + 1} → ${to + 1}`,
    }).then((ok) => {
      if (!ok) persistPreview(to, 'Updating preview…');
    });
  }
  s.moveSection = moveSection;

  function duplicateSection(index: number) {
    const section = s.draft.sections[index];
    if (!section) return;
    checkpoint();
    s.draft.sections.splice(index + 1, 0, deepClone(section));
    s.selectedSection = index + 1;
    markDirty();
    renderSections();
    void applyLiveStructural('insert', {
      sectionIndex: index + 1,
      highlightIndex: index + 1,
      statusMsg: `Duplicated ${section.kind.replace(/-/g, ' ')}`,
    }).then((ok) => {
      if (!ok) persistPreview(s.selectedSection, 'Updating preview…');
    });
  }
  s.duplicateSection = duplicateSection;

  function deleteSection(index: number) {
    const section = s.draft.sections[index];
    if (!section) return;
    if (!confirm(`Delete section ${index} (${section.kind})?`)) return;
    checkpoint();
    s.draft.sections.splice(index, 1);
    s.selectedSection = Math.max(0, Math.min(index, s.draft.sections.length - 1));
    markDirty();
    renderSections();
    void applyLiveStructural('remove', {
      index,
      highlightIndex: s.selectedSection,
      statusMsg: `Deleted ${section.kind.replace(/-/g, ' ')}`,
    }).then((ok) => {
      if (!ok) persistPreview(s.selectedSection, 'Updating preview…');
    });
  }
  s.deleteSection = deleteSection;

  function insertSectionAt(index: number, kind: SectionKind) {
    const clamped = Math.max(0, Math.min(index, s.draft.sections.length));
    checkpoint();
    s.draft.sections.splice(clamped, 0, defaultSection(kind));
    markDirty();
    selectSection(clamped, { openSectionTab: false });
    void applyLiveStructural('insert', {
      sectionIndex: clamped,
      highlightIndex: clamped,
      statusMsg: `Added ${kind.replace(/-/g, ' ')} at position ${clamped + 1}`,
    }).then((ok) => {
      if (!ok) persistPreview(clamped, `Adding “${kind}” to preview…`);
    });
  }
  s.insertSectionAt = insertSectionAt;

  function openInsertModal(atIndex: number) {
    s.pendingInsertAt = atIndex;
    const hint = document.getElementById('insert-hint');
    if (hint) {
      hint.textContent =
        atIndex >= s.draft.sections.length
          ? `Append a block at the end.`
          : `Insert a block before section ${atIndex}.`;
    }
    if (s.insertModal) s.insertModal.hidden = false;
    s.insertKind?.focus();
  }

  function closeInsertModal() {
    s.pendingInsertAt = null;
    if (s.insertModal) s.insertModal.hidden = true;
  }

  function renderMeta() {
    if (!s.metaEl) return;
    s.metaEl.innerHTML = '';
    const labels: Record<MetaKey, string> = {
      title: 'Title',
      description: 'Description',
      keywords: 'Keywords',
      image: 'Social image',
    };
    for (const key of META_KEYS) {
      const val = s.draft.metadata?.[key] ?? '';
      const wrap = document.createElement('div');
      wrap.className = 'field';
      wrap.innerHTML = `<label>${labels[key]}<span class="field-path">metadata.${key}</span></label>`;
      if (key === 'image') {
        mountImageUrlField(wrap, 'metadata.image', val);
        const input = wrap.querySelector('input');
        if (input) {
          input.addEventListener('focus', () => {
            s.fieldEditCheckpointed = false;
          });
          input.addEventListener('input', () => {
            if (!s.fieldEditCheckpointed) {
              checkpoint();
              s.fieldEditCheckpointed = true;
            }
            if (!s.draft.metadata) s.draft.metadata = {} as PageMetadata;
            s.draft.metadata.image = input.value;
            markDirty();
          });
        }
      } else {
        const input = document.createElement(key === 'description' ? 'textarea' : 'input');
        input.value = val;
        input.addEventListener('focus', () => {
          s.fieldEditCheckpointed = false;
        });
        input.addEventListener('input', () => {
          if (!s.fieldEditCheckpointed) {
            checkpoint();
            s.fieldEditCheckpointed = true;
          }
          if (!s.draft.metadata) s.draft.metadata = {} as PageMetadata;
          s.draft.metadata[key] = input.value;
          markDirty();
        });
        wrap.appendChild(input);
      }
      s.metaEl.appendChild(wrap);
    }
  }
  s.renderMeta = renderMeta;

  function sectionLayerLabel(section: PageSection): string | null {
    const raw = loose(section).title;
    const title = typeof raw === 'string' ? raw.trim() : '';
    return title || null;
  }

  /** Context chip payload for the agent composer (not stuffed into the textarea). */
  function sectionAgentContext(section: PageSection, index: number) {
    const n = String(index).padStart(2, '0');
    const bits: string[] = [];
    const fields = loose(section);
    if (typeof fields.title === 'string' && fields.title.trim()) {
      bits.push(`title “${fields.title.trim()}”`);
    }
    if (typeof fields.eyebrow === 'string' && fields.eyebrow.trim()) {
      bits.push(`eyebrow “${fields.eyebrow.trim()}”`);
    }
    if (typeof fields.source === 'string' && fields.source.trim()) {
      const lim = fields.limit != null ? ` · limit ${fields.limit}` : '';
      bits.push(`source ${fields.source}${lim}`);
    }
    const lead =
      fields.headline?.lead ||
      (typeof fields.lede === 'string' ? fields.lede : '') ||
      (typeof fields.text === 'string' ? fields.text : '');
    if (typeof lead === 'string' && lead.trim()) {
      bits.push(`lead “${lead.trim().slice(0, 100)}${lead.trim().length > 100 ? '…' : ''}”`);
    }

    const body = [
      `I'm editing section ${n} (index ${index}): ${section.kind}.`,
      `Use tools against sections.${index} (get_section / set_field / patch_section).`,
      bits.length ? `Currently: ${bits.join(' · ')}.` : '',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      label: `Section ${n} · ${section.kind}`,
      detail: bits.join(' · '),
      body,
    };
  }

  function askAgentAboutSection(index: number) {
    const section = s.draft.sections[index];
    if (!section) return;
    const agent = window.__tbAgent;
    if (!agent?.setContext && !agent?.draftPrompt) {
      setStatus('Agent is not available — set OPENAI_API_KEY on the server.', 'error');
      return;
    }
    const ctx = sectionAgentContext(section, index);
    if (agent?.setContext) agent.setContext(ctx);
    else agent?.draftPrompt(ctx.body);
  }

  function renderSections() {
    if (!s.sectionsEl) return;
    s.sectionsEl.innerHTML = '';
    s.draft.sections.forEach((section, i) => {
      const li = document.createElement('li');
      li.draggable = true;
      li.dataset.index = String(i);
      if (i === s.selectedSection) li.classList.add('active');
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
        const target = e.target;
        if (!(target instanceof Element)) return;
        if (target.closest('button') || target.closest('.drag-handle')) return;
        selectSection(i);
      });
      li.addEventListener('dragstart', (e) => {
        s.dragFromIndex = i;
        li.classList.add('is-dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', String(i));
        }
      });
      li.addEventListener('dragend', () => {
        s.dragFromIndex = null;
        li.classList.remove('is-dragging');
        s.sectionsEl
          ?.querySelectorAll('.drag-over')
          .forEach((el) => el.classList.remove('drag-over'));
      });
      li.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        s.sectionsEl
          ?.querySelectorAll('.drag-over')
          .forEach((el) => el.classList.remove('drag-over'));
        li.classList.add('drag-over');
      });
      li.addEventListener('dragleave', () => {
        li.classList.remove('drag-over');
      });
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        li.classList.remove('drag-over');
        const from = s.dragFromIndex ?? Number(e.dataTransfer?.getData('text/plain'));
        const to = i;
        if (!Number.isFinite(from) || from === to) return;
        moveSection(from, to);
      });
      li.querySelector('[data-up]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        moveSection(i, i - 1);
      });
      li.querySelector('[data-down]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        moveSection(i, i + 1);
      });
      li.querySelector('[data-dup]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        duplicateSection(i);
      });
      li.querySelector('[data-del]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSection(i);
      });
      s.sectionsEl?.appendChild(li);
    });
  }
  s.renderSections = renderSections;

  function fieldMatchesShowWhen(def: FieldDef, section: PageSection): boolean {
    if (!def.showWhen || typeof def.showWhen !== 'object') return true;
    return Object.entries(def.showWhen).every(([key, allowed]) => {
      const current = loose(section)?.[key];
      const list = Array.isArray(allowed) ? allowed : [allowed];
      return (list as unknown[]).includes(current);
    });
  }

  function renderSectionFields(index: number, focusPath?: string | null) {
    const section = s.draft.sections[index];
    if (!s.sectionHeadingEl || !s.sectionFieldsEl) return;
    if (!section) {
      s.sectionHeadingEl.innerHTML = '';
      s.sectionFieldsEl.innerHTML = '<p class="hint">No section selected.</p>';
      return;
    }
    s.sectionHeadingEl.innerHTML = `
      <p class="label">Section ${String(index).padStart(2, '0')}</p>
      <div class="section-heading-row">
        <h3>${section.kind}</h3>
        <button type="button" class="section-ai-btn" data-ask-agent title="Ask agent about this section" aria-label="Ask agent about this section">
          ${icon('agent', 'icon icon-sm')}
        </button>
      </div>
    `;
    s.sectionHeadingEl.querySelector('[data-ask-agent]')?.addEventListener('click', () => {
      askAgentAboutSection(index);
    });
    s.sectionFieldsEl.innerHTML = '';

    const form = SECTION_FORM[section.kind] || { fields: [] };
    const covered = new Set<string>();

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
        if (!fieldMatchesShowWhen(def, section)) {
          covered.add(`sections.${index}.${def.key}`);
          return;
        }
        covered.add(`sections.${index}.${def.key}`);
        appendFieldControl(body, `sections.${index}.${def.key}`, def, { group: 'query' });
      });
      group.appendChild(body);
      s.sectionFieldsEl.appendChild(group);
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
        appendFieldControl(body, `sections.${index}.${def.key}`, def);
      });
      group.appendChild(body);
      s.sectionFieldsEl.appendChild(group);
    }

    const listSpecs = LIST_SPECS[section.kind] || [];
    listSpecs.forEach((spec) => {
      if (s.sectionFieldsEl) renderListEditor(s.sectionFieldsEl, index, spec);
    });

    const extraPaths = editableLeafPaths(section, `sections.${index}`).filter((p) => {
      if (SKIP_LEAF.test(p)) return false;
      if (/\.variant$/.test(p)) return false;
      if (pathCoveredByLists(p, index, section.kind)) return false;
      for (const key of covered) {
        if (p === key || p.startsWith(`${key}.`)) return false;
      }
      const val = getByPath(s.draft, p);
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
        const val = getByPath(s.draft, path);
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
        appendFieldControl(body, path, {
          key: path.replace(`sections.${index}.`, ''),
          type: 'select',
          options,
          label: humanizePath(path, index).label,
        });
      });
      group.appendChild(body);
      s.sectionFieldsEl.appendChild(group);
    }

    if (!s.sectionFieldsEl.children.length) {
      s.sectionFieldsEl.innerHTML = '<p class="hint">No editable fields for this section.</p>';
    }

    if (focusPath) {
      requestAnimationFrame(() => focusFieldInForm(focusPath));
    } else if (s.selectedPath && s.selectedPath.startsWith(`sections.${index}.`)) {
      requestAnimationFrame(() => focusFieldInForm(s.selectedPath));
    }
  }
  s.renderSectionFields = renderSectionFields;

  let imagePickerOpen = false;

  async function openImagePickerForPath(path: string) {
    if (!path || imagePickerOpen) return;
    imagePickerOpen = true;
    s.setStatus('Opening media library…');
    try {
      const asset = await openMediaPickerModal({
        setStatus: s.setStatus,
        getInsertTarget: () => ({ path, label: path }),
      });
      if (!asset) {
        s.setStatus('No image selected');
        return;
      }
      applyCloudinaryAsset(path, asset);
      const match = path.match(/^sections\.(\d+)/);
      if (match) renderSectionFields(Number(match[1]), path);
      else if (path.startsWith('metadata.')) renderMeta();
      s.setStatus('Image selected', 'ok');
    } catch (err) {
      s.setStatus(err instanceof Error ? err.message : String(err), 'error');
    } finally {
      imagePickerOpen = false;
    }
  }

  function handlePreviewSelect(payload: Partial<BridgeMessages['select']>) {
    const sectionIndex =
      typeof payload.sectionIndex === 'number'
        ? payload.sectionIndex
        : Number(String(payload.path || '').match(/^sections\.(\d+)/)?.[1]);
    if (Number.isFinite(sectionIndex)) {
      s.selectedSection = sectionIndex;
    }
    s.selectedPath = payload.path || null;
    renderSections();
    renderSectionFields(s.selectedSection, s.selectedPath);
    openInspector('section');
    if (s.selectedPath) {
      focusFieldInForm(s.selectedPath);
    }
    syncBridgeMeta();
  }

  const INSPECTOR_TITLES: Record<InspectorTab, string> = {
    layers: 'Layers',
    section: 'Section',
    meta: 'Meta',
  };
  const PAGE_TITLES: Record<PageTab, string> = { info: 'Info', history: 'History' };

  function syncPrimaryChrome() {
    root.classList.toggle('primary-collapsed', s.primary == null);
    root.dataset.primary = s.primary || '';

    if (s.formPanel) s.formPanel.hidden = s.primary !== 'inspector';
    if (s.pagePanel) s.pagePanel.hidden = s.primary !== 'page';
    if (s.mediaPanel) s.mediaPanel.hidden = s.primary !== 'media';

    if (s.primary === 'inspector') {
      if (s.inspectorTitleEl) {
        s.inspectorTitleEl.textContent = INSPECTOR_TITLES[s.inspectorTab] || 'Inspector';
      }
      if (s.layersPane) s.layersPane.hidden = s.inspectorTab !== 'layers';
      if (s.sectionPane) s.sectionPane.hidden = s.inspectorTab !== 'section';
      if (s.metaPane) s.metaPane.hidden = s.inspectorTab !== 'meta';
    }

    if (s.primary === 'page') {
      if (s.pageTitleEl) s.pageTitleEl.textContent = PAGE_TITLES[s.pageTab] || 'Page';
      if (s.infoPane) s.infoPane.hidden = s.pageTab !== 'info';
      if (s.historyPane) s.historyPane.hidden = s.pageTab !== 'history';
    }

    if (s.primary === 'media') {
      ensureMediaPicker();
      s.mediaPickerInstance?.syncInsertTarget?.();
    }

    document.querySelectorAll<HTMLElement>('.rail-toggle[data-primary]').forEach((btn) => {
      const match =
        s.primary === btn.dataset.primary &&
        ((s.primary === 'inspector' && btn.dataset.tab === s.inspectorTab) ||
          (s.primary === 'page' && btn.dataset.tab === s.pageTab) ||
          (s.primary === 'media' && btn.dataset.tab === 'library'));
      btn.setAttribute('aria-pressed', String(match));
    });
  }

  function getMediaInsertTarget(): ImageTarget | null {
    // The editor installs the richer facade; the shared type omits this method.
    const api = window.__tbVisualEditor as VisualEditorFacade | undefined;
    return api?.resolveImageTarget?.() || null;
  }
  s.getMediaInsertTarget = getMediaInsertTarget;

  function ensureMediaPicker() {
    if (s.mediaPickerInstance || !s.mediaMount) return;
    s.mediaPickerInstance = createMediaPicker({
      mount: s.mediaMount,
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
    s.mediaPickerInstance.refresh();
  }

  function openInspector(tab: InspectorTab) {
    s.inspectorTab = tab;
    s.primary = 'inspector';
    syncPrimaryChrome();
  }

  function openPage(tab: PageTab) {
    s.pageTab = tab;
    s.primary = 'page';
    syncPrimaryChrome();
    if (tab === 'info') refreshInfoPane();
    if (tab === 'history') refreshHistoryPanel();
  }

  function openMedia() {
    s.primary = 'media';
    syncPrimaryChrome();
  }

  function closePrimary() {
    s.primary = null;
    syncPrimaryChrome();
  }

  function togglePrimary(kind: string | undefined, tab: string | undefined) {
    if (kind === 'inspector') {
      if (s.primary === 'inspector' && s.inspectorTab === tab) closePrimary();
      else openInspector(tab as InspectorTab);
      return;
    }
    if (kind === 'page') {
      if (s.primary === 'page' && s.pageTab === tab) closePrimary();
      else openPage(tab as PageTab);
      return;
    }
    if (kind === 'media') {
      if (s.primary === 'media') closePrimary();
      else openMedia();
    }
  }

  function setDevice(mode: DeviceMode) {
    s.deviceMode = mode;
    s.previewFrame?.classList.remove('is-desktop', 'is-mobile', 'is-full');
    s.previewFrame?.classList.add(`is-${mode}`);
    document.querySelectorAll<HTMLElement>('.devices [data-device]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.device === mode);
    });
  }
  s.setDevice = setDevice;

  document.querySelectorAll<HTMLElement>('.rail-toggle[data-primary]').forEach((btn) => {
    btn.addEventListener('click', () => {
      togglePrimary(btn.dataset.primary, btn.dataset.tab);
    });
  });

  document.getElementById('toggle-agent')?.addEventListener('click', () => {
    setAgentOpen(!root.classList.contains('agent-open'));
  });

  document.querySelectorAll<HTMLElement>('.devices [data-device]').forEach((btn) => {
    btn.addEventListener('click', () => setDevice(btn.dataset.device as DeviceMode));
  });

  document.getElementById('add-section')?.addEventListener('click', () => {
    if (!s.addKind) return;
    insertSectionAt(s.draft.sections.length, s.addKind.value as SectionKind);
  });

  document.getElementById('insert-cancel')?.addEventListener('click', closeInsertModal);
  document.getElementById('insert-confirm')?.addEventListener('click', () => {
    if (s.pendingInsertAt == null) return;
    const at = s.pendingInsertAt;
    const kind = s.insertKind?.value as SectionKind;
    closeInsertModal();
    insertSectionAt(at, kind);
  });
  s.insertModal?.addEventListener('click', (e) => {
    if (e.target === s.insertModal) closeInsertModal();
  });

  async function saveDraft() {
    if (s.saveBtn?.disabled) return;
    if (s.saveBtn) s.saveBtn.disabled = true;
    setDirtyChip('saving');
    setStatus('Saving draft…');
    try {
      await setPageDraft(s.boot.id, s.draft, {
        baseHash: s.baseHash || contentHash(s.publishedSnapshot),
      });
      // Keep server preview draft warm for SSR fallback / section-html.
      await apiFetch(`/api/admin/pages/${s.boot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: s.draft, mode: 'preview' }),
        errorMessage: 'Draft stage failed',
      }).catch(() => undefined);
      s.savedSnapshot = deepClone(s.draft);
      s.dirty = false;
      s.undoStack.length = 0;
      s.redoStack.length = 0;
      s.historyCache = null;
      s.changesCache = null;
      refreshChromeState('saved');
      setStatus('Draft saved locally · Publish from Changes', 'ok');
      if (s.primary === 'page' && s.pageTab === 'info') refreshInfoPane();
    } catch (err) {
      refreshChromeState('error');
      setStatus((err instanceof Error ? err.message : '') || String(err), 'error');
    }
  }
  s.saveDraft = saveDraft;
  s.saveToCms = saveDraft;

  s.saveBtn?.addEventListener('click', () => {
    saveDraft();
  });
  s.undoBtn?.addEventListener('click', () => undo());
  s.redoBtn?.addEventListener('click', () => redo());

  window.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod && e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      const t = e.target;
      if (
        t instanceof HTMLInputElement &&
        s.selectedPath &&
        t.id === pathToFieldId(s.selectedPath) &&
        !s.inlineEditPath
      ) {
        e.preventDefault();
        s.postToFrame('startInlineEdit', { path: s.selectedPath });
        return;
      }
    }
    if (!mod) return;
    const key = e.key.toLowerCase();
    if (key === 's') {
      e.preventDefault();
      if (e.shiftKey) {
        window.location.href = '/admin/changes';
      } else {
        saveDraft();
      }
      return;
    }
    if (key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
  });

  s.frame?.addEventListener('load', () => {
    s.iframeWin = s.frame?.contentWindow ?? null;
    setTimeout(pingFrame, 50);
    setTimeout(pingFrame, 250);
    setTimeout(pingFrame, 800);
  });

  window.addEventListener('message', (e) => {
    const data = readBridgeMessage(e);
    if (!data) return;
    if (data.type === 'ready') {
      s.iframeWin = s.frame?.contentWindow ?? null;
      setStatus(
        `Preview ready · ${data.payload?.count ?? 0} fields · ${s.draft.sections.length} blocks`,
        'ok',
      );
      syncBridgeMeta();
      if (s.pendingHighlight != null || s.pendingScroll) {
        restorePreviewAfterReady();
      } else {
        postToFrame('highlightSection', {
          index: s.selectedSection,
          path: s.selectedPath,
          scroll: deepLinkScroll,
        });
        deepLinkScroll = false;
      }
      return;
    }
    if (data.type === 'select') {
      handlePreviewSelect(data.payload || {});
      return;
    }
    if (data.type === 'pickImage') {
      const path = data.payload?.path;
      if (!path) return;
      // Keep inspector in sync even if select raced ahead.
      if (typeof data.payload?.sectionIndex === 'number') {
        s.selectedSection = data.payload.sectionIndex;
      }
      s.selectedPath = path;
      renderSectionFields(s.selectedSection, path);
      openInspector('section');
      focusFieldInForm(path);
      void openImagePickerForPath(path);
      return;
    }
    if (data.type === 'inlineStart') {
      const path = data.payload?.path;
      if (!path) return;
      const sectionIndex = Number(data.payload?.sectionIndex);
      if (Number.isFinite(sectionIndex)) s.selectedSection = sectionIndex;
      s.selectedPath = path;
      s.inlineEditPath = path;
      s.fieldEditCheckpointed = false;
      renderSections();
      renderSectionFields(s.selectedSection, s.selectedPath);
      openInspector('section');
      // Highlight the form field but keep focus in the preview for typing.
      highlightFieldInForm(path);
      syncBridgeMeta();
      return;
    }
    if (data.type === 'inlineInput') {
      const path = data.payload?.path;
      if (!path) return;
      const value = data.payload?.value ?? '';
      if (!s.fieldEditCheckpointed) {
        s.checkpoint();
        s.fieldEditCheckpointed = true;
      }
      s.inlineEditPath = path;
      setByPath(s.draft, path, value);
      s.markDirty();
      s.selectedPath = path;
      const input = document.getElementById(pathToFieldId(path));
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
        if (input.value !== value) input.value = value;
      }
      highlightFieldInForm(path);
      if (/^sections\.\d+\.title$/.test(path)) renderSections();
      return;
    }
    if (data.type === 'inlineEnd') {
      if (!data.payload?.path || s.inlineEditPath === data.payload.path) {
        s.inlineEditPath = null;
      }
      s.fieldEditCheckpointed = false;
      return;
    }
    if (data.type === 'blockAction') {
      const { action, sectionIndex } =
        data.payload || ({} as Partial<BridgeMessages['blockAction']>);
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
      return;
    }
    if (data.type === 'addListItem') {
      const sectionIndex = Number(data.payload?.sectionIndex);
      const listKey = String(data.payload?.listKey || '').trim();
      if (!Number.isFinite(sectionIndex) || !listKey) return;
      void (async () => {
        try {
          const api = window.__tbVisualEditor as VisualEditorFacade | undefined;
          const result = await api?.addListItem({
            sectionIndex,
            listKey,
          });
          const index =
            result && typeof result === 'object' && 'index' in result
              ? Number((result as { index: number }).index)
              : NaN;
          if (!Number.isFinite(index)) return;
          const focusPath = `sections.${sectionIndex}.${listKey}.${index}.label`;
          selectSection(sectionIndex, {
            keepPath: true,
            focusPath,
            scroll: true,
          });
        } catch (err) {
          setStatus(err instanceof Error ? err.message : String(err), 'error');
        }
      })();
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (s.dirty) {
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
      chip.className = 'webmcp-chip';
      s.statusEl?.appendChild(chip);
    }
    const info = window.__tbWebMcp;
    if (!info) {
      chip.textContent = 'Connecting WebMCP…';
      chip.classList.remove('ok', 'error');
      chip.title = 'Waiting for the browser modelContext API so Cursor can drive this editor.';
      return;
    }
    if (info.ready) {
      const names = info.toolNames || [];
      const shown = names.slice(0, 8).join(', ');
      const extra = names.length > 8 ? ` +${names.length - 8} more` : '';
      const hosts = (info.contexts || []).map((c) => c.label).join(', ') || 'the browser';
      chip.textContent = `WebMCP on · ${info.tools} tools`;
      chip.classList.add('ok');
      chip.classList.remove('error');
      chip.title = `This page registered ${info.tools} editing tools on ${hosts}${shown ? `: ${shown}${extra}` : ''}.`;
    } else {
      chip.textContent = 'WebMCP off';
      chip.classList.add('error');
      chip.classList.remove('ok');
      chip.title =
        (info.errors || []).join(' · ') ||
        'No modelContext API in this browser — enable WebMCP in Chrome/Cursor to drive the editor.';
    }
  }

  function setAgentOpen(open: boolean) {
    const panel = document.getElementById('agent-panel');
    const btn = document.getElementById('toggle-agent');
    if (!panel || !btn || btn.closest<HTMLElement>('#agent-rail-group')?.hidden) return;
    root.classList.toggle('agent-open', open);
    btn.setAttribute('aria-pressed', String(open));
    window.dispatchEvent(new CustomEvent('tb-agent-open', { detail: { open } }));
  }
  s.setAgentOpen = setAgentOpen;

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
    openInspector,
    openPage,
    openMedia,
    closePrimary,
    openPanel(panel) {
      const name = String(panel || '').toLowerCase();
      if (name === 'media') openMedia();
      else if (name === 'info' || name === 'page') openPage('info');
      else if (name === 'history') openPage('history');
      else openInspector((name === 'inspector' ? 'section' : name || 'section') as InspectorTab);
      return { panel: name || 'section' };
    },
  };

  function refreshAfterStructural(highlightIndex?: number | null) {
    renderSections();
    renderSectionFields(highlightIndex ?? s.selectedSection);
    renderMeta();
    markDirty();
    return persistPreview(highlightIndex ?? s.selectedSection, 'Preview updated');
  }
  s.refreshAfterStructural = refreshAfterStructural;

  function applyLiveLeaf(path: string, value: unknown) {
    const str = value == null ? '' : String(value);
    setByPath(s.draft, path, typeof value === 'number' || typeof value === 'boolean' ? value : str);
    if (path.startsWith('metadata.')) {
      const patch = documentMetaPatch(path.slice('metadata.'.length), str);
      if (patch) postToFrame('setDocumentMeta', patch);
    } else if (/\.(src|href)$/.test(path)) {
      postToFrame('setAttr', { path, attr: path.endsWith('.src') ? 'src' : 'href', value: str });
    } else {
      postToFrame('setText', { path, value: str });
    }
    markDirty();
    const input = document.getElementById(pathToFieldId(path));
    if (input && 'value' in input) input.value = str;
  }
  s.applyLiveLeaf = applyLiveLeaf;

  s.setByPath = setByPath;
  s.getByPath = getByPath;
  s.clearPreviewPersistTimer = clearPreviewPersistTimer;

  window.__tbVisualEditor = createVisualEditorFacade(s);

  /** Honor ?section=&path=&addList= from live-site hover CTAs. */
  {
    const params = new URLSearchParams(location.search);
    const path = params.get('path');
    const addList = params.get('addList');
    let index = Number(params.get('section'));
    if (!Number.isFinite(index) && path) {
      const m = path.match(/^sections\.(\d+)/);
      if (m) index = Number(m[1]);
    }
    if (Number.isFinite(index) && index >= 0 && index < s.draft.sections.length) {
      deepLinkScroll = true;
      if (path && !addList) s.selectedPath = path;
      selectSection(index, {
        keepPath: Boolean(path) && !addList,
        focusPath: addList ? null : path,
        scroll: true,
      });

      if (addList) {
        const listKey = addList.trim();
        void (async () => {
          try {
            const api = window.__tbVisualEditor as VisualEditorFacade | undefined;
            const result = await api?.addListItem({
              sectionIndex: index,
              listKey,
            });
            const itemIndex =
              result && typeof result === 'object' && 'index' in result
                ? Number((result as { index: number }).index)
                : NaN;
            if (Number.isFinite(itemIndex)) {
              const focusPath = `sections.${index}.${listKey}.${itemIndex}.label`;
              selectSection(index, {
                keepPath: true,
                focusPath,
                scroll: true,
              });
            }
          } catch (err) {
            setStatus(err instanceof Error ? err.message : String(err), 'error');
          } finally {
            const clean = new URL(location.href);
            clean.searchParams.delete('addList');
            history.replaceState(null, '', clean.pathname + clean.search);
          }
        })();
      }
    }
  }

  window.dispatchEvent(new CustomEvent('tb-visual-editor-ready', { detail: { pageId: boot.id } }));
  syncWebMcpChip();
  window.addEventListener('tb-webmcp-ready', syncWebMcpChip);
  setTimeout(syncWebMcpChip, 100);
  setTimeout(syncWebMcpChip, 500);
}
