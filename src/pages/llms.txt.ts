import type { APIRoute } from 'astro';
import { plainTextResponse, siteUrl, speakingLine } from '../lib/markdown';
import { loadAllSorted } from '../lib/collections';
import { SITE_SUMMARY, STATIC_PAGES } from '../lib/static-pages-prose';

export const GET: APIRoute = async () => {
  const { writing, videos, speaking } = await loadAllSorted();

  const writingItems = writing.map((e) => {
    const desc = e.data.description ? `: ${e.data.description}` : '';
    return `- [${e.data.title}](${siteUrl(`/writing/${e.id}.md`)})${desc}`;
  });

  const videoItems = videos.map((e) => {
    const desc = e.data.description ? `: ${e.data.description}` : '';
    return `- [${e.data.title}](${siteUrl(`/videos/${e.id}.md`)})${desc}`;
  });

  const speakingItems = speaking.slice(0, 50).map(speakingLine);

  const pageItems = STATIC_PAGES.map(
    (p) => `- [${p.title}](${siteUrl(p.path)}): ${p.description}`,
  );

  const optional = [
    `- [RSS feed](${siteUrl('/feed.xml')}): full writing feed in RSS 2.0`,
    `- [JSON feed](${siteUrl('/feed.json')}): writing feed in JSON Feed 1.1`,
    `- [XML sitemap](${siteUrl('/sitemap-index.xml')}): machine-readable URL index`,
    `- [Markdown sitemap](${siteUrl('/sitemap.md')}): the same index, in markdown`,
    `- [Full corpus](${siteUrl('/llms-full.txt')}): writing entries, video metadata, speaking engagements, and static page summaries inlined as markdown`,
    `- [Agent guide](${siteUrl('/agents.md')}): instructions for AI agents consuming this site`,
  ];

  const body = [
    '# Tim Benniks',
    '',
    `> ${SITE_SUMMARY}`,
    '',
    'Every article on this site is also available as raw markdown — append `.md` to any `/writing/<slug>` or `/videos/<slug>` URL, or send `Accept: text/markdown` to the canonical URL.',
    '',
    '## Pages',
    '',
    pageItems.join('\n'),
    '',
    '## Writing',
    '',
    writingItems.join('\n'),
    '',
    '## Videos',
    '',
    videoItems.join('\n'),
    '',
    '## Speaking',
    '',
    speakingItems.join('\n'),
    '',
    '## Optional',
    '',
    optional.join('\n'),
    '',
  ].join('\n');

  return plainTextResponse(body);
};
