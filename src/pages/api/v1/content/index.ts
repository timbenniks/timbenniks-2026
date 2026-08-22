import type { APIRoute } from 'astro';
import {
  enumQuery,
  integerQuery,
  methodNotAllowed,
  publicApiHandler,
  yearQuery,
} from '../../../../lib/public-api';
import { executePublicTool } from '../../../../lib/public-tool-handlers';

export const prerender = false;

export const GET: APIRoute = ({ request, url }) =>
  publicApiHandler(request, () => {
    const args = {
      type: enumQuery(url, 'type', ['writing', 'video', 'talk', 'project', 'page']),
      tag: url.searchParams.get('tag') ?? undefined,
      year: yearQuery(url),
      limit: integerQuery(url, 'limit', 1, 50),
    };
    return executePublicTool('list_content', args);
  });

export const ALL: APIRoute = ({ request }) => methodNotAllowed(request);
