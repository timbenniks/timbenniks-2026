import type { APIRoute } from 'astro';
import { plainTextResponse, siteUrl } from '../../lib/markdown';
import { loadAllSorted } from '../../lib/collections';
import { writingIndexLine } from '../../lib/llms';

export const GET: APIRoute = async () => {
  const { writing } = await loadAllSorted();
  const body = [
    '# Writing — Tim Benniks',
    '',
    `Every non-draft article, newest first. Markdown twin of each post: append \`.md\` to the HTML URL, or send \`Accept: text/markdown\`. Site overview: ${siteUrl('/llms.txt')}.`,
    '',
    ...writing.map((e) => writingIndexLine(e)),
    '',
  ].join('\n');
  return plainTextResponse(body);
};
