import type { APIRoute } from "astro";

const body = (site: URL) => {
  const xml = new URL("sitemap-index.xml", site).href;
  const md = new URL("sitemap.md", site).href;
  const llms = new URL("llms.txt", site).href;
  const llmsWriting = new URL("writing/llms.txt", site).href;
  const llmsVideos = new URL("videos/llms.txt", site).href;
  const llmsFull = new URL("llms-full.txt", site).href;
  const agents = new URL("agents.md", site).href;
  const tools = new URL("tools.json", site).href;
  return `User-agent: *
Disallow:

Sitemap: ${xml}
Sitemap: ${md}

# AI agents and crawlers
# - ${llms}        — site overview + curated link index (llmstxt.org)
# - ${llmsWriting} — every writing entry, one line each
# - ${llmsVideos}  — every video, one line each
# - ${llmsFull}   — full corpus, every entry inlined as markdown
# - ${agents}        — instructions for AI agents
# - ${tools}       — public WebMCP tool catalog
# Markdown twins: /writing/<slug>.md /videos/<slug>.md /projects/<slug>.md
# Static pages: /about.md /press-kit.md /speaking.md /uses.md /projects.md /index.md /livestreams.md /alive-and-kicking.md
# Accept: text/markdown on canonical URLs rewrites to the .md twin.
`;
};

export const GET: APIRoute = ({ site }) => {
  return new Response(body(site!), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
