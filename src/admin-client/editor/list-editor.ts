/**
 * Nested / top-level list editors for section fields.
 */
import { icon } from '../lib/icons.js';
import { escapeHtml, getByPath, setByPath } from '../lib/utils.js';
import type { ListSpec } from './catalog.js';
import type { EditorSession } from './session.js';

type ListEditorApi = Pick<EditorSession, 'listItemLabel' | 'renderListEditor' | 'renderNestedList'>;

interface EditableListOpts {
  container: HTMLElement;
  sectionIndex: number;
  listPath: string;
  spec: ListSpec;
  wrapClass: string;
  headHtml: string;
  bodyClass?: string;
  allowOptionalClear?: boolean;
  allowNested?: boolean;
  /** When false, missing arrays render as empty without writing into draft (top-level lists). */
  ensureArray?: boolean;
}

export function createListEditor(s: EditorSession): ListEditorApi {
  function listItemLabel(spec: ListSpec, item: unknown, index: number): string {
    if (spec.itemKind === 'string') {
      const text = String(item ?? '').trim();
      return text || `Item ${index + 1}`;
    }
    const record = (item ?? {}) as Record<string, unknown>;
    for (const key of ['question', 'title', 'label', 'heading', 'term', 'name', 'company', 'alt']) {
      const val = record[key];
      if (typeof val === 'string' && val.trim()) return val.trim();
    }
    return `Item ${index + 1}`;
  }

  /** Shared card list renderer used by top-level and nested list editors. */
  function renderEditableList({
    container,
    sectionIndex,
    listPath,
    spec,
    wrapClass,
    headHtml,
    bodyClass = 'list-editor-body',
    allowOptionalClear = false,
    allowNested = false,
    ensureArray = true,
  }: EditableListOpts) {
    let items = getByPath(s.draft, listPath);
    if (!Array.isArray(items)) {
      if (ensureArray) {
        setByPath(s.draft, listPath, []);
        items = getByPath(s.draft, listPath);
      } else {
        items = [];
      }
    }

    const wrap = document.createElement('div');
    wrap.className = wrapClass;
    wrap.innerHTML = headHtml;
    const body = document.createElement('div');
    body.className = bodyClass;

    (items as unknown[]).forEach((item, itemIndex) => {
      const card = document.createElement('div');
      card.className = 'list-item';
      const itemPath = `${listPath}.${itemIndex}`;
      card.innerHTML = `
        <div class="list-item-head">
          <span class="list-item-title">${escapeHtml(listItemLabel(spec, item, itemIndex))}</span>
          <span class="list-item-actions">
            <button type="button" data-up title="Move up" aria-label="Move up">${icon('up', 'icon icon-sm')}</button>
            <button type="button" data-down title="Move down" aria-label="Move down">${icon('down', 'icon icon-sm')}</button>
            <button type="button" data-del title="Remove" aria-label="Remove">${icon('del', 'icon icon-sm')}</button>
          </span>
        </div>
      `;
      const fieldsWrap = document.createElement('div');
      fieldsWrap.className = 'list-item-fields';
      s.appendListItemFields(fieldsWrap, itemPath, spec.fields, spec.itemKind);
      card.appendChild(fieldsWrap);

      if (allowNested && spec.nested && spec.itemKind !== 'string') {
        renderNestedList(card, sectionIndex, itemPath, spec.nested);
      }

      card.querySelector('[data-up]')?.addEventListener('click', () => {
        if (itemIndex <= 0) return;
        s.checkpoint();
        const arr = getByPath(s.draft, listPath) as unknown[];
        const [moved] = arr.splice(itemIndex, 1);
        arr.splice(itemIndex - 1, 0, moved);
        s.markDirty();
        s.renderSectionFields(sectionIndex);
        s.persistPreview(sectionIndex, 'Updating preview…');
      });
      card.querySelector('[data-down]')?.addEventListener('click', () => {
        const arr = getByPath(s.draft, listPath) as unknown[];
        if (itemIndex >= arr.length - 1) return;
        s.checkpoint();
        const [moved] = arr.splice(itemIndex, 1);
        arr.splice(itemIndex + 1, 0, moved);
        s.markDirty();
        s.renderSectionFields(sectionIndex);
        s.persistPreview(sectionIndex, 'Updating preview…');
      });
      card.querySelector('[data-del]')?.addEventListener('click', () => {
        const arr = getByPath(s.draft, listPath) as unknown[];
        const min = spec.min ?? 0;
        if (arr.length <= min) {
          s.setStatus(`Keep at least ${min} ${spec.label.toLowerCase()}`, 'error');
          return;
        }
        s.checkpoint();
        arr.splice(itemIndex, 1);
        if (allowOptionalClear && spec.optional && arr.length === 0) {
          const parts = listPath.split('.');
          const key = parts.pop();
          const parent = getByPath(s.draft, parts.join('.'));
          if (parent && typeof parent === 'object' && key) {
            delete (parent as Record<string, unknown>)[key];
          }
        }
        s.markDirty();
        s.renderSectionFields(sectionIndex);
        s.persistPreview(sectionIndex, 'Updating preview…');
      });

      body.appendChild(card);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'list-add';
    addBtn.innerHTML = `${icon('plus', 'icon icon-sm')} Add ${spec.label.replace(/s$/, '')}`;
    addBtn.addEventListener('click', () => {
      s.checkpoint();
      let arr = getByPath(s.draft, listPath);
      if (!Array.isArray(arr)) {
        setByPath(s.draft, listPath, []);
        arr = getByPath(s.draft, listPath);
      }
      (arr as unknown[]).push(spec.create());
      s.markDirty();
      s.renderSectionFields(sectionIndex);
      s.persistPreview(sectionIndex, 'Updating preview…');
    });

    wrap.appendChild(body);
    wrap.appendChild(addBtn);
    container.appendChild(wrap);
  }

  function renderNestedList(
    container: HTMLElement,
    sectionIndex: number,
    parentPath: string,
    nestedSpec: ListSpec,
  ) {
    const parent = getByPath(s.draft, parentPath) as Record<string, unknown> | null | undefined;
    if (!parent || typeof parent !== 'object') return;
    if (!Array.isArray(parent[nestedSpec.key])) parent[nestedSpec.key] = [];

    renderEditableList({
      container,
      sectionIndex,
      listPath: `${parentPath}.${nestedSpec.key}`,
      spec: nestedSpec,
      wrapClass: 'list-editor is-nested',
      headHtml: `<div class="list-editor-head"><h5>${nestedSpec.label}</h5></div>`,
      bodyClass: 'list-editor-body',
      allowOptionalClear: false,
      allowNested: false,
    });
  }

  function renderListEditor(container: HTMLElement, sectionIndex: number, spec: ListSpec) {
    renderEditableList({
      container,
      sectionIndex,
      listPath: `sections.${sectionIndex}.${spec.key}`,
      spec,
      wrapClass: 'field-group is-list',
      headHtml: `
      <div class="field-group-head">
        <h4>${spec.label}</h4>
        <p>Add, reorder, or remove items in this list.</p>
      </div>
    `,
      bodyClass: 'field-group-body list-editor-body',
      allowOptionalClear: true,
      allowNested: true,
      ensureArray: false,
    });
  }

  return { listItemLabel, renderListEditor, renderNestedList };
}
