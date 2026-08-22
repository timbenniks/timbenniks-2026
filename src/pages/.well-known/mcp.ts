import type { APIRoute } from 'astro';
import { jsonResponse } from '../../lib/markdown';
import { mcpDiscoveryManifest } from '../../lib/mcp-discovery';

export const GET: APIRoute = () => {
  return jsonResponse(mcpDiscoveryManifest(), true);
};
