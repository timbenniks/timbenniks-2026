import type { APIRoute } from 'astro';
import {
  createPageEntry,
  formatZodError,
  getPagePath,
  listAdminPageIds,
  readPagesForAdmin,
} from '../../../../lib/admin/pages-store';
import type { PageId } from '../../../../lib/page-schema';
import { isAdminAuthed } from '../../../../lib/admin/auth';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!isAdminAuthed(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const all = await readPagesForAdmin();
  const pages = (await listAdminPageIds()).map((id: PageId) => ({
    id,
    path: getPagePath(all[id]!, id),
    title: all[id]!.metadata.title,
  }));
  return new Response(JSON.stringify({ pages }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  if (!isAdminAuthed(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const payload =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {};

  try {
    const result = await createPageEntry({
      id: String(payload.id ?? ''),
      path: String(payload.path ?? ''),
      title: String(payload.title ?? ''),
      description:
        typeof payload.description === 'string' ? payload.description : undefined,
    });
    return new Response(
      JSON.stringify({
        ok: true,
        id: result.id,
        path: result.page.path,
        commit: result.commit,
        mode: result.mode,
        branch: result.branch,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = formatZodError(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
