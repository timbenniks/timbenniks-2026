import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError, JSONRPCMessageSchema } from '@modelcontextprotocol/sdk/types.js';
import { siteUrl } from '../data/site';
import { executePublicTool } from './public-tool-handlers';
import { PUBLIC_TOOLS } from './public-tools';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, MCP-Protocol-Version',
  'Access-Control-Expose-Headers': 'MCP-Protocol-Version',
  'Cache-Control': 'no-store',
};

/** Public read-only endpoint: no credentials, cookies, or per-client server state. */
export async function handleMcpHttp(request: Request): Promise<Response> {
  // Browser calls originate on this site. Remote MCP clients omit Origin.
  const origin = request.headers.get('Origin');
  const allowedOrigins = [new URL(request.url).origin, new URL(siteUrl('/')).origin];
  if (origin && !allowedOrigins.includes(origin)) {
    return new Response('Forbidden origin', { status: 403, headers: corsHeaders });
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  // This server only sends immediate JSON responses, never unsolicited SSE events.
  if (request.method !== 'POST') {
    return new Response(null, {
      status: 405,
      headers: { ...corsHeaders, Allow: 'POST, OPTIONS' },
    });
  }

  // The transport requires `Accept: application/json, text/event-stream`. Many
  // agent probes and audit crawlers send `application/json`, `*/*`, or nothing
  // and get a 406 instead of a handshake. Widen those to the required pair;
  // a client that explicitly asked for something else (`text/html`) still 406s.
  request = withNegotiableAccept(request);

  // Distinguish malformed JSON from a valid JSON value that is not JSON-RPC.
  // The SDK otherwise reports both as parse errors.
  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return rpcInputError(-32700, 'Parse error');
  }
  if (!JSONRPCMessageSchema.safeParse(body).success) {
    return rpcInputError(-32600, 'Invalid Request');
  }

  const server = new Server(
    { name: 'timbenniks.dev', version: '1.1.0' },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: PUBLIC_TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async ({ params }) => {
    if (!PUBLIC_TOOLS.some((tool) => tool.name === params.name)) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${params.name}`);
    }
    try {
      const result = await executePublicTool(params.name, params.arguments ?? {});
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], isError: false };
    } catch (error) {
      return {
        content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
        isError: true,
      };
    }
  });
  // One SDK server per request is deliberate: Vercel instances share no sessions.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    for (const [name, value] of Object.entries(corsHeaders)) response.headers.set(name, value);
    return response;
  } finally {
    await server.close();
  }
}

const REQUIRED_ACCEPT = 'application/json, text/event-stream';

/**
 * Streamable HTTP requires both media types in `Accept`. Treat an absent,
 * wildcard, or JSON-only `Accept` as the required pair so lenient clients can
 * still complete a handshake; anything else is passed through untouched.
 */
function withNegotiableAccept(request: Request): Request {
  const accept = request.headers.get('Accept');
  if (accept?.includes('text/event-stream')) return request;
  const lenient =
    !accept ||
    accept.trim() === '' ||
    accept.includes('*/*') ||
    accept.includes('application/json');
  if (!lenient) return request;
  const headers = new Headers(request.headers);
  headers.set('Accept', REQUIRED_ACCEPT);
  return new Request(request, { headers });
}

function rpcInputError(code: number, message: string): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code, message } }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
