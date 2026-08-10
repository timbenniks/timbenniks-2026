import type { APIRoute } from 'astro';
import { isAdminAuthed } from '../../../../lib/admin/auth';
import { readPagesForAdmin } from '../../../../lib/admin/pages-store';
import { readSiteForAdmin } from '../../../../lib/admin/site-store';
import {
  hasGitHubConfig,
  mainBranch,
  preferLocalWorkingTree,
  usesGitHubCms,
  PAGES_REL,
  SITE_REL,
} from '../../../../lib/admin/github-git';

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
    const pages = await readPagesForAdmin();
    const site = await readSiteForAdmin();
    const viaGitHub = usesGitHubCms();
    const localDev = preferLocalWorkingTree();

    let hint: string | undefined;
    if (localDev) {
      hint =
        'Local dev: Publish writes src/content/*.json on disk. Commit and push when ready.';
    } else if (!hasGitHubConfig()) {
      hint =
        'GITHUB_TOKEN and GITHUB_REPO are required to publish drafts to main on this host.';
    }

    return new Response(
      JSON.stringify({
        ok: true,
        configured: viaGitHub,
        preferLocal: localDev,
        mode: viaGitHub ? 'github' : 'local-working',
        mainBranch: viaGitHub ? mainBranch() : 'local',
        pages,
        site,
        paths: { pages: PAGES_REL, site: SITE_REL },
        error: hint,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({
        error: message,
        configured: usesGitHubCms(),
        preferLocal: preferLocalWorkingTree(),
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
};
