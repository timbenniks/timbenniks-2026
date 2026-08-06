import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';
import { pageDataSchema } from './lib/page-schema';

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
      faqs: z
        .array(
          z.object({
            question: z.string(),
            answer: z.string(),
          }),
        )
        .optional(),
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

const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    tag: z.string(),
    description: z.string(),
    meta: z.string(),
    order: z.number().default(999),
    // Optional outbound links, surfaced on the card footer and detail page.
    github: z.url().optional(),
    live: z.url().optional(),
    docs: z.url().optional(),
    npm: z.string().optional(),
  }),
});

const pages = defineCollection({
  loader: file('src/content/pages.json'),
  schema: pageDataSchema,
});

export const collections = { writing, speaking, videos, projects, pages };
