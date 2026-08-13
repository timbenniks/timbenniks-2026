import type { APIRoute } from 'astro';
import { loadPage } from '../lib/page';
import { markdownResponse } from '../lib/markdown';
import { pageToMarkdown } from '../lib/page-to-markdown';

export function createPageMarkdownRoute(pageId: string): { GET: APIRoute } {
  return {
    GET: async () => {
      const page = await loadPage(pageId);
      return markdownResponse(pageToMarkdown(page.data));
    },
  };
}
