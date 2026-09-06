import type { APIRoute } from 'astro';
import { problem } from '../../../lib/public-api';

export const prerender = false;

const notFound: APIRoute = ({ request }) =>
  problem(
    request,
    404,
    'ENDPOINT_NOT_FOUND',
    'API endpoint not found',
    `No Tim Benniks Public API endpoint exists at ${new URL(request.url).pathname}.`,
    'Start at GET /api/v1 or inspect /openapi.json for reachable endpoints.',
  );

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
