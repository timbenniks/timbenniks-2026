/**
 * Frontmatter schemas for the Markdown content collections.
 *
 * Shared by `src/content.config.ts` (build-time validation) and the admin
 * entries store (validation before a draft is published), so both sides agree
 * on what a valid entry is.
 *
 * `tags` is intentionally a loose `z.array(z.string())`. The canonical vocabulary
 * (17 slugs, lowercase kebab-case) lives in src/lib/tags.ts. Frontmatter should
 * only contain those slugs; new entries that drift can be re-aligned by re-running
 * `node scripts/migrate-tags.mjs`.
 */
import { z } from 'astro/zod';

export const writingSchema = z
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
  .loose();

export const SPEAKING_FORMATS = [
  'talk',
  'workshop',
  'podcast',
  'panel',
  'livestream',
  'talk and MC',
] as const;

export const speakingSchema = z.object({
  conference: z.string(),
  talk: z.string(),
  location: z.string().optional(),
  date: z.coerce.date(),
  link: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  format: z.enum(SPEAKING_FORMATS).optional(),
  session_url: z.url().optional(),
  recording_url: z.url().optional(),
  slides_url: z.url().optional(),
  sources: z.array(z.url()).default([]),
  metadata_checked: z.iso.date().optional(),
});

export const videosSchema = z
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
  .loose();

export const projectsSchema = z.object({
  title: z.string(),
  seoTitle: z.string().optional(),
  tag: z.string(),
  description: z.string(),
  meta: z.string(),
  order: z.number().default(999),
  // Optional outbound links, surfaced on the card footer and detail page.
  github: z.url().optional(),
  live: z.url().optional(),
  docs: z.url().optional(),
  npm: z.string().optional(),
});

export const ENTRY_COLLECTIONS = ['writing', 'speaking', 'videos', 'projects'] as const;
export type EntryCollection = (typeof ENTRY_COLLECTIONS)[number];

export const entrySchemas = {
  writing: writingSchema,
  speaking: speakingSchema,
  videos: videosSchema,
  projects: projectsSchema,
} as const;

export function isEntryCollection(value: string): value is EntryCollection {
  return (ENTRY_COLLECTIONS as readonly string[]).includes(value);
}
