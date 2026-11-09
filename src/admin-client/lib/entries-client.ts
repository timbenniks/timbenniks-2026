/**
 * Browser-side helpers for collection entry drafts (talks, projects, videos,
 * articles). Shared by the entry editor, the pages desk, the Changes desk and
 * the agent tools so every path stages and publishes entries the same way.
 */
import { apiFetch } from './api.js';
import {
  clearAllDrafts,
  clearEntryDraft,
  getEntryDraft,
  getPageDraft,
  getSiteDraft,
  listDraftPageIds,
  listEntryDrafts,
  setEntryDraft,
  type EntryDraftRecord,
} from './draft-store.js';
import type { PageData, SiteChrome } from './content.js';
import type { EntryRecord } from '../../lib/admin/entries-store';

export type EntryValues = Record<string, unknown>;

/** POST /api/admin/entries/preview */
export interface EntryPreviewFile {
  path: string;
  before: string | null;
  after: string | null;
  /** Other files the op touches (old path on a rename, the redirect map). */
  related?: Array<{ path: string; before: string | null; after: string | null }>;
}

interface PreviewResponse {
  ok: boolean;
  files: EntryPreviewFile[];
}

interface ProposeResponse {
  ok: boolean;
  id: string;
  path: string;
}

/** POST /api/admin/changes/publish */
export interface PublishResponse {
  ok: boolean;
  mode: 'github' | 'local-working';
  branch: string;
  commit: string;
  written: string[];
}

/** The server-side EntryOp for one draft (see src/lib/admin/entries-store.ts). */
export function entryOp(d: Pick<EntryDraftRecord, 'collection' | 'id' | 'isNew' | 'path' | 'op' | 'data' | 'body'>) {
  return d.isNew
    ? { collection: d.collection, op: d.op, path: d.path, data: d.data, body: d.body }
    : { collection: d.collection, op: d.op, id: d.id, data: d.data, body: d.body };
}

export async function previewEntryOps(ops: ReturnType<typeof entryOp>[]): Promise<EntryPreviewFile[]> {
  const res = await apiFetch<PreviewResponse>('/api/admin/entries/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries: ops }),
    errorMessage: 'Validation failed',
  });
  return res.files;
}

export async function fetchPublishedEntry(collection: string, id: string): Promise<EntryRecord | null> {
  try {
    const res = await apiFetch<{ entry: EntryRecord }>(
      `/api/admin/entries/${encodeURIComponent(collection)}/${id.split('/').map(encodeURIComponent).join('/')}`,
    );
    return res.entry;
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

export interface StageEntryInput {
  collection: string;
  /** Existing entry id, or the id of a new entry that is already a local draft. Omit for new. */
  id?: string | undefined;
  data: EntryValues;
  body?: string | undefined;
  title: string;
}

export interface StageEntryResult {
  id: string;
  isNew: boolean;
  path?: string | undefined;
  /** False when the values match the published entry, so no draft was kept. */
  staged: boolean;
  file?: EntryPreviewFile | undefined;
}

/**
 * Validate values against the collection schema and keep them as a local draft.
 * New entries get a file name reserved by the server on first save.
 */
export async function stageEntry(input: StageEntryInput): Promise<StageEntryResult> {
  const { collection, data, body, title } = input;
  let id = input.id;
  let existing = id ? await getEntryDraft(collection, id) : null;
  let isNew = existing?.isNew ?? false;
  let path = existing?.path;

  if (!id) {
    const proposed = await apiFetch<ProposeResponse>(`/api/admin/entries/${collection}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
      errorMessage: 'Could not name the new file',
    });
    id = proposed.id;
    path = proposed.path;
    isNew = true;
    existing = null;
  } else if (!existing) {
    // No draft yet: it must be a published entry.
    isNew = false;
  }

  const op = entryOp({ collection, id, isNew, path, op: 'upsert', data, body });
  const [file] = await previewEntryOps([op]);

  if (!isNew && file && file.before === file.after && !file.related?.length) {
    await clearEntryDraft(collection, id);
    return { id, isNew, staged: false, file };
  }

  await setEntryDraft({ collection, id, isNew, path, op: 'upsert', title, data, body });
  return { id, isNew, path, staged: true, file };
}

/** Stage a delete for a published entry (or drop a never-published draft). */
export async function stageEntryDelete(collection: string, id: string, title: string): Promise<'staged' | 'discarded'> {
  const existing = await getEntryDraft(collection, id);
  if (existing?.isNew) {
    await clearEntryDraft(collection, id);
    return 'discarded';
  }
  await setEntryDraft({ collection, id, isNew: false, op: 'delete', title, data: {} });
  return 'staged';
}

/**
 * Publish every local draft (pages, site chrome, collection entries) in one
 * request, then clear them. Entry drafts are cleared before the request because
 * writing src/content makes `astro dev` reload the page, possibly before the
 * response lands; they are restored if publishing fails.
 */
export async function publishAllDrafts(opts: {
  message?: string | undefined;
  /** Extra page drafts to include (e.g. the page open in the editor). */
  extraPages?: Record<string, PageData> | undefined;
} = {}): Promise<PublishResponse> {
  const pages: Record<string, PageData> = {};
  for (const id of await listDraftPageIds()) {
    const rec = await getPageDraft(id);
    if (rec?.page) pages[id] = rec.page;
  }
  Object.assign(pages, opts.extraPages ?? {});
  const siteRec = await getSiteDraft();
  const entryDrafts = await listEntryDrafts();

  const payload: {
    message: string;
    pages?: Record<string, PageData>;
    site?: SiteChrome;
    entries?: ReturnType<typeof entryOp>[];
  } = {
    message: opts.message?.trim() || 'content: publish drafts',
    ...(Object.keys(pages).length ? { pages } : {}),
    ...(siteRec?.site ? { site: siteRec.site } : {}),
    ...(entryDrafts.length ? { entries: entryDrafts.map(entryOp) } : {}),
  };
  if (!payload.pages && !payload.site && !payload.entries) {
    throw new Error('No local drafts to publish');
  }

  await Promise.all(entryDrafts.map((d) => clearEntryDraft(d.collection, d.id)));
  try {
    const result = await apiFetch<PublishResponse>('/api/admin/changes/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      errorMessage: 'Publish failed',
    });
    await clearAllDrafts();
    return result;
  } catch (err) {
    await Promise.all(entryDrafts.map(({ updatedAt: _u, ...d }) => setEntryDraft(d)));
    throw err;
  }
}

/** Counts for the agent's get_changes summary. */
export async function entryDraftSummary(): Promise<
  Array<{ collection: string; id: string; title: string; change: 'new' | 'modified' | 'delete' }>
> {
  return (await listEntryDrafts()).map((d) => ({
    collection: d.collection,
    id: d.id,
    title: d.title,
    change: d.op === 'delete' ? 'delete' : d.isNew ? 'new' : 'modified',
  }));
}
