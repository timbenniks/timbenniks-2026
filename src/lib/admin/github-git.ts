/** GitHub Contents / Git Data helpers for the cms → main workflow. */

export const PAGES_REL = 'src/content/pages.json';
export const SITE_REL = 'src/content/site.json';
/** Ephemeral admin preview drafts on cms — not intentional page saves. */
export const PREVIEW_DRAFTS_REL = 'src/content/.admin-preview-drafts.json';

export function mainBranch(): string {
  return process.env.GITHUB_BRANCH ?? 'main';
}

export function cmsBranch(): string {
  return process.env.GITHUB_CMS_BRANCH ?? 'cms';
}

export function hasGitHubConfig(): boolean {
  return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO);
}

export function requireGitHubConfig(): { token: string; repo: string } {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) {
    throw new Error(
      'GITHUB_TOKEN and GITHUB_REPO are required for the git CMS (Save / Changes / Publish)',
    );
  }
  return { token, repo };
}

function headers(token: string, json = true): HeadersInit {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

async function ghJson<T>(
  url: string,
  init?: RequestInit & { token?: string },
): Promise<{ ok: boolean; status: number; data: T; text: string }> {
  const token = init?.token ?? requireGitHubConfig().token;
  const { token: _t, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { ...headers(token), ...(rest.headers as Record<string, string> | undefined) },
  });
  const text = await res.text();
  let data = null as T;
  try {
    data = text ? (JSON.parse(text) as T) : (null as T);
  } catch {
    /* non-JSON */
  }
  return { ok: res.ok, status: res.status, data, text };
}

export async function getRefSha(branch: string): Promise<string | null> {
  const { token, repo } = requireGitHubConfig();
  const { ok, status, data, text } = await ghJson<{ object?: { sha?: string } }>(
    `https://api.github.com/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    { token },
  );
  if (status === 404) return null;
  if (!ok) throw new Error(`GitHub get ref failed: ${status} ${text}`);
  return data?.object?.sha ?? null;
}

/** Create cms from main tip if missing. Returns cms tip sha. */
export async function ensureCmsBranch(): Promise<string> {
  const { token, repo } = requireGitHubConfig();
  const existing = await getRefSha(cmsBranch());
  if (existing) return existing;

  const mainSha = await getRefSha(mainBranch());
  if (!mainSha) {
    throw new Error(`Main branch “${mainBranch()}” not found on GitHub`);
  }

  const { ok, status, text } = await ghJson(
    `https://api.github.com/repos/${repo}/git/refs`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({
        ref: `refs/heads/${cmsBranch()}`,
        sha: mainSha,
      }),
    },
  );
  if (!ok) throw new Error(`GitHub create cms branch failed: ${status} ${text}`);
  return mainSha;
}

export type RepoFile = { content: string; sha: string };

export async function getFile(path: string, branch: string): Promise<RepoFile | null> {
  const { token, repo } = requireGitHubConfig();
  const { ok, status, data, text } = await ghJson<{
    content?: string;
    encoding?: string;
    sha?: string;
  }>(
    `https://api.github.com/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`,
    { token },
  );
  if (status === 404) return null;
  if (!ok) throw new Error(`GitHub get contents failed: ${status} ${text}`);
  if (!data?.content || !data.sha) return null;
  const raw = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
  return { content: raw, sha: data.sha };
}

/** Read file from cms (ensure branch), falling back to main content if missing on cms. */
export async function getFileFromCms(
  path: string,
): Promise<RepoFile & { existsOnCms: boolean }> {
  await ensureCmsBranch();
  const onCms = await getFile(path, cmsBranch());
  if (onCms) return { ...onCms, existsOnCms: true };
  const onMain = await getFile(path, mainBranch());
  if (!onMain) throw new Error(`Missing ${path} on ${mainBranch()} and ${cmsBranch()}`);
  return { ...onMain, existsOnCms: false };
}

export async function putFile(
  path: string,
  content: string,
  branch: string,
  message: string,
  sha?: string,
): Promise<string> {
  const { token, repo } = requireGitHubConfig();
  const encoded = Buffer.from(content, 'utf8').toString('base64');
  const url = `https://api.github.com/repos/${repo}/contents/${path}`;

  async function attempt(fileSha: string | undefined) {
    const body: Record<string, string> = {
      message,
      content: encoded,
      branch,
    };
    if (fileSha) body.sha = fileSha;
    return ghJson<{ commit?: { sha?: string } }>(url, {
      method: 'PUT',
      token,
      body: JSON.stringify(body),
    });
  }

  let fileSha = sha;
  if (!fileSha) {
    const existing = await getFile(path, branch);
    fileSha = existing?.sha;
  }

  let { ok, status, data, text } = await attempt(fileSha);
  if (status === 409) {
    const fresh = await getFile(path, branch);
    ({ ok, status, data, text } = await attempt(fresh?.sha));
    if (!ok) {
      throw new Error(
        `GitHub put contents failed after SHA conflict retry: ${status} ${text}`,
      );
    }
    return data?.commit?.sha?.slice(0, 7) ?? 'ok';
  }
  if (!ok) throw new Error(`GitHub put contents failed: ${status} ${text}`);
  return data?.commit?.sha?.slice(0, 7) ?? 'ok';
}

/** Delete a file on a branch (Contents API). No-op if missing. */
export async function deleteFile(
  path: string,
  branch: string,
  message: string,
): Promise<string | null> {
  const { token, repo } = requireGitHubConfig();
  const existing = await getFile(path, branch);
  if (!existing) return null;

  const { ok, status, data, text } = await ghJson<{ commit?: { sha?: string } }>(
    `https://api.github.com/repos/${repo}/contents/${path}`,
    {
      method: 'DELETE',
      token,
      body: JSON.stringify({
        message,
        sha: existing.sha,
        branch,
      }),
    },
  );
  if (status === 409) {
    const fresh = await getFile(path, branch);
    if (!fresh) return null;
    const retry = await ghJson<{ commit?: { sha?: string } }>(
      `https://api.github.com/repos/${repo}/contents/${path}`,
      {
        method: 'DELETE',
        token,
        body: JSON.stringify({
          message,
          sha: fresh.sha,
          branch,
        }),
      },
    );
    if (!retry.ok) {
      throw new Error(
        `GitHub delete contents failed after SHA conflict retry: ${retry.status} ${retry.text}`,
      );
    }
    return retry.data?.commit?.sha?.slice(0, 7) ?? 'ok';
  }
  if (!ok) throw new Error(`GitHub delete contents failed: ${status} ${text}`);
  return data?.commit?.sha?.slice(0, 7) ?? 'ok';
}

export type CompareFile = {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
};

export type CompareResult = {
  status: string;
  aheadBy: number;
  behindBy: number;
  totalCommits: number;
  files: CompareFile[];
  htmlUrl: string | null;
  baseSha: string | null;
  headSha: string | null;
};

export async function compareBranches(
  base: string,
  head: string,
): Promise<CompareResult> {
  const { token, repo } = requireGitHubConfig();
  await ensureCmsBranch();
  const { ok, status, data, text } = await ghJson<{
    status?: string;
    ahead_by?: number;
    behind_by?: number;
    total_commits?: number;
    html_url?: string;
    base_commit?: { sha?: string };
    merge_base_commit?: { sha?: string };
    files?: Array<{
      filename?: string;
      status?: string;
      additions?: number;
      deletions?: number;
      patch?: string;
    }>;
  }>(
    `https://api.github.com/repos/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
    { token },
  );
  if (!ok) throw new Error(`GitHub compare failed: ${status} ${text}`);

  return {
    status: data?.status ?? 'unknown',
    aheadBy: data?.ahead_by ?? 0,
    behindBy: data?.behind_by ?? 0,
    totalCommits: data?.total_commits ?? 0,
    htmlUrl: data?.html_url ?? null,
    baseSha: data?.merge_base_commit?.sha ?? data?.base_commit?.sha ?? null,
    headSha: null,
    files: (data?.files ?? []).map((f) => ({
      filename: f.filename ?? '',
      status: f.status ?? 'modified',
      additions: f.additions ?? 0,
      deletions: f.deletions ?? 0,
      patch: f.patch,
    })),
  };
}

/** Point cms tip at main tip (after merge or discard). */
export async function resetCmsToMain(): Promise<string> {
  const { token, repo } = requireGitHubConfig();
  const mainSha = await getRefSha(mainBranch());
  if (!mainSha) throw new Error(`Main branch “${mainBranch()}” not found`);

  const cmsSha = await getRefSha(cmsBranch());
  if (!cmsSha) {
    await ensureCmsBranch();
    return mainSha.slice(0, 7);
  }

  const { ok, status, text } = await ghJson(
    `https://api.github.com/repos/${repo}/git/refs/heads/${encodeURIComponent(cmsBranch())}`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify({ sha: mainSha, force: true }),
    },
  );
  if (!ok) throw new Error(`GitHub reset cms failed: ${status} ${text}`);
  return mainSha.slice(0, 7);
}

/** Merge cms into main, then reset cms to main. */
export async function mergeCmsToMain(message: string): Promise<{
  commit: string;
  mode: 'github';
}> {
  const { token, repo } = requireGitHubConfig();
  await ensureCmsBranch();

  const compare = await compareBranches(mainBranch(), cmsBranch());
  if (compare.aheadBy === 0 && compare.files.length === 0) {
    throw new Error('Nothing to publish — cms is not ahead of main');
  }

  const { ok, status, data, text } = await ghJson<{
    sha?: string;
    commit?: { sha?: string };
  }>(`https://api.github.com/repos/${repo}/merges`, {
    method: 'POST',
    token,
    body: JSON.stringify({
      base: mainBranch(),
      head: cmsBranch(),
      commit_message: message.trim() || 'content: publish cms changes',
    }),
  });

  if (status === 204 || (ok && !data)) {
    // Already up to date
    await resetCmsToMain();
    return { commit: 'noop', mode: 'github' };
  }
  if (!ok) throw new Error(`GitHub merge failed: ${status} ${text}`);

  const sha = (data?.sha ?? data?.commit?.sha ?? '').slice(0, 7) || 'ok';
  await resetCmsToMain();
  return { commit: sha, mode: 'github' };
}

/** Restore one file on cms from main (or reset whole branch). */
export async function discardCmsChanges(opts?: {
  path?: string;
}): Promise<{ mode: 'github'; commit: string }> {
  await ensureCmsBranch();
  if (!opts?.path) {
    const sha = await resetCmsToMain();
    return { mode: 'github', commit: sha };
  }

  const onMain = await getFile(opts.path, mainBranch());
  if (!onMain) {
    throw new Error(`File ${opts.path} not found on ${mainBranch()}`);
  }
  const onCms = await getFile(opts.path, cmsBranch());
  const commit = await putFile(
    opts.path,
    onMain.content,
    cmsBranch(),
    `cms: discard ${opts.path}`,
    onCms?.sha,
  );
  return { mode: 'github', commit };
}
