import type { APIRoute } from 'astro';
import { markdownResponse, siteUrl } from '../lib/markdown';
import { loadAllSorted } from '../lib/collections';
import { STATIC_PAGES } from '../lib/static-pages-prose';
import { CANONICAL_TAGS, tagLabel } from '../lib/tags';

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export const GET: APIRoute = async () => {
  const { writing, videos, speaking } = await loadAllSorted();

  const pages = [
    ...STATIC_PAGES.map((p) => {
      const md =
        p.path === '/'
          ? `[.md](${siteUrl('/index.md')})`
          : `[.md](${siteUrl(`${p.path}.md`)})`;
      return `- [${p.title}](${siteUrl(p.path)}) · ${md}`;
    }),
    `- [Writing](${siteUrl('/writing')}) · [.md](${siteUrl('/writing.md')})`,
    `- [Videos](${siteUrl('/videos')}) · [.md](${siteUrl('/videos.md')})`,
    `- [Speaking](${siteUrl('/speaking')}) · [.md](${siteUrl('/speaking.md')})`,
    `- [Search](${siteUrl('/search')})`,
    `- [Tool catalog](${siteUrl('/tools.json')})`,
    `- [Content index](${siteUrl('/content-index.json')})`,
    `- [Agent guide](${siteUrl('/agents.md')})`,
  ];

  const writingItems = writing.map(
    (e) =>
      `- ${ymd(e.data.date)} — [${e.data.title}](${siteUrl(`/writing/${e.id}`)}) · [.md](${siteUrl(`/writing/${e.id}.md`)})`,
  );

  const videoItems = videos.map(
    (e) =>
      `- ${ymd(e.data.date)} — [${e.data.title}](${siteUrl(`/videos/${e.id}`)}) · [.md](${siteUrl(`/videos/${e.id}.md`)})`,
  );

  const speakingItems = speaking.map(
    (e) => `- ${ymd(e.data.date)} — ${e.data.talk} at ${e.data.conference}`,
  );

  const tagItems = CANONICAL_TAGS.map(
    (t) => `- [${tagLabel(t)}](${siteUrl(`/writing/tag/${t}`)})`,
  );

  const body = [
    '# Sitemap',
    '',
    `Markdown mirror of [the XML sitemap](${siteUrl('/sitemap-index.xml')}). Writing, videos, projects, and static pages have \`.md\` companions. In-tab agents: [${siteUrl('/tools.json')}](${siteUrl('/tools.json')}).`,
    '',
    '## Pages',
    '',
    pages.join('\n'),
    '',
    '## Writing',
    '',
    writingItems.join('\n'),
    '',
    '## Tag archives',
    '',
    tagItems.join('\n'),
    '',
    '## Videos',
    '',
    videoItems.join('\n'),
    '',
    '## Speaking',
    '',
    speakingItems.join('\n'),
    '',
  ].join('\n');

  return markdownResponse(body);
};
