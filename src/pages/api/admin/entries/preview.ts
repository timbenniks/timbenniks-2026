import type { APIRoute } from 'astro';
import { isAdminAuthed } from '../../../../lib/admin/auth';
import { previewEntries } from '../../../../lib/admin/entries-store';
import { formatZodError } from '../../../../lib/admin/pages-store';
import { json, parseEntryOps } from './_shared';

export const prerender = false;

/**
 * Validate entry drafts and return the file text each would produce, without
 * writing. Used by the entry editor's Save and by the Changes diff.
 * Body: { entries: EntryOp[] }
 */
export const POST: APIRoute = async ({ request }) => {
  if (!isAdminAuthed(request)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const files = await previewEntries(parseEntryOps(body.entries));
    return json({ ok: true, files });
  } catch (err) {
    return json({ error: formatZodError(err) }, 400);
  }
};
