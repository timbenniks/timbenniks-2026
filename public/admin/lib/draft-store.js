/**
 * IndexedDB draft staging for the admin CMS.
 * Pending page/site edits live here until Publish writes to main.
 * Admin-only — never imported from public site pages.
 */

const DB_NAME = 'tb-admin-drafts';
const DB_VERSION = 1;
const STORE = 'drafts';

/** @typedef {{ updatedAt: number, baseHash?: string, page: object }} PageDraftRecord */
/** @typedef {{ updatedAt: number, baseHash?: string, site: object }} SiteDraftRecord */

/** @type {Promise<IDBDatabase> | null} */
let dbPromise = null;

function openDb() {
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

/**
 * @param {string} key
 * @returns {Promise<unknown | null>}
 */
async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result ?? null);
  });
}

/**
 * @param {string} key
 * @param {unknown} value
 */
async function idbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(value, key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

/** @param {string} key */
async function idbDelete(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

/** @returns {Promise<string[]>} */
async function idbKeys() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAllKeys();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(/** @type {string[]} */ (req.result || []));
  });
}

function pageKey(id) {
  return `page:${id}`;
}

const SITE_KEY = 'site';

/** Stable hash for conflict hints (not cryptographic). */
export function contentHash(value) {
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/**
 * @param {string} id
 * @param {object} page
 * @param {{ baseHash?: string }} [meta]
 */
export async function setPageDraft(id, page, meta = {}) {
  /** @type {PageDraftRecord} */
  const record = {
    updatedAt: Date.now(),
    baseHash: meta.baseHash,
    page,
  };
  await idbSet(pageKey(id), record);
  return record;
}

/** @param {string} id @returns {Promise<PageDraftRecord | null>} */
export async function getPageDraft(id) {
  const raw = await idbGet(pageKey(id));
  if (!raw || typeof raw !== 'object' || !/** @type {any} */ (raw).page) return null;
  return /** @type {PageDraftRecord} */ (raw);
}

/** @param {string} id */
export async function clearPageDraft(id) {
  await idbDelete(pageKey(id));
}

/** @returns {Promise<string[]>} */
export async function listDraftPageIds() {
  const keys = await idbKeys();
  return keys
    .filter((k) => typeof k === 'string' && k.startsWith('page:'))
    .map((k) => k.slice('page:'.length))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * @param {object} site
 * @param {{ baseHash?: string }} [meta]
 */
export async function setSiteDraft(site, meta = {}) {
  /** @type {SiteDraftRecord} */
  const record = {
    updatedAt: Date.now(),
    baseHash: meta.baseHash,
    site,
  };
  await idbSet(SITE_KEY, record);
  return record;
}

/** @returns {Promise<SiteDraftRecord | null>} */
export async function getSiteDraft() {
  const raw = await idbGet(SITE_KEY);
  if (!raw || typeof raw !== 'object' || !/** @type {any} */ (raw).site) return null;
  return /** @type {SiteDraftRecord} */ (raw);
}

export async function clearSiteDraft() {
  await idbDelete(SITE_KEY);
}

/** Clear all page drafts and the site draft. */
export async function clearAllDrafts() {
  const keys = await idbKeys();
  await Promise.all(keys.map((k) => idbDelete(/** @type {string} */ (k))));
}

/**
 * @param {string[]} [pageIds] if omitted, clear all page drafts
 */
export async function clearPageDrafts(pageIds) {
  if (!pageIds) {
    const ids = await listDraftPageIds();
    await Promise.all(ids.map((id) => clearPageDraft(id)));
    return;
  }
  await Promise.all(pageIds.map((id) => clearPageDraft(id)));
}

/**
 * Build a merged pages map: baseline ∪ page drafts.
 * @param {Record<string, object>} baseline
 * @returns {Promise<{ merged: Record<string, object>, draftIds: string[], siteDraft: SiteDraftRecord | null }>}
 */
export async function loadDraftOverlay(baseline = {}) {
  const draftIds = await listDraftPageIds();
  const merged = { ...baseline };
  for (const id of draftIds) {
    const rec = await getPageDraft(id);
    if (rec?.page) merged[id] = rec.page;
  }
  const siteDraft = await getSiteDraft();
  return { merged, draftIds, siteDraft };
}

/**
 * Diff page ids between baseline and overlay (same shape as server diffPageIds).
 * @param {Record<string, object>} baseline
 * @param {Record<string, object>} overlay
 */
export function diffPagesLocal(baseline, overlay) {
  const ids = new Set([...Object.keys(baseline || {}), ...Object.keys(overlay || {})]);
  /** @type {{ id: string, change: 'added'|'removed'|'modified', title?: string }[]} */
  const out = [];
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

/**
 * Mark desk rows that have local drafts.
 * @param {ParentNode} [root]
 */
export async function applyDraftBadges(root = document) {
  const ids = await listDraftPageIds();
  const idSet = new Set(ids);
  root.querySelectorAll('[data-page-id]').forEach((el) => {
    const id = el.getAttribute('data-page-id');
    if (!id) return;
    let badge = el.querySelector('.draft-badge');
    if (idSet.has(id)) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'draft-badge count-badge';
        badge.textContent = 'Draft';
        badge.title = 'Local draft — publish from Changes';
        const titleEl = el.querySelector('.page-title, .row-title, h3, a');
        (titleEl || el).appendChild(badge);
      }
      badge.hidden = false;
    } else if (badge) {
      badge.remove();
    }
  });
  return ids;
}
