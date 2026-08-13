import type { APIRoute } from 'astro';
import { loadPage } from '../lib/page';
import { loadAllSorted } from '../lib/collections';
import { markdownResponse, speakingLine } from '../lib/markdown';
import { pageToMarkdown } from '../lib/page-to-markdown';

export const GET: APIRoute = async () => {
  const [page, { speaking }] = await Promise.all([loadPage('speaking'), loadAllSorted()]);
  const talks = speaking.map(speakingLine).join('\n');
  const body = `${pageToMarkdown(page.data).trimEnd()}\n\n---\n\n## All talks\n\n${talks}\n`;
  return markdownResponse(body);
};
