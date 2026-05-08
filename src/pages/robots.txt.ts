import type { APIRoute } from "astro";

const body = (site: URL) => {
  const xml = new URL("sitemap-index.xml", site).href;
  const md = new URL("sitemap.md", site).href;
  const llms = new URL("llms.txt", site).href;
  const llmsFull = new URL("llms-full.txt", site).href;
  const agents = new URL("agents.md", site).href;
  return `User-agent: *
Disallow:

Sitemap: ${xml}
Sitemap: ${md}

# AI agents and crawlers
# - ${llms}        — site overview + curated link index (llmstxt.org)
# - ${llmsFull}   — full corpus, every entry inlined as markdown
# - ${agents}        — instructions for AI agents
# Every /writing/<slug> and /videos/<slug> page has a .md twin and serves
# markdown when called with Accept: text/markdown.
`;
};

export const GET: APIRoute = ({ site }) => {
  return new Response(body(site!), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
