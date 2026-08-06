import type { APIRoute } from 'astro';
import { isAdminAuthed } from '../../../../lib/admin/auth';
import { diffPageIds } from '../../../../lib/admin/pages-store';
import {
  cmsBranch,
  compareBranches,
  getFile,
  hasGitHubConfig,
  mainBranch,
  PAGES_REL,
  SITE_REL,
} from '../../../../lib/admin/github-git';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  if (!isAdminAuthed(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  if (!hasGitHubConfig()) {
    return new Response(
      JSON.stringify({
        ok: false,
        configured: false,
        error:
          'GITHUB_TOKEN and GITHUB_REPO are required for Changes / Publish on the cms → main workflow',
        mainBranch: mainBranch(),
        cmsBranch: cmsBranch(),
        aheadBy: 0,
        files: [],
        pages: [],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const compare = await compareBranches(mainBranch(), cmsBranch());
    let pages: ReturnType<typeof diffPageIds> = [];
    const pagesTouched = compare.files.some((f) => f.filename === PAGES_REL);
    if (pagesTouched) {
      const mainFile = await getFile(PAGES_REL, mainBranch());
      const cmsFile = await getFile(PAGES_REL, cmsBranch());
      if (mainFile && cmsFile) {
        pages = diffPageIds(mainFile.content, cmsFile.content);
      } else if (!mainFile && cmsFile) {
        pages = diffPageIds('{}', cmsFile.content);
      }
    }

    const siteTouched = compare.files.some((f) => f.filename === SITE_REL);

    return new Response(
      JSON.stringify({
        ok: true,
        configured: true,
        mainBranch: mainBranch(),
        cmsBranch: cmsBranch(),
        aheadBy: compare.aheadBy,
        behindBy: compare.behindBy,
        totalCommits: compare.totalCommits,
        status: compare.status,
        htmlUrl: compare.htmlUrl,
        siteTouched,
        files: compare.files,
        pages,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message, configured: true }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
