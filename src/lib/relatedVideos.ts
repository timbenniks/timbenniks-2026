import type { CollectionEntry } from 'astro:content';

/** Prefer same playlist, then fill with tag overlap, then recency. */
export function relatedVideos(
  current: CollectionEntry<'videos'>,
  pool: CollectionEntry<'videos'>[],
  limit = 3,
): CollectionEntry<'videos'>[] {
  const others = pool.filter((entry) => entry.id !== current.id);
  const picked: CollectionEntry<'videos'>[] = [];
  const seen = new Set<string>();

  const take = (entry: CollectionEntry<'videos'>) => {
    if (seen.has(entry.id) || picked.length >= limit) return;
    seen.add(entry.id);
    picked.push(entry);
  };

  others
    .filter((entry) => entry.data.playlist === current.data.playlist)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
    .forEach(take);

  if (picked.length >= limit) return picked;

  const tags = new Set(current.data.tags ?? []);
  if (tags.size > 0) {
    others
      .map((entry) => {
        let score = 0;
        for (const tag of entry.data.tags ?? []) {
          if (tags.has(tag)) score += 1;
        }
        return { entry, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.entry.data.date.getTime() - a.entry.data.date.getTime();
      })
      .forEach(({ entry }) => take(entry));
  }

  if (picked.length < limit) {
    others
      .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
      .forEach(take);
  }

  return picked;
}

export function playlistHref(playlist: string): string {
  return `/videos/playlist/${playlist.replace(/\s+/g, '-')}`;
}
