import type { CollectionEntry } from 'astro:content';
import type { Project } from '../data/projects';
import { tagLabel } from './tags';
import { resolveYoutubeThumbnail } from './youtube-thumbnail';

export type CardKind = 'article' | 'video' | 'talk' | 'project';

export type CardItem = {
  kind: CardKind;
  title: string;
  href?: string;
  external?: boolean;
  date?: string;
  dateISO?: string;
  dateParts?: { day: string; month: string; year: string };
  image?: string;
  description?: string;
  meta?: string[];
  badge?: string;
  location?: string;
  duration?: string;
  tags?: string[];
  ctaLabel?: string;
};

const usFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});
const talkFormatter = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
});

const formatDateUS = (d: Date) => usFormatter.format(d);
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function talkDateInfo(d: Date) {
  const parts = talkFormatter.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = get('day');
  const month = get('month');
  const year = get('year');
  return { display: `${day} ${month} ${year}`, parts: { day, month, year } };
}

export function articleToCard(
  entry: CollectionEntry<'writing'>,
  opts: { ctaLabel?: string } = {},
): CardItem {
  const { reading_time } = entry.data;
  const read = reading_time ? `${reading_time} min read` : '5 min read';

  return {
    kind: 'article',
    title: entry.data.title,
    href: `/writing/${entry.id}`,
    date: formatDateUS(entry.data.date),
    dateISO: isoDay(entry.data.date),
    image: entry.data.image,
    description: entry.data.description,
    meta: [read],
    tags: entry.data.tags.map(tagLabel),
    ctaLabel: opts.ctaLabel,
  };
}

export async function videoToCard(entry: CollectionEntry<'videos'>): Promise<CardItem> {
  const { url } = await resolveYoutubeThumbnail(entry.data.videoId);
  return {
    kind: 'video',
    title: entry.data.title,
    href: `/videos/${entry.id}`,
    date: formatDateUS(entry.data.date),
    dateISO: isoDay(entry.data.date),
    image: url,
    description: entry.data.description,
    meta: [entry.data.playlist, entry.data.duration].filter(Boolean) as string[],
    badge: entry.data.playlist,
    duration: entry.data.duration,
  };
}

export function talkToCard(entry: CollectionEntry<'speaking'>): CardItem {
  const info = talkDateInfo(entry.data.date);
  return {
    kind: 'talk',
    title: entry.data.talk,
    href: entry.data.link,
    external: Boolean(entry.data.link),
    date: info.display,
    dateISO: isoDay(entry.data.date),
    dateParts: info.parts,
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
