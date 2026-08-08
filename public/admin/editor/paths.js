// Generated from src/admin-client by `npm run build:admin` — do not edit.
import { LIST_SPECS } from "./catalog.js";
function humanizePath(path, sectionIndex) {
  const raw = path.replace(new RegExp(`^sections\\.${sectionIndex}\\.`), "");
  const parts = raw.split(".");
  const pretty = parts.map((part) => {
    if (/^\d+$/.test(part)) return `#${Number(part) + 1}`;
    return part.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }).join(" \xB7 ");
  return { label: pretty, path: raw };
}
function fieldLabel(def, sectionIndex) {
  if (def.label) return def.label;
  return humanizePath(`sections.${sectionIndex}.${def.key}`, sectionIndex).label;
}
function editableLeafPaths(value, base = "") {
  const out = [];
  if (value == null) return out;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (base) out.push(base);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      out.push(...editableLeafPaths(item, base ? `${base}.${i}` : String(i)));
    });
    return out;
  }
  if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        out.push(base ? `${base}.${k}` : k);
      } else {
        out.push(...editableLeafPaths(v, base ? `${base}.${k}` : k));
      }
    }
  }
  return out;
}
function pathToFieldId(path) {
  return `field-${path.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}
function pathCoveredByLists(path, sectionIndex, kind) {
  const specs = LIST_SPECS[kind] || [];
  for (const spec of specs) {
    const prefix = `sections.${sectionIndex}.${spec.key}`;
    if (path === prefix || path.startsWith(`${prefix}.`)) return true;
  }
  return false;
}
export {
  editableLeafPaths,
  fieldLabel,
  humanizePath,
  pathCoveredByLists,
  pathToFieldId
};
