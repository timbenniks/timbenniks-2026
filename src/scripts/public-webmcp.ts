/**
 * Public WebMCP tools for timbenniks.dev.
 *
 * Feature-detects document.modelContext || navigator.modelContext and no-ops
 * when neither exists (every browser except Chrome origin-trial / flag).
 * Handlers fetch same-origin JSON and markdown twins — no admin APIs.
 */
import { BOOKING_EMAIL, PUBLIC_TOOLS } from '../lib/public-tools';
import type { AgentIndex, AgentIndexItem, AgentIndexType } from '../lib/agent-index';

type ModelContext = {
  registerTool?: (tool: {
    name: string;
    description: string;
    inputSchema: unknown;
    annotations?: { readOnlyHint?: boolean };
    execute: (args?: Record<string, unknown>) => Promise<{ content: { type: 'text'; text: string }[] }>;
  }) => unknown;
};

declare global {
  interface Window {
    __tbPublicWebMcp?: {
      ready: boolean;
      tools: string[];
      context?: string;
    };
  }
}

function modelContext(): { ctx: ModelContext; label: string } | null {
  const doc = document as Document & { modelContext?: ModelContext };
  const nav = navigator as Navigator & { modelContext?: ModelContext };
  if (doc.modelContext && typeof doc.modelContext.registerTool === 'function') {
    return { ctx: doc.modelContext, label: 'document.modelContext' };
  }
  if (nav.modelContext && typeof nav.modelContext.registerTool === 'function') {
    return { ctx: nav.modelContext, label: 'navigator.modelContext' };
  }
  return null;
}

function textResult(payload: unknown) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: 'text' as const, text }] };
}

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: 'text' as const, text: message }] };
}

let indexCache: AgentIndex | null = null;

async function loadIndex(): Promise<AgentIndex> {
  if (indexCache) return indexCache;
  const res = await fetch('/content-index.json');
  if (!res.ok) throw new Error(`content-index.json ${res.status}`);
  indexCache = (await res.json()) as AgentIndex;
  return indexCache;
}

function clamp(n: unknown, fallback: number, max: number): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(v)));
}

function mdUrlForPath(pathname: string): string | undefined {
  if (pathname === '/') return '/index.md';
  if (
    pathname.startsWith('/writing/') ||
    pathname.startsWith('/videos/') ||
    pathname.startsWith('/projects/')
  ) {
    return pathname.endsWith('.md') ? pathname : `${pathname}.md`;
  }
  const staticPages = [
    '/about',
    '/press-kit',
    '/uses',
    '/projects',
    '/speaking',
    '/writing',
    '/videos',
    '/ai',
    '/contact',
    '/privacy',
    '/developers',
    '/livestreams',
    '/alive-and-kicking',
  ];
  if (staticPages.includes(pathname)) return `${pathname}.md`;
  return undefined;
}

function sameOriginPath(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw, location.origin);
  } catch {
    return null;
  }
  if (url.origin !== location.origin) return null;
  let path = url.pathname;
  if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}

function markdownFetchPath(path: string): string | null {
  const normalized = sameOriginPath(path);
  if (!normalized) return null;
  if (normalized.endsWith('.md')) return normalized;
  const twin = mdUrlForPath(normalized);
  return twin ?? null;
}

function itemMatches(
  item: AgentIndexItem,
  opts: { query?: string; type?: string; tag?: string; year?: string },
): boolean {
  if (opts.type && item.type !== opts.type) return false;
  if (opts.tag && !(item.tags ?? []).includes(opts.tag)) return false;
  if (opts.year && item.date?.slice(0, 4) !== opts.year) return false;
  if (opts.query) {
    const q = opts.query.toLowerCase();
    const hay = [item.title, item.description, item.conference, ...(item.tags ?? [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

function summarizeItem(item: AgentIndexItem) {
  return {
    type: item.type,
    title: item.title,
    date: item.date,
    description: item.description,
    tags: item.tags,
    url: item.url,
    md: item.md,
    conference: item.conference,
    location: item.location,
    link: item.link,
  };
}

async function searchIndex(args: {
  query?: string;
  type?: string;
  tag?: string;
  year?: string;
  limit: number;
}) {
  const index = await loadIndex();
  const type = (
    args.type === 'writing' ||
    args.type === 'video' ||
    args.type === 'talk' ||
    args.type === 'project' ||
    args.type === 'page'
      ? args.type
      : undefined
  ) as AgentIndexType | undefined;
  return index.items
    .filter((item) =>
      itemMatches(item, {
        query: args.query,
        type,
        tag: args.tag,
        year: args.year,
      }),
    )
    .slice(0, args.limit)
    .map((item) => ({ ...summarizeItem(item), source: 'index' }));
}

const handlers: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  async get_page_context() {
    const path = location.pathname.replace(/\/$/, '') || '/';
    const md = mdUrlForPath(path);
    let type: string = 'page';
    if (path.startsWith('/writing/')) type = 'writing';
    else if (path.startsWith('/videos/')) type = 'video';
    else if (path.startsWith('/projects/')) type = 'project';
    else if (path === '/search') type = 'search';
    else if (path === '/press-kit') type = 'press-kit';
    return {
      url: `${location.origin}${path}`,
      path,
      type,
      markdown: md ? `${location.origin}${md}` : undefined,
      tools: PUBLIC_TOOLS.map((t) => t.name),
      catalog: `${location.origin}/tools.json`,
      next:
        type === 'press-kit'
          ? 'Call get_press_kit for bios and photos, or request_booking to draft a booking email.'
          : type === 'search'
            ? 'Call search_site with the user query.'
            : 'Call search_site or list_content to find writing/videos. Call get_content with a path to read one piece. Call get_press_kit to book Tim.',
    };
  },

  async search_site(args) {
    const query = typeof args.query === 'string' ? args.query : undefined;
    const type = typeof args.type === 'string' ? args.type : undefined;
    const tag = typeof args.tag === 'string' ? args.tag : undefined;
    const year = typeof args.year === 'string' ? args.year : undefined;
    const limit = clamp(args.limit, 8, 20);
    return { results: await searchIndex({ query, type, tag, year, limit }), engine: 'index' };
  },

  async list_content(args) {
    const type = (typeof args.type === 'string' ? args.type : 'writing') as AgentIndexType;
    const tag = typeof args.tag === 'string' ? args.tag : undefined;
    const year = typeof args.year === 'string' ? args.year : undefined;
    const limit = clamp(args.limit, 12, 50);
    const index = await loadIndex();
    const results = index.items
      .filter((item) => itemMatches(item, { type, tag, year }))
      .slice(0, limit)
      .map(summarizeItem);
    return { type, count: results.length, results };
  },

  async get_content(args) {
    const raw = typeof args.path === 'string' ? args.path.trim() : '';
    if (!raw) throw new Error('path is required');
    const mdPath = markdownFetchPath(raw);
    if (!mdPath) {
      throw new Error(
        'path must be a same-origin writing, video, project, or static page URL. Example: /writing/the-tool-catalog-is-the-product',
      );
    }
    const res = await fetch(mdPath);
    if (!res.ok) throw new Error(`${mdPath} returned ${res.status}`);
    const markdown = await res.text();
    return { path: mdPath, url: `${location.origin}${mdPath.replace(/\.md$/, '')}`, markdown };
  },

  async get_press_kit() {
    const res = await fetch('/press-kit.json');
    if (!res.ok) throw new Error(`press-kit.json ${res.status}`);
    return res.json();
  },

  async request_booking(args) {
    const event = typeof args.event === 'string' ? args.event : undefined;
    const dates = typeof args.dates === 'string' ? args.dates : undefined;
    const format = typeof args.format === 'string' ? args.format : undefined;
    const notes = typeof args.notes === 'string' ? args.notes : undefined;
    const subject = event ? `Booking: ${event}` : 'Booking request';
    const bodyLines = [
      'Hi Tim,',
      '',
      event ? `Event: ${event}` : null,
      dates ? `Dates: ${dates}` : null,
      format ? `Format: ${format}` : null,
      notes ? `Notes: ${notes}` : null,
      '',
      'Drafted by an agent on timbenniks.dev — please review before sending.',
    ].filter((line) => line !== null);
    const mailto = `mailto:${BOOKING_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;
    return {
      email: BOOKING_EMAIL,
      press_kit: `${location.origin}/press-kit`,
      press_kit_json: `${location.origin}/press-kit.json`,
      include: [
        'Event or podcast name',
        'Dates or window',
        'Format (keynote, talk, workshop, podcast, panel)',
        'Audience and location',
        'Travel / recording constraints',
      ],
      draft_subject: subject,
      draft_body: bodyLines.join('\n'),
      mailto,
      instruction:
        'Show this draft to the user. Do not send email yourself. Wait for them to confirm.',
    };
  },
};

function register() {
  if (window.__tbPublicWebMcp?.ready) return;
  const found = modelContext();
  const names = PUBLIC_TOOLS.map((t) => t.name);
  if (!found) {
    window.__tbPublicWebMcp = { ready: false, tools: names };
    return;
  }

  for (const tool of PUBLIC_TOOLS) {
    found.ctx.registerTool?.({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
      async execute(args) {
        try {
          const handler = handlers[tool.name];
          if (!handler) throw new Error(`Unknown tool ${tool.name}`);
          return textResult(await handler(args ?? {}));
        } catch (err) {
          return errorResult(err);
        }
      },
    });
  }

  window.__tbPublicWebMcp = { ready: true, tools: names, context: found.label };
  console.info('[webmcp-public] registered', names.length, 'tools on', found.label);
}

register();
