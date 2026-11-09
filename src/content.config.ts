import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { pageDataSchema } from './lib/page-schema';
import {
  projectsSchema,
  speakingSchema,
  videosSchema,
  writingSchema,
} from './lib/content-schemas';

// Frontmatter schemas live in src/lib/content-schemas.ts so the admin entries
// store validates drafts against exactly the same rules as the build.

const writing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
  schema: writingSchema,
});

const speaking = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/speaking', retainBody: false }),
  schema: speakingSchema,
});

const videos = defineCollection({
  loader: glob({ pattern: '*/*.md', base: './src/content/videos' }),
  schema: videosSchema,
});

const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/projects' }),
  schema: projectsSchema,
});

const pages = defineCollection({
  loader: file('src/content/pages.json'),
  schema: pageDataSchema,
});

export const collections = { writing, speaking, videos, projects, pages };
