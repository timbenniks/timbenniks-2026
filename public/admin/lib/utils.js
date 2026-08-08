// Generated from src/admin-client by `npm run build:admin` — do not edit.
function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}
function getByPath(obj, path) {
  return path.split(".").reduce((cur, key) => {
    if (cur == null) return void 0;
    return cur[key];
  }, obj);
}
function setByPath(obj, path, value) {
  const parts = path.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (cur[key] == null || typeof cur[key] !== "object") cur[key] = {};
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
}
function escapeHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escapeAttr(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
function pagesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
export {
  deepClone,
  escapeAttr,
  escapeHtml,
  getByPath,
  pagesEqual,
  setByPath
};
