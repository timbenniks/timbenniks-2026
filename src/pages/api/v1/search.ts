import type { APIRoute } from 'astro';
import {
  enumQuery,
  integerQuery,
  methodNotAllowed,
  publicApiHandler,
  problem,
  yearQuery,
} from '../../../lib/public-api';
import { executePublicTool } from '../../../lib/public-tool-handlers';

export const prerender = false;

export const GET: APIRoute = ({ request, url }) => {
  const query = url.searchParams.get('query')?.trim();
  if (!query) {
    return problem(
      request,
      400,
      'MISSING_QUERY',
      'Search query required',
      'The query parameter is required and must not be empty.',
      'Retry with a URL such as /api/v1/search?query=developer%20experience.',
    );
  }

  return publicApiHandler(request, () => {
    const args = {
      query,
      type: enumQuery(url, 'type', ['writing', 'video', 'talk', 'project', 'page']),
      tag: url.searchParams.get('tag') ?? undefined,
      year: yearQuery(url),
      limit: integerQuery(url, 'limit', 1, 20),
    };
    return executePublicTool('search_site', args);
  });
};

export const ALL: APIRoute = ({ request }) => methodNotAllowed(request);
