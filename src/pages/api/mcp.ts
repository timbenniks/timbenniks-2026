import type { APIRoute } from 'astro';
import { handleMcpHttp } from '../../lib/mcp-server';

export const prerender = false;
export const ALL: APIRoute = ({ request }) => handleMcpHttp(request);
