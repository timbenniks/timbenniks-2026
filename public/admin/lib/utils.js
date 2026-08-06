/** Shared admin client utilities. */

export function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

export function getByPath(obj, path) {
  return path.split('.').reduce((cur, key) => {
    if (cur == null) return undefined;
    return cur[key];
  }, obj);
}

export function setByPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (cur[key] == null || typeof cur[key] !== 'object') cur[key] = {};
    cur = cur[key];
  }
  cur[parts[parts.length - 1]] = value;
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function escapeAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

export function pagesEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
