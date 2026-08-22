import type { APIRoute } from 'astro';
import { jsonResponse } from '../lib/markdown';
import { publicAgentOpenApi } from '../lib/openapi-tools';

export const GET: APIRoute = () => jsonResponse(publicAgentOpenApi(), true);
