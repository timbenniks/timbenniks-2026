/**
 * Preview iframe updates — prefer live bridge ops; reload is fallback only.
 * @param {Record<string, any>} s mutable editor session
 */
import { apiFetch } from '../lib/api.js';
import { setPageDraft, contentHash } from '../lib/draft-store.js';

export function createPreviewSync(s) {
  function capturePreviewScroll() {
    try {
      const win = s.frame.contentWindow;
      if (!win) return null;
      return { x: win.scrollX || 0, y: win.scrollY || 0 };
    } catch {
      return null;
    }
  }

  function reloadPreview(highlightIndex) {
    s.pendingScroll = capturePreviewScroll();
    s.pendingHighlight =
      highlightIndex == null ? s.selectedSection : highlightIndex;
    s.setStatus('Refreshing preview…');
    const url = new URL(s.boot.previewUrl, window.location.origin);
    url.searchParams.set('edit', '1');
    url.searchParams.set('t', String(Date.now()));
    if (s.frame.contentWindow) {
      s.frame.contentWindow.location.replace(url.pathname + url.search);
    } else {
      s.frame.src = url.pathname + url.search;
    }
  }

  /** Persist draft to IndexedDB (and optional server preview for reload fallback). */
  async function persistDraftLocal(statusMsg) {
    try {
      await setPageDraft(s.boot.id, s.draft, {
        baseHash: s.baseHash || contentHash(s.savedSnapshot),
      });
      if (statusMsg) s.setStatus(statusMsg, 'ok');
    } catch (err) {
      console.warn('[draft-store]', err);
    }
  }

  /**
   * Fetch Astro-rendered HTML for one section (edit markup included).
   * @param {number} sectionIndex
   */
  async function fetchSectionHtml(sectionIndex) {
    const data = await apiFetch('/api/admin/preview/section-html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pageId: s.boot.id,
        sectionIndex,
        page: s.draft,
      }),
      errorMessage: 'Section preview failed',
    });
    return data.html;
  }

  function reindexBridge() {
    s.postToFrame('reindexSections', {
      kinds: s.draft.sections.map((sec) => sec.kind),
    });
  }

  /**
   * Apply a structural change live in the iframe.
   * @param {'move'|'remove'|'insert'|'replace'|'reindex'} op
   * @param {object} [opts]
   */
  async function applyLiveStructural(op, opts = {}) {
    const target =
      opts.highlightIndex == null ? s.selectedSection : opts.highlightIndex;
    await persistDraftLocal();

    try {
      if (op === 'move') {
        s.postToFrame('moveSection', { from: opts.from, to: opts.to });
        reindexBridge();
      } else if (op === 'remove') {
        s.postToFrame('removeSection', { index: opts.index });
        reindexBridge();
      } else if (op === 'insert' || op === 'replace') {
        const html = await fetchSectionHtml(opts.sectionIndex ?? target);
        s.postToFrame(op === 'insert' ? 'insertSectionHtml' : 'replaceSectionHtml', {
          index: opts.sectionIndex ?? target,
          html,
          kind: s.draft.sections[opts.sectionIndex ?? target]?.kind,
        });
        reindexBridge();
      } else if (op === 'reindex') {
        reindexBridge();
      }

      s.selectSection(target, {
        keepPath: true,
        focusPath: s.selectedPath,
        scroll: false,
        openSectionTab: false,
      });
      s.setStatus(opts.statusMsg || 'Preview updated', 'ok');
      return true;
    } catch (err) {
      console.warn('[live-preview] falling back to reload', err);
      return false;
    }
  }

  async function persistPreview(highlightIndex, statusMsg) {
    const target =
      highlightIndex == null ? s.selectedSection : highlightIndex;
    s.setStatus(statusMsg || 'Updating preview…');
    await persistDraftLocal();

    // Prefer live structural replace of the active section when possible.
    const ok = await applyLiveStructural('replace', {
      sectionIndex: target,
      highlightIndex: target,
      statusMsg: statusMsg || 'Preview updated',
    });
    if (ok) return;

    try {
      await apiFetch(`/api/admin/pages/${s.boot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: s.draft, mode: 'preview' }),
        errorMessage: 'Preview sync failed',
      });
      reloadPreview(target);
      s.setStatus('Preview updated · Save draft, then publish from Changes', 'ok');
    } catch (err) {
      s.setStatus(err.message || String(err), 'error');
    }
  }

  function schedulePersistPreview(highlightIndex, statusMsg) {
    clearTimeout(s.previewPersistTimer);
    s.previewPersistTimer = setTimeout(() => {
      s.previewPersistInFlight = persistPreview(highlightIndex, statusMsg);
    }, 280);
  }

  function restorePreviewAfterReady() {
    const scroll = s.pendingScroll;
    s.pendingScroll = null;
    const idx = s.pendingHighlight != null ? s.pendingHighlight : s.selectedSection;
    s.pendingHighlight = null;

    s.selectSection(idx, {
      keepPath: true,
      focusPath: s.selectedPath,
      scroll: false,
      openSectionTab: false,
    });
    if (scroll) {
      s.postToFrame('restoreScroll', scroll);
      setTimeout(() => s.postToFrame('restoreScroll', scroll), 120);
    }
  }

  function clearPreviewPersistTimer() {
    clearTimeout(s.previewPersistTimer);
    s.previewPersistTimer = null;
  }

  return {
    capturePreviewScroll,
    reloadPreview,
    persistPreview,
    schedulePersistPreview,
    restorePreviewAfterReady,
    clearPreviewPersistTimer,
    persistDraftLocal,
    applyLiveStructural,
    fetchSectionHtml,
  };
}
