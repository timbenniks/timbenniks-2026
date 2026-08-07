/**
 * Preview iframe persist / reload / scroll restore.
 * @param {Record<string, any>} s mutable editor session
 */
import { apiFetch } from '../lib/api.js';

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
    // Only reload the iframe — never touch parent location (avoids wiping the editor).
    const url = new URL(s.boot.previewUrl, window.location.origin);
    url.searchParams.set('edit', '1');
    url.searchParams.set('t', String(Date.now()));
    if (s.frame.contentWindow) {
      s.frame.contentWindow.location.replace(url.pathname + url.search);
    } else {
      s.frame.src = url.pathname + url.search;
    }
  }

  async function persistPreview(highlightIndex, statusMsg) {
    const target =
      highlightIndex == null ? s.selectedSection : highlightIndex;
    s.setStatus(statusMsg || 'Updating preview…');
    try {
      await apiFetch(`/api/admin/pages/${s.boot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: s.draft, mode: 'preview' }),
        errorMessage: 'Preview sync failed',
      });
      reloadPreview(target);
      s.setStatus('Preview updated · Save to cms when ready', 'ok');
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

    // Highlight without scrolling — then restore the previous viewport.
    // Keep the current inspector tab (e.g. stay on Layers after reorder).
    s.selectSection(idx, {
      keepPath: true,
      focusPath: s.selectedPath,
      scroll: false,
      openSectionTab: false,
    });
    if (scroll) {
      s.postToFrame('restoreScroll', scroll);
      // Second pass after images/layout settle.
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
  };
}
