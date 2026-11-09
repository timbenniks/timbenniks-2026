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
import { PAGES_REL, SITE_REL } from '../../../../lib/admin/github-git';
import type { PageData } from '../../../../lib/page-schema';
import { publishEntries } from '../../../../lib/admin/entries-store';
import { parseEntryOps } from '../entries/_shared';

export const prerender = false;

/**
 * Publish client drafts to main (GitHub) or the local working tree (`astro dev`).
 * Body: { message?, pages?: Record<id, PageData>, site?: SiteChrome, pageIds?: string[],
 *         entries?: EntryOp[] }  — collection entry drafts, written as one commit.
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
  const hasEntriesPayload = Array.isArray(body.entries) && body.entries.length > 0;

  if (!hasPagesPayload && !hasSitePayload && !hasEntriesPayload) {
    return new Response(
      JSON.stringify({ error: 'Nothing to publish — include page, site or entry drafts' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    // Validate entry drafts before writing anything, so a bad entry can't leave
    // pages published and entries not.
    const entryOps = hasEntriesPayload ? parseEntryOps(body.entries) : [];
    await clearDurablePreviewDraftsArtifact();
    const commits: string[] = [];
    const written: string[] = [];
    let mode: 'github' | 'local-working' = 'local-working';
    let branch = 'local';

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
      mode = result.mode;
      branch = result.branch;
    }

    if (hasSitePayload) {
      const site = validateSiteChrome(body.site);
      const result = await publishSiteToMain(
        site,
        hasPagesPayload ? `${message} (site)` : message,
      );
      commits.push(result.commit);
      written.push(SITE_REL);
      mode = result.mode;
      branch = result.branch;
    }

    if (entryOps.length) {
      const result = await publishEntries(
        entryOps,
        hasPagesPayload || hasSitePayload ? `${message} (entries)` : message,
      );
      commits.push(result.commit);
      written.push(...result.written);
      mode = result.mode;
      branch = result.branch;
    }

    clearAllPreviewDrafts();
    clearSiteDraft();

    return new Response(
      JSON.stringify({
        ok: true,
        mode,
        branch,
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
