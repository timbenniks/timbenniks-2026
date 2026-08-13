import type { CollectionEntry } from 'astro:content';
import { siteUrl } from '../data/site';
import { playlistLabel } from './playlists';
import { cleanVideoDescription, firstSentence, oneLine } from './video-description';

export function writingIndexLine(
  entry: CollectionEntry<'writing'>,
  opts: { oneSentence?: boolean } = {},
): string {
  const href = siteUrl(`/writing/${entry.id}.md`);
  const raw = entry.data.description?.trim();
  if (!raw) return `- [${entry.data.title}](${href})`;
  const desc = opts.oneSentence ? firstSentence(raw) : oneLine(raw);
  return `- [${entry.data.title}](${href}): ${desc}`;
}

export function videoIndexLine(entry: CollectionEntry<'videos'>): string {
  const href = siteUrl(`/videos/${entry.id}.md`);
  const desc = cleanVideoDescription(entry.data.description);
  return desc
    ? `- [${entry.data.title}](${href}): ${desc}`
    : `- [${entry.data.title}](${href})`;
}

export function videoCorpusBlurb(videos: CollectionEntry<'videos'>[]): string[] {
  const playlists = [...new Set(videos.map((v) => v.data.playlist))]
    .map(playlistLabel)
    .sort((a, b) => a.localeCompare(b));
  const years = videos.map((v) => v.data.date.getUTCFullYear());
  const from = Math.min(...years);
  const to = Math.max(...years);
  const range = from === to ? `${from}` : `${from}–${to}`;
  const playlistList =
    playlists.length <= 4
      ? playlists.join(', ')
      : `${playlists.slice(0, 4).join(', ')}, and others`;
  return [
    `${videos.length} videos (${range}) across playlists including ${playlistList}. Workshops, demos, livestreams, and talks — each entry has a markdown twin with metadata and, when available, a transcript.`,
    `Full index: ${siteUrl('/videos/llms.txt')}`,
    `Browse by playlist: ${siteUrl('/videos')}`,
  ];
}
