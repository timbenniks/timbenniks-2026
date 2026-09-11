import type { APIRoute } from 'astro';
import { siteUrl } from '../../data/site';

/**
 * RFC 9727 API catalog: a linkset naming every developer resource on
 * timbenniks.dev so a client that only knows the origin can find the API
 * documentation, the OpenAPI description and the MCP endpoint by link relation.
 */
export function apiCatalogLinkset() {
  return {
    linkset: [
      {
        anchor: siteUrl('/api/v1'),
        'service-desc': [
          {
            href: siteUrl('/openapi.json'),
            type: 'application/vnd.oai.openapi+json;version=3.1',
            title: 'Tim Benniks Public API — OpenAPI 3.1 description',
          },
        ],
        'service-doc': [
          {
            href: siteUrl('/developers'),
            type: 'text/html',
            title: 'Tim Benniks Developer Resources',
          },
          {
            href: siteUrl('/developers.md'),
            type: 'text/markdown',
            title: 'Tim Benniks Developer Resources (markdown)',
          },
        ],
        'service-meta': [
          {
            href: siteUrl('/api/v1/versions'),
            type: 'application/json',
            title: 'Tim Benniks Public API versioning and deprecation policy',
          },
        ],
        status: [{ href: siteUrl('/api/v1'), type: 'application/json', title: 'API index' }],
      },
      {
        anchor: siteUrl('/api/mcp'),
        'service-desc': [
          {
            href: siteUrl('/.well-known/mcp'),
            type: 'application/json',
            title: 'Tim Benniks MCP server discovery (streamable HTTP)',
          },
        ],
        'service-doc': [
          {
            href: siteUrl('/agents.md'),
            type: 'text/markdown',
            title: 'Agents guide for timbenniks.dev',
          },
        ],
        'service-meta': [
          {
            href: siteUrl('/tools.json'),
            type: 'application/json',
            title: 'Public WebMCP tool catalog',
          },
        ],
      },
    ],
  };
}

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(`${JSON.stringify(apiCatalogLinkset(), null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/linkset+json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
