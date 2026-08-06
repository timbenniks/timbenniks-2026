import type { APIRoute } from 'astro';
import { isAdminAuthed } from '../../../lib/admin/auth';
import {
  readSiteForAdmin,
  saveSiteDraft,
  saveSiteToCms,
  validateSiteChrome,
} from '../../../lib/admin/site-store';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!isAdminAuthed(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  const site = await readSiteForAdmin();
  return new Response(JSON.stringify({ site }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const PUT: APIRoute = async ({ request }) => {
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
    body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  const sitePayload = payload && 'site' in payload ? payload.site : body;
  const previewOnly = payload?.mode === 'preview';

  try {
    const site = validateSiteChrome(sitePayload);
    if (previewOnly) {
      const result = await saveSiteDraft(site);
      return new Response(JSON.stringify({ ok: true, ...result }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const result = await saveSiteToCms(site);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
