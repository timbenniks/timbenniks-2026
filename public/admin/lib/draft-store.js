// Generated from src/admin-client by `npm run build:admin` — do not edit.
const DB_NAME = "tb-admin-drafts";
const DB_VERSION = 1;
const STORE = "drafts";
let dbPromise = null;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
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
async function idbGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result ?? null);
  });
}
async function idbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put(value, key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}
async function idbDelete(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(key);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}
async function idbKeys() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAllKeys();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve((req.result || []).filter((k) => typeof k === "string"));
  });
}
function pageKey(id) {
  return `page:${id}`;
}
const SITE_KEY = "site";
function contentHash(value) {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
async function setPageDraft(id, page, meta = {}) {
  const record = {
    updatedAt: Date.now(),
    baseHash: meta.baseHash,
    page
  };
  await idbSet(pageKey(id), record);
  return record;
}
async function getPageDraft(id) {
  const raw = await idbGet(pageKey(id));
  if (!raw || typeof raw !== "object" || !raw.page) return null;
  return raw;
}
async function clearPageDraft(id) {
  await idbDelete(pageKey(id));
}
async function listDraftPageIds() {
  const keys = await idbKeys();
  return keys.filter((k) => k.startsWith("page:")).map((k) => k.slice("page:".length)).sort((a, b) => a.localeCompare(b));
}
async function setSiteDraft(site, meta = {}) {
  const record = {
    updatedAt: Date.now(),
    baseHash: meta.baseHash,
    site
  };
  await idbSet(SITE_KEY, record);
  return record;
}
async function getSiteDraft() {
  const raw = await idbGet(SITE_KEY);
  if (!raw || typeof raw !== "object" || !raw.site) return null;
  return raw;
}
async function clearSiteDraft() {
  await idbDelete(SITE_KEY);
}
async function clearAllDrafts() {
  const keys = await idbKeys();
  await Promise.all(keys.map((k) => idbDelete(k)));
}
async function clearPageDrafts(pageIds) {
  const ids = pageIds ?? await listDraftPageIds();
  await Promise.all(ids.map((id) => clearPageDraft(id)));
}
async function loadDraftOverlay(baseline = {}) {
  const draftIds = await listDraftPageIds();
  const merged = { ...baseline };
  for (const id of draftIds) {
    const rec = await getPageDraft(id);
    if (rec?.page) merged[id] = rec.page;
  }
  const siteDraft = await getSiteDraft();
  return { merged, draftIds, siteDraft };
}
function diffPagesLocal(baseline, overlay) {
  const ids = /* @__PURE__ */ new Set([...Object.keys(baseline || {}), ...Object.keys(overlay || {})]);
  const out = [];
  for (const id of [...ids].sort()) {
    const a = baseline?.[id];
    const b = overlay?.[id];
    if (!a && b) {
      out.push({ id, change: "added", title: b.metadata?.title });
    } else if (a && !b) {
      out.push({ id, change: "removed", title: a.metadata?.title });
    } else if (a && b && JSON.stringify(a) !== JSON.stringify(b)) {
      out.push({ id, change: "modified", title: b.metadata?.title });
    }
  }
  return out;
}
async function applyDraftBadges(root = document) {
  const ids = await listDraftPageIds();
  const idSet = new Set(ids);
  root.querySelectorAll("[data-page-id]").forEach((el) => {
    const id = el.getAttribute("data-page-id");
    if (!id) return;
    let badge = el.querySelector(".draft-badge");
    if (idSet.has(id)) {
      if (!badge) {
        const created = document.createElement("span");
        created.className = "draft-badge count-badge";
        created.textContent = "Draft";
        created.title = "Local draft \u2014 publish from Changes";
        const titleEl = el.querySelector(".page-title, .row-title, h3, a");
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
export {
  applyDraftBadges,
  clearAllDrafts,
  clearPageDraft,
  clearPageDrafts,
  clearSiteDraft,
  contentHash,
  diffPagesLocal,
  getPageDraft,
  getSiteDraft,
  listDraftPageIds,
  loadDraftOverlay,
  setPageDraft,
  setSiteDraft
};
