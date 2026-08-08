import type { APIRoute } from 'astro';
import { isAdminAuthed } from '../../../../lib/admin/auth';
import {
  clearAllPreviewDrafts,
  clearDurablePreviewDraftsArtifact,
  publishPagesToMain,
  readPagesForAdmin,
  validatePageData,
  formatZodError,
} from '../../../../lib/admin/pages-store';
import {
  clearSiteDraft,
  publishSiteToMain,
  validateSiteChrome,
} from '../../../../lib/admin/site-store';
import { hasGitHubConfig, mainBranch, PAGES_REL, SITE_REL } from '../../../../lib/admin/github-git';
import type { PageData } from '../../../../lib/page-schema';

export const prerender = false;

/**
 * Publish client drafts to main.
 * Body: { message?, pages?: Record<id, PageData>, site?: SiteChrome, pageIds?: string[] }
 * If pageIds is set without full pages map, overlays those ids from the provided pages object.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!isAdminAuthed(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }

  const message =
    typeof body.message === 'string' && body.message.trim()
      ? body.message.trim()
      : 'content: publish drafts';

  const hasPagesPayload =
    body.pages && typeof body.pages === 'object' && !Array.isArray(body.pages);
  const hasSitePayload = body.site != null;

  if (!hasPagesPayload && !hasSitePayload) {
    return new Response(
      JSON.stringify({ error: 'Nothing to publish — include pages and/or site drafts' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Without GitHub, allow local working-tree publish. With GitHub, require token (hasGitHubConfig).
  // Local e2e clears token — Publish still works via local-working when pages/site provided.

  try {
    await clearDurablePreviewDraftsArtifact();
    const commits: string[] = [];
    const written: string[] = [];

    if (hasPagesPayload) {
      const overlays = body.pages as Record<string, unknown>;
      const baseline = await readPagesForAdmin();
      const merged: Record<string, PageData> = { ...baseline };
      for (const [id, raw] of Object.entries(overlays)) {
        merged[id] = validatePageData(raw);
      }
      // Optional removals: pageIds listed under removePageIds
      const removeIds = Array.isArray(body.removePageIds)
        ? (body.removePageIds as unknown[]).map(String)
        : [];
      for (const id of removeIds) {
        delete merged[id];
      }
      const result = await publishPagesToMain(merged, message);
      commits.push(result.commit);
      written.push(PAGES_REL);
    }

    if (hasSitePayload) {
      const site = validateSiteChrome(body.site);
      const result = await publishSiteToMain(
        site,
        hasPagesPayload ? `${message} (site)` : message,
      );
      commits.push(result.commit);
      written.push(SITE_REL);
    }

    clearAllPreviewDrafts();
    clearSiteDraft();

    return new Response(
      JSON.stringify({
        ok: true,
        mode: hasGitHubConfig() ? 'github' : 'local-working',
        branch: hasGitHubConfig() ? mainBranch() : 'local',
        commit: commits.filter(Boolean).join(', ') || 'ok',
        written,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const msg = formatZodError(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
