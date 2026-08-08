/**
 * The visual editor session.
 *
 * `bootEditor()` creates one mutable object and hands it to every editor factory
 * (`createHistory(s)`, `createFieldControls(s)`, …). Each factory closes over it
 * and returns a bag of methods that is merged straight back on, so this type is
 * the union of everything any editor module reads off `s`. Factories declare
 * their slice with `Pick<EditorSession, …>` so the merged surface stays honest.
 */
import type { ChipState, SetStatus } from '../lib/chrome.js';
import type {
  PageData,
  PageSection,
  SectionKind,
  SiteChrome,
} from '../lib/content.js';
import type { DeviceMode, ImageTarget } from '../lib/facade.js';
import type { EditorMessages } from '../lib/messaging.js';
import type { FieldDef, FieldOption, ListSpec } from './catalog.js';
import type { CloudinaryInsertAsset, MediaPicker } from './media-picker.js';

export interface SelectOption {
  value: string;
  label: string;
}

/** `#app[data-initial]`, written by src/pages/admin/pages/[id].astro. */
export interface EditorBoot {
  id: string;
  page: PageData;
  previewUrl: string;
  liveUrl?: string;
  sectionKinds: SectionKind[];
  canonicalTags?: SelectOption[];
  playlists?: SelectOption[];
  cloudinary?: { cloudName?: string };
}

export interface CommitSummary {
  sha?: string;
  shortSha?: string;
  message?: string;
  date?: string | null;
  author?: string | null;
  htmlUrl?: string | null;
}

/** GET /api/admin/pages/:id/history, plus the local fallback built on failure. */
export interface PageHistoryData {
  ok?: boolean;
  configured?: boolean;
  error?: string;
  pageId?: string;
  path?: string;
  mainBranch?: string;
  cmsBranch?: string;
  commits?: CommitSummary[];
  lastPublish?: CommitSummary | null;
}

/** GET /api/admin/changes merged with the local IndexedDB draft ids. */
export interface ChangesStatus {
  ok?: boolean;
  configured?: boolean;
  error?: string;
  mainBranch?: string;
  /** The endpoint returns a map; the local failure fallback uses an empty array. */
  pages?: Record<string, PageData> | PageData[];
  site?: SiteChrome | null;
  paths?: { pages: string; site: string };
  draftIds: string[];
  hasThisDraft: boolean;
  aheadBy: number;
}

export interface SelectSectionOpts {
  /** Keep `selectedPath` instead of clearing it. */
  keepPath?: boolean;
  focusPath?: string | null;
  scroll?: boolean;
  openSectionTab?: boolean;
}

export type StructuralOp = 'move' | 'remove' | 'insert' | 'replace' | 'reindex';

export interface StructuralOpts {
  from?: number;
  to?: number;
  index?: number;
  sectionIndex?: number;
  highlightIndex?: number | null;
  statusMsg?: string;
}

export type PrimaryPanel = 'inspector' | 'page' | 'media';
export type InspectorTab = 'layers' | 'section' | 'meta';
export type PageTab = 'info' | 'history';

export type FieldInput = HTMLInputElement | HTMLTextAreaElement;

export interface EditorSession {
  // ── Boot payload and page identity ──────────────────────────────────────
  boot: EditorBoot;
  liveUrl: string;
  slugPath: string;

  // ── Page state ──────────────────────────────────────────────────────────
  draft: PageData;
  savedSnapshot: PageData;
  publishedSnapshot: PageData;
  baseHash: string;
  dirty: boolean;

  // ── Selection and chrome state ──────────────────────────────────────────
  selectedSection: number;
  selectedPath: string | null;
  primary: PrimaryPanel | null;
  inspectorTab: InspectorTab;
  pageTab: PageTab;
  deviceMode: DeviceMode;
  iframeWin: Window | null;
  mediaPickerInstance: MediaPicker | null;
  fieldEditCheckpointed: boolean;
  dragFromIndex: number | null;

  // ── Work pending until the preview announces itself again ───────────────
  pendingInsertAt: number | null;
  pendingHighlight: number | null;
  pendingScroll: { x: number; y: number } | null;
  previewPersistTimer: ReturnType<typeof setTimeout> | null;
  previewPersistInFlight: Promise<void> | null;
  draftAutosaveTimer?: ReturnType<typeof setTimeout>;

  // ── Undo / redo ─────────────────────────────────────────────────────────
  undoStack: PageData[];
  redoStack: PageData[];
  HISTORY_LIMIT: number;

  // ── Cached panel data ───────────────────────────────────────────────────
  historyCache: PageHistoryData | null;
  changesCache: ChangesStatus | null;

  // ── DOM refs, all from editorShellHtml() ────────────────────────────────
  statusEl: HTMLElement | null;
  dirtyChip: HTMLElement | null;
  saveBtn: HTMLButtonElement | null;
  undoBtn: HTMLButtonElement | null;
  redoBtn: HTMLButtonElement | null;
  sectionsEl: HTMLElement | null;
  sectionFieldsEl: HTMLElement | null;
  sectionHeadingEl: HTMLElement | null;
  metaEl: HTMLElement | null;
  addKind: HTMLSelectElement | null;
  insertKind: HTMLSelectElement | null;
  frame: HTMLIFrameElement | null;
  previewFrame: HTMLElement | null;
  insertModal: HTMLElement | null;
  layersPane: HTMLElement | null;
  sectionPane: HTMLElement | null;
  metaPane: HTMLElement | null;
  formPanel: HTMLElement | null;
  pagePanel: HTMLElement | null;
  mediaPanel: HTMLElement | null;
  mediaMount: HTMLElement | null;
  infoPane: HTMLElement | null;
  historyPane: HTMLElement | null;
  infoFieldsEl: HTMLElement | null;
  historyFieldsEl: HTMLElement | null;
  inspectorTitleEl: HTMLElement | null;
  pageTitleEl: HTMLElement | null;

  // ── Runtime chrome ──────────────────────────────────────────────────────
  setStatus: SetStatus;
  refreshChromeState: (chipState?: ChipState) => void;
  markDirty: () => void;
  postToFrame: <K extends keyof EditorMessages>(type: K, payload: EditorMessages[K]) => void;
  setDevice: (mode: DeviceMode) => void;
  setAgentOpen: (open: boolean) => void;
  getMediaInsertTarget: () => ImageTarget | null;
  /**
   * Panel controls live on `window.__tbEditorChrome`; the facade only ever
   * reaches for these through optional chaining as a fallback.
   */
  openInspector?: (tab?: string) => void;
  openPage?: (tab?: string) => void;
  openMedia?: () => void;

  // ── Runtime rendering ───────────────────────────────────────────────────
  renderMeta: () => void;
  renderSections: () => void;
  renderSectionFields: (index: number, focusPath?: string | null) => void;

  // ── Runtime section mutations ───────────────────────────────────────────
  selectSection: (index: number, opts?: SelectSectionOpts) => void;
  moveSection: (from: number, to: number) => void;
  duplicateSection: (index: number) => void;
  deleteSection: (index: number) => void;
  insertSectionAt: (index: number, kind: SectionKind) => void;
  refreshAfterStructural: (highlightIndex?: number | null) => Promise<void>;
  applyLiveLeaf: (path: string, value: unknown) => void;
  saveDraft: () => Promise<void>;
  saveToCms: () => Promise<void>;
  getByPath: (obj: unknown, path: string) => unknown;
  setByPath: (obj: unknown, path: string, value: unknown) => void;

  // ── editor/history.ts ───────────────────────────────────────────────────
  syncHistoryButtons: () => void;
  checkpoint: () => void;
  restoreFromHistory: (page: PageData) => void;
  undo: () => void;
  redo: () => void;

  // ── editor/preview-sync.ts ──────────────────────────────────────────────
  capturePreviewScroll: () => { x: number; y: number } | null;
  reloadPreview: (highlightIndex?: number | null) => void;
  persistPreview: (highlightIndex?: number | null, statusMsg?: string) => Promise<void>;
  schedulePersistPreview: (highlightIndex?: number | null, statusMsg?: string) => void;
  restorePreviewAfterReady: () => void;
  clearPreviewPersistTimer: () => void;
  persistDraftLocal: (statusMsg?: string) => Promise<void>;
  applyLiveStructural: (op: StructuralOp, opts?: StructuralOpts) => Promise<boolean>;
  fetchSectionHtml: (sectionIndex: number) => Promise<string>;

  // ── editor/field-controls.ts ────────────────────────────────────────────
  coerceFieldValue: (def: FieldDef, raw: unknown) => unknown;
  normalizeOption: (opt: unknown) => FieldOption;
  resolveFieldOptions: (def: FieldDef) => FieldOption[];
  deleteByPath: (obj: unknown, path: string) => void;
  appendFieldControl: (
    container: HTMLElement,
    path: string,
    def: FieldDef,
    opts?: { group?: string },
  ) => string;
  applyCloudinaryAsset: (path: string, asset: CloudinaryInsertAsset | null | undefined) => void;
  mountImageUrlField: (wrap: HTMLElement, path: string, currentValue: unknown) => HTMLInputElement;
  bindLiveInput: (input: FieldInput, path: string, kind?: string) => void;
  highlightFieldInForm: (path: string | null) => void;
  focusFieldInForm: (path: string | null) => void;
  appendFieldsForPath: (
    container: HTMLElement,
    basePath: string,
    fields?: FieldDef[],
    itemKind?: 'string',
  ) => void;
  appendListItemFields: (
    container: HTMLElement,
    basePath: string,
    fields?: FieldDef[],
    itemKind?: 'string',
  ) => void;
  clearSourceDependentFilters: (section: PageSection | undefined) => boolean;

  // ── editor/list-editor.ts ───────────────────────────────────────────────
  listItemLabel: (spec: ListSpec, item: unknown, index: number) => string;
  renderListEditor: (container: HTMLElement, sectionIndex: number, spec: ListSpec) => void;
  renderNestedList: (
    container: HTMLElement,
    sectionIndex: number,
    parentPath: string,
    nestedSpec: ListSpec,
  ) => void;

  // ── editor/page-panels.ts ───────────────────────────────────────────────
  refreshInfoPane: () => Promise<void>;
  syncInfoEditStatus: () => void;
  refreshHistoryPanel: (force?: boolean) => Promise<void>;
  fetchChangesStatus: (force?: boolean) => Promise<ChangesStatus>;
}
