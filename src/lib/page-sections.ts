import { getCollection, type CollectionEntry } from 'astro:content';
import {
  articleToCard,
  projectToCard,
  talkToCard,
  videoToCard,
  type CardItem,
} from './card';
import { yearsActive } from './stats';
import { tagLabel } from './tags';
import { playlistHref, playlistLabel, playlistSlug } from './playlists';

type PageSection = CollectionEntry<'pages'>['data']['sections'][number];
type SourceName = 'writing' | 'videos' | 'speaking' | 'projects';
type SourceSection = Extract<PageSection, { source: SourceName }>;

type StatItem = { label: string; value: string | number };
type BrowsePill = { label: string; href: string; count: number };

export type ResolvedPageSection =
  | Exclude<PageSection, SourceSection | { kind: 'stats' } | { kind: 'browse' }>
  | (SourceSection & { items: CardItem[] })
  | (Extract<PageSection, { kind: 'stats' }> & { items: StatItem[] })
  | (Extract<PageSection, { kind: 'browse' }> & {
      pills: BrowsePill[];
      items: CardItem[];
    });

const sortByDateDesc = <T extends { data: { date: Date } }>(arr: T[]) =>
  [...arr].sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

const hasSource = (section: PageSection): section is SourceSection =>
  'source' in section &&
  section.kind !== 'stats' &&
  section.kind !== 'browse';

const pickItems = (items: CardItem[], limit?: number) =>
  limit ? items.slice(0, limit) : items;

const matchesTags = (entryTags: string[], selected: string[]) =>
  selected.some((tag) => entryTags.includes(tag));

const matchesPlaylist = (entryPlaylist: string, selected: string) =>
  entryPlaylist === selected || playlistSlug(entryPlaylist) === selected;

type CardGridSection = Extract<PageSection, { kind: 'card-grid' }>;

const hasCardGridFilters = (section: CardGridSection) =>
  Boolean(section.tags?.length) || Boolean(section.playlist);

async function loadFilteredCardGridItems(
  section: CardGridSection,
): Promise<CardItem[]> {
  const selectedTags = section.tags?.filter(Boolean) ?? [];
  const playlist = section.playlist?.trim() || undefined;

  if (section.source === 'writing' && selectedTags.length) {
    const entries = await getCollection(
      'writing',
      ({ data }) => !data.draft && matchesTags(data.tags, selectedTags),
    );
    return sortByDateDesc(entries).map((entry) => articleToCard(entry));
  }

  if (section.source === 'videos' && (selectedTags.length || playlist)) {
    const entries = await getCollection('videos', ({ data }) => {
      if (playlist && !matchesPlaylist(data.playlist, playlist)) return false;
      if (selectedTags.length && !matchesTags(data.tags, selectedTags)) {
        return false;
      }
      return true;
    });
    return Promise.all(sortByDateDesc(entries).map(videoToCard));
  }

  return loadSourceItems(section.source);
}

async function loadSourceItems(source: SourceName): Promise<CardItem[]> {
  if (source === 'writing') {
    const entries = await getCollection('writing', ({ data }) => !data.draft);
    return sortByDateDesc(entries).map((entry) => articleToCard(entry));
  }

  if (source === 'videos') {
    const entries = await getCollection('videos');
    return Promise.all(sortByDateDesc(entries).map(videoToCard));
  }

  if (source === 'speaking') {
    const entries = await getCollection('speaking');
    return sortByDateDesc(entries).map(talkToCard);
  }

  const entries = await getCollection('projects');
  return [...entries]
    .sort((a, b) => a.data.order - b.data.order)
    .map(projectToCard);
}

async function resolveStats(
  source: 'writing' | 'videos' | 'speaking',
): Promise<StatItem[]> {
  if (source === 'writing') {
    const entries = await getCollection('writing', ({ data }) => !data.draft);
    const tags = new Set(entries.flatMap((e) => e.data.tags));
    return [
      { label: 'Essays', value: entries.length },
      { label: 'Tags', value: tags.size },
      { label: 'Years', value: yearsActive(entries) },
    ];
  }

  if (source === 'videos') {
    const entries = await getCollection('videos');
    const playlists = new Set(entries.map((e) => e.data.playlist));
    return [
      { label: 'Videos', value: entries.length },
      { label: 'Playlists', value: playlists.size },
      { label: 'Years', value: yearsActive(entries) },
    ];
  }

  const entries = await getCollection('speaking');
  const conferences = new Set(entries.map((e) => e.data.conference));
  const locations = new Set(
    entries.map((e) => e.data.location).filter((l): l is string => Boolean(l)),
  );
  return [
    { label: 'Talks', value: entries.length },
    { label: 'Conferences', value: conferences.size },
    { label: 'Cities', value: locations.size },
    { label: 'Years', value: yearsActive(entries) },
  ];
}

async function resolveBrowse(source: 'writing' | 'videos'): Promise<{
  pills: BrowsePill[];
  items: CardItem[];
}> {
  if (source === 'writing') {
    const entries = await getCollection('writing', ({ data }) => !data.draft);
    const tagCounts = new Map<string, number>();
    for (const e of entries) {
      for (const t of e.data.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
    const pills = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag, count]) => ({
        label: tagLabel(tag),
        href: `/writing/tag/${tag}`,
        count,
      }));
    return {
      pills,
      items: sortByDateDesc(entries).map((entry) => articleToCard(entry)),
    };
  }

  const entries = await getCollection('videos');
  const playlistCounts = new Map<string, number>();
  for (const e of entries) {
    playlistCounts.set(
      e.data.playlist,
      (playlistCounts.get(e.data.playlist) ?? 0) + 1,
    );
  }
  const pills = [...playlistCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([playlist, count]) => ({
      label: playlistLabel(playlist),
      href: playlistHref(playlist),
      count,
    }));
  return {
    pills,
    items: await Promise.all(sortByDateDesc(entries).map(videoToCard)),
  };
}

export async function resolvePageSections(
  sections: PageSection[],
): Promise<ResolvedPageSection[]> {
  const sourceNames = [
    ...new Set(sections.filter(hasSource).map((section) => section.source)),
  ];
  const sourceItems = new Map<SourceName, CardItem[]>(
    await Promise.all(
      sourceNames.map(
        async (source) => [source, await loadSourceItems(source)] as const,
      ),
    ),
  );

  const needsSpeakingWindow = sections.some(
    (s) => s.kind === 'card-rows' && s.window && s.window !== 'all',
  );
  const speakingEntries = needsSpeakingWindow
    ? await getCollection('speaking')
    : [];

  return Promise.all(
    sections.map(async (section) => {
      if (section.kind === 'stats') {
        return {
          ...section,
          items: await resolveStats(section.source),
        };
      }

      if (section.kind === 'browse') {
        const { pills, items } = await resolveBrowse(section.source);
        return { ...section, pills, items };
      }

      if (
        section.kind === 'card-rows' &&
        section.source === 'speaking' &&
        section.window !== 'all'
      ) {
        const cutoff = new Date();
        cutoff.setHours(0, 0, 0, 0);
        const filtered = speakingEntries
          .filter((e) =>
            section.window === 'upcoming'
              ? e.data.date >= cutoff
              : e.data.date < cutoff,
          )
          .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
          .map(talkToCard);
        return {
          ...section,
          items: pickItems(filtered, section.limit),
        };
      }

      if (section.kind === 'card-grid' && hasCardGridFilters(section)) {
        return {
          ...section,
          items: pickItems(
            await loadFilteredCardGridItems(section),
            section.limit,
          ),
        };
      }

      if (!hasSource(section)) return section;

      return {
        ...section,
        items: pickItems(sourceItems.get(section.source) ?? [], section.limit),
      };
    }),
  );
}
