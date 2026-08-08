import type { APIRoute } from 'astro';
import { isAdminAuthed } from '../../../../../lib/admin/auth';
import { isAdminPageId } from '../../../../../lib/admin/pages-store';
import {
  cmsBranch,
  hasGitHubConfig,
  listCommits,
  mainBranch,
  PAGES_REL,
} from '../../../../../lib/admin/github-git';

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  if (!isAdminAuthed(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const id = params.id;
  if (!id || !(await isAdminPageId(id))) {
    return new Response(JSON.stringify({ error: 'Unknown page' }), { status: 404 });
  }

  if (!hasGitHubConfig()) {
    return new Response(
      JSON.stringify({
        ok: false,
        configured: false,
        pageId: id,
        mainBranch: mainBranch(),
        cmsBranch: cmsBranch(),
        commits: [],
        lastPublish: null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  try {
    const commits = await listCommits({ path: PAGES_REL, sha: mainBranch(), perPage: 25 });

    return new Response(
      JSON.stringify({
        ok: true,
        configured: true,
        pageId: id,
        path: PAGES_REL,
        mainBranch: mainBranch(),
        cmsBranch: mainBranch(),
        commits,
        lastPublish: commits[0] ?? null,
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
