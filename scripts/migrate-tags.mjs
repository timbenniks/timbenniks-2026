#!/usr/bin/env node
// One-shot tag migration. Walks src/content/writing/*.md and src/content/videos/**/*.md,
// applies the canonical mapping in src/lib/tags.ts to the `tags:` frontmatter block,
// and writes each file back. Everything except the tags block is preserved byte-for-byte.
//
// Usage:
//   node scripts/migrate-tags.mjs           # apply changes
//   node scripts/migrate-tags.mjs --dry     # report only, don't write

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { glob } from 'node:fs/promises';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const ROOT = dirname(dirname(__filename));

// Inline the mapping logic. Keeping this script free of TS imports so it can run
// directly with `node` — no transpile step. Source of truth is src/lib/tags.ts;
// keep the two in sync.
const CANONICAL_TAGS = [
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
];

const TAG_PRIORITY = [
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

const PRIORITY_INDEX = Object.fromEntries(TAG_PRIORITY.map((t, i) => [t, i]));

const RAW_OLD_TO_NEW = {
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

  cms: 'cms',
  'headless-cms': 'cms',
  'headless cms': 'cms',

  api: 'api-design',
  apis: 'api-design',
  openapi: 'api-design',
  'api-first': 'api-design',
  'api first': 'api-design',
  'api-design': 'api-design',
  'api design': 'api-design',
  graphql: 'api-design',
  rest: 'api-design',

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

  craft: 'craft',
  coding: 'craft',
  engineering: 'craft',
  fundamentals: 'craft',
  philosophy: 'craft',
  'technical-debt': 'craft',
  'technical debt': 'craft',
  legacy: 'craft',
  testing: 'craft',
  tdd: 'craft',
  migration: 'craft',
  refactoring: 'craft',

  personalization: 'personalization',
  'web-personalization': 'personalization',
  'web personalization': 'personalization',
  localization: 'personalization',
  'a-b-testing': 'personalization',
  'ab-testing': 'personalization',
  'a/b testing': 'personalization',

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

  content: 'content-ops',
  'content-ops': 'content-ops',
  'content-modeling': 'content-ops',
  'content modeling': 'content-ops',
  'content-graph': 'content-ops',
  orchestration: 'content-ops',
  'content-composition': 'content-ops',
  'content composition': 'content-ops',
  'content-creator': 'content-ops',
  'content creator': 'content-ops',

  career: 'career',

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

  personal: 'personal',
  fitness: 'personal',
  running: 'personal',
  health: 'personal',
  'social media': 'personal',
  'social-media': 'personal',

  buzzwords: 'opinion',
  opinion: 'opinion',
  'hot-take': 'opinion',
};

const CANONICAL_SET = new Set(CANONICAL_TAGS);

function normalizeKey(raw) {
  return String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
}

const OLD_TO_NEW = new Map(
  Object.entries(RAW_OLD_TO_NEW).map(([k, v]) => [normalizeKey(k), v]),
);

function normalizeTag(raw) {
  if (!raw) return null;
  const key = normalizeKey(raw);
  if (CANONICAL_SET.has(key)) return key;
  return OLD_TO_NEW.get(key) ?? null;
}

function mapTags(rawTags) {
  const seen = new Set();
  const dropped = [];
  for (const raw of rawTags) {
    const mapped = normalizeTag(raw);
    if (mapped) seen.add(mapped);
    else dropped.push(raw);
  }
  const out = [...seen]
    .sort((a, b) => (PRIORITY_INDEX[a] ?? 99) - (PRIORITY_INDEX[b] ?? 99))
    .slice(0, 5);
  return { tags: out, dropped };
}

// ---------------------------------------------------------------------------
// File munging
// ---------------------------------------------------------------------------

// Match the frontmatter block at the very top of the file: ---\n...---\n
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?\r?\n)---\r?\n/;

// Within the frontmatter, the `tags:` field is either:
//   tags: [a, b, c]               (inline flow)
//   tags:\n  - a\n  - b\n         (block list)
// We capture either, then re-emit in the same style.
const TAGS_INLINE_RE = /^tags:[ \t]*\[([^\]]*)\][ \t]*(\r?\n)/m;
const TAGS_BLOCK_RE = /^tags:[ \t]*(\r?\n)((?:[ \t]+-[ \t]+.*(?:\r?\n|$))+)/m;

function emitInline(tags) {
  return `tags: [${tags.join(', ')}]\n`;
}

function emitBlock(tags) {
  if (tags.length === 0) return 'tags: []\n';
  return `tags:\n${tags.map((t) => `  - ${t}`).join('\n')}\n`;
}

async function processFile(absPath, dryRun) {
  const original = await readFile(absPath, 'utf8');
  const fmMatch = original.match(FRONTMATTER_RE);
  if (!fmMatch) return { absPath, status: 'no-frontmatter' };

  const frontmatter = fmMatch[1];

  let style = null;
  let oldTagsBlock = null;
  let rawTags = [];

  const inline = frontmatter.match(TAGS_INLINE_RE);
  const block = frontmatter.match(TAGS_BLOCK_RE);

  if (inline) {
    style = 'inline';
    oldTagsBlock = inline[0];
    // Parse the inline list with js-yaml — handles quoted strings, escapes, etc.
    try {
      const parsed = yaml.load(`tags: [${inline[1]}]`);
      rawTags = Array.isArray(parsed?.tags) ? parsed.tags.map(String) : [];
    } catch {
      return { absPath, status: 'parse-error', detail: 'inline tags' };
    }
  } else if (block) {
    style = 'block';
    oldTagsBlock = block[0];
    try {
      const parsed = yaml.load(`tags:\n${block[2]}`);
      rawTags = Array.isArray(parsed?.tags) ? parsed.tags.map(String) : [];
    } catch {
      return { absPath, status: 'parse-error', detail: 'block tags' };
    }
  } else {
    return { absPath, status: 'no-tags' };
  }

  const { tags: newTags, dropped } = mapTags(rawTags);
  const newTagsBlock = style === 'inline' ? emitInline(newTags) : emitBlock(newTags);

  if (oldTagsBlock === newTagsBlock) {
    return { absPath, status: 'unchanged', before: rawTags.length, after: newTags.length, dropped };
  }

  const newFrontmatter = frontmatter.replace(
    style === 'inline' ? TAGS_INLINE_RE : TAGS_BLOCK_RE,
    newTagsBlock,
  );
  const newContent = original.replace(FRONTMATTER_RE, `---\n${newFrontmatter}---\n`);

  if (!dryRun) {
    await writeFile(absPath, newContent, 'utf8');
  }
  return {
    absPath,
    status: 'changed',
    before: rawTags.length,
    after: newTags.length,
    rawTags,
    newTags,
    dropped,
    zeroTags: newTags.length === 0,
  };
}

async function* walk(root, pattern) {
  for await (const f of glob(pattern, { cwd: root })) {
    yield join(root, f);
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry');
  const writingFiles = [];
  for await (const f of walk(ROOT, 'src/content/writing/*.md')) writingFiles.push(f);
  const videoFiles = [];
  for await (const f of walk(ROOT, 'src/content/videos/**/*.md')) videoFiles.push(f);

  console.log(`writing: ${writingFiles.length} files`);
  console.log(`videos:  ${videoFiles.length} files`);
  console.log(`mode:    ${dryRun ? 'dry-run' : 'write'}`);
  console.log('');

  const all = [...writingFiles, ...videoFiles];
  const results = [];
  for (const f of all) {
    results.push(await processFile(f, dryRun));
  }

  const changed = results.filter((r) => r.status === 'changed');
  const unchanged = results.filter((r) => r.status === 'unchanged');
  const errored = results.filter((r) => r.status === 'parse-error');
  const noTags = results.filter((r) => r.status === 'no-tags');
  const zeroAfter = changed.filter((r) => r.zeroTags);

  console.log(`changed:   ${changed.length}`);
  console.log(`unchanged: ${unchanged.length}`);
  console.log(`no-tags:   ${noTags.length}`);
  console.log(`errored:   ${errored.length}`);
  console.log(`zero-tag after migration: ${zeroAfter.length}`);
  console.log('');

  if (zeroAfter.length > 0) {
    console.log('Files that ended up with zero tags (need manual review):');
    for (const r of zeroAfter) {
      console.log(`  ${relative(ROOT, r.absPath)} — was: [${r.rawTags.join(', ')}]`);
    }
    console.log('');
  }

  if (errored.length > 0) {
    console.log('Files that errored:');
    for (const r of errored) {
      console.log(`  ${relative(ROOT, r.absPath)} — ${r.detail}`);
    }
    console.log('');
  }

  // Tag-frequency report for the new vocabulary.
  const counts = new Map();
  for (const r of [...changed, ...unchanged]) {
    const tags = r.newTags ?? r.rawTags?.map(normalizeTag).filter(Boolean) ?? [];
    for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  console.log('Canonical tag frequency (across all migrated files):');
  for (const [tag, n] of sorted) {
    console.log(`  ${tag.padEnd(28)} ${n}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
