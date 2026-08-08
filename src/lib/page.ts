import {
  getCmsPagesCached,
  getDurablePreviewDraft,
  getPreviewDraft,
  readPagesFile,
  readPagesForAdmin,
  validatePageData,
} from './admin/pages-store';
import { isAdminPreviewRequest } from './admin/request-context';
import { siteUrl } from '../data/site';
import { breadcrumbSchema, buildGraph } from './schema';

/**
 * Prefer in-memory/disk preview draft, then main/admin pages.json, else deployed FS.
 * Intentional drafts live in the browser IndexedDB — preview draft is only for SSR reload fallback.
 */
export async function loadPage(id: string) {
  if (isAdminPreviewRequest()) {
    const draft = getPreviewDraft(id);
    if (draft) {
      return {
        id,
        collection: 'pages' as const,
        data: draft,
      };
    }

    const durable = await getDurablePreviewDraft(id);
    if (durable) {
      return {
        id,
        collection: 'pages' as const,
        data: durable,
      };
    }

    const main = await getCmsPagesCached();
    if (main?.[id]) {
      return {
        id,
        collection: 'pages' as const,
        data: main[id],
      };
    }
    const all = await readPagesForAdmin();
    const raw = all[id];
    if (!raw) throw new Error(`Missing content for pages/${id}`);
    return {
      id,
      collection: 'pages' as const,
      data: validatePageData(raw),
    };
  }

  const all = await readPagesFile();
  const raw = all[id];
  if (!raw) throw new Error(`Missing content for pages/${id}`);
  return {
    id,
    collection: 'pages' as const,
    data: validatePageData(raw),
  };
}

/** `pathOrSlug` may be a page id (`press-kit`) or a public path (`/press-kit`). */
export function pageBreadcrumbGraph(pathOrSlug: string, name?: string) {
  const path =
    pathOrSlug === '/' || pathOrSlug.startsWith('/')
      ? pathOrSlug
      : `/${pathOrSlug}`;
  const derived =
    path
      .split('/')
      .filter(Boolean)
      .map((s) => s.replace(/-/g, ' '))
      .join(' / ') || 'Home';
  const label = name ?? derived;
  return buildGraph(breadcrumbSchema([{ name: label, url: siteUrl(path) }]));
}
