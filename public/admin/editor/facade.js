/**
 * Agent / WebMCP facade — tools call into the live editor session.
 * Preserves window.__tbVisualEditor / WebMCP tool contract.
 */
import { apiFetch } from '../lib/api.js';
import { deepClone, getByPath } from '../lib/utils.js';
import { SECTION_FORM } from './catalog.js';

/** @param {Record<string, any>} s mutable editor session + helpers */
export function createVisualEditorFacade(s) {
  function summarizeSection(section, index) {
    const title =
      section.title ||
      section.eyebrow ||
      section.headline?.lead ||
      section.text ||
      section.lede ||
      '';
    return {
      index,
      kind: section.kind,
      title: String(title).slice(0, 80),
    };
  }

  function resolveFieldPath(path, sectionIndex) {
    const raw = String(path || '').trim();
    if (!raw) throw new Error('path is required');
    if (raw.startsWith('sections.') || raw.startsWith('metadata.') || raw === 'path') {
      return raw;
    }
    const idx = sectionIndex == null ? s.selectedSection : sectionIndex;
    if (!Number.isFinite(idx)) throw new Error('sectionIndex required for relative paths');
    return `sections.${idx}.${raw.replace(/^\./, '')}`;
  }

  function collectImageSrcPaths(value, prefix, out) {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((item, i) => collectImageSrcPaths(item, `${prefix}.${i}`, out));
      return;
    }
    const leaf = prefix.split('.').pop() || '';
    if (
      typeof value.src === 'string' &&
      (Object.prototype.hasOwnProperty.call(value, 'alt') ||
        Object.prototype.hasOwnProperty.call(value, 'width') ||
        /image/i.test(leaf))
    ) {
      out.push({
        path: `${prefix}.src`,
        label: prefix.replace(/^sections\.\d+\./, '') || leaf,
      });
    }
    for (const [k, v] of Object.entries(value)) {
      if (v && typeof v === 'object') collectImageSrcPaths(v, `${prefix}.${k}`, out);
    }
  }

  function resolveImageTarget() {
    const alternatives = [];
    const seen = new Set();
    const push = (path, label) => {
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
          const key = f.key.endsWith('.src') || f.key === 'metadata.image' ? f.key : f.key.endsWith('.alt') ? null : f.key;
          if (key) push(`sections.${s.selectedSection}.${key}`, f.label || key);
        }
      }
      const walked = [];
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

  const facade = {
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
      return { ...facade.getState(), insertedAt: Math.max(0, Math.min(at, s.draft.sections.length - 1)) };
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
      const next = { ...deepClone(s.draft.sections[i]), ...deepClone(patch), kind: s.draft.sections[i].kind };
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
      s.checkpoint();
      if (structural) {
        s.setByPath(s.draft, fullPath, value);
        const m = String(fullPath).match(/^sections\.(\d+)/);
        const idx = m ? Number(m[1]) : s.selectedSection;
        s.selectedSection = idx;
        return s.refreshAfterStructural(idx).then(() => {
          s.selectSection(idx, { keepPath: true, focusPath: fullPath });
          s.setStatus(`Agent set ${fullPath}`, 'ok');
          return { path: fullPath, value: s.getByPath(s.draft, fullPath) };
        });
      }
      s.applyLiveLeaf(fullPath, value);
      const m = String(fullPath).match(/^sections\.(\d+)/);
      if (m) {
        s.selectedSection = Number(m[1]);
        s.selectedPath = fullPath;
        s.renderSectionFields(s.selectedSection, fullPath);
      } else if (fullPath.startsWith('metadata.')) {
        s.renderMeta();
      }
      s.setStatus(`Agent set ${fullPath}`, 'ok');
      return { path: fullPath, value: s.getByPath(s.draft, fullPath) };
    },
    updateMetadata(fields) {
      if (!fields || typeof fields !== 'object') throw new Error('fields object required');
      s.checkpoint();
      if (!s.draft.metadata) s.draft.metadata = {};
      for (const [key, value] of Object.entries(fields)) {
        s.draft.metadata[key] = value == null ? '' : String(value);
        s.postToFrame('setMeta', { key, value: s.draft.metadata[key] });
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
      const data = await apiFetch('/api/admin/cloudinary/search', {
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
  };

  return facade;
}
