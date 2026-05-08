import type { APIRoute } from "astro";

const body = (sitemapURL: URL) => `User-agent: *
Disallow:

Sitemap: ${sitemapURL.href}
`;

export const GET: APIRoute = ({ site }) => {
  const sitemapURL = new URL("sitemap-index.xml", site);
  return new Response(body(sitemapURL), {
    headers: { "Content-Type": "text/plain" },
  });
};
