import { siteUrl } from '../data/site';
import { PUBLIC_TOOLS } from './public-tools';

/** Discovery manifest for /.well-known/mcp (RFC 8615 + MCP ecosystem conventions). */
export function mcpDiscoveryManifest() {
  return {
    name: 'Tim Benniks',
    description:
      'Public read-only MCP tools for timbenniks.dev — search writing and videos, fetch markdown content, press kit, and booking info for Tim Benniks.',
    icon: siteUrl('/favicon.svg'),
    homepage: siteUrl('/'),
    documentation: siteUrl('/developers'),
    agents_guide: siteUrl('/agents.md'),
    llms: siteUrl('/llms.txt'),
    tools_catalog: siteUrl('/tools.json'),
    openapi: siteUrl('/openapi.json'),
    endpoint: siteUrl('/api/mcp'),
    handshake: siteUrl('/.well-known/mcp'),
    transport: 'streamable-http',
    authentication: { required: false },
    note: 'GET returns this discovery document. POST JSON-RPC 2.0 (initialize, tools/list, tools/call) to this same URL, or to `endpoint`, for a live handshake.',
    capabilities: {
      tools: PUBLIC_TOOLS.map((t) => t.name),
    },
  };
}
