import type { APIRoute } from 'astro';
import { jsonResponse } from '../../lib/markdown';
import { publicToolCatalog } from '../../lib/public-tools';

export const GET: APIRoute = () => jsonResponse(publicToolCatalog(), true);
