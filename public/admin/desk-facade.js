/**
 * Lightweight CMS desk facade for /admin (pages overview).
 * Implements the subset of __tbVisualEditor used by desk Agent / WebMCP tools.
 */
import { apiFetch } from './lib/api.js';
import { editorPathFor, hardNavigate } from './lib/navigate.js';
import {
  clearAllDrafts,
  getPageDraft,
  getSiteDraft,
  listDraftPageIds,
  setPageDraft,
  setSiteDraft,
} from './lib/draft-store.js';

const META_KEYS = [
  'title',
  'description',
  'keywords',
  'image',
  'canonical',
  'imageAlt',
  'noindex',
];

export function createDeskFacade() {
  const facade = {
    async listPages() {
      return apiFetch('/api/admin/pages', {
        errorMessage: 'Failed to list pages',
      });
    },
    /** Desk: load any page by id. Editor uses getPage() with no args. */
    async getPage(idOrOpts) {
      const id =
        typeof idOrOpts === 'string'
          ? idOrOpts
          : idOrOpts && typeof idOrOpts === 'object'
            ? idOrOpts.id
            : '';
      const pageId = String(id || '').trim();
      if (!pageId) throw new Error('page id is required on the desk (get_page with id)');
      const draft = await getPageDraft(pageId);
      if (draft?.page) {
        return { id: pageId, page: draft.page, path: draft.page.path, source: 'draft' };
      }
      return apiFetch(`/api/admin/pages/${encodeURIComponent(pageId)}`, {
        errorMessage: 'Failed to load page',
      });
    },
    async createPage({ id, path, title, description, open } = {}) {
      if (!id || !path || !title) throw new Error('id, path, and title are required');
      const data = await apiFetch('/api/admin/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          path,
          title,
          ...(description != null ? { description } : {}),
        }),
        errorMessage: 'Failed to create page',
      });
      if (data.page) {
        await setPageDraft(data.id, data.page);
      }
      window.dispatchEvent(new CustomEvent('tb-desk-page-created', { detail: data }));
      const shouldOpen = open !== false;
      const editorPath = editorPathFor(data.id);
      return {
        ...data,
        editorPath,
        open: shouldOpen,
        navigated: false,
        message: shouldOpen
          ? `Created “${data.id}” as a local draft. Open ${editorPath} next.`
          : `Created “${data.id}” as a local draft. Call open_page to edit layout.`,
      };
    },
    openPage({ id, force } = {}) {
      const pageId = String(id || '').trim();
      if (!pageId) throw new Error('id is required');
      void force;
      const editorPath = editorPathFor(pageId);
      hardNavigate(editorPath);
      return { navigated: true, pageId, editorPath };
    },
    /**
     * Merge SEO fields onto a page and save as a local draft.
     */
    async updateMetadata(fields = {}) {
      const pageId = String(fields.pageId || fields.id || '').trim();
      if (!pageId) throw new Error('pageId is required to update metadata from the desk');
      const current = await facade.getPage(pageId);
      const page = structuredClone(current.page);
      if (!page || typeof page !== 'object') throw new Error('Page payload missing');
      if (!page.metadata) page.metadata = {};
      for (const key of META_KEYS) {
        if (!(key in fields)) continue;
        const value = fields[key];
        if (key === 'noindex') page.metadata[key] = Boolean(value);
        else page.metadata[key] = value == null ? '' : String(value);
      }
      await setPageDraft(pageId, page);
      await apiFetch(`/api/admin/pages/${encodeURIComponent(pageId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page, mode: 'preview' }),
        errorMessage: 'Failed to stage metadata draft',
      }).catch(() => undefined);
      return { ok: true, pageId, metadata: page.metadata, mode: 'draft' };
    },
    async getChanges() {
      const baseline = await apiFetch('/api/admin/changes', {
        errorMessage: 'Failed to load changes',
      });
      const draftIds = await listDraftPageIds();
      const site = await getSiteDraft();
      return {
        ...baseline,
        draftIds,
        siteTouched: Boolean(site?.site),
        aheadBy: draftIds.length + (site?.site ? 1 : 0),
      };
    },
    async publishChanges({ message } = {}) {
      const draftIds = await listDraftPageIds();
      const pages = {};
      for (const id of draftIds) {
        const rec = await getPageDraft(id);
        if (rec?.page) pages[id] = rec.page;
      }
      const siteRec = await getSiteDraft();
      const payload = {
        message: message || 'content: publish drafts',
        ...(Object.keys(pages).length ? { pages } : {}),
        ...(siteRec?.site ? { site: siteRec.site } : {}),
      };
      if (!payload.pages && !payload.site) {
        throw new Error('No local drafts to publish');
      }
      const result = await apiFetch('/api/admin/changes/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        errorMessage: 'Publish failed',
      });
      await clearAllDrafts();
      return result;
    },
    async discardChanges() {
      await clearAllDrafts();
      await apiFetch('/api/admin/changes/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
        errorMessage: 'Discard failed',
      }).catch(() => undefined);
      return { ok: true, cleared: 'local-drafts' };
    },
    async getSite() {
      const draft = await getSiteDraft();
      if (draft?.site) return { site: draft.site, source: 'draft' };
      return apiFetch('/api/admin/site', {
        errorMessage: 'Failed to load site chrome',
      });
    },
    async applySitePatch({ site, mode } = {}) {
      if (!site || typeof site !== 'object') throw new Error('site object required');
      await setSiteDraft(site);
      return apiFetch('/api/admin/site', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site,
          mode: 'preview',
        }),
        errorMessage: 'Site update failed',
      });
    },
    async saveDraft() {
      return { ok: true, mode: 'draft', message: 'Desk has no open editor draft — use the page editor Save.' };
    },
    async saveToCms() {
      return facade.saveDraft();
    },
  };

  return facade;
}

export function installDeskFacade() {
  const facade = createDeskFacade();
  window.__tbVisualEditor = facade;
  window.__tbDeskAgent = facade;
  window.dispatchEvent(new CustomEvent('tb-desk-agent-ready'));
  return facade;
}
