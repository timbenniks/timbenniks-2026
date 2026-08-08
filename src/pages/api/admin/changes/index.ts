import type { APIRoute } from 'astro';
import { isAdminAuthed } from '../../../../lib/admin/auth';
import { readPagesFile, readPagesForAdmin } from '../../../../lib/admin/pages-store';
import { readSiteFile, readSiteForAdmin } from '../../../../lib/admin/site-store';
import { hasGitHubConfig, mainBranch, PAGES_REL, SITE_REL } from '../../../../lib/admin/github-git';

export const prerender = false;

/**
 * Baseline content for the Changes desk.
 * Client diffs IndexedDB drafts against this payload.
 */
export const GET: APIRoute = async ({ request }) => {
  if (!isAdminAuthed(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    const pages = hasGitHubConfig()
      ? await readPagesForAdmin()
      : await readPagesFile();
    const site = hasGitHubConfig()
      ? await readSiteForAdmin()
      : await readSiteFile();

    return new Response(
      JSON.stringify({
        ok: true,
        configured: hasGitHubConfig(),
        mainBranch: mainBranch(),
        pages,
        site,
        paths: { pages: PAGES_REL, site: SITE_REL },
        error: hasGitHubConfig()
          ? undefined
          : 'GITHUB_TOKEN and GITHUB_REPO are required to publish drafts to main. Local drafts still work; Publish writes the working tree when configured locally.',
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message, configured: hasGitHubConfig() }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
