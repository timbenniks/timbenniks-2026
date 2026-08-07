import type { APIRoute } from 'astro';
import {
  isAdminPageId,
  readPagesForAdmin,
  savePageDraft,
  savePageToCms,
  getPagePath,
  validatePageData,
  formatZodError,
} from '../../../../../lib/admin/pages-store';
import { isAdminAuthed } from '../../../../../lib/admin/auth';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  if (!isAdminAuthed(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const id = params.id;
  if (!id || !(await isAdminPageId(id))) {
    return new Response(JSON.stringify({ error: 'Unknown page' }), { status: 404 });
  }
  const all = await readPagesForAdmin();
  const page = all[id];
  if (!page) {
    return new Response(JSON.stringify({ error: 'Missing page' }), { status: 404 });
  }
  return new Response(JSON.stringify({ id, page, path: getPagePath(page, id) }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PUT: APIRoute = async ({ params, request }) => {
  if (!isAdminAuthed(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const id = params.id;
  if (!id || !(await isAdminPageId(id))) {
    return new Response(JSON.stringify({ error: 'Unknown page' }), { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const payload =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  const pagePayload = payload && 'page' in payload ? payload.page : body;
  const previewOnly = payload?.mode === 'preview';

  try {
    const page = validatePageData(pagePayload);
    if (previewOnly) {
      const result = await savePageDraft(id, page);
      return new Response(JSON.stringify({ ok: true, ...result }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const result = await savePageToCms(id, page);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = formatZodError(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
