import { getCollection, type CollectionEntry } from 'astro:content';

export const HUB_SOURCES = ['writing', 'videos', 'speaking', 'projects'] as const;
export type HubSource = (typeof HUB_SOURCES)[number];

export const PAGE_HUB_SOURCE: Partial<Record<string, HubSource>> = {
  writing: 'writing',
  videos: 'videos',
  speaking: 'speaking',
  projects: 'projects',
};

export type AdminContentKind = 'article' | 'video' | 'talk' | 'project' | 'playlist';

export type AdminContentItem = {
  kind: AdminContentKind;
  id: string;
  title: string;
  href?: string;
  external?: boolean;
  date?: string;
  meta?: string;
  draft?: boolean;
  childCount?: number;
};

export type HubContentCounts = {
  writing: number;
  videos: number;
  speaking: number;
  projects: number;
  playlists: number;
};

export type ListHubContentOpts = {
  q?: string;
  limit?: number;
  offset?: number;
  playlist?: string;
};

export type ListHubContentResult = {
  items: AdminContentItem[];
  total: number;
  limit: number;
  offset: number;
};

const dateFmt = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

function formatDate(d: Date): string {
  return dateFmt.format(d);
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function playlistSlug(name: string): string {
  return name.replace(/\s+/g, '-');
}

function matchesQuery(haystacks: Array<string | undefined>, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return haystacks.some((h) => h?.toLowerCase().includes(needle));
}

function paginate<T>(items: T[], limit: number, offset: number): T[] {
  return items.slice(offset, offset + limit);
}

function normalizeLimit(raw?: number): number {
  if (raw === undefined || Number.isNaN(raw)) return 20;
  return Math.min(100, Math.max(1, Math.floor(raw)));
}

function normalizeOffset(raw?: number): number {
  if (raw === undefined || Number.isNaN(raw) || raw < 0) return 0;
  return Math.floor(raw);
}

export function isHubSource(value: string): value is HubSource {
  return (HUB_SOURCES as readonly string[]).includes(value);
}

export async function getHubContentCounts(): Promise<HubContentCounts> {
  const [writing, videos, speaking, projects] = await Promise.all([
    getCollection('writing'),
    getCollection('videos'),
    getCollection('speaking'),
    getCollection('projects'),
  ]);
  const playlists = new Set(videos.map((e) => e.data.playlist));
  return {
    writing: writing.length,
    videos: videos.length,
    speaking: speaking.length,
    projects: projects.length,
    playlists: playlists.size,
  };
}

async function listWriting(opts: ListHubContentOpts): Promise<ListHubContentResult> {
  const limit = normalizeLimit(opts.limit);
  const offset = normalizeOffset(opts.offset);
  const q = opts.q?.trim() ?? '';
  const entries = await getCollection('writing');
  const items = entries
    .filter((e) => matchesQuery([e.data.title, e.data.description, e.id], q))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
    .map(
      (e): AdminContentItem => ({
        kind: 'article',
        id: e.id,
        title: e.data.title,
        href: `/writing/${e.id}`,
        date: formatDate(e.data.date),
        meta: isoDay(e.data.date),
        draft: e.data.draft,
      }),
    );
  return { items: paginate(items, limit, offset), total: items.length, limit, offset };
}

async function listSpeaking(opts: ListHubContentOpts): Promise<ListHubContentResult> {
  const limit = normalizeLimit(opts.limit);
  const offset = normalizeOffset(opts.offset);
  const q = opts.q?.trim() ?? '';
  const entries = await getCollection('speaking');
  const items = entries
    .filter((e) =>
      matchesQuery([e.data.talk, e.data.conference, e.data.location, e.id], q),
    )
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
    .map(
      (e): AdminContentItem => ({
        kind: 'talk',
        id: e.id,
        title: e.data.talk,
        href: e.data.link,
        external: Boolean(e.data.link),
        date: formatDate(e.data.date),
        meta: [e.data.conference, e.data.location].filter(Boolean).join(' · '),
      }),
    );
  return { items: paginate(items, limit, offset), total: items.length, limit, offset };
}

async function listProjects(opts: ListHubContentOpts): Promise<ListHubContentResult> {
  const limit = normalizeLimit(opts.limit);
  const offset = normalizeOffset(opts.offset);
  const q = opts.q?.trim() ?? '';
  const entries = await getCollection('projects');
  const items = entries
    .filter((e) => matchesQuery([e.data.title, e.data.tag, e.data.description, e.id], q))
    .sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title))
    .map(
      (e): AdminContentItem => ({
        kind: 'project',
        id: e.id,
        title: e.data.title,
        href: `/projects/${e.id}`,
        meta: e.data.tag,
      }),
    );
  return { items: paginate(items, limit, offset), total: items.length, limit, offset };
}

function playlistSummaries(
  entries: CollectionEntry<'videos'>[],
  q: string,
): AdminContentItem[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    counts.set(e.data.playlist, (counts.get(e.data.playlist) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([name]) => matchesQuery([name, playlistSlug(name)], q))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]): AdminContentItem => {
      const slug = playlistSlug(name);
      return {
        kind: 'playlist',
        id: slug,
        title: name,
        href: `/videos/playlist/${slug}`,
        meta: `${count} video${count === 1 ? '' : 's'}`,
        childCount: count,
      };
    });
}

async function listVideos(opts: ListHubContentOpts): Promise<ListHubContentResult> {
  const limit = normalizeLimit(opts.limit);
  const offset = normalizeOffset(opts.offset);
  const q = opts.q?.trim() ?? '';
  const playlistFilter = opts.playlist?.trim();
  const entries = await getCollection('videos');

  if (!playlistFilter && !q) {
    const items = playlistSummaries(entries, '');
    return { items: paginate(items, limit, offset), total: items.length, limit, offset };
  }

  if (!playlistFilter && q) {
    // Prefer playlist name matches; if none, fall back to video title search.
    const playlists = playlistSummaries(entries, q);
    if (playlists.length > 0) {
      return {
        items: paginate(playlists, limit, offset),
        total: playlists.length,
        limit,
        offset,
      };
    }
  }

  const filtered = entries
    .filter((e) => {
      if (playlistFilter) {
        const slug = playlistSlug(e.data.playlist);
        if (slug !== playlistFilter && e.data.playlist !== playlistFilter) return false;
      }
      return matchesQuery(
        [e.data.title, e.data.description, e.data.playlist, e.id, e.data.videoId],
        q,
      );
    })
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
    .map(
      (e): AdminContentItem => ({
        kind: 'video',
        id: e.id,
        title: e.data.title,
        href: `/videos/${e.id}`,
        date: formatDate(e.data.date),
        meta: [e.data.playlist, e.data.duration].filter(Boolean).join(' · '),
      }),
    );

  return { items: paginate(filtered, limit, offset), total: filtered.length, limit, offset };
}

export async function listHubContent(
  source: HubSource,
  opts: ListHubContentOpts = {},
): Promise<ListHubContentResult> {
  switch (source) {
    case 'writing':
      return listWriting(opts);
    case 'videos':
      return listVideos(opts);
    case 'speaking':
      return listSpeaking(opts);
    case 'projects':
      return listProjects(opts);
  }
}
