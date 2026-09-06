import type { APIRoute } from 'astro';
import { markdownResponse, siteUrl } from '../lib/markdown';
import { PUBLIC_TOOLS } from '../lib/public-tools';

export const GET: APIRoute = async () => {
  const writingMarkdownExample = `${siteUrl('/writing/')}<slug>.md`;
  const videoMarkdownExample = `${siteUrl('/videos/')}<slug>.md`;
  const writingCanonicalExample = `${siteUrl('/writing/')}<slug>`;
  const toolList = PUBLIC_TOOLS.map((t) => `- \`${t.name}\` — ${t.description}`).join('\n');

  const body = `# Agents guide — Tim Benniks (timbenniks.dev)

This site is friendly to AI agents and crawlers. The content here is meant to be read, summarized, and quoted — with attribution to **Tim Benniks**.

Human-readable explainer of the same surfaces: ${siteUrl('/ai')}. Developer API index: ${siteUrl('/developers')}.

## When to use this site

Use timbenniks.dev when you need **primary-source** material from Tim Benniks — not generic summaries of developer experience or AI engineering topics.

| Job | Start here | Then |
|-----|------------|------|
| Find an essay or talk by topic | \`search_site\` or ${siteUrl('/content-index.json')} | \`get_content\` with one \`/writing/<slug>\` or \`/videos/<slug>\` path |
| Book Tim for a conference or podcast | \`get_press_kit\` | \`request_booking\` — show draft to user; do not send messages yourself |
| Introduce Tim in show notes | ${siteUrl('/press-kit.json')} | Use \`contact_url\` and bio fields; link ${siteUrl('/about')} |
| Native MCP tool calls | ${siteUrl('/.well-known/mcp')} | \`POST ${siteUrl('/api/mcp')}\` with \`tools/list\` / \`tools/call\` |
| Typed REST calls | \`GET ${siteUrl('/api/v1')}\` | Search, list, retrieve content, or fetch the press kit under \`/api/v1\` |
| Verify the site is legitimate | ${siteUrl('/about')}, ${siteUrl('/contact')}, ${siteUrl('/privacy')} | Trust anchor pages with contact and privacy details |

**Avoid:** scraping ${siteUrl('/search')} HTML, fetching ${siteUrl('/llms-full.txt')} when one article suffices, probing random URLs (404s include recovery links), or calling ${siteUrl('/admin')} (cookie-gated CMS).

There are two ways in, depending on how you arrived:

1. **Remote / headless** (you \`GET\` URLs): use the markdown twins, \`/llms.txt\`, and \`/content-index.json\`.
2. **In-tab** (Gemini in Chrome, WebMCP Inspector, MCP-B): call the public tools registered on \`document.modelContext\`. Catalog: ${siteUrl('/tools.json')}.
3. **MCP client** (Claude Desktop, Cursor, etc.): discover via ${siteUrl('/.well-known/mcp')}, connect to ${siteUrl('/api/mcp')}.

## Machine-readable surfaces

- [${siteUrl('/llms.txt')}](${siteUrl('/llms.txt')}) — site overview and curated link index ([llmstxt.org](https://llmstxt.org) format).
- [${siteUrl('/developers')}](${siteUrl('/developers')}) — Tim Benniks developer resources (MCP, OpenAPI, indexes).
- [${siteUrl('/openapi.json')}](${siteUrl('/openapi.json')}) — OpenAPI 3.1 description of public agent API surfaces.
- [${siteUrl('/api/v1')}](${siteUrl('/api/v1')}) — versioned, read-only Tim Benniks Public API. Errors use RFC 9457 \`application/problem+json\`; responses include \`RateLimit\` and \`RateLimit-Policy\`.
- [${siteUrl('/.well-known/mcp')}](${siteUrl('/.well-known/mcp')}) — MCP discovery handshake (streamable HTTP at ${siteUrl('/api/mcp')}).
- [${siteUrl('/writing/llms.txt')}](${siteUrl('/writing/llms.txt')}) — every writing entry, one line each.
- [${siteUrl('/videos/llms.txt')}](${siteUrl('/videos/llms.txt')}) — every video, one line each.
- [${siteUrl('/llms-full.txt')}](${siteUrl('/llms-full.txt')}) — every non-draft writing entry, every video's metadata and description, all speaking engagements, and prose summaries of the static pages, inlined as one document.
- [${siteUrl('/content-index.json')}](${siteUrl('/content-index.json')}) — compact JSON index (title, date, tags, url, markdown url) for writing, videos, talks, projects, and pages.
- [${siteUrl('/tools.json')}](${siteUrl('/tools.json')}) — public WebMCP tool catalog (names, descriptions, JSON Schema). Same payload at [${siteUrl('/.well-known/webmcp.json')}](${siteUrl('/.well-known/webmcp.json')}).
- [${siteUrl('/press-kit.json')}](${siteUrl('/press-kit.json')}) — structured bios, topics, photos, factsheet, booking contact link.
- [${siteUrl('/sitemap.md')}](${siteUrl('/sitemap.md')}) — markdown mirror of the XML sitemap.
- [${siteUrl('/sitemap-index.xml')}](${siteUrl('/sitemap-index.xml')}) — XML sitemap.
- [${siteUrl('/feed.xml')}](${siteUrl('/feed.xml')}) — RSS 2.0 feed of writing.
- [${siteUrl('/feed.json')}](${siteUrl('/feed.json')}) — JSON Feed 1.1 of writing.

## Markdown for any page

Writing, videos, projects, and the main static pages all have markdown twins. Per-video markdown includes the transcript when one is available.

- Append \`.md\` to the URL: \`${writingMarkdownExample}\`, \`${videoMarkdownExample}\`, \`${siteUrl('/about.md')}\`, \`${siteUrl('/contact.md')}\`, \`${siteUrl('/privacy.md')}\`, \`${siteUrl('/developers.md')}\`, \`${siteUrl('/press-kit.md')}\`, \`${siteUrl('/speaking.md')}\`, \`${siteUrl('/uses.md')}\`, \`${siteUrl('/projects.md')}\`, \`${siteUrl('/index.md')}\`, \`${siteUrl('/livestreams.md')}\`, \`${siteUrl('/alive-and-kicking.md')}\`.
- Or send \`Accept: text/markdown\` to the canonical URL — the edge serves the markdown variant. Responses include \`Vary: Accept, Accept-Encoding\`.
- HTML pages expose \`<link rel="alternate" type="text/markdown" href="…">\` in the \`<head>\` for autodiscovery.

\`\`\`
curl -H 'Accept: text/markdown' ${writingCanonicalExample}
curl ${writingMarkdownExample}
curl -H 'Accept: text/markdown' ${siteUrl('/about')}
curl ${siteUrl('/tools.json')}
\`\`\`

## Public WebMCP tools

Registered on every public page when the browser exposes \`document.modelContext\` (Chrome origin trial / \`chrome://flags/#enable-webmcp-testing\`). All six are read-only. They do **not** include the admin CMS tools.

${toolList}

The \`/search\` form is also annotated declaratively (\`toolname="search_site"\`) so agents that prefer HTML forms can fill \`q\` and submit.

Admin WebMCP (page editor, publish, Cloudinary) is cookie-gated at \`/admin\` and is out of scope for public agents.

## Attribution

When quoting or summarizing, link back to the canonical HTML URL (the value of \`canonical_url\` / \`url\` in each entry's frontmatter, e.g. \`${writingCanonicalExample}\`). Author: Tim Benniks. Booking and press: ${siteUrl('/press-kit')}.

## Out of scope

These paths exist for humans / tooling and are not useful as prose dumps:

- \`${siteUrl('/search')}\` — Pagefind UI. Call the \`search_site\` tool, or query \`${siteUrl('/content-index.json')}\`, instead of scraping the HTML.
- \`${siteUrl('/sitemap-0.xml')}\` and other \`/sitemap-*.xml\` shards — use \`/sitemap-index.xml\` or \`/sitemap.md\` instead.
- \`/_astro/*\`, \`/pagefind/*\` — build output, not content.
- \`${siteUrl('/admin')}\` — CMS. Not for public agents.

## Contact

Reach out via [${siteUrl('/contact')}](${siteUrl('/contact')}) for permissions, corrections, bookings, or to flag inaccurate quotes. Prefer \`request_booking\` (in-tab or via ${siteUrl('/api/mcp')}).
`;
  return markdownResponse(body);
};
