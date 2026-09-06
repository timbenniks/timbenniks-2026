/**
 * Preview iframe updates — prefer live bridge ops; reload is fallback only.
 */
import { apiFetch } from '../lib/api.js';
import { contentHash, setPageDraft } from '../lib/draft-store.js';
import type { EditorSession, StructuralOp, StructuralOpts } from './session.js';

type PreviewSyncApi = Pick<
  EditorSession,
  | 'capturePreviewScroll'
  | 'reloadPreview'
  | 'persistPreview'
  | 'schedulePersistPreview'
  | 'restorePreviewAfterReady'
  | 'clearPreviewPersistTimer'
  | 'persistDraftLocal'
  | 'applyLiveStructural'
  | 'fetchSectionHtml'
>;

function errorText(err: unknown): string {
  return err instanceof Error && err.message ? err.message : String(err);
}

export function createPreviewSync(s: EditorSession): PreviewSyncApi {
  function capturePreviewScroll() {
    try {
      const win = s.frame?.contentWindow;
      if (!win) return null;
      return { x: win.scrollX || 0, y: win.scrollY || 0 };
    } catch {
      return null;
    }
  }

  function reloadPreview(highlightIndex?: number | null) {
    if (s.inlineEditPath) {
      s.postToFrame('endInlineEdit', {});
      s.inlineEditPath = null;
    }
    s.pendingScroll = capturePreviewScroll();
    s.pendingHighlight =
      highlightIndex == null ? s.selectedSection : highlightIndex;
    s.setStatus('Refreshing preview…');
    const url = new URL(s.boot.previewUrl, window.location.origin);
    url.searchParams.set('edit', '1');
    url.searchParams.set('t', String(Date.now()));
    if (s.frame?.contentWindow) {
      s.frame.contentWindow.location.replace(url.pathname + url.search);
    } else if (s.frame) {
      s.frame.src = url.pathname + url.search;
    }
  }

  /** Persist draft to IndexedDB (and optional server preview for reload fallback). */
  async function persistDraftLocal(statusMsg?: string) {
    try {
      await setPageDraft(s.boot.id, s.draft, {
        baseHash: s.baseHash || contentHash(s.savedSnapshot),
      });
      if (statusMsg) s.setStatus(statusMsg, 'ok');
    } catch (err) {
      console.warn('[draft-store]', err);
    }
  }

  /** Fetch Astro-rendered HTML for one section (edit markup included). */
  async function fetchSectionHtml(sectionIndex: number): Promise<string> {
    const data = await apiFetch<{ html: string }>('/api/admin/preview/section-html', {
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

  /** Apply a structural change live in the iframe. */
  async function applyLiveStructural(
    op: StructuralOp,
    opts: StructuralOpts = {},
  ): Promise<boolean> {
    if (s.inlineEditPath) {
      s.postToFrame('endInlineEdit', {});
      s.inlineEditPath = null;
    }
    const target =
      opts.highlightIndex == null ? s.selectedSection : opts.highlightIndex;
    await persistDraftLocal();

    try {
      if (op === 'move') {
        const { from, to } = opts;
        if (typeof from === 'number' && typeof to === 'number') {
          s.postToFrame('moveSection', { from, to });
        }
        reindexBridge();
      } else if (op === 'remove') {
        if (typeof opts.index === 'number') {
          s.postToFrame('removeSection', { index: opts.index });
        }
        reindexBridge();
      } else if (op === 'insert' || op === 'replace') {
        const index = opts.sectionIndex ?? target;
        const html = await fetchSectionHtml(index);
        s.postToFrame(op === 'insert' ? 'insertSectionHtml' : 'replaceSectionHtml', {
          index,
          html,
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

  async function persistPreview(highlightIndex?: number | null, statusMsg?: string) {
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
      s.setStatus(errorText(err), 'error');
    }
  }

  function schedulePersistPreview(highlightIndex?: number | null, statusMsg?: string) {
    clearTimeout(s.previewPersistTimer ?? undefined);
    s.previewPersistTimer = setTimeout(() => {
      void persistPreview(highlightIndex, statusMsg);
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
    clearTimeout(s.previewPersistTimer ?? undefined);
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
