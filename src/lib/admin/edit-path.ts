import { isEditMarkupEnabled } from './edit-mode';

/** Stamp editable field paths for the visual editor bridge. No-op when edit markup is off. */
export function editAttr(path: string | undefined): Record<string, string> {
  if (!path || !isEditMarkupEnabled()) return {};
  return { 'data-edit': path };
}

/** Stamp a list container (ctas, items, gallery, …) for in-preview “+” add affordances. */
export function editListAttr(path: string | undefined): Record<string, string> {
  if (!path || !isEditMarkupEnabled()) return {};
  return { 'data-edit-list': path };
}

export function editPath(base: string | undefined, ...parts: (string | number)[]): string | undefined {
  if (!base) return undefined;
  return [base, ...parts.map(String)].join('.');
}

/** Section wrapper attrs for the preview bridge. Empty when edit markup is off. */
export function sectionEditAttrs(
  index: number,
  kind: string,
  pageId?: string,
): Record<string, string> {
  if (!isEditMarkupEnabled()) return {};
  return {
    'data-section': String(index),
    'data-section-kind': kind,
    ...(pageId ? { 'data-page-id': pageId } : {}),
  };
}
