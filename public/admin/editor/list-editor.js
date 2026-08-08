// Generated from src/admin-client by `npm run build:admin` — do not edit.
import { icon } from "../lib/icons.js";
import { escapeHtml, getByPath, setByPath } from "../lib/utils.js";
function createListEditor(s) {
  function listItemLabel(spec, item, index) {
    if (spec.itemKind === "string") {
      const text = String(item ?? "").trim();
      return text || `Item ${index + 1}`;
    }
    const record = item ?? {};
    for (const key of ["question", "title", "label", "heading", "term", "name", "company", "alt"]) {
      const val = record[key];
      if (typeof val === "string" && val.trim()) return val.trim();
    }
    return `Item ${index + 1}`;
  }
  function renderEditableList({
    container,
    sectionIndex,
    listPath,
    spec,
    wrapClass,
    headHtml,
    bodyClass = "list-editor-body",
    allowOptionalClear = false,
    allowNested = false,
    ensureArray = true
  }) {
    let items = getByPath(s.draft, listPath);
    if (!Array.isArray(items)) {
      if (ensureArray) {
        setByPath(s.draft, listPath, []);
        items = getByPath(s.draft, listPath);
      } else {
        items = [];
      }
    }
    const wrap = document.createElement("div");
    wrap.className = wrapClass;
    wrap.innerHTML = headHtml;
    const body = document.createElement("div");
    body.className = bodyClass;
    items.forEach((item, itemIndex) => {
      const card = document.createElement("div");
      card.className = "list-item";
      const itemPath = `${listPath}.${itemIndex}`;
      card.innerHTML = `
        <div class="list-item-head">
          <span class="list-item-title">${escapeHtml(listItemLabel(spec, item, itemIndex))}</span>
          <span class="list-item-actions">
            <button type="button" data-up title="Move up" aria-label="Move up">${icon("up", "icon icon-sm")}</button>
            <button type="button" data-down title="Move down" aria-label="Move down">${icon("down", "icon icon-sm")}</button>
            <button type="button" data-del title="Remove" aria-label="Remove">${icon("del", "icon icon-sm")}</button>
          </span>
        </div>
      `;
      const fieldsWrap = document.createElement("div");
      fieldsWrap.className = "list-item-fields";
      s.appendListItemFields(fieldsWrap, itemPath, spec.fields, spec.itemKind);
      card.appendChild(fieldsWrap);
      if (allowNested && spec.nested && spec.itemKind !== "string") {
        renderNestedList(card, sectionIndex, itemPath, spec.nested);
      }
      card.querySelector("[data-up]")?.addEventListener("click", () => {
        if (itemIndex <= 0) return;
        s.checkpoint();
        const arr = getByPath(s.draft, listPath);
        const [moved] = arr.splice(itemIndex, 1);
        arr.splice(itemIndex - 1, 0, moved);
        s.markDirty();
        s.renderSectionFields(sectionIndex);
        s.persistPreview(sectionIndex, "Updating preview\u2026");
      });
      card.querySelector("[data-down]")?.addEventListener("click", () => {
        const arr = getByPath(s.draft, listPath);
        if (itemIndex >= arr.length - 1) return;
        s.checkpoint();
        const [moved] = arr.splice(itemIndex, 1);
        arr.splice(itemIndex + 1, 0, moved);
        s.markDirty();
        s.renderSectionFields(sectionIndex);
        s.persistPreview(sectionIndex, "Updating preview\u2026");
      });
      card.querySelector("[data-del]")?.addEventListener("click", () => {
        const arr = getByPath(s.draft, listPath);
        const min = spec.min ?? 0;
        if (arr.length <= min) {
          s.setStatus(`Keep at least ${min} ${spec.label.toLowerCase()}`, "error");
          return;
        }
        s.checkpoint();
        arr.splice(itemIndex, 1);
        if (allowOptionalClear && spec.optional && arr.length === 0) {
          const parts = listPath.split(".");
          const key = parts.pop();
          const parent = getByPath(s.draft, parts.join("."));
          if (parent && typeof parent === "object" && key) {
            delete parent[key];
          }
        }
        s.markDirty();
        s.renderSectionFields(sectionIndex);
        s.persistPreview(sectionIndex, "Updating preview\u2026");
      });
      body.appendChild(card);
    });
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "list-add";
    addBtn.innerHTML = `${icon("plus", "icon icon-sm")} Add ${spec.label.replace(/s$/, "")}`;
    addBtn.addEventListener("click", () => {
      s.checkpoint();
      let arr = getByPath(s.draft, listPath);
      if (!Array.isArray(arr)) {
        setByPath(s.draft, listPath, []);
        arr = getByPath(s.draft, listPath);
      }
      arr.push(spec.create());
      s.markDirty();
      s.renderSectionFields(sectionIndex);
      s.persistPreview(sectionIndex, "Updating preview\u2026");
    });
    wrap.appendChild(body);
    wrap.appendChild(addBtn);
    container.appendChild(wrap);
  }
  function renderNestedList(container, sectionIndex, parentPath, nestedSpec) {
    const parent = getByPath(s.draft, parentPath);
    if (!parent || typeof parent !== "object") return;
    if (!Array.isArray(parent[nestedSpec.key])) parent[nestedSpec.key] = [];
    renderEditableList({
      container,
      sectionIndex,
      listPath: `${parentPath}.${nestedSpec.key}`,
      spec: nestedSpec,
      wrapClass: "list-editor is-nested",
      headHtml: `<div class="list-editor-head"><h5>${nestedSpec.label}</h5></div>`,
      bodyClass: "list-editor-body",
      allowOptionalClear: false,
      allowNested: false
    });
  }
  function renderListEditor(container, sectionIndex, spec) {
    renderEditableList({
      container,
      sectionIndex,
      listPath: `sections.${sectionIndex}.${spec.key}`,
      spec,
      wrapClass: "field-group is-list",
      headHtml: `
      <div class="field-group-head">
        <h4>${spec.label}</h4>
        <p>Add, reorder, or remove items in this list.</p>
      </div>
    `,
      bodyClass: "field-group-body list-editor-body",
      allowOptionalClear: true,
      allowNested: true,
      ensureArray: false
    });
  }
  return { listItemLabel, renderListEditor, renderNestedList };
}
export {
  createListEditor
};
