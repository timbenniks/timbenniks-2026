/**
 * Public WebMCP tool catalog — the AI-facing contract for timbenniks.dev.
 *
 * This file is isomorphic: `/tools.json` and `/.well-known/webmcp.json` serialize
 * it, and the browser script registers the same names/schemas on
 * `document.modelContext`. Keep it small. Keep descriptions as prompts.
 */

export const BOOKING_EMAIL = 'hi@timbenniks.dev';

export interface PublicToolDef {
  name: string;
  description: string;
  annotations: { readOnlyHint: boolean; openWorldHint?: boolean };
  inputSchema: {
    type: 'object';
    properties: Record<string, Record<string, unknown>>;
    required?: string[];
  };
}

export const PUBLIC_TOOLS = [
  {
    name: 'get_page_context',
    description:
      'Call this first. Returns what this page is: canonical URL, content type, markdown twin URL if any, and which other tools to use next. No inputs.',
    annotations: { readOnlyHint: true },
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'search_site',
    description:
      'Full-text search across writing and videos. Use when the user is looking for a topic, a talk, or an article by subject rather than a known URL. Prefer this over fetching llms-full.txt. Returns title, type, date, url, markdown url, and a short snippet.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query. Required unless filtering by type/tag/year only.',
        },
        type: {
          type: 'string',
          enum: ['writing', 'video', 'talk', 'project'],
          description: 'Limit to one collection.',
        },
        tag: {
          type: 'string',
          description: 'Canonical tag slug, e.g. ai-engineering, developer-experience, cms.',
        },
        year: {
          type: 'string',
          description: 'Four-digit year, e.g. 2026.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 20,
          description: 'Max results. Default 8.',
        },
      },
    },
  },
  {
    name: 'list_content',
    description:
      'List recent writing, videos, talks, or projects without a search query. Use for "latest essays", "talks in 2025", "projects". Returns compact metadata plus markdown URLs. Default 12 items, max 50.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['writing', 'video', 'talk', 'project', 'page'],
          description: 'Collection to list. Default writing.',
        },
        tag: { type: 'string', description: 'Canonical tag slug (writing/videos).' },
        year: { type: 'string', description: 'Four-digit year.' },
        limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Default 12.' },
      },
    },
  },
  {
    name: 'get_content',
    description:
      'Fetch one piece of content as markdown. Pass a site path or slug: /writing/<id>, /videos/<playlist>/<id>, /projects/<id>, or a static page like /about, /press-kit, /speaking. Do not dump the full corpus. For videos this includes the transcript when one exists.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'Path or URL on this origin, with or without .md. Examples: /writing/the-tool-catalog-is-the-product, /about, /press-kit.md',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'get_press_kit',
    description:
      'Bios (short and long), speaker topics, headshots, on-stage photos, factsheet, and booking email. Use when introducing Tim, booking a talk or podcast, or fetching photos for show notes.',
    annotations: { readOnlyHint: true },
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'request_booking',
    description:
      'How to book Tim for a conference, podcast, or workshop. Returns the email address, what to include in the request, and the press-kit URL. Does not send email — draft a message for the user to confirm.',
    annotations: { readOnlyHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        event: { type: 'string', description: 'Conference, podcast, or event name.' },
        dates: { type: 'string', description: 'Proposed dates or window.' },
        format: {
          type: 'string',
          description: 'keynote, talk, workshop, podcast, panel, other.',
        },
        notes: { type: 'string', description: 'Audience, location, or other context.' },
      },
    },
  },
] as const satisfies readonly PublicToolDef[];

export type PublicToolName = (typeof PUBLIC_TOOLS)[number]['name'];

export function publicToolCatalog() {
  return {
    name: 'timbenniks.dev',
    description:
      'Public tools for AI agents visiting timbenniks.dev. Read-only. Admin CMS tools live on /admin and are not listed here.',
    homepage: 'https://timbenniks.dev',
    agents_guide: 'https://timbenniks.dev/agents.md',
    llms: 'https://timbenniks.dev/llms.txt',
    developers: 'https://timbenniks.dev/developers',
    openapi: 'https://timbenniks.dev/openapi.json',
    mcp_discovery: 'https://timbenniks.dev/.well-known/mcp',
    mcp_endpoint: 'https://timbenniks.dev/api/mcp',
    booking_email: BOOKING_EMAIL,
    tools: PUBLIC_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      annotations: tool.annotations,
      inputSchema: tool.inputSchema,
    })),
  };
}
