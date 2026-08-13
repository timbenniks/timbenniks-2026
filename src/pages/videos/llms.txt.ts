import type { APIRoute } from 'astro';
import { plainTextResponse, siteUrl } from '../../lib/markdown';
import { loadAllSorted } from '../../lib/collections';
import { videoIndexLine } from '../../lib/llms';

export const GET: APIRoute = async () => {
  const { videos } = await loadAllSorted();
  const body = [
    '# Videos — Tim Benniks',
    '',
    `Every video, newest first. Markdown twin (metadata + transcript when available): append \`.md\` to the HTML URL. Site overview: ${siteUrl('/llms.txt')}.`,
    '',
    ...videos.map(videoIndexLine),
    '',
  ].join('\n');
  return plainTextResponse(body);
};
