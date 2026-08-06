// Canonical tag taxonomy. The 17 slugs below are the only tag values that should
// appear in writing/video frontmatter. Source of truth for this project — the
// content collection schema (src/content.config.ts) intentionally stays a loose
// z.array(z.string()), so this file is what enforces vocabulary discipline.

export const CANONICAL_TAGS = [
  'composable-architecture',
  'cms',
  'api-design',
  'frontend',
  'performance',
  'cloud-infra',
  'developer-experience',
  'ai-engineering',
  'craft',
  'personalization',
  'devrel',
  'product-strategy',
  'content-ops',
  'career',
  'media-production',
  'personal',
  'opinion',
] as const;

export type CanonicalTag = (typeof CANONICAL_TAGS)[number];

// Display labels (what users see in chips, archive headings, search facets).
export const TAG_LABELS: Record<CanonicalTag, string> = {
  'composable-architecture': 'Composable architecture',
  cms: 'CMS',
  'api-design': 'API design',
  frontend: 'Frontend',
  performance: 'Performance',
  'cloud-infra': 'Cloud & infra',
  'developer-experience': 'Developer experience',
  'ai-engineering': 'AI engineering',
  craft: 'Craft',
  personalization: 'Personalization',
  devrel: 'DevRel',
  'product-strategy': 'Product strategy',
  'content-ops': 'Content ops',
  career: 'Career',
  'media-production': 'Media production',
  personal: 'Personal',
  opinion: 'Opinion',
};

// Priority order — when capping at 5, the most topic-defining tags survive.
// Lower index = higher priority.
const TAG_PRIORITY: CanonicalTag[] = [
  'composable-architecture',
  'ai-engineering',
  'cms',
  'api-design',
  'personalization',
  'content-ops',
  'performance',
  'cloud-infra',
  'frontend',
  'craft',
  'developer-experience',
  'product-strategy',
  'devrel',
  'career',
  'opinion',
  'media-production',
  'personal',
];

const PRIORITY_INDEX: Record<CanonicalTag, number> = TAG_PRIORITY.reduce(
  (acc, tag, i) => {
    acc[tag] = i;
    return acc;
  },
  {} as Record<CanonicalTag, number>,
);

// Old → new mapping. Keys are normalized: trim + lowercase + collapse whitespace.
// Anything not in this table that is *also* not already a canonical slug is dropped.
const RAW_OLD_TO_NEW: Record<string, CanonicalTag> = {
  // composable-architecture
  architecture: 'composable-architecture',
  composable: 'composable-architecture',
  'composable-architecture': 'composable-architecture',
  'composable architecture': 'composable-architecture',
  'composable-dxp': 'composable-architecture',
  mach: 'composable-architecture',
  monolith: 'composable-architecture',
  headless: 'composable-architecture',
  'digital-experience-platform': 'composable-architecture',
  'digital experience platform': 'composable-architecture',
  dxp: 'composable-architecture',
  'enterprise-architecture': 'composable-architecture',
  'enterprise architecture': 'composable-architecture',
  'software-architecture': 'composable-architecture',
  'software architecture': 'composable-architecture',
  jamstack: 'composable-architecture',

  // cms
  cms: 'cms',
  'headless-cms': 'cms',
  'headless cms': 'cms',

  // api-design
  api: 'api-design',
  apis: 'api-design',
  openapi: 'api-design',
  'api-first': 'api-design',
  'api first': 'api-design',
  'api-design': 'api-design',
  'api design': 'api-design',
  graphql: 'api-design',
  rest: 'api-design',

  // frontend
  frontend: 'frontend',
  'web development': 'frontend',
  webdev: 'frontend',
  'web-development': 'frontend',
  'frontend-development': 'frontend',
  'frontend development': 'frontend',
  'front-end-development': 'frontend',
  'front-end development': 'frontend',
  javascript: 'frontend',
  vue: 'frontend',
  'vue-3': 'frontend',
  vue3: 'frontend',
  nuxt: 'frontend',
  nuxtjs: 'frontend',
  nuxt3: 'frontend',
  'nuxt-3': 'frontend',
  'nuxt-image': 'frontend',
  nextjs: 'frontend',
  'next-image': 'frontend',
  react: 'frontend',
  'web component': 'frontend',
  'web-component': 'frontend',
  'web components': 'frontend',
  frameworks: 'frontend',
  html: 'frontend',
  'img-tag': 'frontend',
  'picture-tag': 'frontend',
  'composition-api': 'frontend',
  'script-setup': 'frontend',
  'use-fetch': 'frontend',
  ssr: 'frontend',
  typescript: 'frontend',
  'tailwind-css': 'frontend',
  tailwind: 'frontend',
  'tailwind-jit': 'frontend',
  vite: 'frontend',
  'apple-m1': 'frontend',
  'apple-silicon': 'frontend',
  m1: 'frontend',
  programming: 'frontend',

  // performance
  performance: 'performance',
  optimization: 'performance',
  'web-performance': 'performance',
  'web performance': 'performance',
  'core-web-vitals': 'performance',
  'core web vitals': 'performance',
  'responsive-images': 'performance',
  'responsive images': 'performance',
  cdn: 'performance',
  edge: 'performance',
  'edge-rendering': 'performance',
  'edge-functions': 'performance',
  'edge functions': 'performance',

  // cloud-infra
  cloud: 'cloud-infra',
  'cloud-infra': 'cloud-infra',
  deployment: 'cloud-infra',
  devops: 'cloud-infra',
  database: 'cloud-infra',
  data: 'cloud-infra',
  security: 'cloud-infra',
  auth: 'cloud-infra',
  authentication: 'cloud-infra',
  gdpr: 'cloud-infra',
  environment: 'cloud-infra',
  'netlify-edge': 'cloud-infra',
  seo: 'cloud-infra',
  analytics: 'cloud-infra',
  privacy: 'cloud-infra',
  'javascript-build-tools': 'cloud-infra',
  automation: 'cloud-infra',
  serverless: 'cloud-infra',
  hosting: 'cloud-infra',

  // developer-experience
  tools: 'developer-experience',
  'developer experience': 'developer-experience',
  'developer-experience': 'developer-experience',
  dx: 'developer-experience',
  cli: 'developer-experience',
  sdk: 'developer-experience',
  sdks: 'developer-experience',
  education: 'developer-experience',
  tutorial: 'developer-experience',
  productivity: 'developer-experience',
  github: 'developer-experience',
  devbreak: 'developer-experience',
  'developer-life': 'developer-experience',
  'developer life': 'developer-experience',
  'content-editing': 'developer-experience',
  'live-preview': 'developer-experience',
  'live preview': 'developer-experience',
  'custom-field': 'developer-experience',
  'uniform-canvas': 'developer-experience',

  // ai-engineering
  ai: 'ai-engineering',
  'ai-engineering': 'ai-engineering',
  'ai engineering': 'ai-engineering',
  agents: 'ai-engineering',
  'agentic-workflows': 'ai-engineering',
  'agentic workflows': 'ai-engineering',
  mcp: 'ai-engineering',
  'prompt engineering': 'ai-engineering',
  'prompt-engineering': 'ai-engineering',
  'vibe coding': 'ai-engineering',
  'vibe-coding': 'ai-engineering',
  codex: 'ai-engineering',
  llm: 'ai-engineering',
  'content-operations': 'ai-engineering',

  // craft
  craft: 'craft',
  coding: 'craft',
  engineering: 'craft',
  fundamentals: 'craft',
  philosophy: 'craft',
  writing: 'craft',
  'technical-debt': 'craft',
  'technical debt': 'craft',
  legacy: 'craft',
  testing: 'craft',
  tdd: 'craft',
  migration: 'craft',
  refactoring: 'craft',

  // personalization
  personalization: 'personalization',
  'web-personalization': 'personalization',
  'web personalization': 'personalization',
  localization: 'personalization',
  'a-b-testing': 'personalization',
  'ab-testing': 'personalization',
  'a/b testing': 'personalization',

  // devrel
  devrel: 'devrel',
  community: 'devrel',
  marketing: 'devrel',
  streaming: 'devrel',
  livestream: 'devrel',
  livestreaming: 'devrel',
  'public-speaking': 'devrel',
  'public speaking': 'devrel',
  'tech-festival': 'devrel',
  conference: 'devrel',
  'product-meetup': 'devrel',
  metrics: 'devrel',
  algolia: 'devrel',
  'algolia-crawler': 'devrel',
  'site-search': 'devrel',
  prismic: 'devrel',
  advocacy: 'devrel',

  // product-strategy
  product: 'product-strategy',
  'product-management': 'product-strategy',
  'product management': 'product-strategy',
  'product-strategy': 'product-strategy',
  'product strategy': 'product-strategy',
  leadership: 'product-strategy',
  process: 'product-strategy',
  collaboration: 'product-strategy',
  governance: 'product-strategy',
  agency: 'product-strategy',
  saas: 'product-strategy',
  commerce: 'product-strategy',

  // content-ops
  content: 'content-ops',
  'content-ops': 'content-ops',
  'content-management': 'content-ops',
  'content management': 'content-ops',
  'content-modeling': 'content-ops',
  'content modeling': 'content-ops',
  'content-graph': 'content-ops',
  orchestration: 'content-ops',
  'content-composition': 'content-ops',
  'content composition': 'content-ops',
  'content-creator': 'content-ops',
  'content creator': 'content-ops',

  // career
  career: 'career',

  // media-production
  audio: 'media-production',
  media: 'media-production',
  video: 'media-production',
  vlog: 'media-production',
  'video-production': 'media-production',
  'video production': 'media-production',
  'video-editing': 'media-production',
  'video editing': 'media-production',
  'studio-tour': 'media-production',
  'studio tour': 'media-production',
  'studio build': 'media-production',
  'studio-build': 'media-production',
  'home-office-setup': 'media-production',
  'home-office': 'media-production',
  'home office': 'media-production',
  'garage renovation': 'media-production',
  'garage-renovation': 'media-production',
  'workspace-build': 'media-production',
  'youtube-studio': 'media-production',
  'youtube studio': 'media-production',
  insulation: 'media-production',
  diy: 'media-production',
  dock: 'media-production',
  'nvme-ssd': 'media-production',
  'mac-mini': 'media-production',
  'hardware-unboxing': 'media-production',
  comparison: 'media-production',
  'media-production': 'media-production',

  // personal
  personal: 'personal',
  fitness: 'personal',
  running: 'personal',
  health: 'personal',
  'social media': 'personal',
  'social-media': 'personal',

  // opinion
  buzzwords: 'opinion',
  opinion: 'opinion',
  'hot-take': 'opinion',
};

// Tags explicitly dropped — listed for clarity. The migration treats anything
// not in RAW_OLD_TO_NEW as "drop" anyway, so this set is informational.
export const DROPPED_TAGS = new Set([
  'development',
  'design',
  'developers',
  'uniform',
  'contentstack',
  'hygraph',
  'vercel',
  'cloudflare-workers',
  'netlify',
  'sitecore',
  'contentful',
  'dxc',
]);

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

const OLD_TO_NEW: Map<string, CanonicalTag> = new Map(
  Object.entries(RAW_OLD_TO_NEW).map(([k, v]) => [normalizeKey(k), v]),
);

const CANONICAL_SET: Set<string> = new Set(CANONICAL_TAGS);

/**
 * Map a single raw tag to its canonical slug, or null if it should be dropped.
 */
export function normalizeTag(raw: string): CanonicalTag | null {
  if (!raw) return null;
  const key = normalizeKey(raw);
  if (CANONICAL_SET.has(key)) return key as CanonicalTag;
  return OLD_TO_NEW.get(key) ?? null;
}

/**
 * Apply mapping to an array of raw tags: dedupe, sort by canonical priority,
 * cap at 5. Returns a fresh array of canonical slugs.
 */
export function mapTags(rawTags: readonly string[]): CanonicalTag[] {
  const seen = new Set<CanonicalTag>();
  for (const raw of rawTags) {
    const mapped = normalizeTag(raw);
    if (mapped) seen.add(mapped);
  }
  return [...seen]
    .sort((a, b) => (PRIORITY_INDEX[a] ?? 99) - (PRIORITY_INDEX[b] ?? 99))
    .slice(0, 5);
}

/**
 * Display label for a canonical slug. Falls back to the slug itself if unknown
 * (defensive — shouldn't happen if content has been migrated).
 */
export function tagLabel(slug: string): string {
  return TAG_LABELS[slug as CanonicalTag] ?? slug;
}
