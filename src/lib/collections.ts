import { getCollection, type CollectionEntry } from 'astro:content';

const byDateDesc = <T extends { data: { date: Date } }>(a: T, b: T) =>
  b.data.date.getTime() - a.data.date.getTime();

export type LoadedCollections = {
  writing: CollectionEntry<'writing'>[];
  videos: CollectionEntry<'videos'>[];
  speaking: CollectionEntry<'speaking'>[];
};

// Loads all three collections, sorted newest-first, with drafts excluded from `writing`.
// Used by the GEO endpoints (llms.txt, section indexes, llms-full.txt, sitemap.md).
export async function loadAllSorted(): Promise<LoadedCollections> {
  const [writing, videos, speaking] = await Promise.all([
    getCollection('writing', ({ data }) => !data.draft),
    getCollection('videos'),
    getCollection('speaking'),
  ]);
  return {
    writing: writing.sort(byDateDesc),
    videos: videos.sort(byDateDesc),
    speaking: speaking.sort(byDateDesc),
  };
}

