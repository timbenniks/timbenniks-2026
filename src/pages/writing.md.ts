import type { APIRoute } from 'astro';
import { loadAllSorted } from '../lib/collections';
import { markdownResponse, siteUrl } from '../lib/markdown';

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export const GET: APIRoute = async () => {
  const { writing } = await loadAllSorted();
  const items = writing.map((e) => {
    const desc = e.data.description ? `: ${e.data.description}` : '';
    return `- ${ymd(e.data.date)} — [${e.data.title}](${siteUrl(`/writing/${e.id}`)}) · [.md](${siteUrl(`/writing/${e.id}.md`)})${desc}`;
  });
  const body = [
    '# Writing',
    '',
    `Essays by Tim Benniks. HTML index: ${siteUrl('/writing')}. Tag archives: ${siteUrl('/writing/tag/<tag>')}.`,
    '',
    ...items,
    '',
  ].join('\n');
  return markdownResponse(body);
};
