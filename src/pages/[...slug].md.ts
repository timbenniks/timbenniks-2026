import type { APIRoute, GetStaticPaths } from 'astro';
import { loadPage } from '../lib/page';
import { listCatchAllPages } from '../lib/admin/pages-store';
import { markdownResponse } from '../lib/markdown';
import { pageToMarkdown } from '../lib/page-to-markdown';

export const getStaticPaths: GetStaticPaths = async () => {
  const pages = await listCatchAllPages();
  return pages.map(({ id, path }) => ({
    params: { slug: path.replace(/^\//, '') },
    props: { pageId: id },
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const page = await loadPage((props as { pageId: string }).pageId);
  return markdownResponse(pageToMarkdown(page.data));
};
