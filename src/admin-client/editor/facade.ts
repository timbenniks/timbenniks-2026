/**
 * Agent / WebMCP facade — tools call into the live editor session.
 * Preserves window.__tbVisualEditor / WebMCP tool contract.
 */
import { apiFetch } from '../lib/api.js';
import type {
  ChangesSummary,
  CloudinarySearchResult,
  EditorFacade,
  EditorState,
  ImageTarget,
  ListItemTarget,
  PageSummary,
  SetImageArgs,
} from '../lib/facade.js';
import { PANEL_NAMES, isPanelName } from '../lib/facade.js';
import type {
  PageData,
  PageMetadata,
  PageSection,
  SectionKind,
  SiteChrome,
} from '../lib/content.js';
import { documentMetaPatch } from '../lib/messaging.js';
import { editorPathFor, hardNavigate } from '../lib/navigate.js';
import { deepClone, getByPath } from '../lib/utils.js';
import { LIST_SPECS, SECTION_FORM } from './catalog.js';
import type { FieldDef, ListSpec } from './catalog.js';
import type { EditorSession } from './session.js';

const FIELD_DESC_KEYS = [
  'key',
  'type',
  'label',
  'options',
  'hint',
  'min',
  'max',
  'allowEmpty',
  'emptyLabel',
  'optionsFrom',
  'showWhen',
  'coerce',
];

export interface SectionSummary {
  index: number;
  kind: SectionKind;
  title: string;
}

/**
 * `EditorState` plus the editor-only extras: the live preview URL, a section
 * summary list, and the page metadata. `sectionKinds` and `imageTarget` are on
 * the shared state; the editor always resolves an image target, so it narrows.
 */
export interface VisualEditorState extends EditorState {
  liveUrl: string;
  imageTarget: ImageTarget;
  sections: SectionSummary[];
  metadata: Partial<PageMetadata>;
}

export interface EditorChangesSummary extends ChangesSummary {
  draftIds: string[];
  siteTouched: boolean;
  aheadBy: number;
}

/**
 * `EditorFacade` as the editor actually implements it: richer state, the image
 * target resolver the media picker needs, and the wider list argument objects
 * the tool layer already passes.
 */
export interface VisualEditorFacade extends EditorFacade {
  getState(): VisualEditorState;
  getChanges(): Promise<EditorChangesSummary>;
  setImage(args?: Partial<SetImageArgs>): Promise<unknown>;
  addListItem(args?: Partial<ListItemTarget> & { item?: unknown }): Promise<unknown>;
  removeListItem(args?: Partial<ListItemTarget> & { itemIndex?: number }): Promise<unknown>;
  moveListItem(args?: Partial<ListItemTarget> & { from?: number; to?: number }): Promise<unknown>;
  resolveImageTarget(): ImageTarget;
}

type FieldDesc = Record<string, unknown>;

interface ListDesc {
  key: string;
  label: string;
  min: number;
  fields: FieldDesc[];
  optional?: boolean;
  nested?: ListDesc;
}

export function createVisualEditorFacade(s: EditorSession): VisualEditorFacade {
  function summarizeSection(section: PageSection, index: number): SectionSummary {
    // Only some kinds carry these, so read them off the union loosely.
    const loose = section as Record<string, unknown> & { headline?: { lead?: string } };
    const title =
      loose.title || loose.eyebrow || loose.headline?.lead || loose.text || loose.lede || '';
    return {
      index,
      kind: section.kind,
      title: String(title).slice(0, 80),
    };
  }

  function serializeFieldDesc(field: FieldDef): FieldDesc {
    const source = field as unknown as Record<string, unknown>;
    const out: FieldDesc = {};
    for (const key of FIELD_DESC_KEYS) {
      if (source[key] !== undefined) out[key] = source[key];
    }
    return out;
  }

  function serializeListDesc(spec: ListSpec): ListDesc {
    const out: ListDesc = {
      key: spec.key,
      label: spec.label,
      min: spec.min,
      fields: (spec.fields || []).map(serializeFieldDesc),
    };
    if (spec.optional !== undefined) out.optional = spec.optional;
    if (spec.nested) out.nested = serializeListDesc(spec.nested);
    return out;
  }

  /** First field with a non-empty key — serialized descs are index signatures. */
  function firstFieldKey(fields: FieldDesc[] | undefined): string | undefined {
    const found = (fields || []).find((f) => f.key);
    return typeof found?.key === 'string' ? found.key : undefined;
  }

  function resolveSectionIndex(sectionIndex?: number): number {
    const i = sectionIndex == null ? s.selectedSection : Number(sectionIndex);
    if (!Number.isFinite(i) || i < 0 || i >= s.draft.sections.length) {
      throw new Error(`Invalid section index ${sectionIndex}`);
    }
    return i;
  }

  function resolveListTarget({
    sectionIndex,
    listKey,
    nestedKey,
    parentItemIndex,
  }: Partial<ListItemTarget> = {}): {
    i: number;
    section: PageSection;
    spec: ListSpec;
    listPath: string;
  } {
    if (!listKey) throw new Error('listKey is required');
    const i = resolveSectionIndex(sectionIndex);
    const section = s.draft.sections[i];
    const specs = LIST_SPECS[section.kind] || [];
    const spec = specs.find((sp) => sp.key === listKey);
    if (!spec) throw new Error(`Unknown list “${listKey}” for kind ${section.kind}`);

    const useNested = nestedKey != null && nestedKey !== '' && parentItemIndex != null;
    if (nestedKey != null && nestedKey !== '' && parentItemIndex == null) {
      throw new Error('parentItemIndex required for nested lists');
    }
    if (useNested) {
      if (!spec.nested || spec.nested.key !== nestedKey) {
        throw new Error(`Unknown nested list “${nestedKey}” on ${listKey}`);
      }
      const parentIdx = Number(parentItemIndex);
      if (!Number.isFinite(parentIdx) || parentIdx < 0) {
        throw new Error(`Invalid parentItemIndex ${parentItemIndex}`);
      }
      return {
        i,
        section,
        spec: spec.nested,
        listPath: `sections.${i}.${listKey}.${parentIdx}.${nestedKey}`,
      };
    }

    return {
      i,
      section,
      spec,
      listPath: `sections.${i}.${listKey}`,
    };
  }

  function ensureListArray(listPath: string): unknown[] {
    let arr = getByPath(s.draft, listPath);
    if (!Array.isArray(arr)) {
      s.setByPath(s.draft, listPath, []);
      arr = getByPath(s.draft, listPath);
    }
    return arr as unknown[];
  }

  function resolveFieldPath(path: string | undefined, sectionIndex?: number): string {
    const raw = String(path || '').trim();
    if (!raw) throw new Error('path is required');
    if (raw.startsWith('sections.') || raw.startsWith('metadata.') || raw === 'path') {
      return raw;
    }
    const idx = sectionIndex == null ? s.selectedSection : sectionIndex;
    if (!Number.isFinite(idx)) throw new Error('sectionIndex required for relative paths');
    return `sections.${idx}.${raw.replace(/^\./, '')}`;
  }

  interface FieldDefMatch {
    idx: number;
    rel: string;
    section: PageSection;
    def: FieldDef | null;
    isQuery: boolean;
  }

  /** Match catalog field defs so agent edits can mirror UI preview-reload rules. */
  function lookupFieldDef(fullPath: string): FieldDefMatch | null {
    const m = String(fullPath).match(/^sections\.(\d+)\.(.+)$/);
    if (!m) return null;
    const idx = Number(m[1]);
    const rel = m[2];
    const section = s.draft.sections[idx];
    if (!section) return null;
    const form = SECTION_FORM[section.kind];
    const queryDef = (form?.query || []).find((f) => f.key === rel);
    if (queryDef) return { idx, rel, section, def: queryDef, isQuery: true };
    const fieldDef = (form?.fields || []).find(
      (f) => f.key === rel || (f.key && rel.startsWith(`${f.key}.`)),
    );
    return { idx, rel, section, def: fieldDef || null, isQuery: false };
  }

  function needsPreviewReload(info: FieldDefMatch | null, structuralFlag: boolean): boolean {
    if (structuralFlag) return true;
    if (!info) return false;
    if (info.isQuery) return true;
    if (info.def && ['select', 'number', 'boolean', 'multi-select'].includes(info.def.type)) {
      return true;
    }
    const leaf = String(info.rel || '').split('.')[0];
    return /^(source|limit|columns|tags|playlist|window|hideWhenEmpty)$/.test(leaf);
  }

  function coerceAgentValue(def: FieldDef | null | undefined, value: unknown): unknown {
    if (!def) return value;
    if (def.type === 'multi-select') {
      if (Array.isArray(value)) return value.map(String);
      if (value == null || value === '') return [];
      if (typeof value === 'string') {
        try {
          const parsed: unknown = JSON.parse(value);
          if (Array.isArray(parsed)) return parsed.map(String);
        } catch {
          /* treat as comma/space list */
        }
        return value
          .split(/[,\s]+/)
          .map((t) => t.trim())
          .filter(Boolean);
      }
      return [String(value)];
    }
    if (typeof s.coerceFieldValue === 'function') {
      return s.coerceFieldValue(def, value);
    }
    return value;
  }

  function collectImageSrcPaths(
    value: unknown,
    prefix: string,
    out: { path: string; label: string }[],
  ) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((item, i) => collectImageSrcPaths(item, `${prefix}.${i}`, out));
      return;
    }
    const leaf = prefix.split('.').pop() || '';
    const record = value as Record<string, unknown>;
    if (
      typeof record.src === 'string' &&
      (Object.prototype.hasOwnProperty.call(value, 'alt') ||
        Object.prototype.hasOwnProperty.call(value, 'width') ||
        /image/i.test(leaf))
    ) {
      out.push({
        path: `${prefix}.src`,
        label: prefix.replace(/^sections\.\d+\./, '') || leaf,
      });
    }
    for (const [k, v] of Object.entries(record)) {
      if (v && typeof v === 'object') collectImageSrcPaths(v, `${prefix}.${k}`, out);
    }
  }

  function resolveImageTarget(): ImageTarget {
    const alternatives: { path: string; label: string }[] = [];
    const seen = new Set<string>();
    const push = (path: string, label?: string) => {
      let p = String(path || '').trim();
      if (!p || seen.has(p)) return;
      if (/image/i.test(p) && !p.endsWith('.src') && !p.endsWith('.alt') && p !== 'metadata.image') {
        p = `${p}.src`;
      }
      if (seen.has(p)) return;
      seen.add(p);
      alternatives.push({ path: p, label: label || p.replace(/^sections\.\d+\./, '') });
    };

    if (s.selectedPath) {
      const p = String(s.selectedPath);
      if (p === 'metadata.image') push(p, 'Selected SEO image');
      else if (/\.src$/i.test(p) && /image/i.test(p)) push(p, 'Selected field');
      else if (/image/i.test(p) && !/\.alt$/i.test(p)) {
        push(p.replace(/\.(width|height|alt)$/i, ''), 'Selected field');
      }
    }

    if (Number.isFinite(s.selectedSection) && s.draft.sections[s.selectedSection]) {
      const section = s.draft.sections[s.selectedSection];
      const form = SECTION_FORM[section.kind];
      for (const f of [...(form?.fields || []), ...(form?.query || [])]) {
        if (typeof f.key === 'string' && /image/i.test(f.key)) {
          const key =
            f.key.endsWith('.src') || f.key === 'metadata.image'
              ? f.key
              : f.key.endsWith('.alt')
                ? null
                : f.key;
          if (key) push(`sections.${s.selectedSection}.${key}`, f.label || key);
        }
      }
      const walked: { path: string; label: string }[] = [];
      collectImageSrcPaths(section, `sections.${s.selectedSection}`, walked);
      for (const item of walked) push(item.path, item.label);
    }

    if (s.draft.metadata && 'image' in (s.draft.metadata || {})) {
      push('metadata.image', 'SEO / social image');
    }

    const target = alternatives[0] || null;
    return {
      path: target?.path || null,
      label: target?.label || null,
      sectionIndex: s.selectedSection,
      selectedPath: s.selectedPath,
      alternatives: alternatives.slice(0, 8),
    };
  }

  const facade: VisualEditorFacade = {
    getState() {
      return {
        pageId: s.boot.id,
        path: s.draft.path || s.liveUrl,
        liveUrl: s.liveUrl,
        dirty: s.dirty,
        selectedSection: s.selectedSection,
        selectedPath: s.selectedPath,
        imageTarget: resolveImageTarget(),
        deviceMode: s.deviceMode,
        sectionCount: s.draft.sections.length,
        sectionKinds: s.boot.sectionKinds,
        sections: s.draft.sections.map(summarizeSection),
        metadata: deepClone(s.draft.metadata || {}),
      };
    },
    resolveImageTarget,
    getPage() {
      return deepClone(s.draft);
    },
    getSection(index) {
      const i = Number(index);
      if (!Number.isFinite(i) || i < 0 || i >= s.draft.sections.length) {
        throw new Error(`Invalid section index ${index}`);
      }
      return deepClone(s.draft.sections[i]);
    },
    selectSection(index, opts = {}) {
      s.selectSection(Number(index), opts);
      s.setStatus(`Agent selected section ${Number(index)}`, 'ok');
      return facade.getState();
    },
    addSection({ kind, index } = {}) {
      if (!kind || !s.boot.sectionKinds.includes(kind)) {
        throw new Error(`Unknown kind “${kind}”. Use one of: ${s.boot.sectionKinds.join(', ')}`);
      }
      const at = index == null ? s.draft.sections.length : Number(index);
      s.insertSectionAt(at, kind);
      s.setStatus(`Agent added ${kind} at ${at}`, 'ok');
      return {
        ...facade.getState(),
        insertedAt: Math.max(0, Math.min(at, s.draft.sections.length - 1)),
      };
    },
    moveSection({ from, to }) {
      s.moveSection(Number(from), Number(to));
      s.setStatus(`Agent moved section ${from} → ${to}`, 'ok');
      return facade.getState();
    },
    duplicateSection(index) {
      s.duplicateSection(Number(index));
      s.setStatus(`Agent duplicated section ${index}`, 'ok');
      return facade.getState();
    },
    deleteSection(index) {
      s.deleteSection(Number(index));
      s.setStatus(`Agent deleted section ${index}`, 'ok');
      return facade.getState();
    },
    async replaceSection({ index, section }) {
      const i = Number(index);
      if (!Number.isFinite(i) || i < 0 || i >= s.draft.sections.length) {
        throw new Error(`Invalid section index ${index}`);
      }
      if (!section || typeof section !== 'object' || !section.kind) {
        throw new Error('section must be an object with a kind');
      }
      if (!s.boot.sectionKinds.includes(section.kind)) {
        throw new Error(`Unknown kind “${section.kind}”`);
      }
      s.checkpoint();
      s.draft.sections[i] = deepClone(section);
      s.selectedSection = i;
      await s.refreshAfterStructural(i);
      s.selectSection(i);
      s.setStatus(`Agent replaced section ${i} (${section.kind})`, 'ok');
      return facade.getSection(i);
    },
    async patchSection({ index, patch }) {
      const i = Number(index);
      if (!Number.isFinite(i) || i < 0 || i >= s.draft.sections.length) {
        throw new Error(`Invalid section index ${index}`);
      }
      if (!patch || typeof patch !== 'object') throw new Error('patch object required');
      s.checkpoint();
      // Agent-authored patch; only the server parse validates the merged shape.
      const next = {
        ...deepClone(s.draft.sections[i]),
        ...deepClone(patch),
        kind: s.draft.sections[i].kind,
      } as unknown as PageSection;
      if (patch.kind && patch.kind !== s.draft.sections[i].kind) {
        throw new Error('Cannot change kind via patch_section — use replace_section');
      }
      s.draft.sections[i] = next;
      s.selectedSection = i;
      await s.refreshAfterStructural(i);
      s.selectSection(i);
      s.setStatus(`Agent patched section ${i}`, 'ok');
      return facade.getSection(i);
    },
    setField({ path, value, sectionIndex, structural = false }) {
      const fullPath = resolveFieldPath(path, sectionIndex);
      const info = lookupFieldDef(fullPath);
      const nextValue = coerceAgentValue(info?.def, value);
      const reload = needsPreviewReload(info, Boolean(structural));
      s.checkpoint();
      if (reload) {
        s.setByPath(s.draft, fullPath, nextValue);
        let idx = info?.idx;
        if (idx == null) {
          const sectionMatch = String(fullPath).match(/^sections\.(\d+)/);
          idx = sectionMatch ? Number(sectionMatch[1]) : s.selectedSection;
        }
        if ((info?.rel === 'source' || info?.def?.key === 'source') && s.draft.sections[idx]) {
          s.clearSourceDependentFilters?.(s.draft.sections[idx]);
        }
        s.selectedSection = idx;
        s.selectedPath = fullPath;
        const at = idx;
        return s.refreshAfterStructural(at).then(() => {
          s.selectSection(at, { keepPath: true, focusPath: fullPath });
          s.setStatus(`Agent set ${fullPath}`, 'ok');
          return { path: fullPath, value: s.getByPath(s.draft, fullPath), previewReloaded: true };
        });
      }
      s.applyLiveLeaf(fullPath, nextValue);
      const m = String(fullPath).match(/^sections\.(\d+)/);
      if (m) {
        s.selectedSection = Number(m[1]);
        s.selectedPath = fullPath;
        s.renderSectionFields(s.selectedSection, fullPath);
      } else if (fullPath.startsWith('metadata.')) {
        s.renderMeta();
      }
      s.setStatus(`Agent set ${fullPath}`, 'ok');
      return { path: fullPath, value: s.getByPath(s.draft, fullPath), previewReloaded: false };
    },
    updateMetadata(fields) {
      if (!fields || typeof fields !== 'object') throw new Error('fields object required');
      s.checkpoint();
      if (!s.draft.metadata) s.draft.metadata = {} as PageMetadata;
      const metadata = s.draft.metadata as Record<string, unknown>;
      for (const [key, value] of Object.entries(fields)) {
        if (key === 'pageId' || key === 'id') continue;
        if (key === 'noindex') {
          metadata[key] = Boolean(value);
        } else {
          metadata[key] = value == null ? '' : String(value);
        }
        const patch = documentMetaPatch(key, metadata[key]);
        if (patch) s.postToFrame('setDocumentMeta', patch);
      }
      s.renderMeta();
      s.markDirty();
      s.setStatus('Agent updated metadata', 'ok');
      return deepClone(s.draft.metadata);
    },
    setDevice(mode) {
      if (!['desktop', 'mobile', 'full'].includes(mode)) {
        throw new Error('mode must be desktop, mobile, or full');
      }
      s.setDevice(mode);
      s.setStatus(`Agent preview: ${mode}`, 'ok');
      return { deviceMode: mode };
    },
    undo() {
      s.undo();
      return facade.getState();
    },
    redo() {
      s.redo();
      return facade.getState();
    },
    async saveToCms() {
      await s.saveToCms();
      return { ...facade.getState(), dirty: s.dirty };
    },
    async refreshPreview() {
      await s.persistPreview(s.selectedSection, 'Agent refreshing preview…');
      return facade.getState();
    },
    async searchImages({
      query = '',
      describe,
      vision,
      folder,
      maxResults,
      orientation,
      minWidth,
      maxWidth,
      minHeight,
      maxHeight,
      format,
      tags,
    } = {}) {
      const data = await apiFetch<CloudinarySearchResult>('/api/admin/cloudinary/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          ...(describe ? { describe } : {}),
          ...(vision ? { vision: true } : {}),
          ...(folder ? { folder } : {}),
          ...(maxResults ? { maxResults } : {}),
          ...(orientation ? { orientation } : {}),
          ...(minWidth != null ? { minWidth } : {}),
          ...(maxWidth != null ? { maxWidth } : {}),
          ...(minHeight != null ? { minHeight } : {}),
          ...(maxHeight != null ? { maxHeight } : {}),
          ...(format ? { format } : {}),
          ...(Array.isArray(tags) && tags.length ? { tags } : {}),
        }),
        errorMessage: 'Cloudinary search failed',
      });
      const n = data.assets?.length ?? 0;
      const metaNote =
        data.metadata?.used && data.metadata?.terms?.length
          ? ` (metadata: ${data.metadata.terms.slice(0, 5).join(', ')})`
          : '';
      const visionNote = data.vision?.used
        ? ` (vision-ranked from ${data.vision.candidates} thumbs)`
        : data.vision?.error
          ? ` (${data.vision.error})`
          : '';
      s.setStatus(`Found ${n} Cloudinary images${metaNote}${visionNote}`, 'ok');
      return data;
    },
    async getImageLibraryConfig() {
      return apiFetch('/api/admin/cloudinary/search', {
        errorMessage: 'Cloudinary config unavailable',
      });
    },
    async setImage({ path, sectionIndex, secureUrl, publicId, width, height, alt } = {}) {
      let fieldPath = resolveFieldPath(path || 'image.src', sectionIndex);
      if (
        !fieldPath.startsWith('metadata.') &&
        !fieldPath.endsWith('.src') &&
        !fieldPath.endsWith('.href')
      ) {
        fieldPath = `${fieldPath}.src`;
      }

      const url =
        secureUrl ||
        (publicId && s.boot.cloudinary?.cloudName
          ? `https://res.cloudinary.com/${s.boot.cloudinary.cloudName}/image/upload/${publicId}`
          : '');
      if (!url) throw new Error('secureUrl or publicId required');

      s.applyCloudinaryAsset(fieldPath, {
        secure_url: url,
        width,
        height,
        display_name: alt || '',
        public_id: publicId || '',
      });
      if (alt && fieldPath.endsWith('.src')) {
        s.applyLiveLeaf(fieldPath.replace(/\.src$/, '.alt'), alt);
      }

      const m = String(fieldPath).match(/^sections\.(\d+)/);
      const sectionIdx = m ? Number(m[1]) : s.selectedSection;
      if (m) {
        s.selectedSection = sectionIdx;
        s.selectedPath = fieldPath;
        s.renderSectionFields(s.selectedSection, fieldPath);
      } else if (fieldPath.startsWith('metadata.')) {
        s.renderMeta();
      }

      s.clearPreviewPersistTimer();
      await s.persistPreview(sectionIdx, 'Updating image preview…');
      s.setStatus(`Agent set image ${fieldPath}`, 'ok');
      return {
        path: fieldPath,
        src: s.getByPath(s.draft, fieldPath),
        width: fieldPath.endsWith('.src')
          ? s.getByPath(s.draft, fieldPath.replace(/\.src$/, '.width'))
          : undefined,
        height: fieldPath.endsWith('.src')
          ? s.getByPath(s.draft, fieldPath.replace(/\.src$/, '.height'))
          : undefined,
        alt: fieldPath.endsWith('.src')
          ? s.getByPath(s.draft, fieldPath.replace(/\.src$/, '.alt'))
          : undefined,
        previewUpdated: true,
      };
    },

    async listPages() {
      return apiFetch<{ pages: PageSummary[] }>('/api/admin/pages', {
        errorMessage: 'Failed to list pages',
      });
    },
    async createPage({ id, path, title, description } = {}) {
      if (!id || !path || !title) throw new Error('id, path, and title are required');
      return apiFetch('/api/admin/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          path,
          title,
          ...(description != null ? { description } : {}),
        }),
        errorMessage: 'Failed to create page',
      });
    },
    openPage({ id, force } = {}) {
      if (!id) throw new Error('id is required');
      const editorPath = editorPathFor(id);
      if (s.dirty && !force) {
        return {
          navigated: false,
          dirty: true,
          pageId: id,
          editorPath,
          message: 'Unsaved changes — pass force:true to navigate anyway',
        };
      }
      hardNavigate(editorPath);
      return { navigated: true, pageId: id, editorPath };
    },

    describeSection({ index } = {}) {
      const i = resolveSectionIndex(index);
      const section = s.draft.sections[i];
      const kind = section.kind;
      const form = SECTION_FORM[kind] || { fields: [] };
      const fields = [...(form.query || []), ...(form.fields || [])].map(serializeFieldDesc);
      const lists = (LIST_SPECS[kind] || []).map(serializeListDesc);
      const pathHints = [`set_field path <relative> with sectionIndex`];
      for (const list of lists) {
        const leaf = firstFieldKey(list.fields);
        if (leaf) pathHints.push(`set_field path ${list.key}.0.${leaf} with sectionIndex`);
        if (list.nested?.key) {
          const nestedLeaf = firstFieldKey(list.nested.fields);
          if (nestedLeaf) {
            pathHints.push(
              `set_field path ${list.key}.0.${list.nested.key}.0.${nestedLeaf} with sectionIndex`,
            );
          }
        }
      }
      return { kind, index: i, fields, lists, pathHints };
    },
    async addListItem({ sectionIndex, listKey, nestedKey, parentItemIndex, item } = {}) {
      const { i, spec, listPath } = resolveListTarget({
        sectionIndex,
        listKey,
        nestedKey,
        parentItemIndex,
      });
      if (typeof spec.create !== 'function' && item == null) {
        throw new Error(`List “${listKey}” has no create() and no item was provided`);
      }
      s.checkpoint();
      const arr = ensureListArray(listPath);
      arr.push(item != null ? deepClone(item) : spec.create());
      await s.refreshAfterStructural(i);
      const last = arr.length - 1;
      s.setStatus(`Agent added item at ${listPath}.${last}`, 'ok');
      return {
        listPath,
        index: last,
        item: deepClone(arr[last]),
        state: facade.getState(),
      };
    },
    async removeListItem({
      sectionIndex,
      listKey,
      nestedKey,
      parentItemIndex,
      itemIndex,
    } = {}) {
      const { i, spec, listPath } = resolveListTarget({
        sectionIndex,
        listKey,
        nestedKey,
        parentItemIndex,
      });
      const arr = getByPath(s.draft, listPath);
      if (!Array.isArray(arr)) throw new Error(`No list at ${listPath}`);
      const idx = Number(itemIndex);
      if (!Number.isFinite(idx) || idx < 0 || idx >= arr.length) {
        throw new Error(`Invalid itemIndex ${itemIndex}`);
      }
      const min = spec.min ?? 0;
      if (arr.length <= min) {
        throw new Error(`Keep at least ${min} ${String(spec.label || listKey).toLowerCase()}`);
      }
      s.checkpoint();
      arr.splice(idx, 1);
      await s.refreshAfterStructural(i);
      s.setStatus(`Agent removed item at ${listPath}.${idx}`, 'ok');
      return facade.getState();
    },
    async moveListItem({ sectionIndex, listKey, nestedKey, parentItemIndex, from, to } = {}) {
      const { i, listPath } = resolveListTarget({
        sectionIndex,
        listKey,
        nestedKey,
        parentItemIndex,
      });
      const arr = getByPath(s.draft, listPath);
      if (!Array.isArray(arr)) throw new Error(`No list at ${listPath}`);
      const fromIdx = Number(from);
      const toIdx = Number(to);
      if (!Number.isFinite(fromIdx) || fromIdx < 0 || fromIdx >= arr.length) {
        throw new Error(`Invalid from index ${from}`);
      }
      if (!Number.isFinite(toIdx) || toIdx < 0 || toIdx >= arr.length) {
        throw new Error(`Invalid to index ${to}`);
      }
      if (fromIdx === toIdx) return facade.getState();
      s.checkpoint();
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      await s.refreshAfterStructural(i);
      s.setStatus(`Agent moved item ${fromIdx} → ${toIdx} in ${listPath}`, 'ok');
      return facade.getState();
    },

    async getChanges() {
      const { listDraftPageIds, getSiteDraft } = await import('../lib/draft-store.js');
      const baseline = await apiFetch<ChangesSummary>('/api/admin/changes', {
        errorMessage: 'Failed to load changes',
      });
      const draftIds = await listDraftPageIds();
      const site = await getSiteDraft();
      return {
        ...baseline,
        draftIds,
        siteTouched: Boolean(site?.site),
        aheadBy: draftIds.length + (site?.site ? 1 : 0),
      };
    },
    async publishChanges({ message } = {}) {
      const { clearAllDrafts, getPageDraft, getSiteDraft, listDraftPageIds } = await import(
        '../lib/draft-store.js'
      );
      const draftIds = await listDraftPageIds();
      const pages: Record<string, PageData> = {};
      for (const id of draftIds) {
        const rec = await getPageDraft(id);
        if (rec?.page) pages[id] = rec.page;
      }
      // Always include the open editor draft
      if (s.draft) pages[s.boot.id] = s.draft;
      const siteRec = await getSiteDraft();
      const payload = {
        message: message || 'content: publish drafts',
        ...(Object.keys(pages).length ? { pages } : {}),
        ...(siteRec?.site ? { site: siteRec.site } : {}),
      };
      const result = await apiFetch('/api/admin/changes/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        errorMessage: 'Publish failed',
      });
      await clearAllDrafts();
      s.publishedSnapshot = deepClone(s.draft);
      s.savedSnapshot = deepClone(s.draft);
      s.dirty = false;
      s.refreshChromeState?.('saved');
      return result;
    },
    async discardChanges() {
      const { clearAllDrafts, clearPageDraft } = await import('../lib/draft-store.js');
      await clearPageDraft(s.boot.id);
      await clearAllDrafts();
      await apiFetch('/api/admin/changes/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
        errorMessage: 'Discard failed',
      }).catch(() => undefined);
      s.draft = deepClone(s.publishedSnapshot || s.boot.page);
      s.savedSnapshot = deepClone(s.draft);
      s.dirty = false;
      s.refreshChromeState?.('saved');
      await s.persistPreview?.(s.selectedSection, 'Discarded drafts…');
      return { ok: true, cleared: 'local-drafts' };
    },

    async updateAssetMetadata({ publicId, tags, title, description } = {}) {
      if (!publicId) throw new Error('publicId is required');
      return apiFetch('/api/admin/cloudinary/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicId,
          ...(title != null ? { title } : {}),
          ...(description != null ? { description } : {}),
          ...(tags != null ? { tags } : {}),
        }),
        errorMessage: 'Metadata update failed',
      });
    },

    async getSite() {
      return apiFetch<{ site: SiteChrome | null }>('/api/admin/site', {
        errorMessage: 'Failed to load site',
      });
    },
    async applySitePatch({ site, mode } = {}) {
      if (!site || typeof site !== 'object') throw new Error('site object required');
      return apiFetch('/api/admin/site', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site,
          ...(mode === 'preview' ? { mode: 'preview' } : {}),
        }),
        errorMessage: 'Site update failed',
      });
    },

    async getPageHistory() {
      return apiFetch(`/api/admin/pages/${encodeURIComponent(s.boot.id)}/history`, {
        errorMessage: 'Failed to load page history',
      });
    },
    openPanel({ panel } = {}) {
      const name = String(panel || 'section').toLowerCase();
      if (!isPanelName(name)) {
        throw new Error(`panel must be ${PANEL_NAMES.map((p) => `'${p}'`).join('|')}`);
      }
      const chrome = window.__tbEditorChrome;
      if (typeof chrome?.openPanel === 'function') {
        return chrome.openPanel(name === 'inspector' ? 'section' : name);
      }
      // Chrome and session fallbacks both return void, so both always run —
      // same as the `||` chain this replaces.
      if (name === 'media') {
        chrome?.openMedia?.();
        s.openMedia?.();
      } else if (name === 'info' || name === 'page') {
        chrome?.openPage?.('info');
        s.openPage?.('info');
      } else if (name === 'history') {
        chrome?.openPage?.('history');
        s.openPage?.('history');
      } else {
        chrome?.openInspector?.('section');
        s.openInspector?.('section');
      }
      return { panel: name };
    },
  };

  return facade;
}
