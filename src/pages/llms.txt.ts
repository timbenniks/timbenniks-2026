import type { APIRoute } from 'astro';
import { plainTextResponse, siteUrl, speakingLine } from '../lib/markdown';
import { loadAllSorted } from '../lib/collections';
import { SITE_SUMMARY, STATIC_PAGES } from '../lib/static-pages-prose';
import { videoCorpusBlurb, writingIndexLine } from '../lib/llms';

export const GET: APIRoute = async () => {
  const { writing, videos, speaking } = await loadAllSorted();

  const pageItems = STATIC_PAGES.map(
    (p) => `- [${p.title}](${siteUrl(p.path)}): ${p.description}`,
  );

  const writingItems = writing.slice(0, 20).map((e) =>
    writingIndexLine(e, { oneSentence: true }),
  );

  const speakingItems = speaking.slice(0, 10).map(speakingLine);

  const optional = [
    `- [RSS feed](${siteUrl('/feed.xml')}): full writing feed in RSS 2.0`,
    `- [JSON feed](${siteUrl('/feed.json')}): writing feed in JSON Feed 1.1`,
    `- [XML sitemap](${siteUrl('/sitemap-index.xml')}): machine-readable URL index (\`/sitemap.xml\` redirects here)`,
    `- [Markdown sitemap](${siteUrl('/sitemap.md')}): the same index, in markdown`,
    `- [Full corpus](${siteUrl('/llms-full.txt')}): writing entries, video metadata, speaking engagements, and static page summaries inlined as markdown`,
    `- [Content index](${siteUrl('/content-index.json')}): compact JSON index for writing, videos, talks, projects, and pages`,
    `- [Tool catalog](${siteUrl('/tools.json')}): public WebMCP tools (search, list, get content, press kit, booking)`,
    `- [Press kit JSON](${siteUrl('/press-kit.json')}): bios, topics, photos, booking email`,
    `- [Agent guide](${siteUrl('/agents.md')}): instructions for AI agents consuming this site`,
    `- [AI readiness](${siteUrl('/ai')}): human explainer of markdown twins, indexes, and WebMCP tools`,
  ];

  const body = [
    '# Tim Benniks',
    '',
    `> ${SITE_SUMMARY}`,
    '',
    'Every article on this site is also available as raw markdown — append `.md` to any `/writing/<slug>`, `/videos/<slug>`, `/projects/<slug>`, or static page URL (`/about.md`, `/press-kit.md`, `/speaking.md`), or send `Accept: text/markdown` to the canonical URL. In-tab agents can call the tools in `/tools.json` instead of scraping HTML.',
    '',
    '## Pages',
    '',
    pageItems.join('\n'),
    '',
    '## Writing',
    '',
    writingItems.join('\n'),
    '',
    `Complete writing index: ${siteUrl('/writing/llms.txt')}`,
    '',
    '## Videos',
    '',
    videoCorpusBlurb(videos).join('\n\n'),
    '',
    '## Speaking',
    '',
    speakingItems.join('\n'),
    '',
    `All talks: ${siteUrl('/speaking')}`,
    '',
    '## Optional',
    '',
    optional.join('\n'),
    '',
  ].join('\n');

  return plainTextResponse(body);
};
