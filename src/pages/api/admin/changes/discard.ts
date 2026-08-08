import type { APIRoute } from 'astro';
import { isAdminAuthed } from '../../../../lib/admin/auth';
import {
  clearAllPreviewDrafts,
  clearDurablePreviewDraftsArtifact,
  clearPreviewDraft,
} from '../../../../lib/admin/pages-store';
import { clearSiteDraft } from '../../../../lib/admin/site-store';
import { isPageIdFormat } from '../../../../lib/page-schema';

export const prerender = false;

/**
 * Clear server-side preview drafts. IndexedDB drafts are cleared by the client.
 * Body: { pageId?: string, site?: boolean, all?: boolean }
 */
export const POST: APIRoute = async ({ request }) => {
  if (!isAdminAuthed(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    /* discard all server drafts */
  }

  try {
    if (body.all === true || (!body.pageId && body.site !== true && body.all !== false)) {
      await clearDurablePreviewDraftsArtifact();
      clearAllPreviewDrafts();
      clearSiteDraft();
      return new Response(JSON.stringify({ ok: true, cleared: 'all-server' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (typeof body.pageId === 'string' && isPageIdFormat(body.pageId)) {
      clearPreviewDraft(body.pageId);
    }
    if (body.site === true) {
      clearSiteDraft();
    }

    return new Response(JSON.stringify({ ok: true, cleared: 'partial-server' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
