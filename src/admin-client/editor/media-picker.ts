/**
 * Shared Cloudinary media picker — rail (manage) + field modal (insert).
 */
import { apiFetch } from '../lib/api.js';
import { deliveryThumbUrl } from '../lib/cloudinary-url.js';
import { escapeHtml } from '../lib/utils.js';
import type { SetStatus } from '../lib/chrome.js';
import { icon } from './icons.js';

/** A Cloudinary asset as /api/admin/cloudinary/search maps it. */
export interface MediaAsset {
  publicId: string;
  secureUrl: string;
  width?: number;
  height?: number;
  aspectRatio?: number | null;
  orientation?: 'portrait' | 'landscape' | 'square' | null;
  format?: string;
  folder?: string;
  filename?: string;
  tags?: string[];
  title?: string | null;
  description?: string | null;
  context?: Record<string, string>;
  createdAt?: unknown;
}

/** The snake_case shape the editor writes into page data. */
export interface CloudinaryInsertAsset {
  secure_url?: string;
  url?: string;
  public_id?: string;
  width?: number | undefined;
  height?: number | undefined;
  display_name?: string;
  tags?: string[] | undefined;
  context?: Record<string, string> | undefined;
}

interface MediaScope {
  enabled?: boolean;
  needsSecret?: boolean;
  cloudName?: string | null;
  folders?: string[];
  defaultFolder?: string | null;
}

interface MediaSearchResponse {
  assets?: MediaAsset[];
  nextCursor?: string | null;
  folder?: string;
  foldersSearched?: string[];
  totalCount?: number;
}

interface SignResponse {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  context?: string;
  tags?: string;
}

interface UploadResponse {
  public_id?: string;
  secure_url?: string;
  url?: string;
  width?: number;
  height?: number;
  aspect_ratio?: number | null;
  format?: string;
  tags?: string[];
  created_at?: string;
  context?: { custom?: Record<string, string> } & Record<string, unknown>;
  error?: { message?: string };
}

export interface MediaPickerOptions {
  mount: HTMLElement;
  mode?: 'manage' | 'insert';
  variant?: 'rail' | 'page';
  /** True on the standalone DAM, where there is no page to insert into. */
  hideInsert?: boolean;
  onInsert?: (mapped: CloudinaryInsertAsset, asset: MediaAsset) => void;
  onClose?: () => void;
  getInsertTarget?: () => { path?: string | null; label?: string | null } | null;
  setStatus?: SetStatus;
}

export interface MediaPicker {
  refresh(): Promise<void>;
  syncInsertTarget(): void;
  destroy(): void;
}

function parseTagsInput(raw: unknown): string[] {
  return String(raw || '')
    .split(/[,;\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function errorText(err: unknown): string {
  return err instanceof Error && err.message ? err.message : String(err);
}

export function createMediaPicker(opts: MediaPickerOptions): MediaPicker {
  const {
    mount,
    mode = 'manage',
    variant = 'rail',
    hideInsert = false,
    onInsert,
    onClose,
    getInsertTarget,
    setStatus = () => {},
  } = opts;

  let scope: MediaScope | null = null;
  let folder = '';
  let query = '';
  let assets: MediaAsset[] = [];
  let nextCursor: string | null = null;
  let selectedId: string | null = null;
  let loading = false;
  let uploading = false;

  mount.classList.add('media-picker');
  mount.dataset.mode = mode;
  mount.dataset.variant = variant;
  mount.innerHTML = `
    <div class="media-toolbar">
      <select class="media-folder" aria-label="Folder"></select>
      <div class="media-search-row">
        <input type="search" class="media-search" placeholder="Search tags, title, description…" aria-label="Search media" />
        <button type="button" class="media-search-btn" title="Search">${icon('image', 'icon icon-sm')}</button>
      </div>
      <label class="media-upload-btn">
        ${icon('plus', 'icon icon-sm')} Upload
        <input type="file" accept="image/*" hidden class="media-file" />
      </label>
      ${mode === 'insert' ? `<button type="button" class="media-cancel">Cancel</button>` : ''}
    </div>
    <div class="media-body">
      <div class="media-grid-wrap">
        <div class="media-grid" role="listbox" aria-label="Library"></div>
        <div class="media-grid-footer">
          <button type="button" class="media-more" hidden>Load more</button>
          <p class="media-empty hint" hidden>No images found.</p>
        </div>
      </div>
      <div class="media-detail" hidden>
        <div class="media-detail-preview"></div>
        <form class="media-detail-form">
          <label>Title<input type="text" name="title" autocomplete="off" /></label>
          <label>Description<textarea name="description" rows="3"></textarea></label>
          <label>Tags<input type="text" name="tags" placeholder="speaking, conference" autocomplete="off" /></label>
          <p class="media-detail-meta hint"></p>
          <div class="media-detail-actions">
            <button type="submit" class="primary">Save metadata</button>
            ${
              hideInsert
                ? ''
                : `<button type="button" class="media-insert-btn primary">${mode === 'insert' ? 'Use image' : 'Insert into page'}</button>`
            }
          </div>
          <p class="media-detail-status hint" hidden></p>
        </form>
      </div>
    </div>
    <div class="media-upload-panel" hidden>
      <h4>Upload</h4>
      <label>Destination folder
        <select class="media-upload-folder"></select>
      </label>
      <label>Title (optional)<input type="text" class="media-upload-title" /></label>
      <label>Tags (optional)<input type="text" class="media-upload-tags" placeholder="speaking, conference" /></label>
      <p class="media-upload-file-name hint"></p>
      <div class="media-upload-actions">
        <button type="button" class="primary media-upload-go" disabled>Upload</button>
        <button type="button" class="media-upload-cancel">Cancel</button>
      </div>
      <p class="media-upload-status hint" hidden></p>
    </div>
  `;

  const folderSelect = mount.querySelector<HTMLSelectElement>('.media-folder');
  const searchInput = mount.querySelector<HTMLInputElement>('.media-search');
  const searchBtn = mount.querySelector<HTMLButtonElement>('.media-search-btn');
  const grid = mount.querySelector<HTMLElement>('.media-grid');
  const moreBtn = mount.querySelector<HTMLButtonElement>('.media-more');
  const emptyEl = mount.querySelector<HTMLElement>('.media-empty');
  const detail = mount.querySelector<HTMLElement>('.media-detail');
  const detailPreview = mount.querySelector<HTMLElement>('.media-detail-preview');
  const detailForm = mount.querySelector<HTMLFormElement>('.media-detail-form');
  const detailMeta = mount.querySelector<HTMLElement>('.media-detail-meta');
  const detailStatus = mount.querySelector<HTMLElement>('.media-detail-status');
  const insertBtn = mount.querySelector<HTMLButtonElement>('.media-insert-btn');
  const fileInput = mount.querySelector<HTMLInputElement>('.media-file');
  const uploadPanel = mount.querySelector<HTMLElement>('.media-upload-panel');
  const uploadFolder = mount.querySelector<HTMLSelectElement>('.media-upload-folder');
  const uploadTitle = mount.querySelector<HTMLInputElement>('.media-upload-title');
  const uploadTags = mount.querySelector<HTMLInputElement>('.media-upload-tags');
  const uploadFileName = mount.querySelector<HTMLElement>('.media-upload-file-name');
  const uploadGo = mount.querySelector<HTMLButtonElement>('.media-upload-go');
  const uploadCancel = mount.querySelector<HTMLButtonElement>('.media-upload-cancel');
  const uploadStatus = mount.querySelector<HTMLElement>('.media-upload-status');
  const cancelBtn = mount.querySelector<HTMLButtonElement>('.media-cancel');
  // Named form access (form.title) collides with HTMLElement.title, so the
  // metadata inputs are looked up directly.
  const detailTitle = detailForm?.querySelector<HTMLInputElement>('[name="title"]') ?? null;
  const detailDescription =
    detailForm?.querySelector<HTMLTextAreaElement>('[name="description"]') ?? null;
  const detailTags = detailForm?.querySelector<HTMLInputElement>('[name="tags"]') ?? null;

  let pendingFile: File | null = null;

  function selectedAsset(): MediaAsset | null {
    return assets.find((a) => a.publicId === selectedId) || null;
  }

  function fillFolderSelects(folders: string[] | undefined) {
    const list = folders?.length ? folders : ['website'];
    const options = [
      `<option value="">All folders</option>`,
      ...list.map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`),
    ].join('');
    if (folderSelect) {
      folderSelect.innerHTML = options;
      if (folder) folderSelect.value = folder;
      else folderSelect.value = '';
    }
    if (uploadFolder) {
      uploadFolder.innerHTML = list
        .map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`)
        .join('');
      if (!uploadFolder.value && list[0]) uploadFolder.value = list[0];
    }
  }

  function renderGrid() {
    if (grid) {
      grid.innerHTML = assets
        .map((asset) => {
          const active = asset.publicId === selectedId ? ' is-selected' : '';
          const label = escapeHtml(asset.title || asset.filename || asset.publicId || 'Image');
          const tags = (asset.tags || []).slice(0, 3).map(escapeHtml).join(' · ');
          return `
          <div class="media-card${active}" role="option" tabindex="0" aria-selected="${asset.publicId === selectedId}" data-id="${escapeHtml(asset.publicId)}" title="${label}">
            <span class="media-card-thumb">
              <img src="${escapeHtml(deliveryThumbUrl(asset.secureUrl, 280, asset.publicId))}" alt="" width="280" height="280" loading="lazy" decoding="async" referrerpolicy="no-referrer" />
            </span>
            <span class="media-card-label">${label}</span>
            ${tags ? `<span class="media-card-tags">${tags}</span>` : ''}
          </div>
        `;
        })
        .join('');
    }
    if (emptyEl) emptyEl.hidden = assets.length > 0 || loading;
    if (moreBtn) moreBtn.hidden = !nextCursor;
    syncInsertEnabled();
  }

  function renderDetail() {
    const asset = selectedAsset();
    if (!detail) return;
    if (!asset) {
      detail.hidden = true;
      return;
    }
    detail.hidden = false;
    if (detailPreview) {
      detailPreview.innerHTML = `
      <img src="${escapeHtml(deliveryThumbUrl(asset.secureUrl, 640, asset.publicId))}" alt="" width="640" height="640" loading="lazy" decoding="async" referrerpolicy="no-referrer" />
      <a href="${escapeHtml(asset.secureUrl)}" target="_blank" rel="noopener" class="hint">Open full</a>
    `;
    }
    if (detailTitle) detailTitle.value = asset.title || '';
    if (detailDescription) detailDescription.value = asset.description || '';
    if (detailTags) detailTags.value = (asset.tags || []).join(', ');
    const bits = [
      asset.publicId,
      asset.orientation,
      asset.width && asset.height ? `${asset.width}×${asset.height}` : '',
      asset.folder,
    ].filter(Boolean);
    if (detailMeta) detailMeta.textContent = bits.join(' · ');
    if (detailStatus) detailStatus.hidden = true;
    syncInsertEnabled();
  }

  function syncInsertEnabled() {
    if (!insertBtn) return;
    const asset = selectedAsset();
    const target = getInsertTarget?.() || null;
    if (mode === 'insert') {
      insertBtn.disabled = !asset;
      insertBtn.textContent = 'Use image';
      return;
    }
    if (!asset) {
      insertBtn.disabled = true;
      insertBtn.textContent = 'Insert into page';
      insertBtn.title = '';
      return;
    }
    if (target?.path) {
      insertBtn.disabled = false;
      insertBtn.textContent = 'Insert into page';
      insertBtn.title = target.label || target.path;
    } else {
      insertBtn.disabled = true;
      insertBtn.textContent = 'Select an image field first';
      insertBtn.title = 'Focus an image field in the inspector, or open Browse from a field';
    }
  }

  async function loadScope() {
    scope = await apiFetch<MediaScope>('/api/admin/cloudinary/search', {
      errorMessage: 'Cloudinary config unavailable',
    });
    if (!scope?.enabled) {
      setStatus(scope?.needsSecret ? 'CLOUDINARY_API_SECRET required for Media' : 'Cloudinary not configured', 'error');
      fillFolderSelects([]);
      return;
    }
    // Always start on All folders so the library is not locked to CLOUDINARY_SEARCH_FOLDER.
    folder = '';
    fillFolderSelects(scope.folders || []);
    if (folderSelect) folderSelect.value = '';
  }

  async function search(reset = true) {
    if (loading) return;
    loading = true;
    if (emptyEl) {
      emptyEl.hidden = true;
      emptyEl.textContent = 'Loading…';
      emptyEl.hidden = false;
    }
    try {
      const browsing = !query;
      const data = await apiFetch<MediaSearchResponse>('/api/admin/cloudinary/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          browse: browsing || undefined,
          query: query || undefined,
          folder: folder || 'all',
          maxResults: browsing ? 48 : 24,
          nextCursor: reset ? undefined : nextCursor || undefined,
        }),
        errorMessage: 'Media search failed',
      });
      const page = Array.isArray(data.assets) ? data.assets : [];
      assets = reset ? page : [...assets, ...page];
      nextCursor = data.nextCursor || null;
      if (selectedId && !assets.some((a) => a.publicId === selectedId)) {
        selectedId = null;
      }
      if (!selectedId && assets[0]) selectedId = assets[0].publicId;
      renderGrid();
      renderDetail();
      const folderLabel = data.folder
        ? data.folder
        : (data.foldersSearched || []).length > 1
          ? 'all folders'
          : (data.foldersSearched || [])[0] || '';
      const total =
        typeof data.totalCount === 'number' && data.totalCount > assets.length
          ? ` of ~${data.totalCount}`
          : '';
      setStatus(`Media · ${assets.length}${total} shown${folderLabel ? ` · ${folderLabel}` : ''}`, 'ok');
    } catch (err) {
      if (emptyEl) {
        emptyEl.textContent = errorText(err);
        emptyEl.hidden = false;
      }
      setStatus(errorText(err), 'error');
    } finally {
      loading = false;
    }
  }

  function selectAsset(publicId: string | null) {
    selectedId = publicId;
    renderGrid();
    renderDetail();
  }

  async function saveMetadata(e: Event) {
    e.preventDefault();
    const asset = selectedAsset();
    if (!asset) return;
    if (detailStatus) {
      detailStatus.hidden = false;
      detailStatus.textContent = 'Saving…';
    }
    try {
      const data = await apiFetch<{ asset?: MediaAsset }>('/api/admin/cloudinary/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicId: asset.publicId,
          title: detailTitle?.value,
          description: detailDescription?.value,
          tags: parseTagsInput(detailTags?.value),
        }),
        errorMessage: 'Metadata update failed',
      });
      const updated = data.asset;
      const idx = assets.findIndex((a) => a.publicId === asset.publicId);
      const current = assets[idx];
      if (idx >= 0 && updated && current) {
        assets[idx] = {
          ...current,
          title: updated.title,
          description: updated.description,
          tags: updated.tags || [],
          secureUrl: updated.secureUrl || current.secureUrl,
        };
      }
      renderGrid();
      renderDetail();
      if (detailStatus) detailStatus.textContent = 'Saved';
      setStatus('Asset metadata saved', 'ok');
    } catch (err) {
      if (detailStatus) detailStatus.textContent = errorText(err);
      setStatus(errorText(err), 'error');
    }
  }

  function doInsert() {
    const asset = selectedAsset();
    if (!asset) return;
    const mapped: CloudinaryInsertAsset = {
      secure_url: asset.secureUrl,
      url: asset.secureUrl,
      public_id: asset.publicId,
      width: asset.width,
      height: asset.height,
      display_name: asset.description || asset.title || asset.filename || asset.publicId,
      tags: asset.tags,
      context: asset.context,
    };
    onInsert?.(mapped, asset);
    if (mode === 'insert') onClose?.();
  }

  function openUpload(file: File | null) {
    pendingFile = file || null;
    if (uploadPanel) uploadPanel.hidden = !pendingFile;
    if (uploadFileName) uploadFileName.textContent = pendingFile ? pendingFile.name : '';
    if (uploadGo) uploadGo.disabled = !pendingFile;
    if (uploadStatus) uploadStatus.hidden = true;
    if (uploadFolder && !uploadFolder.value && scope?.folders?.[0]) {
      uploadFolder.value = folder || scope.folders[0];
    }
  }

  async function runUpload() {
    if (!pendingFile || uploading) return;
    uploading = true;
    if (uploadGo) uploadGo.disabled = true;
    if (uploadStatus) {
      uploadStatus.hidden = false;
      uploadStatus.textContent = 'Signing…';
    }
    try {
      const sign = await apiFetch<SignResponse>('/api/admin/cloudinary/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder: uploadFolder?.value || folder || undefined,
          title: uploadTitle?.value || undefined,
          tags: parseTagsInput(uploadTags?.value),
        }),
        errorMessage: 'Could not sign upload',
      });

      if (uploadStatus) uploadStatus.textContent = 'Uploading…';
      const form = new FormData();
      form.append('file', pendingFile);
      form.append('api_key', sign.apiKey);
      form.append('timestamp', String(sign.timestamp));
      form.append('signature', sign.signature);
      form.append('folder', sign.folder);
      if (sign.context) form.append('context', sign.context);
      if (sign.tags) form.append('tags', sign.tags);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`,
        { method: 'POST', body: form },
      );
      const data: UploadResponse = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || `Upload failed (${res.status})`);
      }

      const newAsset: MediaAsset = {
        publicId: String(data.public_id ?? ''),
        secureUrl: data.secure_url || data.url || '',
        width: data.width,
        height: data.height,
        aspectRatio: data.aspect_ratio ?? null,
        orientation: null,
        format: data.format || '',
        folder: sign.folder,
        filename: String(data.public_id || '').split('/').pop(),
        tags: Array.isArray(data.tags) ? data.tags : parseTagsInput(uploadTags?.value),
        title: uploadTitle?.value || data.context?.custom?.caption || null,
        description: data.context?.custom?.alt || null,
        context: data.context?.custom || {},
        createdAt: data.created_at || null,
      };

      // Normalize context if Cloudinary returns nested shape
      if (data.context && typeof data.context === 'object' && !newAsset.title) {
        const ctx = (data.context.custom || data.context) as Record<string, string>;
        newAsset.title = ctx.caption || null;
        newAsset.description = ctx.alt || null;
        newAsset.context = ctx;
      }

      assets = [newAsset, ...assets.filter((a) => a.publicId !== newAsset.publicId)];
      selectedId = newAsset.publicId;
      pendingFile = null;
      if (fileInput) fileInput.value = '';
      if (uploadPanel) uploadPanel.hidden = true;
      if (uploadTitle) uploadTitle.value = '';
      if (uploadTags) uploadTags.value = '';
      renderGrid();
      renderDetail();
      if (uploadStatus) uploadStatus.textContent = 'Uploaded';
      setStatus(`Uploaded ${newAsset.filename}`, 'ok');
    } catch (err) {
      if (uploadStatus) uploadStatus.textContent = errorText(err);
      setStatus(errorText(err), 'error');
    } finally {
      uploading = false;
      if (uploadGo) uploadGo.disabled = !pendingFile;
    }
  }

  function cardFrom(e: Event): HTMLElement | null {
    return e.target instanceof Element ? e.target.closest<HTMLElement>('.media-card') : null;
  }

  folderSelect?.addEventListener('change', () => {
    folder = folderSelect.value;
    search(true);
  });
  searchBtn?.addEventListener('click', () => {
    query = searchInput?.value.trim() || '';
    search(true);
  });
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      query = searchInput.value.trim();
      search(true);
    }
  });
  moreBtn?.addEventListener('click', () => search(false));
  grid?.addEventListener('click', (e) => {
    const card = cardFrom(e);
    if (!card) return;
    selectAsset(card.dataset.id ?? null);
  });
  grid?.addEventListener('keydown', (e) => {
    const card = cardFrom(e);
    if (!card) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectAsset(card.dataset.id ?? null);
      if (e.key === 'Enter') doInsert();
    }
  });
  grid?.addEventListener('dblclick', (e) => {
    const card = cardFrom(e);
    if (!card) return;
    selectAsset(card.dataset.id ?? null);
    doInsert();
  });
  detailForm?.addEventListener('submit', saveMetadata);
  insertBtn?.addEventListener('click', doInsert);
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) openUpload(file);
  });
  uploadGo?.addEventListener('click', runUpload);
  uploadCancel?.addEventListener('click', () => {
    pendingFile = null;
    if (fileInput) fileInput.value = '';
    if (uploadPanel) uploadPanel.hidden = true;
  });
  cancelBtn?.addEventListener('click', () => onClose?.());

  return {
    async refresh() {
      await loadScope();
      await search(true);
      syncInsertEnabled();
    },
    syncInsertTarget() {
      syncInsertEnabled();
    },
    destroy() {
      mount.innerHTML = '';
    },
  };
}

/** Open insert-mode picker as a modal overlay; resolves with the chosen asset or null. */
export function openMediaPickerModal(
  opts: Pick<MediaPickerOptions, 'getInsertTarget' | 'setStatus'> = {},
): Promise<CloudinaryInsertAsset | null> {
  const { getInsertTarget, setStatus } = opts;
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'media-modal-backdrop';
    backdrop.innerHTML = `
      <div class="media-modal" role="dialog" aria-label="Choose image">
        <div class="media-modal-head">
          <h3>Choose image</h3>
          <button type="button" class="media-modal-close" aria-label="Close">${icon('del', 'icon icon-sm')}</button>
        </div>
        <div class="media-modal-body"></div>
      </div>
    `;
    document.body.appendChild(backdrop);

    const body = backdrop.querySelector<HTMLElement>('.media-modal-body');
    const close = () => {
      picker.destroy();
      backdrop.remove();
    };

    const picker = createMediaPicker({
      mount: body ?? backdrop,
      mode: 'insert',
      getInsertTarget,
      setStatus,
      onInsert(mapped) {
        resolve(mapped);
        close();
      },
      onClose() {
        resolve(null);
        close();
      },
    });

    backdrop.querySelector('.media-modal-close')?.addEventListener('click', () => {
      resolve(null);
      close();
    });
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        resolve(null);
        close();
      }
    });

    picker.refresh();
  });
}
