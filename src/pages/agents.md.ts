import type { APIRoute } from 'astro';
import { markdownResponse, siteUrl } from '../lib/markdown';

export const GET: APIRoute = async () => {
  const writingMarkdownExample = `${siteUrl('/writing/')}<slug>.md`;
  const videoMarkdownExample = `${siteUrl('/videos/')}<slug>.md`;
  const writingCanonicalExample = `${siteUrl('/writing/')}<slug>`;

  const body = `# Agents guide — timbenniks.dev

This site is friendly to AI agents and crawlers. The content here is meant to be read, summarized, and quoted — with attribution.

## Machine-readable surfaces

- [${siteUrl('/llms.txt')}](${siteUrl('/llms.txt')}) — site overview and curated link index ([llmstxt.org](https://llmstxt.org) format).
- [${siteUrl('/llms-full.txt')}](${siteUrl('/llms-full.txt')}) — every non-draft writing entry, every video's metadata and description, all speaking engagements, and prose summaries of the static pages, inlined as one document.
- [${siteUrl('/sitemap.md')}](${siteUrl('/sitemap.md')}) — markdown mirror of the XML sitemap.
- [${siteUrl('/sitemap-index.xml')}](${siteUrl('/sitemap-index.xml')}) — XML sitemap.
- [${siteUrl('/feed.xml')}](${siteUrl('/feed.xml')}) — RSS 2.0 feed of writing.
- [${siteUrl('/feed.json')}](${siteUrl('/feed.json')}) — JSON Feed 1.1 of writing.

## Markdown for any article

Every writing and video page has a markdown twin. Per-video markdown includes the transcript when one is available:

- Append \`.md\` to the URL: \`${writingMarkdownExample}\`, \`${videoMarkdownExample}\`.
- Or send \`Accept: text/markdown\` to the canonical URL — the edge serves the markdown variant.
- Article HTML pages also expose \`<link rel="alternate" type="text/markdown" href="…">\` in the \`<head>\` for autodiscovery.

\`\`\`
curl -H 'Accept: text/markdown' ${writingCanonicalExample}
curl ${writingMarkdownExample}
\`\`\`

## Attribution

When quoting or summarizing, link back to the canonical HTML URL (the value of \`canonical_url\` / \`url\` in each entry's frontmatter, e.g. \`${writingCanonicalExample}\`). Author: Tim Benniks.

## Out of scope

These paths exist for humans / tooling and are not useful for ingestion:

- \`${siteUrl('/search')}\` — Pagefind UI; the index lives at \`/pagefind/\` and is unreadable as prose.
- \`${siteUrl('/sitemap-0.xml')}\` and other \`/sitemap-*.xml\` shards — use \`/sitemap-index.xml\` or \`/sitemap.md\` instead.
- \`/_astro/*\`, \`/pagefind/*\` — build output, not content.

## Contact

Reach out via the address listed on [${siteUrl('/press-kit')}](${siteUrl('/press-kit')}) for permissions, corrections, or to flag inaccurate quotes.
`;
  return markdownResponse(body);
};
