import type { APIRoute } from 'astro';
import { apiVersionsPolicy } from '../../../lib/api-versioning';
import { methodNotAllowed, publicApiResponse } from '../../../lib/public-api';

export const prerender = false;

export const GET: APIRoute = ({ request }) => publicApiResponse(request, apiVersionsPolicy());

export const ALL: APIRoute = ({ request }) => methodNotAllowed(request);
