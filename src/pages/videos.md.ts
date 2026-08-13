import type { APIRoute } from 'astro';
import { loadAllSorted } from '../lib/collections';
import { markdownResponse, siteUrl } from '../lib/markdown';
import { cleanVideoDescription } from '../lib/video-description';

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export const GET: APIRoute = async () => {
  const { videos } = await loadAllSorted();
  const items = videos.map((e) => {
    const cleaned = cleanVideoDescription(e.data.description);
    const desc = cleaned ? `: ${cleaned}` : '';
    return `- ${ymd(e.data.date)} — [${e.data.title}](${siteUrl(`/videos/${e.id}`)}) · [.md](${siteUrl(`/videos/${e.id}.md`)})${desc}`;
  });
  const body = [
    '# Videos',
    '',
    `Talks and recordings. HTML index: ${siteUrl('/videos')}. Per-video markdown includes the transcript when one exists.`,
    '',
    ...items,
    '',
  ].join('\n');
  return markdownResponse(body);
};
