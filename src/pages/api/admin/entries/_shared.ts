import type { EntryCollection } from '../../../../lib/content-schemas';
import { isEntryCollection } from '../../../../lib/content-schemas';
import type { EntryOp } from '../../../../lib/admin/entries-store';

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Collections the admin can edit. */
export const EDITABLE_COLLECTIONS: readonly EntryCollection[] = ['speaking', 'projects', 'videos', 'writing'];

/** Parse and shape-check an `entries` array from a request body. */
export function parseEntryOps(raw: unknown): EntryOp[] {
  if (!Array.isArray(raw)) throw new Error('entries must be an array');
  return raw.map((item, i) => {
    if (!item || typeof item !== 'object') throw new Error(`entries[${i}] must be an object`);
    const o = item as Record<string, unknown>;
    const collection = String(o.collection ?? '');
    if (!isEntryCollection(collection)) throw new Error(`entries[${i}]: unknown collection`);
    if (!EDITABLE_COLLECTIONS.includes(collection)) {
      throw new Error(`entries[${i}]: editing ${collection} is not supported yet`);
    }
    if (o.op !== 'upsert' && o.op !== 'delete') throw new Error(`entries[${i}]: op must be upsert or delete`);
    const op: EntryOp = { collection, op: o.op };
    if (typeof o.id === 'string' && o.id) op.id = o.id;
    if (typeof o.path === 'string' && o.path) op.path = o.path;
    if (o.data && typeof o.data === 'object' && !Array.isArray(o.data)) {
      op.data = o.data as Record<string, unknown>;
    }
    if (typeof o.body === 'string') op.body = o.body;
    return op;
  });
}
