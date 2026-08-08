/**
 * IndexedDB draft staging for the admin CMS.
 * Pending page/site edits live here until Publish writes to main.
 * Admin-only — never imported from public site pages.
 */
import type { PageData, SiteChrome } from './content.js';

const DB_NAME = 'tb-admin-drafts';
const DB_VERSION = 1;
const STORE = 'drafts';

export interface PageDraftRecord {
  updatedAt: number;
  baseHash?: string | undefined;
  page: PageData;
}

export interface SiteDraftRecord {
  updatedAt: number;
  baseHash?: string | undefined;
  site: SiteChrome;
}

export type PageChange = 'added' | 'removed' | 'modified';

export interface PageDiff {
  id: string;
  change: PageChange;
  title?: string | undefined;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
  return dbPromise;
}

async function idbGet(key: string): Promise<unknown> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result ?? null);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(value, key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

async function idbKeys(): Promise<string[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAllKeys();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve((req.result || []).filter((k): k is string => typeof k === 'string'));
  });
}

function pageKey(id: string): string {
  return `page:${id}`;
}

const SITE_KEY = 'site';

/** Stable hash for conflict hints (not cryptographic). */
export function contentHash(value: unknown): string {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export async function setPageDraft(
  id: string,
  page: PageData,
  meta: { baseHash?: string } = {},
): Promise<PageDraftRecord> {
  const record: PageDraftRecord = {
    updatedAt: Date.now(),
    baseHash: meta.baseHash,
    page,
  };
  await idbSet(pageKey(id), record);
  return record;
}

export async function getPageDraft(id: string): Promise<PageDraftRecord | null> {
  const raw = await idbGet(pageKey(id));
  if (!raw || typeof raw !== 'object' || !(raw as PageDraftRecord).page) return null;
  return raw as PageDraftRecord;
}

export async function clearPageDraft(id: string): Promise<void> {
  await idbDelete(pageKey(id));
}

export async function listDraftPageIds(): Promise<string[]> {
  const keys = await idbKeys();
  return keys
    .filter((k) => k.startsWith('page:'))
    .map((k) => k.slice('page:'.length))
    .sort((a, b) => a.localeCompare(b));
}

export async function setSiteDraft(
  site: SiteChrome,
  meta: { baseHash?: string } = {},
): Promise<SiteDraftRecord> {
  const record: SiteDraftRecord = {
    updatedAt: Date.now(),
    baseHash: meta.baseHash,
    site,
  };
  await idbSet(SITE_KEY, record);
  return record;
}

export async function getSiteDraft(): Promise<SiteDraftRecord | null> {
  const raw = await idbGet(SITE_KEY);
  if (!raw || typeof raw !== 'object' || !(raw as SiteDraftRecord).site) return null;
  return raw as SiteDraftRecord;
}

export async function clearSiteDraft(): Promise<void> {
  await idbDelete(SITE_KEY);
}

/** Clear all page drafts and the site draft. */
export async function clearAllDrafts(): Promise<void> {
  const keys = await idbKeys();
  await Promise.all(keys.map((k) => idbDelete(k)));
}

/** @param pageIds if omitted, clear all page drafts */
export async function clearPageDrafts(pageIds?: string[]): Promise<void> {
  const ids = pageIds ?? (await listDraftPageIds());
  await Promise.all(ids.map((id) => clearPageDraft(id)));
}

/** Build a merged pages map: baseline ∪ page drafts. */
export async function loadDraftOverlay(baseline: Record<string, PageData> = {}): Promise<{
  merged: Record<string, PageData>;
  draftIds: string[];
  siteDraft: SiteDraftRecord | null;
}> {
  const draftIds = await listDraftPageIds();
  const merged: Record<string, PageData> = { ...baseline };
  for (const id of draftIds) {
    const rec = await getPageDraft(id);
    if (rec?.page) merged[id] = rec.page;
  }
  const siteDraft = await getSiteDraft();
  return { merged, draftIds, siteDraft };
}

/** Diff page ids between baseline and overlay (same shape as server diffPageIds). */
export function diffPagesLocal(
  baseline: Record<string, PageData>,
  overlay: Record<string, PageData>,
): PageDiff[] {
  const ids = new Set([...Object.keys(baseline || {}), ...Object.keys(overlay || {})]);
  const out: PageDiff[] = [];
  for (const id of [...ids].sort()) {
    const a = baseline?.[id];
    const b = overlay?.[id];
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

/** Mark desk rows that have local drafts. */
export async function applyDraftBadges(root: ParentNode = document): Promise<string[]> {
  const ids = await listDraftPageIds();
  const idSet = new Set(ids);
  root.querySelectorAll('[data-page-id]').forEach((el) => {
    const id = el.getAttribute('data-page-id');
    if (!id) return;
    let badge = el.querySelector('.draft-badge');
    if (idSet.has(id)) {
      if (!badge) {
        const created = document.createElement('span');
        created.className = 'draft-badge count-badge';
        created.textContent = 'Draft';
        created.title = 'Local draft — publish from Changes';
        const titleEl = el.querySelector('.page-title, .row-title, h3, a');
        (titleEl || el).appendChild(created);
        badge = created;
      }
      if (badge instanceof HTMLElement) badge.hidden = false;
    } else if (badge) {
      badge.remove();
    }
  });
  return ids;
}
