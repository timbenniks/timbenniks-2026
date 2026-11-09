import type { APIRoute } from 'astro';
import { isAdminAuthed } from '../../../../../lib/admin/auth';
import { readEntry } from '../../../../../lib/admin/entries-store';
import { isEntryCollection } from '../../../../../lib/content-schemas';
import { json } from '../_shared';

export const prerender = false;

/** The published entry (frontmatter + body) from main / the working tree. */
export const GET: APIRoute = async ({ request, params }) => {
  if (!isAdminAuthed(request)) return json({ error: 'Unauthorized' }, 401);
  const collection = params.collection ?? '';
  const id = params.id ?? '';
  if (!isEntryCollection(collection)) return json({ error: 'Unknown collection' }, 404);
  try {
    const entry = await readEntry(collection, id);
    if (!entry) return json({ error: `${collection}/${id} not found` }, 404);
    return json({ ok: true, entry });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
};
