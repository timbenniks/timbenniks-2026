// Generated from src/admin-client by `npm run build:admin` — do not edit.
const CHANNEL = "tb-ve";
const BLOCK_ACTIONS = ["up", "down", "dup", "del"];
function isBlockAction(value) {
  return value !== null && BLOCK_ACTIONS.includes(value);
}
function editorOrigin() {
  return window.location.origin;
}
function isTrustedEditorMessage(event) {
  if (!event) return false;
  const data = event.data;
  if (typeof data !== "object" || data === null) return false;
  if (data.channel !== CHANNEL) return false;
  if (event.origin && event.origin !== window.location.origin) return false;
  return true;
}
function readEditorMessage(event) {
  return isTrustedEditorMessage(event) ? event.data : null;
}
function readBridgeMessage(event) {
  return isTrustedEditorMessage(event) ? event.data : null;
}
function postToFrame(win, type, payload) {
  if (!win) return;
  win.postMessage({ channel: CHANNEL, type, payload }, editorOrigin());
}
function postToParent(type, payload) {
  if (!window.parent || window.parent === window) return;
  window.parent.postMessage({ channel: CHANNEL, type, payload }, editorOrigin());
}
function documentMetaPatch(key, value) {
  if (key === "title") return { title: String(value ?? "") };
  if (key === "description") return { description: String(value ?? "") };
  return null;
}
export {
  BLOCK_ACTIONS,
  CHANNEL,
  documentMetaPatch,
  editorOrigin,
  isBlockAction,
  isTrustedEditorMessage,
  postToFrame,
  postToParent,
  readBridgeMessage,
  readEditorMessage
};
