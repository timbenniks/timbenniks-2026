import { getCollection, type CollectionEntry } from 'astro:content';
import {
  articleToCard,
  projectToCard,
  talkToCard,
  videoToCard,
  type CardItem,
} from './card';

type PageSection = CollectionEntry<'pages'>['data']['sections'][number];
type SourceName = 'writing' | 'videos' | 'speaking' | 'projects';
type SourceSection = Extract<PageSection, { source: SourceName }>;

export type ResolvedPageSection =
  | Exclude<PageSection, SourceSection>
  | (SourceSection & { items: CardItem[] });

const sortByDateDesc = <T extends { data: { date: Date } }>(arr: T[]) =>
  [...arr].sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

const hasSource = (section: PageSection): section is SourceSection =>
  'source' in section;

const pickItems = (items: CardItem[], limit?: number) =>
  limit ? items.slice(0, limit) : items;

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

export async function resolvePageSections(
  sections: PageSection[],
): Promise<ResolvedPageSection[]> {
  const sources = [...new Set(sections.filter(hasSource).map((section) => section.source))];
  const sourceItems = new Map<SourceName, CardItem[]>(
    await Promise.all(
      sources.map(async (source) => [source, await loadSourceItems(source)] as const),
    ),
  );

  return sections.map((section) => {
    if (!hasSource(section)) return section;

    return {
      ...section,
      items: pickItems(sourceItems.get(section.source) ?? [], section.limit),
    };
  });
}
