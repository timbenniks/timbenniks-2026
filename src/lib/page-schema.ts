import { z } from 'astro/zod';

export const cta = z.object({ label: z.string(), href: z.string() });
export const ctaButton = cta.extend({
  variant: z.enum(['primary', 'secondary', 'accent', 'ghost']).optional(),
});
export const headline = z.object({
  lead: z.string(),
  em: z.string(),
  tail: z.string(),
});
export const tone = z.enum(['light', 'dark']).default('light');
export const source = z.enum(['writing', 'videos', 'speaking', 'projects']);
export const remoteImage = z.object({
  src: z.url(),
  alt: z.string(),
  width: z.number(),
  height: z.number(),
});
const headingFields = {
  eyebrow: z.string().optional(),
  title: z.string().optional(),
  lede: z.string().optional(),
};

export const pageSectionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('hero'),
    eyebrow: z.string().optional(),
    headline,
    subline: z.string().optional(),
    ctas: z.array(ctaButton).default([]),
    image: remoteImage
      .extend({
        widths: z.array(z.number()).optional(),
        eager: z.boolean().default(false),
        preload: z.boolean().default(false),
      })
      .optional(),
    gallery: z
      .array(
        z.object({
          src: z.url(),
          alt: z.string(),
          label: z.string().optional(),
          featured: z.boolean().default(false),
        }),
      )
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
        src: z.url(),
        width: z.number(),
        height: z.number(),
        opacity: z.number().optional(),
      })
      .optional(),
  }),
  z.object({
    kind: z.literal('feature-split'),
    ...headingFields,
    title: z.string(),
    source,
    limit: z.number().optional(),
    cta: cta.optional(),
  }),
  z.object({
    kind: z.literal('card-grid'),
    ...headingFields,
    source,
    limit: z.number().optional(),
    /** Filter writing/videos: match any of these tags (OR). */
    tags: z.array(z.string()).optional(),
    /** Filter videos by playlist name or slug. Ignored for other sources. */
    playlist: z.string().optional(),
    columns: z.union([z.literal(2), z.literal(3)]).default(3),
    tone,
    class: z.string().optional(),
    cta: cta.optional(),
    pagefindIgnore: z.boolean().default(false),
  }),
  z.object({
    kind: z.literal('card-rows'),
    ...headingFields,
    title: z.string(),
    source,
    limit: z.number().optional(),
    window: z.enum(['all', 'upcoming', 'past']).default('all'),
    hideWhenEmpty: z.boolean().default(false),
    cta: cta.optional(),
  }),
  z.object({
    kind: z.literal('stats'),
    source: z.enum(['writing', 'videos', 'speaking']),
  }),
  z.object({
    kind: z.literal('browse'),
    source: z.enum(['writing', 'videos']),
    eyebrow: z.string().optional(),
    searchHref: z.string().optional(),
    columns: z.union([z.literal(2), z.literal(3)]).default(3),
    pagefindIgnore: z.boolean().default(true),
    /** Cap the item grid. `0` keeps playlist/tag pills and hides the cards. */
    limit: z.number().optional(),
  }),
  z.object({
    kind: z.literal('inventory'),
    ...headingFields,
    title: z.string(),
    /** In-page id for jump-nav links, e.g. `computer-desk`. */
    anchor: z.string().optional(),
    tone,
    groups: z.array(
      z.object({
        heading: z.string(),
        items: z.array(
          z.object({
            name: z.string(),
            note: z.string().optional(),
            href: z.string().optional(),
          }),
        ),
      }),
    ),
  }),
  z.object({
    kind: z.literal('copy-blocks'),
    ...headingFields,
    title: z.string(),
    items: z.array(
      z.object({
        label: z.string(),
        body: z.string(),
        style: z.enum(['serif', 'muted']).default('serif'),
      }),
    ),
  }),
  z.object({
    kind: z.literal('photo-grid'),
    ...headingFields,
    title: z.string(),
    tone,
    columns: z.union([z.literal(2), z.literal(3)]).default(3),
    aspect: z.enum(['video', 'portrait']).default('video'),
    items: z.array(
      z.object({
        src: z.url(),
        alt: z.string(),
        label: z.string().optional(),
        width: z.number().default(1600),
        height: z.number().default(900),
      }),
    ),
  }),
  z.object({
    kind: z.literal('topic-grid'),
    ...headingFields,
    title: z.string(),
    items: z.array(
      z.object({
        title: z.string(),
        body: z.string(),
      }),
    ),
    pills: z.array(z.string()).default([]),
    pillsLabel: z.string().optional(),
    noteBefore: z.string().optional(),
    noteHref: z.string().optional(),
    noteLinkLabel: z.string().optional(),
    noteAfter: z.string().optional(),
  }),
  z.object({
    kind: z.literal('factsheet'),
    ...headingFields,
    title: z.string(),
    items: z.array(
      z.object({
        term: z.string(),
        value: z.string(),
        href: z.string().optional(),
      }),
    ),
  }),
  z.object({
    kind: z.literal('image-text'),
    ...headingFields,
    title: z.string(),
    body: z.string().optional(),
    image: remoteImage,
    imageSize: z.number().optional(),
    equalWidth: z.boolean().default(false),
    imageSide: z.enum(['left', 'right']).default('left'),
    cta: cta.optional(),
  }),
  z.object({
    kind: z.literal('faq'),
    ...headingFields,
    title: z.string(),
    tone,
    items: z.array(
      z.object({
        question: z.string(),
        answer: z.string(),
      }),
    ),
  }),
  z.object({
    kind: z.literal('timeline'),
    ...headingFields,
    title: z.string(),
    tone,
    cta: cta.optional(),
    items: z.array(
      z.object({
        daterange: z.string(),
        company: z.string(),
        title: z.string(),
        location: z.string().optional(),
        url: z.url().optional(),
        text: z.string(),
      }),
    ),
  }),
  z.object({
    kind: z.literal('cta-strip'),
    text: z.string(),
    em: z.string().optional(),
    ctas: z
      .array(cta.extend({ variant: z.enum(['primary', 'secondary', 'accent']).optional() }))
      .min(1),
  }),
  z.object({
    kind: z.literal('principles'),
    ...headingFields,
    title: z.string(),
    tone,
    items: z.array(
      z.object({
        kicker: z.string().optional(),
        title: z.string(),
        body: z.string(),
      }),
    ),
  }),
  z.object({
    kind: z.literal('logo-row'),
    ...headingFields,
    tone,
    items: z.array(
      z.object({
        label: z.string(),
        href: z.string().optional(),
        note: z.string().optional(),
      }),
    ),
  }),
  z.object({
    kind: z.literal('downloads'),
    ...headingFields,
    title: z.string(),
    tone,
    items: z.array(
      z.object({
        label: z.string(),
        href: z.string(),
        meta: z.string().optional(),
        note: z.string().optional(),
      }),
    ),
  }),
  z.object({
    kind: z.literal('swatches'),
    ...headingFields,
    title: z.string(),
    items: z.array(
      z.object({
        name: z.string(),
        hex: z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, {
          message: 'hex must be #RGB or #RRGGBB',
        }),
        usage: z.string().optional(),
      }),
    ),
  }),
  z.object({
    kind: z.literal('jump-nav'),
    label: z.string().optional(),
    items: z.array(
      z.object({
        label: z.string(),
        href: z.string(),
      }),
    ),
  }),
]);

export const pageDataSchema = z.object({
  /** Public URL path, e.g. `/` or `/about` or `/my-new-page`. */
  path: z
    .string()
    .regex(/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/, {
      message: 'path must be / or a kebab-case path like /about or /work/case-study',
    }),
  metadata: z.object({
    title: z.string(),
    description: z.string(),
    canonical: z.url().optional(),
    image: z.url().optional(),
    imageAlt: z.string().optional(),
    keywords: z.string().optional(),
    noindex: z.boolean().optional(),
  }),
  sections: z.array(pageSectionSchema),
});

export type PageData = z.infer<typeof pageDataSchema>;
export type PageSection = z.infer<typeof pageSectionSchema>;
export type PageId = string;

/** Pages that have dedicated Astro route shells (not served by catch-all). */
export const FIXED_PAGE_IDS = [
  'home',
  'about',
  'videos',
  'writing',
  'speaking',
  'projects',
  'uses',
  'press-kit',
  'ai',
] as const;

export type FixedPageId = (typeof FIXED_PAGE_IDS)[number];

export const FIXED_PAGE_PATHS: Record<FixedPageId, string> = {
  home: '/',
  about: '/about',
  videos: '/videos',
  writing: '/writing',
  speaking: '/speaking',
  projects: '/projects',
  uses: '/uses',
  'press-kit': '/press-kit',
  ai: '/ai',
};

/** @deprecated Use listPageIds() / getPagePath() — kept for gradual migration. */
export const PAGE_IDS = FIXED_PAGE_IDS;

/** @deprecated Use getPagePath from pages-store. */
export const PAGE_URLS = FIXED_PAGE_PATHS;

export const PAGE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isPageIdFormat(id: string): boolean {
  return PAGE_ID_PATTERN.test(id);
}

export function defaultPathForId(id: string): string {
  if (id === 'home') return '/';
  return `/${id}`;
}

/**
 * The insertable kinds, in editor order. `satisfies` rejects a kind that is not
 * in the union; `SectionKindsCoverUnion` below rejects one the union has and
 * this list is missing, so the array cannot drift from `pageSectionSchema`.
 */
export const SECTION_KINDS = [
  'hero',
  'quote-callout',
  'feature-split',
  'card-grid',
  'card-rows',
  'stats',
  'browse',
  'inventory',
  'copy-blocks',
  'photo-grid',
  'topic-grid',
  'factsheet',
  'image-text',
  'faq',
  'timeline',
  'cta-strip',
  'principles',
  'logo-row',
  'downloads',
  'swatches',
  'jump-nav',
] as const satisfies readonly PageSection['kind'][];

type SectionKindsCoverUnion<T extends never> = T;
export type _SectionKindsAreComplete = SectionKindsCoverUnion<
  Exclude<PageSection['kind'], (typeof SECTION_KINDS)[number]>
>;
