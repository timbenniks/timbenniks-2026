import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { siteChromeSchema, type SiteChrome } from '../site-schema';
import {
  getFile,
  usesGitHubCms,
  mainBranch,
  putFile,
  SITE_REL,
} from './github-git';

export function siteFilePath(cwd = process.cwd()): string {
  return join(cwd, SITE_REL);
}

export async function readSiteFile(): Promise<SiteChrome> {
  const raw = await readFile(siteFilePath(), 'utf8');
  return siteChromeSchema.parse(JSON.parse(raw));
}

export async function writeSiteFile(data: SiteChrome): Promise<void> {
  const body = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(siteFilePath(), body, 'utf8');
}

export function validateSiteChrome(data: unknown): SiteChrome {
  return siteChromeSchema.parse(data);
}

let siteDraft: SiteChrome | null = null;
let mainSiteCache: { at: number; data: SiteChrome } | null = null;
const CACHE_MS = 5_000;

export function getSiteDraft(): SiteChrome | null {
  return siteDraft;
}

export function clearSiteDraft(): void {
  siteDraft = null;
  mainSiteCache = null;
}

export async function saveSiteDraft(data: SiteChrome): Promise<{ mode: 'draft' }> {
  siteDraft = validateSiteChrome(data);
  return { mode: 'draft' };
}

/** Prefer main branch when GitHub CMS is active. Drafts live in the browser. */
export async function readSiteForAdmin(): Promise<SiteChrome> {
  if (usesGitHubCms()) {
    const cached = await getMainSiteCached();
    if (cached) return cached;
    const file = await getFile(SITE_REL, mainBranch());
    if (!file) return readSiteFile();
    return siteChromeSchema.parse(JSON.parse(file.content));
  }
  return readSiteFile();
}

export async function getMainSiteCached(): Promise<SiteChrome | null> {
  if (!usesGitHubCms()) return null;
  if (mainSiteCache && Date.now() - mainSiteCache.at < CACHE_MS) {
    return mainSiteCache.data;
  }
  try {
    const file = await getFile(SITE_REL, mainBranch());
    if (!file) return null;
    const data = siteChromeSchema.parse(JSON.parse(file.content));
    mainSiteCache = { at: Date.now(), data };
    return data;
  } catch {
    return null;
  }
}

/** @deprecated Use getMainSiteCached */
export async function getCmsSiteCached(): Promise<SiteChrome | null> {
  return getMainSiteCached();
}

/** Publish site chrome to main (or local working tree). */
export async function publishSiteToMain(
  data: SiteChrome,
  message = 'content: publish site chrome',
): Promise<{ commit: string; mode: 'github' | 'local-working'; branch: string }> {
  const validated = validateSiteChrome(data);
  const fullJson = `${JSON.stringify(validated, null, 2)}\n`;

  if (usesGitHubCms()) {
    const file = await getFile(SITE_REL, mainBranch());
    const commit = await putFile(
      SITE_REL,
      fullJson,
      mainBranch(),
      message,
      file?.sha,
    );
    siteDraft = validated;
    mainSiteCache = { at: Date.now(), data: validated };
    return { commit, mode: 'github', branch: mainBranch() };
  }

  await writeSiteFile(validated);
  siteDraft = validated;
  return { commit: 'working-tree', mode: 'local-working', branch: 'local' };
}

/**
 * Stage a preview draft only (no Git). Client IndexedDB owns intentional drafts.
 * @deprecated Prefer client draft store; kept for preview sync fallback.
 */
export async function saveSiteToCms(
  data: SiteChrome,
): Promise<{ commit: string; mode: 'draft'; branch: string }> {
  await saveSiteDraft(data);
  return { commit: 'local-draft', mode: 'draft', branch: 'draft' };
}

/** @deprecated Use saveSiteToCms / publishSiteToMain */
export async function saveSiteEntry(
  data: SiteChrome,
): Promise<{ commit: string; mode: 'draft'; branch: string }> {
  return saveSiteToCms(data);
}
