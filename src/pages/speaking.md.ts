import type { APIRoute } from 'astro';
import { markdownResponse } from '../lib/markdown';
import { resolveMarkdown } from '../lib/public-tool-handlers';

export const GET: APIRoute = async () => {
  const { markdown } = await resolveMarkdown('/speaking');
  return markdownResponse(markdown);
};
