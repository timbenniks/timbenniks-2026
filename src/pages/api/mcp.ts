import type { APIRoute } from 'astro';
import { handleMcpRequestBody, parseError } from '../../lib/mcp-server';

export const prerender = false;

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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
    },
  });

export const GET: APIRoute = () =>
  new Response(JSON.stringify({ status: 'ok', transport: 'streamable-http', methods: ['POST'] }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
