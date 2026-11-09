import type { APIRoute } from 'astro';
import { isAdminAuthed } from '../../../../../lib/admin/auth';
import { proposeNewEntry } from '../../../../../lib/admin/entries-store';
import { isEntryCollection } from '../../../../../lib/content-schemas';
import { EDITABLE_COLLECTIONS, json } from '../_shared';

export const prerender = false;

/**
 * Reserve a file name for a new entry. Nothing is written: the client keeps the
 * new entry as a local draft until it is published from Changes.
 * Body: { data: Record<string, unknown>, slug?: string }
 */
export const POST: APIRoute = async ({ request, params }) => {
  if (!isAdminAuthed(request)) return json({ error: 'Unauthorized' }, 401);
  const collection = params.collection ?? '';
  if (!isEntryCollection(collection)) return json({ error: 'Unknown collection' }, 404);
  if (!EDITABLE_COLLECTIONS.includes(collection)) {
    return json({ error: `Creating ${collection} entries is not supported yet` }, 400);
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  const data =
    body.data && typeof body.data === 'object' ? (body.data as Record<string, unknown>) : {};
  try {
    const proposed = await proposeNewEntry(
      collection,
      data,
      typeof body.slug === 'string' ? body.slug : undefined,
    );
    return json({ ok: true, ...proposed });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
};
