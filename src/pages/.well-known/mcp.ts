import type { APIRoute } from 'astro';
import { jsonResponse } from '../../lib/markdown';
import { handleMcpHttp } from '../../lib/mcp-server';
import { mcpDiscoveryManifest } from '../../lib/mcp-discovery';

export const prerender = false;

/** JSON discovery remains available; protocol requests use the same transport as /api/mcp. */
export const ALL: APIRoute = ({ request }) => {
  if (request.method === 'GET' && !request.headers.get('Accept')?.includes('text/event-stream')) {
    return jsonResponse(mcpDiscoveryManifest(), true);
  }
  return handleMcpHttp(request);
};
