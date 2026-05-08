import type { CollectionEntry } from 'astro:content';
import type { Project } from '../data/projects';
import { tagLabel } from './tags';

export type CardKind = 'article' | 'video' | 'talk' | 'project';

export type CardItem = {
  kind: CardKind;
  title: string;
  href?: string;
  external?: boolean;
  date?: string;
  image?: string;
  description?: string;
  meta?: string[];
  badge?: string;
  location?: string;
  duration?: string;
  tags?: string[];
  ctaLabel?: string;
};

const formatDateUS = (d: Date) =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const formatTalkDate = (d: Date) =>
  d
    .toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' })
    .replace(/,/g, '');

export function articleToCard(
  entry: CollectionEntry<'writing'>,
  opts: { ctaLabel?: string } = {},
): CardItem {
  const readingTime = (entry.data as { reading_time?: string | number }).reading_time;
  const read = readingTime ? `${readingTime} min read` : '5 min read';

  return {
    kind: 'article',
    title: entry.data.title,
    href: `/writing/${entry.id}`,
    date: formatDateUS(entry.data.date),
    image: entry.data.image,
    description: entry.data.description,
    meta: [read],
    tags: entry.data.tags.map(tagLabel),
    ctaLabel: opts.ctaLabel,
  };
}

export function videoToCard(entry: CollectionEntry<'videos'>): CardItem {
  return {
    kind: 'video',
    title: entry.data.title,
    href: `/videos/${entry.id}`,
    date: formatDateUS(entry.data.date),
    image: entry.data.image,
    description: entry.data.description,
    meta: [entry.data.playlist, entry.data.duration].filter(Boolean) as string[],
    badge: entry.data.playlist,
    duration: entry.data.duration,
  };
}

export function talkToCard(entry: CollectionEntry<'speaking'>): CardItem {
  return {
    kind: 'talk',
    title: entry.data.talk,
    href: entry.data.link,
    external: Boolean(entry.data.link),
    date: formatTalkDate(entry.data.date),
    badge: entry.data.conference,
    location: entry.data.location ?? '',
  };
}

export function projectToCard(project: Project): CardItem {
  return {
    kind: 'project',
    title: project.title,
    description: project.description,
    badge: project.tag,
    meta: [project.meta],
  };
}
