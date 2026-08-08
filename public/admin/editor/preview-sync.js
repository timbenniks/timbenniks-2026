// Generated from src/admin-client by `npm run build:admin` — do not edit.
import { apiFetch } from "../lib/api.js";
import { contentHash, setPageDraft } from "../lib/draft-store.js";
function errorText(err) {
  return err instanceof Error && err.message ? err.message : String(err);
}
function createPreviewSync(s) {
  function capturePreviewScroll() {
    try {
      const win = s.frame?.contentWindow;
      if (!win) return null;
      return { x: win.scrollX || 0, y: win.scrollY || 0 };
    } catch {
      return null;
    }
  }
  function reloadPreview(highlightIndex) {
    if (s.inlineEditPath) {
      s.postToFrame("endInlineEdit", {});
      s.inlineEditPath = null;
    }
    s.pendingScroll = capturePreviewScroll();
    s.pendingHighlight = highlightIndex == null ? s.selectedSection : highlightIndex;
    s.setStatus("Refreshing preview\u2026");
    const url = new URL(s.boot.previewUrl, window.location.origin);
    url.searchParams.set("edit", "1");
    url.searchParams.set("t", String(Date.now()));
    if (s.frame?.contentWindow) {
      s.frame.contentWindow.location.replace(url.pathname + url.search);
    } else if (s.frame) {
      s.frame.src = url.pathname + url.search;
    }
  }
  async function persistDraftLocal(statusMsg) {
    try {
      await setPageDraft(s.boot.id, s.draft, {
        baseHash: s.baseHash || contentHash(s.savedSnapshot)
      });
      if (statusMsg) s.setStatus(statusMsg, "ok");
    } catch (err) {
      console.warn("[draft-store]", err);
    }
  }
  async function fetchSectionHtml(sectionIndex) {
    const data = await apiFetch("/api/admin/preview/section-html", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageId: s.boot.id,
        sectionIndex,
        page: s.draft
      }),
      errorMessage: "Section preview failed"
    });
    return data.html;
  }
  function reindexBridge() {
    s.postToFrame("reindexSections", {
      kinds: s.draft.sections.map((sec) => sec.kind)
    });
  }
  async function applyLiveStructural(op, opts = {}) {
    if (s.inlineEditPath) {
      s.postToFrame("endInlineEdit", {});
      s.inlineEditPath = null;
    }
    const target = opts.highlightIndex == null ? s.selectedSection : opts.highlightIndex;
    await persistDraftLocal();
    try {
      if (op === "move") {
        const { from, to } = opts;
        if (typeof from === "number" && typeof to === "number") {
          s.postToFrame("moveSection", { from, to });
        }
        reindexBridge();
      } else if (op === "remove") {
        if (typeof opts.index === "number") {
          s.postToFrame("removeSection", { index: opts.index });
        }
        reindexBridge();
      } else if (op === "insert" || op === "replace") {
        const index = opts.sectionIndex ?? target;
        const html = await fetchSectionHtml(index);
        s.postToFrame(op === "insert" ? "insertSectionHtml" : "replaceSectionHtml", {
          index,
          html
        });
        reindexBridge();
      } else if (op === "reindex") {
        reindexBridge();
      }
      s.selectSection(target, {
        keepPath: true,
        focusPath: s.selectedPath,
        scroll: false,
        openSectionTab: false
      });
      s.setStatus(opts.statusMsg || "Preview updated", "ok");
      return true;
    } catch (err) {
      console.warn("[live-preview] falling back to reload", err);
      return false;
    }
  }
  async function persistPreview(highlightIndex, statusMsg) {
    const target = highlightIndex == null ? s.selectedSection : highlightIndex;
    s.setStatus(statusMsg || "Updating preview\u2026");
    await persistDraftLocal();
    const ok = await applyLiveStructural("replace", {
      sectionIndex: target,
      highlightIndex: target,
      statusMsg: statusMsg || "Preview updated"
    });
    if (ok) return;
    try {
      await apiFetch(`/api/admin/pages/${s.boot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: s.draft, mode: "preview" }),
        errorMessage: "Preview sync failed"
      });
      reloadPreview(target);
      s.setStatus("Preview updated \xB7 Save draft, then publish from Changes", "ok");
    } catch (err) {
      s.setStatus(errorText(err), "error");
    }
  }
  function schedulePersistPreview(highlightIndex, statusMsg) {
    clearTimeout(s.previewPersistTimer ?? void 0);
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
      openSectionTab: false
    });
    if (scroll) {
      s.postToFrame("restoreScroll", scroll);
      setTimeout(() => s.postToFrame("restoreScroll", scroll), 120);
    }
  }
  function clearPreviewPersistTimer() {
    clearTimeout(s.previewPersistTimer ?? void 0);
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
    fetchSectionHtml
  };
}
export {
  createPreviewSync
};
