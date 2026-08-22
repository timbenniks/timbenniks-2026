/**
 * Server-side handlers for public WebMCP tools — shared by /api/mcp and the
 * in-browser script (via fetch to JSON/markdown endpoints where applicable).
 */
import { getCollection } from 'astro:content';
import { siteUrl } from '../data/site';
import { buildAgentIndex, type AgentIndexItem, type AgentIndexType } from './agent-index';
import { findPageByPath, readPagesFile } from './admin/pages-store';
import { loadPage } from './page';
import {
  projectEntryToMarkdown,
  videoEntryToMarkdown,
  writingEntryToMarkdown,
} from './markdown';
import { pageToMarkdown } from './page-to-markdown';
import { BOOKING_EMAIL, PUBLIC_TOOLS } from './public-tools';
import { extractPressKit } from './press-kit';

function clamp(n: unknown, fallback: number, max: number): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(v)));
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

async function searchIndex(args: {
  query?: string;
  type?: string;
  tag?: string;
  year?: string;
  limit: number;
}) {
  const index = await buildAgentIndex();
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

function normalizePath(raw: string): string {
  let path = raw.trim();
  if (path.startsWith('http://') || path.startsWith('https://')) {
    path = new URL(path).pathname;
  }
  if (path.endsWith('.md')) path = path.slice(0, -3);
  if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);
  return path || '/';
}

export async function resolveMarkdown(path: string): Promise<{ path: string; url: string; markdown: string }> {
  const normalized = normalizePath(path);

  if (normalized.startsWith('/writing/')) {
    const id = normalized.slice('/writing/'.length);
    const writing = await getCollection('writing');
    const entry = writing.find((e) => e.id === id);
    if (!entry) throw new Error(`Unknown writing entry: ${id}`);
    return {
      path: `/writing/${id}.md`,
      url: siteUrl(`/writing/${id}`),
      markdown: writingEntryToMarkdown(entry),
    };
  }

  if (normalized.startsWith('/videos/')) {
    const id = normalized.slice('/videos/'.length);
    const videos = await getCollection('videos');
    const entry = videos.find((e) => e.id === id);
    if (!entry) throw new Error(`Unknown video entry: ${id}`);
    return {
      path: `/videos/${id}.md`,
      url: siteUrl(`/videos/${id}`),
      markdown: videoEntryToMarkdown(entry),
    };
  }

  if (normalized.startsWith('/projects/')) {
    const id = normalized.slice('/projects/'.length);
    const projects = await getCollection('projects');
    const entry = projects.find((e) => e.id === id);
    if (!entry) throw new Error(`Unknown project entry: ${id}`);
    return {
      path: `/projects/${id}.md`,
      url: siteUrl(`/projects/${id}`),
      markdown: projectEntryToMarkdown(entry),
    };
  }

  const pageMatch = await findPageByPath(normalized);
  if (pageMatch) {
    const page = await loadPage(pageMatch.id);
    return {
      path: `${normalized === '/' ? '/index' : normalized}.md`,
      url: siteUrl(normalized),
      markdown: pageToMarkdown(page.data),
    };
  }

  throw new Error(
    'path must be a writing, video, project, or static page URL. Example: /writing/the-tool-catalog-is-the-product',
  );
}

export async function executePublicTool(
  name: string,
  args: Record<string, unknown> = {},
  context?: { path?: string },
): Promise<unknown> {
  switch (name) {
    case 'get_page_context': {
      const path = context?.path ?? '/';
      let type = 'page';
      if (path.startsWith('/writing/')) type = 'writing';
      else if (path.startsWith('/videos/')) type = 'video';
      else if (path.startsWith('/projects/')) type = 'project';
      else if (path === '/search') type = 'search';
      else if (path === '/press-kit') type = 'press-kit';
      return {
        url: siteUrl(path),
        path,
        type,
        markdown: path === '/' ? siteUrl('/index.md') : siteUrl(`${path}.md`),
        tools: PUBLIC_TOOLS.map((t) => t.name),
        catalog: siteUrl('/tools.json'),
        mcp: siteUrl('/.well-known/mcp'),
        next:
          type === 'press-kit'
            ? 'Call get_press_kit for bios and photos, or request_booking to draft a booking email.'
            : type === 'search'
              ? 'Call search_site with the user query.'
              : 'Call search_site or list_content to find writing/videos. Call get_content with a path to read one piece. Call get_press_kit to book Tim.',
      };
    }
    case 'search_site':
      return {
        results: await searchIndex({
          query: typeof args.query === 'string' ? args.query : undefined,
          type: typeof args.type === 'string' ? args.type : undefined,
          tag: typeof args.tag === 'string' ? args.tag : undefined,
          year: typeof args.year === 'string' ? args.year : undefined,
          limit: clamp(args.limit, 8, 20),
        }),
        engine: 'index',
      };
    case 'list_content': {
      const type = (typeof args.type === 'string' ? args.type : 'writing') as AgentIndexType;
      const index = await buildAgentIndex();
      const results = index.items
        .filter((item) =>
          itemMatches(item, {
            type,
            tag: typeof args.tag === 'string' ? args.tag : undefined,
            year: typeof args.year === 'string' ? args.year : undefined,
          }),
        )
        .slice(0, clamp(args.limit, 12, 50))
        .map(summarizeItem);
      return { type, count: results.length, results };
    }
    case 'get_content': {
      const raw = typeof args.path === 'string' ? args.path.trim() : '';
      if (!raw) throw new Error('path is required');
      return resolveMarkdown(raw);
    }
    case 'get_press_kit': {
      const pages = await readPagesFile();
      const pressKitPage = pages['press-kit'];
      if (!pressKitPage) throw new Error('press-kit page missing');
      return extractPressKit(pressKitPage);
    }
    case 'request_booking': {
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
        press_kit: siteUrl('/press-kit'),
        press_kit_json: siteUrl('/press-kit.json'),
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
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
