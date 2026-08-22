import { executePublicTool } from './public-tool-handlers';
import { PUBLIC_TOOLS } from './public-tools';

export type JsonRpcRequest = {
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

export function parseError() {
  return err(null, -32700, 'Parse error');
}

export function invalidRequest() {
  return err(null, -32600, 'Invalid Request');
}

/** Handles one JSON-RPC 2.0 MCP message (initialize, tools/list, tools/call, ping). */
export async function handleMcpMessage(msg: JsonRpcRequest) {
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

/** Handles a full JSON-RPC request body (single message or a batch array). */
export async function handleMcpRequestBody(body: unknown) {
  const messages = Array.isArray(body) ? body : [body];
  const responses = [];
  for (const msg of messages) {
    const res = await handleMcpMessage(msg as JsonRpcRequest);
    if (res) responses.push(res);
  }

  return Array.isArray(body) ? responses : (responses[0] ?? invalidRequest());
}
