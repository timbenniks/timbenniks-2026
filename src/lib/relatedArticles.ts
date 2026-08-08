import type { CollectionEntry } from 'astro:content';

/** Pick related writing posts by shared-tag overlap, then recency. */
export function relatedArticles(
  current: CollectionEntry<'writing'>,
  pool: CollectionEntry<'writing'>[],
  limit = 3,
): CollectionEntry<'writing'>[] {
  const tags = new Set(current.data.tags);
  if (tags.size === 0) return [];

  return pool
    .filter((entry) => entry.id !== current.id && !entry.data.draft)
    .map((entry) => {
      let score = 0;
      for (const tag of entry.data.tags) {
        if (tags.has(tag)) score += 1;
      }
      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.entry.data.date.getTime() - a.entry.data.date.getTime();
    })
    .slice(0, limit)
    .map(({ entry }) => entry);
}
