import { test, expect } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const headers = { Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25' };
for (const endpoint of ['/api/mcp', '/.well-known/mcp']) {
  test(`${endpoint}: official SDK initializes, lists, calls and closes`, async ({ baseURL }) => {
    const client = new Client({ name: 'site-regression-test', version: '1.0.0' });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(endpoint, baseURL)));
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(6);
      expect(tools.every(tool => tool.annotations?.readOnlyHint)).toBe(true);
      const argumentsByTool: Record<string, Record<string, unknown>> = {
        search_site: { query: 'mcp', limit: 2 }, list_content: { limit: 2 }, get_content: { path: '/about' },
      };
      for (const tool of tools) {
        const result = await client.callTool({ name: tool.name, arguments: argumentsByTool[tool.name] ?? {} });
        expect(result.isError, tool.name).toBe(false);
        expect(result.content).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'text' })]));
      }
      await expect(client.callTool({ name: 'nonexistent_tool', arguments: {} })).rejects.toMatchObject({ code: -32602 });
      const missing = await client.callTool({ name: 'get_content', arguments: { path: '/writing/no-such-entry' } });
      expect(missing.isError).toBe(true);
    } finally { await client.close(); }
  });

  test(`${endpoint}: notifications have no JSON-RPC response`, async ({ request }) => {
    for (const method of ['notifications/initialized', 'notifications/cancelled']) {
      const response = await request.post(endpoint, { headers, data: { jsonrpc: '2.0', method, params: { requestId: 42 } } });
      expect(response.status()).toBe(202);
      expect(await response.text()).toBe('');
    }
  });

  test(`${endpoint}: negotiates versions and rejects unsupported version headers`, async ({ request }) => {
    for (const version of ['2025-03-26', '2025-06-18', '2025-11-25', '2099-01-01']) {
      const response = await request.post(endpoint, { headers: { Accept: headers.Accept }, data: {
        jsonrpc: '2.0', id: 1, method: 'initialize', params: {
          protocolVersion: version, capabilities: {}, clientInfo: { name: 'test', version: '1' },
        },
      } });
      expect(response.status()).toBe(200);
      expect((await response.json()).result.protocolVersion).toBe(version === '2099-01-01' ? '2025-11-25' : version);
    }
    const response = await request.post(endpoint, { headers: { ...headers, 'MCP-Protocol-Version': 'invalid' }, data: { jsonrpc: '2.0', id: 2, method: 'ping' } });
    expect(response.status()).toBe(400);
  });

  test(`${endpoint}: malformed input returns protocol errors without crashing`, async ({ request }) => {
    for (const data of [null, [], [{ jsonrpc: '2.0', id: 1, method: 'ping' }], { method: 'ping' }]) {
      const response = await request.post(endpoint, { headers: { ...headers, 'Content-Type': 'application/json' }, data: Buffer.from(JSON.stringify(data)) });
      expect(response.status()).toBe(400);
      expect((await response.json()).error.code).toBe(-32600);
    }
    const malformed = await request.post(endpoint, { headers: { ...headers, 'Content-Type': 'application/json' }, data: Buffer.from('{') });
    expect(malformed.status()).toBe(400);
    expect((await malformed.json()).error.code).toBe(-32700);
  });

  test(`${endpoint}: streaming, origins, media types and CORS follow the transport contract`, async ({ request }) => {
    const stream = await request.get(endpoint, { headers: { Accept: 'text/event-stream' } });
    expect(stream.status()).toBe(405);
    const badOrigin = await request.post(endpoint, { headers: { ...headers, Origin: 'https://untrusted.invalid' }, data: { jsonrpc: '2.0', id: 1, method: 'ping' } });
    expect(badOrigin.status()).toBe(403);
    const preflight = await request.fetch(endpoint, { method: 'OPTIONS', headers: { 'Access-Control-Request-Headers': 'Content-Type, Accept, MCP-Protocol-Version' } });
    expect(preflight.status()).toBe(204);
    expect(preflight.headers()['access-control-allow-headers']).toContain('MCP-Protocol-Version');
    const unacceptable = await request.post(endpoint, { headers: { Accept: 'text/html' }, data: { jsonrpc: '2.0', id: 1, method: 'ping' } });
    expect(unacceptable.status()).toBe(406);
  });
}

test('published curl example performs a complete handshake', async ({ request }) => {
  const { readFileSync } = await import('node:fs');
  const pages = JSON.parse(readFileSync('src/content/pages.json', 'utf8'));
  const example = pages.developers.sections.flatMap((section: any) => section.items ?? [])
    .find((item: any) => item.label === 'List the tools · MCP handshake').body as string;
  const messages = [...example.matchAll(/-d '([^']+)'/g)].map(match => JSON.parse(match[1]));
  expect(messages.map(message => message.method)).toEqual(['initialize', 'notifications/initialized', 'tools/list']);
  expect(example).toContain('Accept: application/json, text/event-stream');
  for (const message of messages) {
    const response = await request.post('/api/mcp', { headers, data: message });
    expect(response.status()).toBe(message.id ? 200 : 202);
    if (message.method === 'initialize') expect((await response.json()).result.protocolVersion).toBe('2025-11-25');
    if (message.method === 'tools/list') expect((await response.json()).result.tools).toHaveLength(6);
  }
});
