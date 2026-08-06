/**
 * Alignment between Zod `SECTION_KINDS` (server truth) and the client form catalog
 * in `public/admin/editor/catalog.js` (SECTION_FORM / LIST_SPECS / defaultSection).
 *
 * Adding a section kind requires:
 * 1. `page-schema.ts` discriminated union + SECTION_KINDS
 * 2. `public/admin/editor/catalog.js` — defaultSection + SECTION_FORM (+ LIST_SPECS if arrays)
 * 3. Astro section renderer
 *
 * This module asserts (1) and (2) key sets stay in sync at import time in admin APIs.
 */
import { SECTION_KINDS } from '../page-schema';

/** Must match Object.keys(SECTION_FORM) in public/admin/editor/catalog.js */
export const CLIENT_SECTION_FORM_KINDS = [
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
] as const;

export function assertSectionCatalogAligned(): void {
  const zod = new Set<string>(SECTION_KINDS);
  const client = new Set<string>(CLIENT_SECTION_FORM_KINDS);
  const missingInClient = SECTION_KINDS.filter((k) => !client.has(k));
  const missingInZod = CLIENT_SECTION_FORM_KINDS.filter((k) => !zod.has(k));
  if (missingInClient.length || missingInZod.length) {
    throw new Error(
      [
        'Section catalog split-brain detected.',
        missingInClient.length
          ? `In Zod but not CLIENT_SECTION_FORM_KINDS: ${missingInClient.join(', ')}`
          : '',
        missingInZod.length
          ? `In CLIENT_SECTION_FORM_KINDS but not Zod: ${missingInZod.join(', ')}`
          : '',
        'Update page-schema.ts SECTION_KINDS and public/admin/editor/catalog.js together.',
      ]
        .filter(Boolean)
        .join(' '),
    );
  }
}

// Run once when this module is first imported (admin page routes / create).
assertSectionCatalogAligned();
