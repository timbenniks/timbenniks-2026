import type { APIRoute } from 'astro';
import { executePublicTool } from '../../lib/public-tool-handlers';
import { PUBLIC_TOOLS } from '../../lib/public-tools';

export const prerender = false;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

function ok(id: JsonRpcRequest['id'], result: unknown) {
  return { jsonrpc: '2.0', id: id ?? null, result };
}

function err(id: JsonRpcRequest['id'], code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

async function handleMessage(msg: JsonRpcRequest) {
  const { id, method, params } = msg;

  try {
    switch (method) {
      case 'initialize':
        return ok(id, {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'timbenniks.dev', version: '1.0.0' },
        });
      case 'notifications/initialized':
      case 'initialized':
        return null;
      case 'tools/list':
        return ok(id, {
          tools: PUBLIC_TOOLS.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: tool.annotations,
          })),
        });
      case 'tools/call': {
        const name = typeof params?.name === 'string' ? params.name : '';
        const args =
          params?.arguments && typeof params.arguments === 'object'
            ? (params.arguments as Record<string, unknown>)
            : {};
        const result = await executePublicTool(name, args);
        return ok(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: false,
        });
      }
      case 'ping':
        return ok(id, {});
      default:
        return err(id, -32601, `Method not found: ${method ?? '(none)'}`);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (method === 'tools/call') {
      return ok(id, {
        content: [{ type: 'text', text: message }],
        isError: true,
      });
    }
    return err(id, -32603, message);
  }
}

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify(err(null, -32700, 'Parse error')), {
      status: 400,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const messages = Array.isArray(body) ? body : [body];
  const responses = [];
  for (const msg of messages) {
    const res = await handleMessage(msg as JsonRpcRequest);
    if (res) responses.push(res);
  }

  const payload = Array.isArray(body) ? responses : (responses[0] ?? err(null, -32600, 'Invalid Request'));

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
