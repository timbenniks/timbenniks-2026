import type { APIRoute } from 'astro';
import { methodNotAllowed, publicApiHandler } from '../../../lib/public-api';
import { executePublicTool } from '../../../lib/public-tool-handlers';

export const prerender = false;

export const GET: APIRoute = ({ request }) =>
  publicApiHandler(request, () => executePublicTool('get_press_kit'));

export const ALL: APIRoute = ({ request }) => methodNotAllowed(request);
