/**
 * Content shapes for the admin client, re-exported from the server Zod schemas
 * so page and site data have exactly one definition.
 *
 * These are type-only. `verbatimModuleSyntax` guarantees the imports are erased
 * at compile time, so no Zod ever reaches the browser.
 */
import type { PageData, PageSection } from '../../lib/page-schema';

export type { PageData, PageSection, PageId, FixedPageId } from '../../lib/page-schema';
export type { SiteChrome, NavLink, FooterColumn } from '../../lib/site-schema';

/** The 16 section kinds, straight off the discriminated union. */
export type SectionKind = PageSection['kind'];

export type PageMetadata = PageData['metadata'];

/** A section narrowed to one kind, e.g. `SectionOfKind<'faq'>`. */
export type SectionOfKind<K extends SectionKind> = Extract<PageSection, { kind: K }>;
