/**
 * Form definitions for the admin entry editor, one per collection.
 *
 * Resolved on the server (tag vocabulary, enum options, playlist names) and
 * handed to the browser as JSON, so the client renderer stays generic and
 * imports nothing from the site at runtime. Field keys must match the
 * frontmatter keys in src/lib/content-schemas.ts; the special key `$body` is
 * the Markdown body below the frontmatter.
 */
import { SPEAKING_FORMATS, type EntryCollection } from '../content-schemas';
import { CANONICAL_TAGS, TAG_LABELS } from '../tags';
import { listVideoPlaylists } from './entries-store';

export const BODY_KEY = '$body';

export type EntryFieldType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'url'
  | 'number'
  | 'boolean'
  | 'select'
  | 'tags'
  | 'url-list'
  | 'image'
  | 'faqs'
  | 'slug'
  | 'markdown';

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
  /** Free-text suggestions (rendered as a datalist). */
  suggestions?: string[];
  /** Grid width in the form. */
  span?: 'half' | 'full';
  /** `date` fields: write `YYYY-MM-DDT10:00:00Z` instead of `YYYY-MM-DD` for a new day. */
  timestamp?: boolean;
  /** Extra rows for textareas (long transcripts, bodies). */
  rows?: number;
  /** Shown only when editing an existing entry / only for a new one. */
  only?: 'existing' | 'new';
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
  /** Offer "Fill from YouTube" on new entries. */
  youtubeImport?: boolean;
  /** Field that turns a published entry into a hidden draft (offered before Delete). */
  unpublishKey?: string;
  /** Field auto-filled from the body word count when left empty. */
  readingTimeKey?: string;
}

const TAG_OPTIONS: EntryFieldOption[] = CANONICAL_TAGS.map((value) => ({
  value,
  label: TAG_LABELS[value],
}));

const URL_PH = 'https://';

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
      key: 'metadata_checked',
      label: 'Links last checked',
      type: 'date',
      hint: 'When the links below were last verified.',
    },
    {
      key: 'description',
      label: 'Description',
      type: 'textarea',
      span: 'full',
      hint: 'One or two sentences shown under the talk.',
    },
    { key: 'link', label: 'Event link', type: 'url', span: 'full', placeholder: URL_PH },
    { key: 'session_url', label: 'Session page', type: 'url', placeholder: URL_PH },
    { key: 'recording_url', label: 'Recording', type: 'url', placeholder: URL_PH },
    { key: 'slides_url', label: 'Slides', type: 'url', placeholder: URL_PH },
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

const projects: EntryCollectionDef = {
  collection: 'projects',
  singular: 'project',
  plural: 'projects',
  titleKey: 'title',
  viewHref: (id) => `/projects/${id}`,
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'tag', label: 'Label', type: 'text', required: true, placeholder: 'CLI · Agent readiness' },
    { key: 'seoTitle', label: 'SEO title', type: 'text', span: 'full', hint: 'Optional <title> override for the detail page.' },
    { key: 'description', label: 'Description', type: 'textarea', required: true, span: 'full' },
    { key: 'meta', label: 'Status line', type: 'text', required: true, placeholder: 'Active · @scope/package' },
    {
      key: 'order',
      label: 'Order',
      type: 'number',
      hint: 'Lower comes first. You can also reorder from the Projects list.',
    },
    { key: 'github', label: 'GitHub', type: 'url', placeholder: URL_PH },
    { key: 'live', label: 'Live site', type: 'url', placeholder: URL_PH },
    { key: 'docs', label: 'Docs', type: 'url', placeholder: URL_PH },
    { key: 'npm', label: 'npm package', type: 'text', placeholder: '@scope/package' },
    { key: '$body', label: 'Body', type: 'markdown', span: 'full', rows: 18 },
  ],
};

function videos(playlists: string[]): EntryCollectionDef {
  return {
    collection: 'videos',
    singular: 'video',
    plural: 'videos',
    titleKey: 'title',
    viewHref: (id) => `/videos/${id}`,
    youtubeImport: true,
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, span: 'full' },
      { key: 'videoId', label: 'YouTube video id', type: 'text', required: true, placeholder: 'dQw4w9WgXcQ' },
      {
        key: 'playlist',
        label: 'Playlist',
        type: 'text',
        required: true,
        suggestions: playlists,
        hint: 'Also the folder and part of the URL. Changing it moves the video to a new URL.',
      },
      { key: 'date', label: 'Published', type: 'date', required: true },
      { key: 'duration', label: 'Duration', type: 'text', placeholder: '12:34' },
      { key: 'image', label: 'Thumbnail', type: 'image', span: 'full' },
      { key: 'description', label: 'Description', type: 'textarea', span: 'full', rows: 5 },
      { key: 'tags', label: 'Tags', type: 'tags', span: 'full', options: TAG_OPTIONS },
      { key: 'transcript', label: 'Transcript', type: 'textarea', span: 'full', rows: 8 },
    ],
  };
}

const writing: EntryCollectionDef = {
  collection: 'writing',
  singular: 'article',
  plural: 'articles',
  titleKey: 'title',
  viewHref: (id) => `/writing/${id}`,
  unpublishKey: 'draft',
  readingTimeKey: 'reading_time',
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true, span: 'full' },
    {
      key: 'slug',
      label: 'Slug',
      type: 'slug',
      span: 'full',
      hint: 'The URL: /writing/<slug>. Changing it on a published article adds a redirect from the old URL.',
    },
    { key: 'description', label: 'Description', type: 'textarea', span: 'full' },
    { key: 'date', label: 'Date', type: 'date', required: true, timestamp: true },
    { key: 'reading_time', label: 'Reading time', type: 'text', placeholder: 'Calculated from the body' },
    { key: 'image', label: 'Image', type: 'image', span: 'full' },
    { key: 'tags', label: 'Tags', type: 'tags', span: 'full', options: TAG_OPTIONS },
    {
      key: 'draft',
      label: 'Hidden (draft)',
      type: 'boolean',
      hint: 'Hidden articles are not listed or rendered on the site.',
    },
    {
      key: 'canonical_url',
      label: 'Canonical URL',
      type: 'url',
      placeholder: URL_PH,
      hint: 'Only set this when the article was first published elsewhere.',
    },
    { key: 'faqs', label: 'FAQs', type: 'faqs', span: 'full' },
    { key: '$body', label: 'Body', type: 'markdown', span: 'full', rows: 24, required: true },
  ],
};

/** Field definitions for a collection, or null when it has no editor. */
export async function loadEntryCollectionDef(
  collection: EntryCollection,
): Promise<EntryCollectionDef | null> {
  switch (collection) {
    case 'speaking':
      return speaking;
    case 'projects':
      return projects;
    case 'writing':
      return writing;
    case 'videos':
      return videos(await listVideoPlaylists().catch(() => []));
  }
}

/** Static singular names for the desk (no I/O). */
export const ENTRY_SINGULAR: Record<EntryCollection, string> = {
  speaking: 'talk',
  projects: 'project',
  videos: 'video',
  writing: 'article',
};

/** JSON-safe version for the browser (drops functions). */
export type EntryCollectionDefJson = Omit<EntryCollectionDef, 'viewHref'> & { viewHref: string };

export function entryCollectionDefJson(
  def: EntryCollectionDef,
  id: string,
): EntryCollectionDefJson {
  return { ...def, viewHref: def.viewHref(id) };
}
