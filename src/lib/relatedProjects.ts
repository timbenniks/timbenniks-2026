import type { CollectionEntry } from 'astro:content';

function tokens(...parts: string[]): Set<string> {
  const out = new Set<string>();
  for (const part of parts) {
    for (const t of part.toLowerCase().split(/[^a-z0-9]+/)) {
      if (t.length > 2) out.add(t);
    }
  }
  return out;
}

/** Score projects by overlapping words in tag / meta / title. */
export function relatedProjects(
  current: CollectionEntry<'projects'>,
  pool: CollectionEntry<'projects'>[],
  limit = 3,
): CollectionEntry<'projects'>[] {
  const mine = tokens(current.data.tag, current.data.meta, current.data.title);

  return pool
    .filter((entry) => entry.id !== current.id)
    .map((entry) => {
      const theirs = tokens(entry.data.tag, entry.data.meta, entry.data.title);
      let score = 0;
      for (const t of mine) {
        if (theirs.has(t)) score += 1;
      }
      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.entry.data.order - b.entry.data.order;
    })
    .slice(0, limit)
    .map(({ entry }) => entry);
}
