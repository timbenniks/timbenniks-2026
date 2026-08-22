import type { APIRoute } from 'astro';
import { siteUrl } from '../../../data/site';
import { methodNotAllowed, publicApiResponse } from '../../../lib/public-api';

export const prerender = false;

export const GET: APIRoute = ({ request }) =>
  publicApiResponse(request, {
    name: 'Tim Benniks Public API',
    version: 'v1',
    status: 'ok',
    documentation: siteUrl('/developers'),
    openapi: siteUrl('/openapi.json'),
    endpoints: {
      search: siteUrl('/api/v1/search'),
      content: siteUrl('/api/v1/content'),
      press_kit: siteUrl('/api/v1/press-kit'),
      versions: siteUrl('/api/v1/versions'),
    },
  });

export const ALL: APIRoute = ({ request }) => methodNotAllowed(request);
