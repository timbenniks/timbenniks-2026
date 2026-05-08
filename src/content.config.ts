import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// `tags` is intentionally a loose `z.array(z.string())`. The canonical vocabulary
// (17 slugs, lowercase kebab-case) lives in src/lib/tags.ts. Frontmatter should
// only contain those slugs; new entries that drift can be re-aligned by re-running
// `node scripts/migrate-tags.mjs`.

const writing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
  schema: z
    .object({
      title: z.string(),
      description: z.string().optional(),
      date: z.coerce.date(),
      image: z.string().optional(),
      tags: z.array(z.string()).default([]),
      canonical_url: z.string().optional(),
      reading_time: z.union([z.string(), z.number()]).optional(),
      draft: z.boolean().default(false),
    })
    .loose(),
});

const speaking = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/speaking', retainBody: false }),
  schema: z.object({
    conference: z.string(),
    talk: z.string(),
    location: z.string().optional(),
    date: z.coerce.date(),
    link: z.string().optional(),
  }),
});

const videos = defineCollection({
  loader: glob({ pattern: '*/*.md', base: './src/content/videos' }),
  schema: z
    .object({
      title: z.string(),
      description: z.string().optional(),
      date: z.coerce.date(),
      image: z.string().optional(),
      videoId: z.string(),
      playlist: z.string(),
      duration: z.string().optional(),
      tags: z.array(z.string()).default([]),
      transcript: z.string().optional(),
      position: z.string().optional(),
    })
    .loose(),
});

export const collections = { writing, speaking, videos };
