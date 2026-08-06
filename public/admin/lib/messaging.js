/** postMessage helpers for the visual editor bridge channel. */

export const CHANNEL = 'tb-ve';

export function editorOrigin() {
  return window.location.origin;
}

/** True if message is from same origin (or null origin file:// edge cases skipped). */
export function isTrustedEditorMessage(event) {
  if (!event || event.data?.channel !== CHANNEL) return false;
  // Same-origin iframe / parent only.
  if (event.origin && event.origin !== window.location.origin) return false;
  return true;
}

export function postToFrame(win, type, payload) {
  if (!win) return;
  win.postMessage({ channel: CHANNEL, type, payload }, editorOrigin());
}

export function postToParent(type, payload) {
  if (!window.parent || window.parent === window) return;
  window.parent.postMessage({ channel: CHANNEL, type, payload }, editorOrigin());
}
