/**
 * Undo / redo stack for the visual editor session.
 * @param {Record<string, any>} s mutable editor session
 */
import { deepClone } from '../lib/utils.js';

export function createHistory(s) {
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
    s.persistPreview(s.selectedSection, 'Restoring preview…');
    s.setStatus('History restored · Save to cms when ready');
  }

  function undo() {
    if (!s.undoStack.length) return;
    s.redoStack.push(deepClone(s.draft));
    restoreFromHistory(s.undoStack.pop());
  }

  function redo() {
    if (!s.redoStack.length) return;
    s.undoStack.push(deepClone(s.draft));
    restoreFromHistory(s.redoStack.pop());
  }

  return { syncHistoryButtons, checkpoint, restoreFromHistory, undo, redo };
}
