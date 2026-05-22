import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
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

const projects = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    tag: z.string(),
    description: z.string(),
    meta: z.string(),
    order: z.number().default(999),
  }),
});

const cta = z.object({ label: z.string(), href: z.string() });
const headline = z.object({ lead: z.string(), em: z.string(), tail: z.string() });
const remoteImage = z.object({
  src: z.string().url(),
  alt: z.string(),
  width: z.number(),
  height: z.number(),
});

const pages = defineCollection({
  loader: file('src/content/pages.json'),
  schema: z.object({
    metadata: z.object({
      title: z.string(),
      description: z.string(),
      canonical: z.string().url().optional(),
      image: z.string().url().optional(),
      imageAlt: z.string().optional(),
      keywords: z.string().optional(),
      noindex: z.boolean().optional(),
    }),
    sections: z.array(
      z.discriminatedUnion('kind', [
        z.object({
          kind: z.literal('hero'),
          headline,
          subline: z.string().optional(),
          ctas: z
            .array(cta.extend({ variant: z.enum(['primary', 'secondary', 'accent', 'ghost']).optional() }))
            .default([]),
          image: remoteImage
            .extend({
              widths: z.array(z.number()).optional(),
              eager: z.boolean().default(false),
              preload: z.boolean().default(false),
            })
            .optional(),
          imageSide: z.enum(['left', 'right']).default('right'),
        }),
        z.object({
          kind: z.literal('quote-callout'),
          headline,
          attribution: z.string().optional(),
          cta: cta.optional(),
          tone: z.enum(['light', 'dark']).default('dark'),
          align: z.enum(['left', 'right']).default('left'),
          backgroundImage: z
            .object({
              src: z.string().url(),
              width: z.number(),
              height: z.number(),
              opacity: z.number().optional(),
            })
            .optional(),
        }),
        z.object({
          kind: z.literal('feature-split'),
          eyebrow: z.string().optional(),
          title: z.string(),
          lede: z.string().optional(),
          source: z.enum(['writing', 'videos', 'speaking', 'projects']),
          limit: z.number().optional(),
          cta: cta.optional(),
        }),
        z.object({
          kind: z.literal('card-grid'),
          eyebrow: z.string().optional(),
          title: z.string(),
          lede: z.string().optional(),
          source: z.enum(['writing', 'videos', 'speaking', 'projects']),
          limit: z.number().optional(),
          columns: z.union([z.literal(2), z.literal(3)]).default(3),
          tone: z.enum(['light', 'dark']).default('light'),
          class: z.string().optional(),
          cta: cta.optional(),
        }),
        z.object({
          kind: z.literal('card-rows'),
          eyebrow: z.string().optional(),
          title: z.string(),
          lede: z.string().optional(),
          source: z.enum(['writing', 'videos', 'speaking', 'projects']),
          limit: z.number().optional(),
          cta: cta.optional(),
        }),
        z.object({
          kind: z.literal('image-text'),
          eyebrow: z.string().optional(),
          title: z.string(),
          lede: z.string().optional(),
          body: z.string().optional(),
          image: remoteImage,
          imageSize: z.number().optional(),
          equalWidth: z.boolean().default(false),
          imageSide: z.enum(['left', 'right']).default('left'),
          cta: cta.optional(),
        }),
        z.object({
          kind: z.literal('timeline'),
          eyebrow: z.string().optional(),
          title: z.string(),
          lede: z.string().optional(),
          tone: z.enum(['light', 'dark']).default('light'),
          cta: cta.optional(),
          items: z.array(
            z.object({
              daterange: z.string(),
              company: z.string(),
              title: z.string(),
              location: z.string().optional(),
              url: z.string().url().optional(),
              text: z.string(),
            }),
          ),
        }),
        z.object({
          kind: z.literal('cta-strip'),
          text: z.string(),
          em: z.string().optional(),
          cta: cta.extend({ variant: z.enum(['primary', 'secondary', 'accent']).optional() }),
        }),
      ]),
    ),
  }),
});

export const collections = { writing, speaking, videos, projects, pages };
