/**
 * The facade the agent tools drive the admin through.
 *
 * Two surfaces install onto `window.__tbVisualEditor`: the page editor installs
 * the full `EditorFacade`, the pages desk installs `DeskFacade`, which is a
 * strict subset. Tool code that runs on both must narrow with `in` rather than
 * checking `typeof api.someMethod === 'function'`.
 */
import type { PageData, PageMetadata, PageSection, SectionKind, SiteChrome } from './content.js';

export type DeviceMode = 'full' | 'desktop' | 'mobile';

/**
 * Panels `openPanel` accepts, in one place: the union below, the tool schema
 * enum, and the runtime whitelist all derive from this array. `inspector` is an
 * alias for `section` and `page` for `info`; the editor chrome maps them.
 */
export const PANEL_NAMES = ['inspector', 'section', 'media', 'info', 'page', 'history'] as const;

export type PanelName = (typeof PANEL_NAMES)[number];

export function isPanelName(value: unknown): value is PanelName {
  return PANEL_NAMES.includes(value as PanelName);
}

/** Where the media picker (or a `set_image` call) would write the next image. */
export interface ImageTarget {
  path: string | null;
  label: string | null;
  sectionIndex: number;
  selectedPath: string | null;
  alternatives: { path: string; label: string }[];
}

export interface CloudinaryAsset {
  publicId: string;
  secureUrl: string;
  width?: number;
  height?: number;
  format?: string;
  tags?: string[];
  title?: string;
  description?: string;
  folder?: string;
}

export interface PageSummary {
  id: string;
  path: string;
  title?: string;
}

export interface ChangesSummary {
  pages: Record<string, PageData>;
  site: SiteChrome | null;
  mainBranch?: string;
  configured?: boolean;
}

export interface EditorState {
  pageId: string;
  path?: string;
  sectionCount: number;
  selectedSection: number;
  selectedPath: string | null;
  dirty: boolean;
  deviceMode: DeviceMode;
  sectionKinds: SectionKind[];
  /** Absent on any surface that has no live image field selected. */
  imageTarget?: ImageTarget | null;
}

export interface SetFieldArgs {
  path: string;
  value: unknown;
  sectionIndex?: number;
  structural?: boolean;
}

export interface SetImageArgs {
  path?: string;
  sectionIndex?: number;
  secureUrl: string;
  publicId?: string;
  width?: number;
  height?: number;
  alt?: string;
}

/**
 * What `searchImages` really sends to /api/admin/cloudinary/search. The tool
 * schema exposes exactly these names to the model.
 */
export interface SearchImagesArgs {
  query?: string;
  describe?: string;
  vision?: boolean;
  folder?: string;
  maxResults?: number;
  orientation?: string;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  format?: string;
  tags?: string[];
}

export interface CloudinarySearchResult {
  assets: CloudinaryAsset[];
  metadata?: { used?: boolean; terms?: string[] };
  vision?: { used?: boolean; candidates?: number; error?: string };
}

export interface ListItemTarget {
  sectionIndex?: number;
  listKey: string;
  nestedKey?: string;
  parentItemIndex?: number;
}

/**
 * Methods both surfaces implement. Tool handlers that must work on the desk and
 * in the editor should depend on this and nothing wider.
 */
export interface SharedFacade {
  listPages(): Promise<PageSummary[] | { pages: PageSummary[] }>;
  getPage(args?: { id?: string } | string): Promise<unknown> | unknown;
  createPage(args?: {
    id?: string;
    path?: string;
    title?: string;
    description?: string;
    open?: boolean;
  }): Promise<unknown>;
  openPage(args?: { id?: string; force?: boolean }): unknown;
  updateMetadata(fields: Partial<PageMetadata> & Record<string, unknown>): unknown;
  getChanges(): Promise<ChangesSummary>;
  publishChanges(args?: { message?: string }): Promise<unknown>;
  discardChanges(): Promise<unknown>;
  getSite(): Promise<{ site: SiteChrome | null; source?: 'draft' | 'published' }>;
  applySitePatch(args?: { site?: Partial<SiteChrome>; mode?: string }): Promise<unknown>;
  saveToCms(): Promise<unknown>;
}

/** The pages desk surface: shared methods plus a draft save. */
export interface DeskFacade extends SharedFacade {
  saveDraft(): Promise<unknown>;
}

/** The full page editor surface. */
export interface EditorFacade extends SharedFacade {
  getState(): EditorState;
  getSection(index: number): PageSection;
  selectSection(index: number, opts?: { scroll?: boolean; focusPath?: string }): unknown;
  addSection(args?: { kind?: SectionKind; index?: number }): unknown;
  moveSection(args: { from: number; to: number }): unknown;
  duplicateSection(index: number): unknown;
  deleteSection(index: number): unknown;
  replaceSection(args: { index: number; section: PageSection }): Promise<unknown>;
  patchSection(args: { index: number; patch: Record<string, unknown> }): Promise<unknown>;
  setField(args: SetFieldArgs): unknown;
  setDevice(mode: DeviceMode): unknown;
  undo(): unknown;
  redo(): unknown;
  refreshPreview(): Promise<unknown>;
  searchImages(args?: SearchImagesArgs): Promise<CloudinarySearchResult>;
  getImageLibraryConfig(): Promise<unknown>;
  setImage(args?: SetImageArgs): Promise<unknown>;
  describeSection(args?: { index?: number }): unknown;
  addListItem(args?: ListItemTarget & { item?: unknown }): Promise<unknown>;
  removeListItem(args?: ListItemTarget & { itemIndex?: number }): Promise<unknown>;
  moveListItem(args?: ListItemTarget & { from?: number; to?: number }): Promise<unknown>;
  updateAssetMetadata(args?: {
    publicId?: string;
    tags?: string[];
    title?: string;
    description?: string;
  }): Promise<unknown>;
  getPageHistory(): Promise<unknown>;
  openPanel(args?: { panel?: PanelName }): unknown;
}

/** Whatever is installed on the current page. */
export type AdminFacade = EditorFacade | DeskFacade;

/** True when the full page editor installed the facade. */
export function isEditorFacade(api: AdminFacade): api is EditorFacade {
  return 'getState' in api && 'getSection' in api;
}
