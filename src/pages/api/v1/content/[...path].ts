import type { APIRoute } from 'astro';
import { methodNotAllowed, problem, publicApiHandler } from '../../../../lib/public-api';
import { executePublicTool } from '../../../../lib/public-tool-handlers';

export const prerender = false;

export const GET: APIRoute = ({ params, request }) => {
  const path = params.path?.trim();
  if (!path) {
    return problem(
      request,
      400,
      'MISSING_CONTENT_PATH',
      'Content path required',
      'Add a site-relative content path after /api/v1/content/.',
      'Discover paths with GET /api/v1/search or GET /api/v1/content.',
    );
  }
  return publicApiHandler(request, () => executePublicTool('get_content', { path: `/${path}` }));
};

export const ALL: APIRoute = ({ request }) => methodNotAllowed(request);
