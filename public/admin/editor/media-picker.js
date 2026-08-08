// Generated from src/admin-client by `npm run build:admin` — do not edit.
import { apiFetch } from "../lib/api.js";
import { deliveryThumbUrl } from "../lib/cloudinary-url.js";
import { escapeHtml } from "../lib/utils.js";
import { icon } from "./icons.js";
function parseTagsInput(raw) {
  return String(raw || "").split(/[,;\n]/).map((t) => t.trim()).filter(Boolean);
}
function errorText(err) {
  return err instanceof Error && err.message ? err.message : String(err);
}
function createMediaPicker(opts) {
  const {
    mount,
    mode = "manage",
    variant = "rail",
    hideInsert = false,
    onInsert,
    onClose,
    getInsertTarget,
    setStatus = () => {
    }
  } = opts;
  let scope = null;
  let folder = "";
  let query = "";
  let assets = [];
  let nextCursor = null;
  let selectedId = null;
  let loading = false;
  let uploading = false;
  mount.classList.add("media-picker");
  mount.dataset.mode = mode;
  mount.dataset.variant = variant;
  mount.innerHTML = `
    <div class="media-toolbar">
      <select class="media-folder" aria-label="Folder"></select>
      <div class="media-search-row">
        <input type="search" class="media-search" placeholder="Search tags, title, description\u2026" aria-label="Search media" />
        <button type="button" class="media-search-btn" title="Search">${icon("image", "icon icon-sm")}</button>
      </div>
      <label class="media-upload-btn">
        ${icon("plus", "icon icon-sm")} Upload
        <input type="file" accept="image/*" hidden class="media-file" />
      </label>
      ${mode === "insert" ? `<button type="button" class="media-cancel">Cancel</button>` : ""}
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
            ${hideInsert ? "" : `<button type="button" class="media-insert-btn primary">${mode === "insert" ? "Use image" : "Insert into page"}</button>`}
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
  const folderSelect = mount.querySelector(".media-folder");
  const searchInput = mount.querySelector(".media-search");
  const searchBtn = mount.querySelector(".media-search-btn");
  const grid = mount.querySelector(".media-grid");
  const moreBtn = mount.querySelector(".media-more");
  const emptyEl = mount.querySelector(".media-empty");
  const detail = mount.querySelector(".media-detail");
  const detailPreview = mount.querySelector(".media-detail-preview");
  const detailForm = mount.querySelector(".media-detail-form");
  const detailMeta = mount.querySelector(".media-detail-meta");
  const detailStatus = mount.querySelector(".media-detail-status");
  const insertBtn = mount.querySelector(".media-insert-btn");
  const fileInput = mount.querySelector(".media-file");
  const uploadPanel = mount.querySelector(".media-upload-panel");
  const uploadFolder = mount.querySelector(".media-upload-folder");
  const uploadTitle = mount.querySelector(".media-upload-title");
  const uploadTags = mount.querySelector(".media-upload-tags");
  const uploadFileName = mount.querySelector(".media-upload-file-name");
  const uploadGo = mount.querySelector(".media-upload-go");
  const uploadCancel = mount.querySelector(".media-upload-cancel");
  const uploadStatus = mount.querySelector(".media-upload-status");
  const cancelBtn = mount.querySelector(".media-cancel");
  const detailTitle = detailForm?.querySelector('[name="title"]') ?? null;
  const detailDescription = detailForm?.querySelector('[name="description"]') ?? null;
  const detailTags = detailForm?.querySelector('[name="tags"]') ?? null;
  let pendingFile = null;
  function selectedAsset() {
    return assets.find((a) => a.publicId === selectedId) || null;
  }
  function fillFolderSelects(folders) {
    const list = folders?.length ? folders : ["website"];
    const options = [
      `<option value="">All folders</option>`,
      ...list.map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`)
    ].join("");
    if (folderSelect) {
      folderSelect.innerHTML = options;
      if (folder) folderSelect.value = folder;
      else folderSelect.value = "";
    }
    if (uploadFolder) {
      uploadFolder.innerHTML = list.map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join("");
      if (!uploadFolder.value && list[0]) uploadFolder.value = list[0];
    }
  }
  function renderGrid() {
    if (grid) {
      grid.innerHTML = assets.map((asset) => {
        const active = asset.publicId === selectedId ? " is-selected" : "";
        const label = escapeHtml(asset.title || asset.filename || asset.publicId || "Image");
        const tags = (asset.tags || []).slice(0, 3).map(escapeHtml).join(" \xB7 ");
        return `
          <div class="media-card${active}" role="option" tabindex="0" aria-selected="${asset.publicId === selectedId}" data-id="${escapeHtml(asset.publicId)}" title="${label}">
            <span class="media-card-thumb">
              <img src="${escapeHtml(deliveryThumbUrl(asset.secureUrl, 280, asset.publicId))}" alt="" width="280" height="280" loading="lazy" decoding="async" referrerpolicy="no-referrer" />
            </span>
            <span class="media-card-label">${label}</span>
            ${tags ? `<span class="media-card-tags">${tags}</span>` : ""}
          </div>
        `;
      }).join("");
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
    if (detailTitle) detailTitle.value = asset.title || "";
    if (detailDescription) detailDescription.value = asset.description || "";
    if (detailTags) detailTags.value = (asset.tags || []).join(", ");
    const bits = [
      asset.publicId,
      asset.orientation,
      asset.width && asset.height ? `${asset.width}\xD7${asset.height}` : "",
      asset.folder
    ].filter(Boolean);
    if (detailMeta) detailMeta.textContent = bits.join(" \xB7 ");
    if (detailStatus) detailStatus.hidden = true;
    syncInsertEnabled();
  }
  function syncInsertEnabled() {
    if (!insertBtn) return;
    const asset = selectedAsset();
    const target = getInsertTarget?.() || null;
    if (mode === "insert") {
      insertBtn.disabled = !asset;
      insertBtn.textContent = "Use image";
      return;
    }
    if (!asset) {
      insertBtn.disabled = true;
      insertBtn.textContent = "Insert into page";
      insertBtn.title = "";
      return;
    }
    if (target?.path) {
      insertBtn.disabled = false;
      insertBtn.textContent = "Insert into page";
      insertBtn.title = target.label || target.path;
    } else {
      insertBtn.disabled = true;
      insertBtn.textContent = "Select an image field first";
      insertBtn.title = "Focus an image field in the inspector, or open Browse from a field";
    }
  }
  async function loadScope() {
    scope = await apiFetch("/api/admin/cloudinary/search", {
      errorMessage: "Cloudinary config unavailable"
    });
    if (!scope?.enabled) {
      setStatus(scope?.needsSecret ? "CLOUDINARY_API_SECRET required for Media" : "Cloudinary not configured", "error");
      fillFolderSelects([]);
      return;
    }
    folder = "";
    fillFolderSelects(scope.folders || []);
    if (folderSelect) folderSelect.value = "";
  }
  async function search(reset = true) {
    if (loading) return;
    loading = true;
    if (emptyEl) {
      emptyEl.hidden = true;
      emptyEl.textContent = "Loading\u2026";
      emptyEl.hidden = false;
    }
    try {
      const browsing = !query;
      const data = await apiFetch("/api/admin/cloudinary/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          browse: browsing || void 0,
          query: query || void 0,
          folder: folder || "all",
          maxResults: browsing ? 48 : 24,
          nextCursor: reset ? void 0 : nextCursor || void 0
        }),
        errorMessage: "Media search failed"
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
      const folderLabel = data.folder ? data.folder : (data.foldersSearched || []).length > 1 ? "all folders" : (data.foldersSearched || [])[0] || "";
      const total = typeof data.totalCount === "number" && data.totalCount > assets.length ? ` of ~${data.totalCount}` : "";
      setStatus(`Media \xB7 ${assets.length}${total} shown${folderLabel ? ` \xB7 ${folderLabel}` : ""}`, "ok");
    } catch (err) {
      if (emptyEl) {
        emptyEl.textContent = errorText(err);
        emptyEl.hidden = false;
      }
      setStatus(errorText(err), "error");
    } finally {
      loading = false;
    }
  }
  function selectAsset(publicId) {
    selectedId = publicId;
    renderGrid();
    renderDetail();
  }
  async function saveMetadata(e) {
    e.preventDefault();
    const asset = selectedAsset();
    if (!asset) return;
    if (detailStatus) {
      detailStatus.hidden = false;
      detailStatus.textContent = "Saving\u2026";
    }
    try {
      const data = await apiFetch("/api/admin/cloudinary/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicId: asset.publicId,
          title: detailTitle?.value,
          description: detailDescription?.value,
          tags: parseTagsInput(detailTags?.value)
        }),
        errorMessage: "Metadata update failed"
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
          secureUrl: updated.secureUrl || current.secureUrl
        };
      }
      renderGrid();
      renderDetail();
      if (detailStatus) detailStatus.textContent = "Saved";
      setStatus("Asset metadata saved", "ok");
    } catch (err) {
      if (detailStatus) detailStatus.textContent = errorText(err);
      setStatus(errorText(err), "error");
    }
  }
  function doInsert() {
    const asset = selectedAsset();
    if (!asset) return;
    const mapped = {
      secure_url: asset.secureUrl,
      url: asset.secureUrl,
      public_id: asset.publicId,
      width: asset.width,
      height: asset.height,
      display_name: asset.description || asset.title || asset.filename || asset.publicId,
      tags: asset.tags,
      context: asset.context
    };
    onInsert?.(mapped, asset);
    if (mode === "insert") onClose?.();
  }
  function openUpload(file) {
    pendingFile = file || null;
    if (uploadPanel) uploadPanel.hidden = !pendingFile;
    if (uploadFileName) uploadFileName.textContent = pendingFile ? pendingFile.name : "";
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
      uploadStatus.textContent = "Signing\u2026";
    }
    try {
      const sign = await apiFetch("/api/admin/cloudinary/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folder: uploadFolder?.value || folder || void 0,
          title: uploadTitle?.value || void 0,
          tags: parseTagsInput(uploadTags?.value)
        }),
        errorMessage: "Could not sign upload"
      });
      if (uploadStatus) uploadStatus.textContent = "Uploading\u2026";
      const form = new FormData();
      form.append("file", pendingFile);
      form.append("api_key", sign.apiKey);
      form.append("timestamp", String(sign.timestamp));
      form.append("signature", sign.signature);
      form.append("folder", sign.folder);
      if (sign.context) form.append("context", sign.context);
      if (sign.tags) form.append("tags", sign.tags);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`,
        { method: "POST", body: form }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || `Upload failed (${res.status})`);
      }
      const newAsset = {
        publicId: String(data.public_id ?? ""),
        secureUrl: data.secure_url || data.url || "",
        width: data.width,
        height: data.height,
        aspectRatio: data.aspect_ratio ?? null,
        orientation: null,
        format: data.format || "",
        folder: sign.folder,
        filename: String(data.public_id || "").split("/").pop(),
        tags: Array.isArray(data.tags) ? data.tags : parseTagsInput(uploadTags?.value),
        title: uploadTitle?.value || data.context?.custom?.caption || null,
        description: data.context?.custom?.alt || null,
        context: data.context?.custom || {},
        createdAt: data.created_at || null
      };
      if (data.context && typeof data.context === "object" && !newAsset.title) {
        const ctx = data.context.custom || data.context;
        newAsset.title = ctx.caption || null;
        newAsset.description = ctx.alt || null;
        newAsset.context = ctx;
      }
      assets = [newAsset, ...assets.filter((a) => a.publicId !== newAsset.publicId)];
      selectedId = newAsset.publicId;
      pendingFile = null;
      if (fileInput) fileInput.value = "";
      if (uploadPanel) uploadPanel.hidden = true;
      if (uploadTitle) uploadTitle.value = "";
      if (uploadTags) uploadTags.value = "";
      renderGrid();
      renderDetail();
      if (uploadStatus) uploadStatus.textContent = "Uploaded";
      setStatus(`Uploaded ${newAsset.filename}`, "ok");
    } catch (err) {
      if (uploadStatus) uploadStatus.textContent = errorText(err);
      setStatus(errorText(err), "error");
    } finally {
      uploading = false;
      if (uploadGo) uploadGo.disabled = !pendingFile;
    }
  }
  function cardFrom(e) {
    return e.target instanceof Element ? e.target.closest(".media-card") : null;
  }
  folderSelect?.addEventListener("change", () => {
    folder = folderSelect.value;
    search(true);
  });
  searchBtn?.addEventListener("click", () => {
    query = searchInput?.value.trim() || "";
    search(true);
  });
  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      query = searchInput.value.trim();
      search(true);
    }
  });
  moreBtn?.addEventListener("click", () => search(false));
  grid?.addEventListener("click", (e) => {
    const card = cardFrom(e);
    if (!card) return;
    selectAsset(card.dataset.id ?? null);
  });
  grid?.addEventListener("keydown", (e) => {
    const card = cardFrom(e);
    if (!card) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectAsset(card.dataset.id ?? null);
      if (e.key === "Enter") doInsert();
    }
  });
  grid?.addEventListener("dblclick", (e) => {
    const card = cardFrom(e);
    if (!card) return;
    selectAsset(card.dataset.id ?? null);
    doInsert();
  });
  detailForm?.addEventListener("submit", saveMetadata);
  insertBtn?.addEventListener("click", doInsert);
  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) openUpload(file);
  });
  uploadGo?.addEventListener("click", runUpload);
  uploadCancel?.addEventListener("click", () => {
    pendingFile = null;
    if (fileInput) fileInput.value = "";
    if (uploadPanel) uploadPanel.hidden = true;
  });
  cancelBtn?.addEventListener("click", () => onClose?.());
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
      mount.innerHTML = "";
    }
  };
}
function openMediaPickerModal(opts = {}) {
  const { getInsertTarget, setStatus } = opts;
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "media-modal-backdrop";
    backdrop.innerHTML = `
      <div class="media-modal" role="dialog" aria-label="Choose image">
        <div class="media-modal-head">
          <h3>Choose image</h3>
          <button type="button" class="media-modal-close" aria-label="Close">${icon("del", "icon icon-sm")}</button>
        </div>
        <div class="media-modal-body"></div>
      </div>
    `;
    document.body.appendChild(backdrop);
    const body = backdrop.querySelector(".media-modal-body");
    const close = () => {
      picker.destroy();
      backdrop.remove();
    };
    const picker = createMediaPicker({
      mount: body ?? backdrop,
      mode: "insert",
      getInsertTarget,
      setStatus,
      onInsert(mapped) {
        resolve(mapped);
        close();
      },
      onClose() {
        resolve(null);
        close();
      }
    });
    backdrop.querySelector(".media-modal-close")?.addEventListener("click", () => {
      resolve(null);
      close();
    });
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        resolve(null);
        close();
      }
    });
    picker.refresh();
  });
}
export {
  createMediaPicker,
  openMediaPickerModal
};
