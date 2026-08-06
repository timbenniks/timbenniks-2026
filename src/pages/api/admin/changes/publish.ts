import type { APIRoute } from 'astro';
import { isAdminAuthed } from '../../../../lib/admin/auth';
import {
  clearAllPreviewDrafts,
  clearDurablePreviewDraftsArtifact,
} from '../../../../lib/admin/pages-store';
import { clearSiteDraft } from '../../../../lib/admin/site-store';
import { hasGitHubConfig, mergeCmsToMain } from '../../../../lib/admin/github-git';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isAdminAuthed(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  if (!hasGitHubConfig()) {
    return new Response(
      JSON.stringify({
        error: 'GITHUB_TOKEN and GITHUB_REPO are required to publish',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  let message = 'content: publish cms changes';
  try {
    const body = await request.json();
    if (body && typeof body === 'object' && typeof (body as { message?: string }).message === 'string') {
      const m = (body as { message: string }).message.trim();
      if (m) message = m;
    }
  } catch {
    /* optional body */
  }

  try {
    // Drop ephemeral preview drafts so they are not merged into main.
    await clearDurablePreviewDraftsArtifact();
    const result = await mergeCmsToMain(message);
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
