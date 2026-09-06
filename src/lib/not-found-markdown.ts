import { siteUrl } from '../data/site';

/** Agent-friendly 404 body — recovery pointers, not a dead end. */
export function notFoundMarkdownBody(requestedPath?: string): string {
  const pathLine = requestedPath
    ? `Requested path: \`${requestedPath}\`\n\n`
    : '';

  return `# 404 — page not found on Tim Benniks

${pathLine}This URL does not exist on timbenniks.dev. The response status is **404** — do not treat this path as valid content.

## Where to look next

- [llms.txt](${siteUrl('/llms.txt')}) — curated site map for agents (start here)
- [agents.md](${siteUrl('/agents.md')}) — when to use this site and how to call it
- [sitemap.md](${siteUrl('/sitemap.md')}) — markdown URL index with \`.md\` twins
- [content-index.json](${siteUrl('/content-index.json')}) — compact JSON index (writing, videos, talks, projects, pages)
- [tools.json](${siteUrl('/tools.json')}) — public WebMCP tool catalog (search, list, get content, press kit)

## Main sections

- [Home](${siteUrl('/')}) / [index.md](${siteUrl('/index.md')})
- [About Tim Benniks](${siteUrl('/about')}) / [about.md](${siteUrl('/about.md')})
- [Writing](${siteUrl('/writing')}) — append \`.md\` to any article URL
- [Videos](${siteUrl('/videos')}) — append \`.md\` to any video URL
- [Speaking](${siteUrl('/speaking')}) / [press kit](${siteUrl('/press-kit')})
- [Developer resources](${siteUrl('/developers')}) — API docs, OpenAPI spec, MCP manifest

## Search instead of guessing URLs

Use \`search_site\` via [WebMCP tools](${siteUrl('/tools.json')}) or query \`/content-index.json\` with a keyword rather than probing random paths.

Author: Tim Benniks — ${siteUrl('/')}
`;
}

export const NEGOTIATION_VARY = 'Accept, Accept-Encoding';
