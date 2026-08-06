import { LIST_SPECS } from './catalog.js';

export function humanizePath(path, sectionIndex) {
  const raw = path.replace(new RegExp(`^sections\\.${sectionIndex}\\.`), '');
  const parts = raw.split('.');
  const pretty = parts
    .map((part) => {
      if (/^\d+$/.test(part)) return `#${Number(part) + 1}`;
      return part
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    })
    .join(' · ');
  return { label: pretty, path: raw };
}

export function fieldLabel(def, sectionIndex) {
  if (def.label) return def.label;
  return humanizePath(`sections.${sectionIndex}.${def.key}`, sectionIndex).label;
}

export function editableLeafPaths(value, base = '') {
  const out = [];
  if (value == null) return out;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    if (base) out.push(base);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      out.push(...editableLeafPaths(item, base ? `${base}.${i}` : String(i)));
    });
    return out;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        out.push(base ? `${base}.${k}` : k);
      } else {
        out.push(...editableLeafPaths(v, base ? `${base}.${k}` : k));
      }
    }
  }
  return out;
}

export function pathToFieldId(path) {
  return `field-${path.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

export function pathCoveredByLists(path, sectionIndex, kind) {
  const specs = LIST_SPECS[kind] || [];
  for (const spec of specs) {
    const prefix = `sections.${sectionIndex}.${spec.key}`;
    if (path === prefix || path.startsWith(`${prefix}.`)) return true;
  }
  return false;
}
