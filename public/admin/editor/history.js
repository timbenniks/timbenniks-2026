// Generated from src/admin-client by `npm run build:admin` — do not edit.
import { deepClone } from "../lib/utils.js";
function createHistory(s) {
  function syncHistoryButtons() {
    if (s.undoBtn) s.undoBtn.disabled = s.undoStack.length === 0;
    if (s.redoBtn) s.redoBtn.disabled = s.redoStack.length === 0;
  }
  function checkpoint() {
    s.undoStack.push(deepClone(s.draft));
    if (s.undoStack.length > s.HISTORY_LIMIT) s.undoStack.shift();
    s.redoStack.length = 0;
    syncHistoryButtons();
  }
  function restoreFromHistory(page) {
    s.draft = deepClone(page);
    s.fieldEditCheckpointed = false;
    if (s.selectedSection >= s.draft.sections.length) {
      s.selectedSection = Math.max(0, s.draft.sections.length - 1);
    }
    s.refreshChromeState();
    s.renderMeta();
    s.renderSections();
    s.renderSectionFields(s.selectedSection, s.selectedPath);
    s.persistPreview(s.selectedSection, "Restoring preview\u2026");
    s.setStatus("History restored \xB7 Save to cms when ready");
  }
  function undo() {
    if (!s.undoStack.length) return;
    s.redoStack.push(deepClone(s.draft));
    const previous = s.undoStack.pop();
    if (previous) restoreFromHistory(previous);
  }
  function redo() {
    if (!s.redoStack.length) return;
    s.undoStack.push(deepClone(s.draft));
    const next = s.redoStack.pop();
    if (next) restoreFromHistory(next);
  }
  return { syncHistoryButtons, checkpoint, restoreFromHistory, undo, redo };
}
export {
  createHistory
};
