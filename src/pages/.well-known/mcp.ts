import type { APIRoute } from 'astro';
import { jsonResponse } from '../../lib/markdown';
import { handleMcpRequestBody, parseError } from '../../lib/mcp-server';
import { mcpDiscoveryManifest } from '../../lib/mcp-discovery';

export const prerender = false;

export const GET: APIRoute = () => {
  return jsonResponse(mcpDiscoveryManifest(), true);
};

/**
 * Live streamable-HTTP MCP handshake at the well-known URI itself, so an
 * agent can `initialize` / `tools/list` / `tools/call` here directly instead
 * of following `endpoint` to POST /api/mcp.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify(parseError()), {
      status: 400,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const payload = await handleMcpRequestBody(body);

  return new Response(`${JSON.stringify(payload)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
};

export const OPTIONS: APIRoute = () =>
  new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
    },
  });
