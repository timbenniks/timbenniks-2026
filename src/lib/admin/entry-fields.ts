/**
 * Form definitions for the admin entry editor, one per collection.
 *
 * Resolved on the server (tag vocabulary, enum options) and handed to the
 * browser as JSON, so the client renderer stays generic and imports nothing
 * from the site at runtime. Field keys must match the frontmatter keys in
 * src/lib/content-schemas.ts.
 */
import { SPEAKING_FORMATS, type EntryCollection } from '../content-schemas';
import { CANONICAL_TAGS, TAG_LABELS } from '../tags';

export type EntryFieldType = 'text' | 'textarea' | 'date' | 'url' | 'select' | 'tags' | 'url-list';

export interface EntryFieldOption {
  value: string;
  label: string;
}

export interface EntryFieldDef {
  key: string;
  label: string;
  type: EntryFieldType;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  options?: EntryFieldOption[];
  /** Grid width in the form. */
  span?: 'half' | 'full';
}

export interface EntryCollectionDef {
  collection: EntryCollection;
  singular: string;
  plural: string;
  /** Field used as the entry's display title. */
  titleKey: string;
  /** Public page to open after publishing. */
  viewHref: (id: string) => string;
  fields: EntryFieldDef[];
}

const TAG_OPTIONS: EntryFieldOption[] = CANONICAL_TAGS.map((value) => ({
  value,
  label: TAG_LABELS[value],
}));

const speaking: EntryCollectionDef = {
  collection: 'speaking',
  singular: 'talk',
  plural: 'talks',
  titleKey: 'talk',
  viewHref: () => '/speaking',
  fields: [
    // Same key order as the existing files: conference, talk, location, date, …
    { key: 'conference', label: 'Event', type: 'text', required: true, span: 'full', placeholder: 'Vue.js Amsterdam 2027' },
    { key: 'talk', label: 'Talk title', type: 'text', required: true, span: 'full' },
    { key: 'location', label: 'Location', type: 'text', placeholder: 'Amsterdam, The Netherlands' },
    { key: 'date', label: 'Date', type: 'date', required: true },
    {
      key: 'format',
      label: 'Format',
      type: 'select',
      options: SPEAKING_FORMATS.map((value) => ({ value, label: value })),
    },
    {
      key: 'description',
      label: 'Description',
      type: 'textarea',
      span: 'full',
      hint: 'One or two sentences shown under the talk.',
    },
    { key: 'link', label: 'Event link', type: 'url', span: 'full', placeholder: 'https://' },
    { key: 'session_url', label: 'Session page', type: 'url', placeholder: 'https://' },
    { key: 'recording_url', label: 'Recording', type: 'url', placeholder: 'https://' },
    { key: 'slides_url', label: 'Slides', type: 'url', placeholder: 'https://' },
    {
      key: 'metadata_checked',
      label: 'Links last checked',
      type: 'date',
      hint: 'When the links above were last verified.',
    },
    { key: 'tags', label: 'Tags', type: 'tags', span: 'full', options: TAG_OPTIONS },
    {
      key: 'sources',
      label: 'Sources',
      type: 'url-list',
      span: 'full',
      hint: 'Pages that confirm this talk happened (one URL per line).',
    },
  ],
};

const DEFS: Partial<Record<EntryCollection, EntryCollectionDef>> = { speaking };

export function getEntryCollectionDef(collection: EntryCollection): EntryCollectionDef | null {
  return DEFS[collection] ?? null;
}

/** JSON-safe version for the browser (drops functions). */
export type EntryCollectionDefJson = Omit<EntryCollectionDef, 'viewHref'> & { viewHref: string };

export function entryCollectionDefJson(
  def: EntryCollectionDef,
  id: string,
): EntryCollectionDefJson {
  return { ...def, viewHref: def.viewHref(id) };
}
