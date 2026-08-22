import { siteUrl } from '../data/site';
import { PUBLIC_TOOLS } from './public-tools';

/** OpenAPI 3.1 description of the Tim Benniks public agent API surfaces. */
export function publicAgentOpenApi() {
  const paths: Record<string, unknown> = {
    '/tools.json': {
      get: {
        operationId: 'getToolCatalog',
        summary: 'Tim Benniks WebMCP tool catalog',
        description: 'JSON catalog of public read-only tools for AI agents visiting timbenniks.dev.',
        tags: ['Tim Benniks MCP'],
        responses: {
          '200': {
            description: 'Tool catalog with JSON Schema inputs',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/content-index.json': {
      get: {
        operationId: 'getContentIndex',
        summary: 'Tim Benniks content index',
        description: 'Compact index of writing, videos, talks, projects, and pages with markdown URLs.',
        tags: ['Tim Benniks Developer API'],
        responses: {
          '200': {
            description: 'Content index',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/agents.md': {
      get: {
        operationId: 'getAgentsGuide',
        summary: 'Tim Benniks agent instructions',
        tags: ['Tim Benniks Developer API'],
        responses: {
          '200': {
            description: 'Markdown agent guide',
            content: { 'text/markdown': { schema: { type: 'string' } } },
          },
        },
      },
    },
    '/llms.txt': {
      get: {
        operationId: 'getLlmsTxt',
        summary: 'Tim Benniks llms.txt site map',
        tags: ['Tim Benniks Developer API'],
        responses: {
          '200': {
            description: 'llmstxt.org site overview',
            content: { 'text/plain': { schema: { type: 'string' } } },
          },
        },
      },
    },
    '/.well-known/mcp': {
      get: {
        operationId: 'getMcpDiscovery',
        summary: 'Tim Benniks MCP discovery handshake',
        tags: ['Tim Benniks MCP'],
        responses: {
          '200': {
            description: 'MCP server discovery manifest',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/api/mcp': {
      post: {
        operationId: 'mcpJsonRpc',
        summary: 'Tim Benniks streamable HTTP MCP endpoint',
        description: 'JSON-RPC 2.0 MCP endpoint exposing the six public read-only tools.',
        tags: ['Tim Benniks MCP'],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          '200': {
            description: 'JSON-RPC response',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
  };

  for (const tool of PUBLIC_TOOLS) {
    paths[`/api/mcp#${tool.name}`] = {
      post: {
        operationId: tool.name,
        summary: tool.name,
        description: tool.description,
        tags: ['Tim Benniks MCP Tools'],
        requestBody: {
          content: {
            'application/json': {
              schema: tool.inputSchema,
            },
          },
        },
        responses: {
          '200': { description: 'Tool result (via tools/call on /api/mcp)' },
        },
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Tim Benniks Developer API',
      version: '1.0.0',
      description:
        'Machine-readable surfaces for AI agents and developers consuming timbenniks.dev — Tim Benniks personal site. Prefer /llms.txt and /agents.md for discovery; use /api/mcp for native MCP tool calls.',
      contact: {
        name: 'Tim Benniks',
        email: 'hi@timbenniks.dev',
        url: siteUrl('/contact'),
      },
    },
    servers: [{ url: siteUrl('/') }],
    tags: [
      { name: 'Tim Benniks MCP', description: 'Model Context Protocol discovery and transport' },
      { name: 'Tim Benniks MCP Tools', description: 'Read-only public tool definitions' },
      { name: 'Tim Benniks Developer API', description: 'Indexes, feeds, and markdown twins' },
    ],
    paths,
  };
}
