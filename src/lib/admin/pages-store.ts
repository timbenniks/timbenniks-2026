import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  defaultPathForId,
  FIXED_PAGE_IDS,
  FIXED_PAGE_PATHS,
  isPageIdFormat,
  pageDataSchema,
  type FixedPageId,
  type PageData,
  type PageId,
} from '../page-schema';
import {
  deleteFile,
  getFile,
  usesGitHubCms,
  mainBranch,
  PAGES_REL,
  PREVIEW_DRAFTS_REL,
  putFile,
} from './github-git';

export { PREVIEW_DRAFTS_REL };

/** Readable message from Zod (or passthrough for other errors). */
export function formatZodError(err: unknown): string {
  if (
    err &&
    typeof err === 'object' &&
    'issues' in err &&
    Array.isArray((err as { issues: unknown }).issues)
  ) {
    const issues = (
      err as {
        issues: Array<{ path?: (string | number)[]; message?: string }>;
      }
    ).issues;
    if (issues.length === 0) return 'Validation failed';
    return issues
      .map((issue) => {
        const path = issue.path?.length ? issue.path.join('.') : '(root)';
        return `${path}: ${issue.message ?? 'invalid'}`;
      })
      .join('; ');
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export function pagesFilePath(cwd = process.cwd()): string {
  return join(cwd, PAGES_REL);
}

function parsePagesJson(raw: string): Record<string, PageData> {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const out: Record<string, PageData> = {};
  for (const [id, value] of Object.entries(parsed)) {
    out[id] = pageDataSchema.parse(value);
  }
  return out;
}

/** Deployed / working-tree pages.json (public site + SSG). */
export async function readPagesFile(): Promise<Record<string, PageData>> {
  const raw = await readFile(pagesFilePath(), 'utf8');
  return parsePagesJson(raw);
}

export async function writePagesFile(data: Record<string, PageData>): Promise<void> {
  const body = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(pagesFilePath(), body, 'utf8');
}

/** Prefer main branch when GitHub CMS is active; else filesystem. Drafts live in the browser. */
export async function readPagesForAdmin(): Promise<Record<string, PageData>> {
  if (usesGitHubCms()) {
    const main = await getMainPagesCached();
    if (main) return main;
    const file = await getFile(PAGES_REL, mainBranch());
    if (!file) return readPagesFile();
    const data = parsePagesJson(file.content);
    previewStore().cmsPagesCache = { at: Date.now(), data };
    return data;
  }
  return readPagesFile();
}

export function validatePageData(data: unknown): PageData {
  try {
    return pageDataSchema.parse(data);
  } catch (err) {
    throw new Error(formatZodError(err));
  }
}

export async function listPageIds(): Promise<PageId[]> {
  const all = await readPagesFile();
  return Object.keys(all).sort((a, b) => a.localeCompare(b));
}

export async function listAdminPageIds(): Promise<PageId[]> {
  const all = await readPagesForAdmin();
  return Object.keys(all).sort((a, b) => a.localeCompare(b));
}

export async function isPageId(id: string): Promise<boolean> {
  if (!isPageIdFormat(id)) return false;
  const all = await readPagesFile();
  return id in all;
}

/** True if id exists on main/FS or as an in-memory/disk preview draft (new local pages). */
export async function isAdminPageId(id: string): Promise<boolean> {
  if (!isPageIdFormat(id)) return false;
  if (getPreviewDraft(id)) return true;
  const all = await readPagesForAdmin();
  return id in all;
}

export function getPagePath(page: PageData, id?: string): string {
  return page.path || (id ? defaultPathForId(id) : '/');
}

export async function findPageByPath(
  pathname: string,
): Promise<{ id: PageId; page: PageData } | null> {
  const normalized = pathname.replace(/\/$/, '') || '/';
  const all = await readPagesFile();
  for (const [id, page] of Object.entries(all)) {
    const path = getPagePath(page, id).replace(/\/$/, '') || '/';
    if (path === normalized) return { id, page };
  }
  return null;
}

/** Paths that must not be claimed by catch-all / create-page. */
export const RESERVED_PATH_PREFIXES = [
  '/admin',
  '/api',
  '/_',
  '/search',
  '/pagefind',
  '/writing/',
  '/videos/',
  '/speaking/',
  '/projects/',
] as const;

export function isReservedPath(path: string): boolean {
  const normalized = path.replace(/\/$/, '') || '/';
  if (normalized === '/robots.txt' || normalized === '/sitemap.xml') return true;
  if (normalized.endsWith('.txt') || normalized.endsWith('.xml') || normalized.endsWith('.md')) {
    return true;
  }
  for (const prefix of RESERVED_PATH_PREFIXES) {
    if (normalized === prefix.replace(/\/$/, '') || normalized.startsWith(prefix)) {
      return true;
    }
  }
  for (const fixed of Object.values(FIXED_PAGE_PATHS)) {
    const f = fixed.replace(/\/$/, '') || '/';
    if (f === normalized) return true;
  }
  return false;
}

export function isFixedPageId(id: string): id is FixedPageId {
  return (FIXED_PAGE_IDS as readonly string[]).includes(id);
}

/** Pages that should be emitted by the [...slug] catch-all (not fixed shells). */
export async function listCatchAllPages(): Promise<{ id: PageId; path: string }[]> {
  const all = await readPagesFile();
  const out: { id: PageId; path: string }[] = [];
  for (const [id, page] of Object.entries(all)) {
    if (isFixedPageId(id)) continue;
    const path = getPagePath(page, id);
    if (path === '/') continue;
    out.push({ id, path });
  }
  return out;
}

export function defaultHeroSection() {
  return {
    kind: 'hero' as const,
    eyebrow: 'New page',
    headline: {
      lead: 'A clear lead line,',
      em: 'one emphasized beat,',
      tail: 'and a short tail.',
    },
    subline:
      'Supporting copy for this new page. Replace this with the real message.',
    ctas: [{ label: 'Primary action', href: '/', variant: 'primary' as const }],
    imageSide: 'right' as const,
  };
}

export function getByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    const next = cur[key];
    if (next == null || typeof next !== 'object') {
      const nest: Record<string, unknown> = {};
      cur[key] = nest;
      cur = nest;
    } else {
      cur = next as Record<string, unknown>;
    }
  }
  cur[parts[parts.length - 1]!] = value;
}

/**
 * Preview drafts must survive Vite HMR module reloads and (locally) multiple
 * Astro processes. A plain module-level Map is wiped whenever pages-store is
 * re-imported — then iframe reload falls back to pages.json and the old image
 * flashes back. Use globalThis + a small on-disk cache.
 */
type PreviewDraftStore = {
  memory: Map<string, PageData>;
  cmsPagesCache: { at: number; data: Record<string, PageData> } | null;
  durableDraftsCache: {
    at: number;
    data: Record<string, PageData>;
    sha: string | undefined;
  } | null;
};

const PREVIEW_GLOBAL_KEY = '__tbAdminPreviewDrafts';

function previewStore(): PreviewDraftStore {
  const g = globalThis as typeof globalThis & {
    [PREVIEW_GLOBAL_KEY]?: PreviewDraftStore;
  };
  if (!g[PREVIEW_GLOBAL_KEY]) {
    g[PREVIEW_GLOBAL_KEY] = {
      memory: new Map(),
      cmsPagesCache: null,
      durableDraftsCache: null,
    };
  }
  return g[PREVIEW_GLOBAL_KEY];
}

function previewDraftDir(cwd = process.cwd()): string {
  return join(cwd, '.cache', 'admin-preview');
}

function previewDraftFile(pageId: string, cwd = process.cwd()): string {
  return join(previewDraftDir(cwd), `${pageId}.json`);
}

function writePreviewDraftFile(pageId: string, page: PageData): void {
  try {
    const dir = previewDraftDir();
    mkdirSync(dir, { recursive: true });
    writeFileSync(previewDraftFile(pageId), `${JSON.stringify(page)}\n`, 'utf8');
  } catch {
    // Disk cache is best-effort (read-only FS, etc.).
  }
}

function readPreviewDraftFile(pageId: string): PageData | undefined {
  try {
    const raw = readFileSync(previewDraftFile(pageId), 'utf8');
    return validatePageData(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

function deletePreviewDraftFile(pageId: string): void {
  try {
    unlinkSync(previewDraftFile(pageId));
  } catch {
    // ignore
  }
}

const CMS_CACHE_MS = 5_000;

export function getPreviewDraft(pageId: string): PageData | undefined {
  const store = previewStore();
  const mem = store.memory.get(pageId);
  if (mem) return mem;
  const disk = readPreviewDraftFile(pageId);
  if (disk) {
    store.memory.set(pageId, disk);
    return disk;
  }
  return undefined;
}

export function clearPreviewDraft(pageId: PageId): void {
  previewStore().memory.delete(pageId);
  deletePreviewDraftFile(pageId);
}

/** Clear memory/disk draft and remove pageId from the durable cms artifact. */
export async function clearPreviewDraftFully(pageId: PageId): Promise<void> {
  clearPreviewDraft(pageId);
  await removeDurablePreviewDraft(pageId);
}

export function clearAllPreviewDrafts(): void {
  const store = previewStore();
  store.memory.clear();
  store.cmsPagesCache = null;
  store.durableDraftsCache = null;
  try {
    const dir = previewDraftDir();
    // Best-effort: leave directory; individual files cleared on next overwrite.
    void dir;
  } catch {
    // ignore
  }
}

/** Clear local drafts and delete the durable preview-drafts artifact on cms. */
export async function clearAllPreviewDraftsFully(): Promise<void> {
  clearAllPreviewDrafts();
  await clearDurablePreviewDraftsArtifact();
}

export function invalidateCmsPagesCache(): void {
  previewStore().cmsPagesCache = null;
}

export function invalidateDurableDraftsCache(): void {
  previewStore().durableDraftsCache = null;
}

/** True on Vercel (or when forced) — process memory / .cache are not shared across isolates. */
export function needsDurablePreviewDraft(): boolean {
  return false;
}

async function readDurablePreviewDraftsMap(): Promise<{
  data: Record<string, PageData>;
  sha: string | undefined;
}> {
  // Durable cms-branch preview drafts are retired — client drafts + memory/disk only.
  return { data: {}, sha: undefined };
}

/** Preview draft for a page from the dedicated cms artifact (retired). */
export async function getDurablePreviewDraft(
  _pageId: string,
): Promise<PageData | undefined> {
  return undefined;
}

async function writeDurablePreviewDraftsMap(
  _data: Record<string, PageData>,
  _sha: string | undefined,
  _message: string,
): Promise<string> {
  return 'noop';
}

async function removeDurablePreviewDraft(_pageId: PageId): Promise<void> {
  invalidateDurableDraftsCache();
}

/** Delete the whole durable preview-drafts file on cms (e.g. before publish). */
export async function clearDurablePreviewDraftsArtifact(): Promise<void> {
  if (!usesGitHubCms()) return;
  try {
    await deleteFile(
      PREVIEW_DRAFTS_REL,
      mainBranch(),
      'content: clear leftover preview-drafts',
    );
  } catch {
    // ignore — file may live only on a legacy cms branch
  }
  invalidateDurableDraftsCache();
}

export async function savePageDraft(
  pageId: PageId,
  page: PageData,
): Promise<{
  mode: 'draft' | 'draft-durable';
  commit?: string;
  branch?: string;
}> {
  if (!isPageIdFormat(pageId)) {
    throw new Error('Invalid page id');
  }
  const validated = validatePageData(page);
  previewStore().memory.set(pageId, validated);
  writePreviewDraftFile(pageId, validated);
  // Instant preview + IndexedDB drafts replace durable GitHub preview artifacts.
  return { mode: 'draft' };
}

/** Short-lived cache of pages.json from main (field name kept for store shape). */
export async function getMainPagesCached(): Promise<Record<string, PageData> | null> {
  if (!usesGitHubCms()) return null;
  const store = previewStore();
  if (store.cmsPagesCache && Date.now() - store.cmsPagesCache.at < CMS_CACHE_MS) {
    return store.cmsPagesCache.data;
  }
  try {
    const file = await getFile(PAGES_REL, mainBranch());
    if (!file) return null;
    const data = parsePagesJson(file.content);
    store.cmsPagesCache = { at: Date.now(), data };
    return data;
  } catch {
    return null;
  }
}

/** @deprecated Use getMainPagesCached */
export async function getCmsPagesCached(): Promise<Record<string, PageData> | null> {
  return getMainPagesCached();
}

/**
 * Persist intentional page content to main (or local working tree).
 * Used by Publish from Changes — not by the editor Save button.
 */
export async function publishPagesToMain(
  pages: Record<string, PageData>,
  message = 'content: publish page drafts',
): Promise<{ mode: 'github' | 'local-working'; commit: string; branch: string }> {
  for (const [id, page] of Object.entries(pages)) {
    if (!isPageIdFormat(id)) throw new Error(`Invalid page id: ${id}`);
    validatePageData(page);
  }

  const fullJson = `${JSON.stringify(pages, null, 2)}\n`;
  const store = previewStore();

  if (usesGitHubCms()) {
    const file = await getFile(PAGES_REL, mainBranch());
    const commit = await putFile(
      PAGES_REL,
      fullJson,
      mainBranch(),
      message,
      file?.sha,
    );
    store.cmsPagesCache = { at: Date.now(), data: pages };
    for (const id of Object.keys(pages)) {
      clearPreviewDraft(id as PageId);
    }
    await clearDurablePreviewDraftsArtifact().catch(() => undefined);
    return { commit, mode: 'github', branch: mainBranch() };
  }

  await writePagesFile(pages);
  store.cmsPagesCache = { at: Date.now(), data: pages };
  for (const id of Object.keys(pages)) {
    clearPreviewDraft(id as PageId);
  }
  return { commit: 'working-tree', mode: 'local-working', branch: 'local' };
}

/**
 * Validate + stage a server preview draft (for SSR iframe). Does not write Git.
 * @deprecated Prefer client Instant preview; kept as reload fallback.
 */
export async function savePageToCms(
  pageId: PageId,
  page: PageData,
): Promise<{ mode: 'draft'; commit: string; branch: string }> {
  const result = await savePageDraft(pageId, page);
  return { mode: 'draft', commit: 'local-draft', branch: 'draft' };
}

/** @deprecated */
export async function savePageEntry(
  pageId: PageId,
  page: PageData,
): Promise<{ commit: string; mode: 'draft'; branch: string }> {
  return savePageToCms(pageId, page);
}

export async function createPageEntry(input: {
  id: string;
  path: string;
  title: string;
  description?: string;
}): Promise<{
  id: PageId;
  page: PageData;
  commit: string;
  mode: 'draft';
  branch: string;
}> {
  const id = input.id.trim();
  if (!isPageIdFormat(id)) {
    throw new Error('Page id must be lowercase kebab-case (e.g. my-page)');
  }
  if (isFixedPageId(id)) {
    throw new Error(`Page id “${id}” is reserved for a fixed route shell`);
  }

  let path = input.path.trim();
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/$/, '') || '/';
  if (path === '/') {
    throw new Error('Path / is reserved for home');
  }
  if (isReservedPath(path)) {
    throw new Error(`Path “${path}” is reserved`);
  }

  const all = await readPagesForAdmin();
  if (id in all) throw new Error(`Page id “${id}” already exists`);
  if (getPreviewDraft(id)) throw new Error(`Page id “${id}” already has a local draft`);
  for (const [otherId, page] of Object.entries(all)) {
    if (getPagePath(page, otherId) === path) {
      throw new Error(`Path “${path}” is already used by “${otherId}”`);
    }
  }

  const page = validatePageData({
    path,
    metadata: {
      title: input.title.trim() || id,
      description: input.description?.trim() || `Page: ${input.title.trim() || id}`,
    },
    sections: [defaultHeroSection()],
  });

  await savePageDraft(id, page);
  return { id, page, commit: 'local-draft', mode: 'draft', branch: 'draft' };
}

/** Summarize which page ids differ between two pages.json blobs. */
export function diffPageIds(
  mainRaw: string,
  cmsRaw: string,
): { id: string; change: 'added' | 'removed' | 'modified'; title?: string }[] {
  let mainPages: Record<string, PageData> = {};
  let cmsPages: Record<string, PageData> = {};
  try {
    mainPages = parsePagesJson(mainRaw);
  } catch {
    /* ignore */
  }
  try {
    cmsPages = parsePagesJson(cmsRaw);
  } catch {
    /* ignore */
  }

  const ids = new Set([...Object.keys(mainPages), ...Object.keys(cmsPages)]);
  const out: { id: string; change: 'added' | 'removed' | 'modified'; title?: string }[] = [];
  for (const id of [...ids].sort()) {
    const a = mainPages[id];
    const b = cmsPages[id];
    if (!a && b) {
      out.push({ id, change: 'added', title: b.metadata?.title });
    } else if (a && !b) {
      out.push({ id, change: 'removed', title: a.metadata?.title });
    } else if (a && b && JSON.stringify(a) !== JSON.stringify(b)) {
      out.push({ id, change: 'modified', title: b.metadata?.title });
    }
  }
  return out;
}
