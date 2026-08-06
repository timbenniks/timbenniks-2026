import type { APIRoute } from 'astro';
import { isAdminAuthed } from '../../../../lib/admin/auth';
import {
  clearAllPreviewDrafts,
  clearDurablePreviewDraftsArtifact,
} from '../../../../lib/admin/pages-store';
import { clearSiteDraft } from '../../../../lib/admin/site-store';
import {
  discardCmsChanges,
  hasGitHubConfig,
  PAGES_REL,
  SITE_REL,
} from '../../../../lib/admin/github-git';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isAdminAuthed(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  if (!hasGitHubConfig()) {
    return new Response(
      JSON.stringify({
        error: 'GITHUB_TOKEN and GITHUB_REPO are required to discard',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let path: string | undefined;
  try {
    const body = await request.json();
    if (body && typeof body === 'object' && typeof (body as { path?: string }).path === 'string') {
      const p = (body as { path: string }).path.trim();
      if (p === PAGES_REL || p === SITE_REL) path = p;
      else if (p) {
        return new Response(JSON.stringify({ error: `Cannot discard path: ${p}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
  } catch {
    /* discard all */
  }

  try {
    const result = await discardCmsChanges(path ? { path } : undefined);
    if (!path) {
      // Full discard already reset cms; still clear local + cache.
      await clearDurablePreviewDraftsArtifact();
    }
    clearAllPreviewDrafts();
    clearSiteDraft();
    return new Response(JSON.stringify({ ok: true, ...result }), {
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
