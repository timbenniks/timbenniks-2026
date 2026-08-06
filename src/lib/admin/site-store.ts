import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { siteChromeSchema, type SiteChrome } from '../site-schema';
import {
  cmsBranch,
  ensureCmsBranch,
  getFileFromCms,
  hasGitHubConfig,
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
let cmsSiteCache: { at: number; data: SiteChrome } | null = null;
const CMS_CACHE_MS = 5_000;

export function getSiteDraft(): SiteChrome | null {
  return siteDraft;
}

export function clearSiteDraft(): void {
  siteDraft = null;
  cmsSiteCache = null;
}

export async function saveSiteDraft(data: SiteChrome): Promise<{ mode: 'draft' }> {
  siteDraft = validateSiteChrome(data);
  return { mode: 'draft' };
}

/** Prefer cms branch when GitHub is configured. */
export async function readSiteForAdmin(): Promise<SiteChrome> {
  if (hasGitHubConfig()) {
    await ensureCmsBranch();
    const file = await getFileFromCms(SITE_REL);
    return siteChromeSchema.parse(JSON.parse(file.content));
  }
  return readSiteFile();
}

export async function getCmsSiteCached(): Promise<SiteChrome | null> {
  if (!hasGitHubConfig()) return null;
  if (cmsSiteCache && Date.now() - cmsSiteCache.at < CMS_CACHE_MS) {
    return cmsSiteCache.data;
  }
  try {
    const file = await getFileFromCms(SITE_REL);
    const data = siteChromeSchema.parse(JSON.parse(file.content));
    cmsSiteCache = { at: Date.now(), data };
    return data;
  } catch {
    return null;
  }
}

export async function saveSiteToCms(
  data: SiteChrome,
): Promise<{ commit: string; mode: 'cms' | 'local-working'; branch: string }> {
  const validated = validateSiteChrome(data);
  const fullJson = `${JSON.stringify(validated, null, 2)}\n`;

  if (hasGitHubConfig()) {
    await ensureCmsBranch();
    const file = await getFileFromCms(SITE_REL);
    const commit = await putFile(
      SITE_REL,
      fullJson,
      cmsBranch(),
      'cms: update site chrome',
      file.existsOnCms ? file.sha : undefined,
    );
    siteDraft = validated;
    cmsSiteCache = { at: Date.now(), data: validated };
    return { commit, mode: 'cms', branch: cmsBranch() };
  }

  await writeSiteFile(validated);
  siteDraft = validated;
  return { commit: 'working-tree', mode: 'local-working', branch: 'local' };
}

/** @deprecated Use saveSiteToCms */
export async function saveSiteEntry(
  data: SiteChrome,
): Promise<{ commit: string; mode: 'cms' | 'local-working'; branch: string }> {
  return saveSiteToCms(data);
}
