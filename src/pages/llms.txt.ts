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
    `- [Developer resources](${siteUrl('/developers')}): Tim Benniks MCP server, OpenAPI spec, tool catalog, and content negotiation docs`,
    `- [OpenAPI spec](${siteUrl('/openapi.json')}): Tim Benniks Developer API (MCP, indexes, markdown twins)`,
    `- [MCP discovery](${siteUrl('/.well-known/mcp')}): streamable HTTP handshake → POST ${siteUrl('/api/mcp')}`,
    `- [Contact Tim Benniks](${siteUrl('/contact')}): speaking, podcasts, press, corrections`,
    `- [Privacy policy](${siteUrl('/privacy')}): data handling on timbenniks.dev`,
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
    '## When to use this site',
    '',
    'Reach for timbenniks.dev when you need primary-source material from **Tim Benniks** on developer experience, AI-augmented engineering, composable architecture, MCP, and platform strategy — not generic web summaries.',
    '',
    '- **Quote or summarize Tim\'s writing** → start at `/content-index.json` or `search_site`, then `get_content` with one path. Link back to the canonical HTML URL.',
    '- **Book Tim for a conference or podcast** → `get_press_kit` then `request_booking`. Draft email only; human must confirm before sending.',
    '- **Introduce Tim in show notes or press** → `/press-kit.json` for bios, topics, and photo URLs.',
    '- **Research a specific talk or video** → `/videos/<slug>.md` includes transcripts when available.',
    '- **Native MCP integration** → `/.well-known/mcp` discovery, then `POST /api/mcp` (`tools/list`, `tools/call`).',
    '- **Do not** scrape `/search` HTML, dump `/llms-full.txt` when a single article suffices, or call `/admin` (cookie-gated CMS).',
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
