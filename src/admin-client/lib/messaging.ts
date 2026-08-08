/**
 * The postMessage protocol between the editor shell and the preview iframe.
 *
 * Both directions are modelled as a map of message type -> payload, so the
 * envelope on the wire stays `{ channel, type, payload }`.
 */

export const CHANNEL = 'tb-ve';

/** Attributes the editor may live-patch on a previewed element. */
export type EditableAttr = 'src' | 'href' | 'width' | 'height';

/** What sort of field the user clicked in the preview. */
export type SelectKind = 'text' | 'image';

export const BLOCK_ACTIONS = ['up', 'down', 'dup', 'del'] as const;

/** Section chrome menu actions. */
export type BlockAction = (typeof BLOCK_ACTIONS)[number];

export function isBlockAction(value: string | null): value is BlockAction {
  return value !== null && (BLOCK_ACTIONS as readonly string[]).includes(value);
}

/** Editor shell -> preview iframe. */
export interface EditorMessages {
  /** Ask the bridge to re-announce itself. */
  ping: Record<string, never>;
  /** Section kinds and current selection, so section chrome can label itself. */
  setSectionMeta: {
    kinds: string[];
    selectedSection: number;
    selectedPath: string | null;
  };
  /** SEO fields that live on the previewed document rather than on a section. */
  setDocumentMeta: { title?: string; description?: string };
  highlight: { path: string };
  highlightSection: { index: number; path: string | null; scroll: boolean };
  restoreScroll: { x: number; y: number };
  setText: { path: string; value: string };
  setAttr: { path: string; attr: EditableAttr; value: string };
  setHtml: { path: string; value: string };
  moveSection: { from: number; to: number };
  removeSection: { index: number };
  insertSectionHtml: { index: number; html: string };
  replaceSectionHtml: { index: number; html: string };
  reindexSections: { kinds: string[] };
  /** Exit preview contenteditable before structural DOM swaps. */
  endInlineEdit: Record<string, never>;
  /** Enter preview contenteditable for a path (shell Enter on a text input). */
  startInlineEdit: { path: string };
}

/** Preview iframe -> editor shell. */
export interface BridgeMessages {
  ready: { count: number; sections: number; href: string };
  select: {
    sectionIndex: number;
    path: string | null;
    kind: SelectKind;
    value: string;
  };
  blockAction: { action: BlockAction; sectionIndex: number };
  addAt: { index: number };
  /** Append an item to a section list (e.g. ctas) from a preview “+” chip. */
  addListItem: { sectionIndex: number; listKey: string };
  /** Open Cloudinary picker for an image path (hover chip in preview). */
  pickImage: { sectionIndex: number; path: string };
  /** Preview contenteditable started on a plain-text leaf. */
  inlineStart: { sectionIndex: number; path: string; value: string };
  /** Live value from preview contenteditable. */
  inlineInput: { path: string; value: string };
  /** Preview contenteditable ended (blur / Escape / shell request). */
  inlineEnd: { path: string };
}

type Envelope<M> = {
  [K in keyof M]: { channel: typeof CHANNEL; type: K; payload: M[K] };
}[keyof M];

export type EditorMessage = Envelope<EditorMessages>;
export type BridgeMessage = Envelope<BridgeMessages>;

export function editorOrigin(): string {
  return window.location.origin;
}

/** True if the message is from same origin on our channel. */
export function isTrustedEditorMessage(event: MessageEvent): boolean {
  if (!event) return false;
  const data: unknown = event.data;
  if (typeof data !== 'object' || data === null) return false;
  if ((data as { channel?: unknown }).channel !== CHANNEL) return false;
  // Same-origin iframe / parent only.
  if (event.origin && event.origin !== window.location.origin) return false;
  return true;
}

/**
 * The one place inbound messages are trusted. Origin and channel are verified
 * here and the payload is taken on faith; everywhere else reads the narrowed
 * union instead of poking at `event.data`.
 */
export function readEditorMessage(event: MessageEvent): EditorMessage | null {
  return isTrustedEditorMessage(event) ? (event.data as EditorMessage) : null;
}

export function readBridgeMessage(event: MessageEvent): BridgeMessage | null {
  return isTrustedEditorMessage(event) ? (event.data as BridgeMessage) : null;
}

export function postToFrame<K extends keyof EditorMessages>(
  win: Window | null | undefined,
  type: K,
  payload: EditorMessages[K],
): void {
  if (!win) return;
  win.postMessage({ channel: CHANNEL, type, payload }, editorOrigin());
}

export function postToParent<K extends keyof BridgeMessages>(
  type: K,
  payload: BridgeMessages[K],
): void {
  if (!window.parent || window.parent === window) return;
  window.parent.postMessage({ channel: CHANNEL, type, payload }, editorOrigin());
}

/**
 * Of the seven `metadata.*` fields only title and description are rendered in
 * the previewed document, so the rest produce no bridge message.
 */
export function documentMetaPatch(
  key: string,
  value: unknown,
): EditorMessages['setDocumentMeta'] | null {
  if (key === 'title') return { title: String(value ?? '') };
  if (key === 'description') return { description: String(value ?? '') };
  return null;
}
