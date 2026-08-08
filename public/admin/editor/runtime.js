// Generated from src/admin-client by `npm run build:admin` — do not edit.
import { apiFetch } from "../lib/api.js";
import { deepClone, getByPath, setByPath, escapeHtml, pagesEqual } from "../lib/utils.js";
import {
  documentMetaPatch,
  readBridgeMessage,
  postToFrame as postToFrameWin
} from "../lib/messaging.js";
import {
  defaultSection,
  SECTION_FORM,
  LIST_SPECS,
  SKIP_LEAF,
  VARIANT_CTA,
  VARIANT_STRIP
} from "./catalog.js";
import { icon } from "../lib/icons.js";
import {
  humanizePath,
  editableLeafPaths,
  pathToFieldId,
  pathCoveredByLists
} from "./paths.js";
import { createVisualEditorFacade } from "./facade.js";
import { createMediaPicker } from "./media-picker.js";
import { editorShellHtml } from "./shell.js";
import { createHistory } from "./history.js";
import { createFieldControls } from "./field-controls.js";
import { createListEditor } from "./list-editor.js";
import { createPreviewSync } from "./preview-sync.js";
import { createPagePanels } from "./page-panels.js";
import { bindStatus, bindStateChip } from "../lib/chrome.js";
import { contentHash, getPageDraft, setPageDraft } from "../lib/draft-store.js";
const META_KEYS = ["title", "description", "keywords", "image"];
function loose(section) {
  return section;
}
function bootEditor() {
  const rootEl = document.getElementById("app");
  if (!rootEl) {
    console.error("[tb-editor] Missing #app root");
    return;
  }
  const root = rootEl;
  let boot;
  try {
    boot = JSON.parse(root.dataset.initial || "null");
  } catch (err) {
    console.error("[tb-editor] Invalid data-initial JSON", err);
    root.innerHTML = '<p class="status-line error">Editor failed to boot: invalid initial payload.</p>';
    return;
  }
  if (!boot || typeof boot !== "object" || !boot.page) {
    console.error("[tb-editor] Incomplete boot payload");
    root.innerHTML = '<p class="status-line error">Editor failed to boot: incomplete payload.</p>';
    return;
  }
  const missingKinds = (boot.sectionKinds || []).filter((k) => !SECTION_FORM[k]);
  if (missingKinds.length) {
    console.warn("[tb-editor] SECTION_FORM missing kinds:", missingKinds.join(", "));
  }
  const liveUrl = boot.liveUrl || boot.previewUrl.replace(/[?&]edit=1/, "").replace(/\?$/, "") || "/";
  const slugPath = String(liveUrl).replace(/^https?:\/\/[^/]+/, "") || "/";
  const s = {
    boot,
    liveUrl,
    slugPath,
    savedSnapshot: deepClone(boot.page),
    draft: deepClone(boot.page),
    dirty: false,
    selectedPath: null,
    selectedSection: 0,
    iframeWin: null,
    primary: "inspector",
    inspectorTab: "layers",
    pageTab: "info",
    mediaPickerInstance: null,
    pendingInsertAt: null,
    pendingHighlight: null,
    pendingScroll: null,
    deviceMode: "full",
    fieldEditCheckpointed: false,
    dragFromIndex: null,
    undoStack: [],
    redoStack: [],
    HISTORY_LIMIT: 50,
    historyCache: null,
    changesCache: null,
    previewPersistTimer: null,
    previewPersistInFlight: null
  };
  root.innerHTML = editorShellHtml({ boot, slugPath, icon });
  s.statusEl = document.getElementById("status");
  s.dirtyChip = document.getElementById("dirty-chip");
  s.saveBtn = document.getElementById("save");
  s.undoBtn = document.getElementById("undo-btn");
  s.redoBtn = document.getElementById("redo-btn");
  s.sectionsEl = document.getElementById("sections");
  s.sectionFieldsEl = document.getElementById("section-fields");
  s.sectionHeadingEl = document.getElementById("section-heading");
  s.metaEl = document.getElementById("meta-fields");
  s.addKind = document.getElementById("add-kind");
  s.insertKind = document.getElementById("insert-kind");
  s.frame = document.getElementById("frame");
  s.previewFrame = document.getElementById("preview-frame");
  s.insertModal = document.getElementById("insert-modal");
  s.layersPane = document.getElementById("layers-pane");
  s.sectionPane = document.getElementById("section-pane");
  s.metaPane = document.getElementById("meta-pane");
  s.formPanel = document.getElementById("form-panel");
  s.pagePanel = document.getElementById("page-panel");
  s.mediaPanel = document.getElementById("media-panel");
  s.mediaMount = document.getElementById("media-mount");
  s.infoPane = document.getElementById("info-pane");
  s.historyPane = document.getElementById("history-pane");
  s.infoFieldsEl = document.getElementById("info-fields");
  s.historyFieldsEl = document.getElementById("history-fields");
  s.inspectorTitleEl = document.getElementById("inspector-title");
  s.pageTitleEl = document.getElementById("page-title");
  boot.sectionKinds.forEach((kind) => {
    for (const sel of [s.addKind, s.insertKind]) {
      const opt = document.createElement("option");
      opt.value = kind;
      opt.textContent = kind;
      sel?.appendChild(opt);
    }
  });
  Object.assign(s, createHistory(s));
  Object.assign(s, createPreviewSync(s));
  Object.assign(s, createFieldControls(s));
  Object.assign(s, createListEditor(s));
  Object.assign(s, createPagePanels(s));
  const {
    syncHistoryButtons,
    checkpoint,
    undo,
    redo,
    persistPreview,
    reloadPreview,
    restorePreviewAfterReady,
    clearPreviewPersistTimer,
    persistDraftLocal,
    applyLiveStructural,
    appendFieldControl,
    applyCloudinaryAsset,
    mountImageUrlField,
    bindLiveInput,
    focusFieldInForm,
    renderListEditor,
    refreshInfoPane,
    syncInfoEditStatus,
    refreshHistoryPanel
  } = s;
  s.baseHash = contentHash(boot.page);
  s.publishedSnapshot = deepClone(boot.page);
  const setStatus = bindStatus(s.statusEl, { baseClass: "status-line" });
  s.setStatus = setStatus;
  void (async () => {
    try {
      const rec = await getPageDraft(boot.id);
      if (!rec?.page) return;
      if (pagesEqual(rec.page, s.draft)) return;
      s.draft = deepClone(rec.page);
      s.savedSnapshot = deepClone(rec.page);
      s.dirty = !pagesEqual(s.draft, s.publishedSnapshot);
      refreshChromeState(s.dirty ? "dirty" : "saved");
      setStatus("Restored local draft \xB7 Publish from Changes when ready", "ok");
      renderSections();
      renderMeta();
      persistPreview(s.selectedSection, "Applying local draft to preview\u2026");
    } catch (err) {
      console.warn("[draft-hydrate]", err);
    }
  })();
  function syncActionButtons() {
    s.dirty = !pagesEqual(s.draft, s.savedSnapshot);
    if (s.saveBtn) s.saveBtn.disabled = !s.dirty;
  }
  const setChipBase = bindStateChip(s.dirtyChip);
  function setDirtyChip(state) {
    setChipBase(state);
    syncInfoEditStatus();
  }
  function refreshChromeState(chipState) {
    syncActionButtons();
    syncHistoryButtons();
    if (chipState) {
      setDirtyChip(chipState);
      return;
    }
    setDirtyChip(s.dirty ? "dirty" : "saved");
  }
  s.refreshChromeState = refreshChromeState;
  function markDirty() {
    refreshChromeState("dirty");
    setStatus("Unsaved changes \xB7 Save draft, then publish from Changes");
    clearTimeout(s.draftAutosaveTimer);
    s.draftAutosaveTimer = setTimeout(() => {
      void persistDraftLocal();
    }, 400);
  }
  s.markDirty = markDirty;
  function postToFrame(type, payload) {
    const win = s.iframeWin || s.frame?.contentWindow;
    postToFrameWin(win, type, payload);
  }
  s.postToFrame = postToFrame;
  function pingFrame() {
    s.iframeWin = s.frame?.contentWindow ?? null;
    postToFrame("ping", {});
    syncBridgeMeta();
  }
  function syncBridgeMeta() {
    postToFrame("setSectionMeta", {
      kinds: s.draft.sections.map((sec) => sec.kind),
      selectedSection: s.selectedSection,
      selectedPath: s.selectedPath
    });
  }
  function selectSection(index, opts = {}) {
    if (index < 0 || index >= s.draft.sections.length) return;
    s.selectedSection = index;
    if (!opts.keepPath) s.selectedPath = null;
    renderSections();
    renderSectionFields(index, opts.focusPath);
    if (opts.openSectionTab !== false) {
      openInspector("section");
    }
    postToFrame("highlightSection", {
      index,
      path: opts.focusPath || null,
      scroll: opts.scroll !== false
    });
    syncBridgeMeta();
    s.mediaPickerInstance?.syncInsertTarget?.();
  }
  s.selectSection = selectSection;
  function moveSection(from, to) {
    if (to < 0 || to >= s.draft.sections.length) return;
    if (from === to) return;
    checkpoint();
    const [item] = s.draft.sections.splice(from, 1);
    s.draft.sections.splice(to, 0, item);
    s.selectedSection = to;
    markDirty();
    renderSections();
    void applyLiveStructural("move", { from, to, highlightIndex: to }).then((ok) => {
      if (!ok) persistPreview(to, "Updating preview\u2026");
    });
  }
  s.moveSection = moveSection;
  function duplicateSection(index) {
    const section = s.draft.sections[index];
    if (!section) return;
    checkpoint();
    s.draft.sections.splice(index + 1, 0, deepClone(section));
    s.selectedSection = index + 1;
    markDirty();
    renderSections();
    void applyLiveStructural("insert", {
      sectionIndex: index + 1,
      highlightIndex: index + 1,
      statusMsg: "Duplicated section"
    }).then((ok) => {
      if (!ok) persistPreview(s.selectedSection, "Updating preview\u2026");
    });
  }
  s.duplicateSection = duplicateSection;
  function deleteSection(index) {
    const section = s.draft.sections[index];
    if (!section) return;
    if (!confirm(`Delete section ${index} (${section.kind})?`)) return;
    checkpoint();
    s.draft.sections.splice(index, 1);
    s.selectedSection = Math.max(0, Math.min(index, s.draft.sections.length - 1));
    markDirty();
    renderSections();
    void applyLiveStructural("remove", {
      index,
      highlightIndex: s.selectedSection
    }).then((ok) => {
      if (!ok) persistPreview(s.selectedSection, "Updating preview\u2026");
    });
  }
  s.deleteSection = deleteSection;
  function insertSectionAt(index, kind) {
    const clamped = Math.max(0, Math.min(index, s.draft.sections.length));
    checkpoint();
    s.draft.sections.splice(clamped, 0, defaultSection(kind));
    markDirty();
    selectSection(clamped, { openSectionTab: false });
    void applyLiveStructural("insert", {
      sectionIndex: clamped,
      highlightIndex: clamped,
      statusMsg: `Added \u201C${kind}\u201D`
    }).then((ok) => {
      if (!ok) persistPreview(clamped, `Adding \u201C${kind}\u201D to preview\u2026`);
    });
  }
  s.insertSectionAt = insertSectionAt;
  function openInsertModal(atIndex) {
    s.pendingInsertAt = atIndex;
    const hint = document.getElementById("insert-hint");
    if (hint) {
      hint.textContent = atIndex >= s.draft.sections.length ? `Append a block at the end.` : `Insert a block before section ${atIndex}.`;
    }
    if (s.insertModal) s.insertModal.hidden = false;
    s.insertKind?.focus();
  }
  function closeInsertModal() {
    s.pendingInsertAt = null;
    if (s.insertModal) s.insertModal.hidden = true;
  }
  function renderMeta() {
    if (!s.metaEl) return;
    s.metaEl.innerHTML = "";
    const labels = {
      title: "Title",
      description: "Description",
      keywords: "Keywords",
      image: "Social image"
    };
    for (const key of META_KEYS) {
      const val = s.draft.metadata?.[key] ?? "";
      const wrap = document.createElement("div");
      wrap.className = "field";
      wrap.innerHTML = `<label>${labels[key]}<span class="field-path">metadata.${key}</span></label>`;
      if (key === "image") {
        mountImageUrlField(wrap, "metadata.image", val);
        const input = wrap.querySelector("input");
        if (input) {
          input.addEventListener("focus", () => {
            s.fieldEditCheckpointed = false;
          });
          input.addEventListener("input", () => {
            if (!s.fieldEditCheckpointed) {
              checkpoint();
              s.fieldEditCheckpointed = true;
            }
            if (!s.draft.metadata) s.draft.metadata = {};
            s.draft.metadata.image = input.value;
            markDirty();
          });
        }
      } else {
        const input = document.createElement(key === "description" ? "textarea" : "input");
        input.value = val;
        input.addEventListener("focus", () => {
          s.fieldEditCheckpointed = false;
        });
        input.addEventListener("input", () => {
          if (!s.fieldEditCheckpointed) {
            checkpoint();
            s.fieldEditCheckpointed = true;
          }
          if (!s.draft.metadata) s.draft.metadata = {};
          s.draft.metadata[key] = input.value;
          markDirty();
        });
        wrap.appendChild(input);
      }
      s.metaEl.appendChild(wrap);
    }
  }
  s.renderMeta = renderMeta;
  function sectionLayerLabel(section) {
    const raw = loose(section).title;
    const title = typeof raw === "string" ? raw.trim() : "";
    return title || null;
  }
  function sectionAgentContext(section, index) {
    const n = String(index).padStart(2, "0");
    const bits = [];
    const fields = loose(section);
    if (typeof fields.title === "string" && fields.title.trim()) {
      bits.push(`title \u201C${fields.title.trim()}\u201D`);
    }
    if (typeof fields.eyebrow === "string" && fields.eyebrow.trim()) {
      bits.push(`eyebrow \u201C${fields.eyebrow.trim()}\u201D`);
    }
    if (typeof fields.source === "string" && fields.source.trim()) {
      const lim = fields.limit != null ? ` \xB7 limit ${fields.limit}` : "";
      bits.push(`source ${fields.source}${lim}`);
    }
    const lead = fields.headline?.lead || (typeof fields.lede === "string" ? fields.lede : "") || (typeof fields.text === "string" ? fields.text : "");
    if (typeof lead === "string" && lead.trim()) {
      bits.push(`lead \u201C${lead.trim().slice(0, 100)}${lead.trim().length > 100 ? "\u2026" : ""}\u201D`);
    }
    const body = [
      `I'm editing section ${n} (index ${index}): ${section.kind}.`,
      `Use tools against sections.${index} (get_section / set_field / patch_section).`,
      bits.length ? `Currently: ${bits.join(" \xB7 ")}.` : ""
    ].filter(Boolean).join("\n");
    return {
      label: `Section ${n} \xB7 ${section.kind}`,
      detail: bits.join(" \xB7 "),
      body
    };
  }
  function askAgentAboutSection(index) {
    const section = s.draft.sections[index];
    if (!section) return;
    const agent = window.__tbAgent;
    if (!agent?.setContext && !agent?.draftPrompt) {
      setStatus("Agent is not available \u2014 set OPENAI_API_KEY on the server.", "error");
      return;
    }
    const ctx = sectionAgentContext(section, index);
    if (agent?.setContext) agent.setContext(ctx);
    else agent?.draftPrompt(ctx.body);
  }
  function renderSections() {
    if (!s.sectionsEl) return;
    s.sectionsEl.innerHTML = "";
    s.draft.sections.forEach((section, i) => {
      const li = document.createElement("li");
      li.draggable = true;
      li.dataset.index = String(i);
      if (i === s.selectedSection) li.classList.add("active");
      const title = sectionLayerLabel(section);
      li.innerHTML = `
        <span class="drag-handle" title="Drag to reorder" aria-hidden="true">${icon("grip", "icon icon-sm")}</span>
        <span class="kind-wrap">
          <span class="idx-line">
            <span class="idx">${String(i).padStart(2, "0")}</span>
            ${title ? `<span class="layer-title">${escapeHtml(title)}</span>` : ""}
          </span>
          <span class="kind">${section.kind}</span>
        </span>
        <span class="row-actions">
          <button type="button" data-up title="Move up" aria-label="Move up">${icon("up", "icon icon-sm")}</button>
          <button type="button" data-down title="Move down" aria-label="Move down">${icon("down", "icon icon-sm")}</button>
          <button type="button" data-dup title="Duplicate" aria-label="Duplicate">${icon("dup", "icon icon-sm")}</button>
          <button type="button" data-del title="Delete" aria-label="Delete">${icon("del", "icon icon-sm")}</button>
        </span>
      `;
      li.title = title ? `${section.kind} \xB7 ${title}` : section.kind;
      li.addEventListener("click", (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;
        if (target.closest("button") || target.closest(".drag-handle")) return;
        selectSection(i);
      });
      li.addEventListener("dragstart", (e) => {
        s.dragFromIndex = i;
        li.classList.add("is-dragging");
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", String(i));
        }
      });
      li.addEventListener("dragend", () => {
        s.dragFromIndex = null;
        li.classList.remove("is-dragging");
        s.sectionsEl?.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
      });
      li.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        s.sectionsEl?.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
        li.classList.add("drag-over");
      });
      li.addEventListener("dragleave", () => {
        li.classList.remove("drag-over");
      });
      li.addEventListener("drop", (e) => {
        e.preventDefault();
        li.classList.remove("drag-over");
        const from = s.dragFromIndex ?? Number(e.dataTransfer?.getData("text/plain"));
        const to = i;
        if (!Number.isFinite(from) || from === to) return;
        moveSection(from, to);
      });
      li.querySelector("[data-up]")?.addEventListener("click", (e) => {
        e.stopPropagation();
        moveSection(i, i - 1);
      });
      li.querySelector("[data-down]")?.addEventListener("click", (e) => {
        e.stopPropagation();
        moveSection(i, i + 1);
      });
      li.querySelector("[data-dup]")?.addEventListener("click", (e) => {
        e.stopPropagation();
        duplicateSection(i);
      });
      li.querySelector("[data-del]")?.addEventListener("click", (e) => {
        e.stopPropagation();
        deleteSection(i);
      });
      s.sectionsEl?.appendChild(li);
    });
  }
  s.renderSections = renderSections;
  function fieldMatchesShowWhen(def, section) {
    if (!def.showWhen || typeof def.showWhen !== "object") return true;
    return Object.entries(def.showWhen).every(([key, allowed]) => {
      const current = loose(section)?.[key];
      const list = Array.isArray(allowed) ? allowed : [allowed];
      return list.includes(current);
    });
  }
  function renderSectionFields(index, focusPath) {
    const section = s.draft.sections[index];
    if (!s.sectionHeadingEl || !s.sectionFieldsEl) return;
    if (!section) {
      s.sectionHeadingEl.innerHTML = "";
      s.sectionFieldsEl.innerHTML = '<p class="hint">No section selected.</p>';
      return;
    }
    s.sectionHeadingEl.innerHTML = `
      <p class="label">Section ${String(index).padStart(2, "0")}</p>
      <div class="section-heading-row">
        <h3>${section.kind}</h3>
        <button type="button" class="section-ai-btn" data-ask-agent title="Ask agent about this section" aria-label="Ask agent about this section">
          ${icon("agent", "icon icon-sm")}
        </button>
      </div>
    `;
    s.sectionHeadingEl.querySelector("[data-ask-agent]")?.addEventListener("click", () => {
      askAgentAboutSection(index);
    });
    s.sectionFieldsEl.innerHTML = "";
    const form = SECTION_FORM[section.kind] || { fields: [] };
    const covered = /* @__PURE__ */ new Set();
    if (form.query?.length) {
      const group = document.createElement("div");
      group.className = "field-group is-query";
      group.innerHTML = `
        <div class="field-group-head">
          <h4>Content query</h4>
          <p>Which collection items appear here. Save to refresh the preview.</p>
        </div>
      `;
      const body = document.createElement("div");
      body.className = "field-group-body";
      form.query.forEach((def) => {
        if (!fieldMatchesShowWhen(def, section)) {
          covered.add(`sections.${index}.${def.key}`);
          return;
        }
        covered.add(`sections.${index}.${def.key}`);
        appendFieldControl(body, `sections.${index}.${def.key}`, def, { group: "query" });
      });
      group.appendChild(body);
      s.sectionFieldsEl.appendChild(group);
    }
    if (form.fields?.length) {
      const group = document.createElement("div");
      group.className = "field-group";
      if (form.query?.length) {
        group.innerHTML = `<div class="field-group-head"><h4>Copy &amp; media</h4></div>`;
      }
      const body = document.createElement("div");
      body.className = "field-group-body";
      form.fields.forEach((def) => {
        covered.add(`sections.${index}.${def.key}`);
        appendFieldControl(body, `sections.${index}.${def.key}`, def);
      });
      group.appendChild(body);
      s.sectionFieldsEl.appendChild(group);
    }
    const listSpecs = LIST_SPECS[section.kind] || [];
    listSpecs.forEach((spec) => {
      if (s.sectionFieldsEl) renderListEditor(s.sectionFieldsEl, index, spec);
    });
    const extraPaths = editableLeafPaths(section, `sections.${index}`).filter((p) => {
      if (SKIP_LEAF.test(p)) return false;
      if (/\.variant$/.test(p)) return false;
      if (pathCoveredByLists(p, index, section.kind)) return false;
      for (const key of covered) {
        if (p === key || p.startsWith(`${key}.`)) return false;
      }
      const val = getByPath(s.draft, p);
      return typeof val === "string";
    });
    const variantPaths = editableLeafPaths(section, `sections.${index}`).filter(
      (p) => p.endsWith(".variant") && !pathCoveredByLists(p, index, section.kind)
    );
    if (extraPaths.length || variantPaths.length) {
      const group = document.createElement("div");
      group.className = "field-group";
      group.innerHTML = `<div class="field-group-head"><h4>Items &amp; details</h4></div>`;
      const body = document.createElement("div");
      body.className = "field-group-body";
      extraPaths.forEach((path) => {
        const val = getByPath(s.draft, path);
        const str = String(val ?? "");
        const { label, path: shortPath } = humanizePath(path, index);
        const wrap = document.createElement("div");
        wrap.className = "field";
        wrap.innerHTML = `<label for="${pathToFieldId(path)}">${label}<span class="field-path">${shortPath}</span></label>`;
        if (path.endsWith(".src")) {
          mountImageUrlField(wrap, path, str);
        } else {
          const input = document.createElement(str.length > 80 ? "textarea" : "input");
          input.id = pathToFieldId(path);
          input.value = str;
          bindLiveInput(input, path, "text");
          wrap.appendChild(input);
        }
        body.appendChild(wrap);
      });
      variantPaths.forEach((path) => {
        const options = section.kind === "cta-strip" ? VARIANT_STRIP : VARIANT_CTA;
        appendFieldControl(body, path, {
          key: path.replace(`sections.${index}.`, ""),
          type: "select",
          options,
          label: humanizePath(path, index).label
        });
      });
      group.appendChild(body);
      s.sectionFieldsEl.appendChild(group);
    }
    if (!s.sectionFieldsEl.children.length) {
      s.sectionFieldsEl.innerHTML = '<p class="hint">No editable fields for this section.</p>';
    }
    if (focusPath) {
      requestAnimationFrame(() => focusFieldInForm(focusPath));
    } else if (s.selectedPath && s.selectedPath.startsWith(`sections.${index}.`)) {
      requestAnimationFrame(() => focusFieldInForm(s.selectedPath));
    }
  }
  s.renderSectionFields = renderSectionFields;
  function handlePreviewSelect(payload) {
    const sectionIndex = typeof payload.sectionIndex === "number" ? payload.sectionIndex : Number(String(payload.path || "").match(/^sections\.(\d+)/)?.[1]);
    if (Number.isFinite(sectionIndex)) {
      s.selectedSection = sectionIndex;
    }
    s.selectedPath = payload.path || null;
    renderSections();
    renderSectionFields(s.selectedSection, s.selectedPath);
    openInspector("section");
    if (s.selectedPath) {
      focusFieldInForm(s.selectedPath);
    }
    syncBridgeMeta();
  }
  const INSPECTOR_TITLES = {
    layers: "Layers",
    section: "Section",
    meta: "Meta"
  };
  const PAGE_TITLES = { info: "Info", history: "History" };
  function syncPrimaryChrome() {
    root.classList.toggle("primary-collapsed", s.primary == null);
    root.dataset.primary = s.primary || "";
    if (s.formPanel) s.formPanel.hidden = s.primary !== "inspector";
    if (s.pagePanel) s.pagePanel.hidden = s.primary !== "page";
    if (s.mediaPanel) s.mediaPanel.hidden = s.primary !== "media";
    if (s.primary === "inspector") {
      if (s.inspectorTitleEl) {
        s.inspectorTitleEl.textContent = INSPECTOR_TITLES[s.inspectorTab] || "Inspector";
      }
      if (s.layersPane) s.layersPane.hidden = s.inspectorTab !== "layers";
      if (s.sectionPane) s.sectionPane.hidden = s.inspectorTab !== "section";
      if (s.metaPane) s.metaPane.hidden = s.inspectorTab !== "meta";
    }
    if (s.primary === "page") {
      if (s.pageTitleEl) s.pageTitleEl.textContent = PAGE_TITLES[s.pageTab] || "Page";
      if (s.infoPane) s.infoPane.hidden = s.pageTab !== "info";
      if (s.historyPane) s.historyPane.hidden = s.pageTab !== "history";
    }
    if (s.primary === "media") {
      ensureMediaPicker();
      s.mediaPickerInstance?.syncInsertTarget?.();
    }
    document.querySelectorAll(".rail-toggle[data-primary]").forEach((btn) => {
      const match = s.primary === btn.dataset.primary && (s.primary === "inspector" && btn.dataset.tab === s.inspectorTab || s.primary === "page" && btn.dataset.tab === s.pageTab || s.primary === "media" && btn.dataset.tab === "library");
      btn.setAttribute("aria-pressed", String(match));
    });
  }
  function getMediaInsertTarget() {
    const api = window.__tbVisualEditor;
    return api?.resolveImageTarget?.() || null;
  }
  s.getMediaInsertTarget = getMediaInsertTarget;
  function ensureMediaPicker() {
    if (s.mediaPickerInstance || !s.mediaMount) return;
    s.mediaPickerInstance = createMediaPicker({
      mount: s.mediaMount,
      mode: "manage",
      setStatus,
      getInsertTarget: getMediaInsertTarget,
      onInsert(mapped) {
        const target = getMediaInsertTarget();
        if (!target?.path) {
          setStatus("Select an image field in the inspector first", "error");
          return;
        }
        applyCloudinaryAsset(target.path, mapped);
        const match = target.path.match(/^sections\.(\d+)/);
        if (match) renderSectionFields(Number(match[1]), target.path);
        else if (target.path.startsWith("metadata.")) renderMeta();
        setStatus(`Inserted into ${target.label || target.path}`, "ok");
      }
    });
    s.mediaPickerInstance.refresh();
  }
  function openInspector(tab) {
    s.inspectorTab = tab;
    s.primary = "inspector";
    syncPrimaryChrome();
  }
  function openPage(tab) {
    s.pageTab = tab;
    s.primary = "page";
    syncPrimaryChrome();
    if (tab === "info") refreshInfoPane();
    if (tab === "history") refreshHistoryPanel();
  }
  function openMedia() {
    s.primary = "media";
    syncPrimaryChrome();
  }
  function closePrimary() {
    s.primary = null;
    syncPrimaryChrome();
  }
  function togglePrimary(kind, tab) {
    if (kind === "inspector") {
      if (s.primary === "inspector" && s.inspectorTab === tab) closePrimary();
      else openInspector(tab);
      return;
    }
    if (kind === "page") {
      if (s.primary === "page" && s.pageTab === tab) closePrimary();
      else openPage(tab);
      return;
    }
    if (kind === "media") {
      if (s.primary === "media") closePrimary();
      else openMedia();
    }
  }
  function setDevice(mode) {
    s.deviceMode = mode;
    s.previewFrame?.classList.remove("is-desktop", "is-mobile", "is-full");
    s.previewFrame?.classList.add(`is-${mode}`);
    document.querySelectorAll(".devices [data-device]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.device === mode);
    });
  }
  s.setDevice = setDevice;
  document.querySelectorAll(".rail-toggle[data-primary]").forEach((btn) => {
    btn.addEventListener("click", () => {
      togglePrimary(btn.dataset.primary, btn.dataset.tab);
    });
  });
  document.getElementById("toggle-agent")?.addEventListener("click", () => {
    setAgentOpen(!root.classList.contains("agent-open"));
  });
  document.querySelectorAll(".devices [data-device]").forEach((btn) => {
    btn.addEventListener("click", () => setDevice(btn.dataset.device));
  });
  document.getElementById("add-section")?.addEventListener("click", () => {
    if (!s.addKind) return;
    insertSectionAt(s.draft.sections.length, s.addKind.value);
  });
  document.getElementById("insert-cancel")?.addEventListener("click", closeInsertModal);
  document.getElementById("insert-confirm")?.addEventListener("click", () => {
    if (s.pendingInsertAt == null) return;
    const at = s.pendingInsertAt;
    const kind = s.insertKind?.value;
    closeInsertModal();
    insertSectionAt(at, kind);
  });
  s.insertModal?.addEventListener("click", (e) => {
    if (e.target === s.insertModal) closeInsertModal();
  });
  async function saveDraft() {
    if (s.saveBtn?.disabled) return;
    if (s.saveBtn) s.saveBtn.disabled = true;
    setDirtyChip("saving");
    setStatus("Saving draft\u2026");
    try {
      await setPageDraft(s.boot.id, s.draft, {
        baseHash: s.baseHash || contentHash(s.publishedSnapshot)
      });
      await apiFetch(`/api/admin/pages/${s.boot.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: s.draft, mode: "preview" }),
        errorMessage: "Draft stage failed"
      }).catch(() => void 0);
      s.savedSnapshot = deepClone(s.draft);
      s.dirty = false;
      s.undoStack.length = 0;
      s.redoStack.length = 0;
      s.historyCache = null;
      s.changesCache = null;
      refreshChromeState("saved");
      setStatus("Draft saved locally \xB7 Publish from Changes", "ok");
      if (s.primary === "page" && s.pageTab === "info") refreshInfoPane();
    } catch (err) {
      refreshChromeState("error");
      setStatus((err instanceof Error ? err.message : "") || String(err), "error");
    }
  }
  s.saveDraft = saveDraft;
  s.saveToCms = saveDraft;
  s.saveBtn?.addEventListener("click", () => {
    saveDraft();
  });
  s.undoBtn?.addEventListener("click", () => undo());
  s.redoBtn?.addEventListener("click", () => redo());
  window.addEventListener("keydown", (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const key = e.key.toLowerCase();
    if (key === "s") {
      e.preventDefault();
      if (e.shiftKey) {
        window.location.href = "/admin/changes";
      } else {
        saveDraft();
      }
      return;
    }
    if (key === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
  });
  s.frame?.addEventListener("load", () => {
    s.iframeWin = s.frame?.contentWindow ?? null;
    setTimeout(pingFrame, 50);
    setTimeout(pingFrame, 250);
    setTimeout(pingFrame, 800);
  });
  window.addEventListener("message", (e) => {
    const data = readBridgeMessage(e);
    if (!data) return;
    if (data.type === "ready") {
      s.iframeWin = s.frame?.contentWindow ?? null;
      setStatus(
        `Preview ready \xB7 ${data.payload?.count ?? 0} fields \xB7 ${s.draft.sections.length} blocks`,
        "ok"
      );
      syncBridgeMeta();
      if (s.pendingHighlight != null || s.pendingScroll) {
        restorePreviewAfterReady();
      } else {
        postToFrame("highlightSection", {
          index: s.selectedSection,
          path: s.selectedPath,
          scroll: false
        });
      }
      return;
    }
    if (data.type === "select") {
      handlePreviewSelect(data.payload || {});
      return;
    }
    if (data.type === "blockAction") {
      const { action, sectionIndex } = data.payload || {};
      const i = Number(sectionIndex);
      if (!Number.isFinite(i)) return;
      if (action === "up") moveSection(i, i - 1);
      else if (action === "down") moveSection(i, i + 1);
      else if (action === "dup") duplicateSection(i);
      else if (action === "del") deleteSection(i);
      return;
    }
    if (data.type === "addAt") {
      const index = Number(data.payload?.index);
      if (!Number.isFinite(index)) return;
      openInsertModal(index);
    }
  });
  window.addEventListener("beforeunload", (e) => {
    if (s.dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  renderMeta();
  renderSections();
  renderSectionFields(0);
  setDevice("full");
  syncPrimaryChrome();
  refreshChromeState("saved");
  syncHistoryButtons();
  function syncWebMcpChip() {
    let chip = document.getElementById("webmcp-chip");
    if (!chip) {
      chip = document.createElement("span");
      chip.id = "webmcp-chip";
      chip.className = "chip webmcp-chip";
      s.statusEl?.appendChild(chip);
    }
    const info = window.__tbWebMcp;
    if (!info) {
      chip.textContent = "WebMCP\u2026";
      chip.classList.remove("ok", "error");
      return;
    }
    if (info.ready) {
      chip.textContent = `WebMCP \xB7 ${info.tools}`;
      chip.classList.add("ok");
      chip.classList.remove("error");
      chip.title = `Registered ${info.tools} tools on ${(info.contexts || []).map((c) => c.label).join(", ")}`;
    } else {
      chip.textContent = "WebMCP off";
      chip.classList.add("error");
      chip.classList.remove("ok");
      chip.title = (info.errors || []).join(" \xB7 ") || "No modelContext API";
    }
  }
  function setAgentOpen(open) {
    const panel = document.getElementById("agent-panel");
    const btn = document.getElementById("toggle-agent");
    if (!panel || !btn || btn.closest("#agent-rail-group")?.hidden) return;
    root.classList.toggle("agent-open", open);
    btn.setAttribute("aria-pressed", String(open));
    window.dispatchEvent(new CustomEvent("tb-agent-open", { detail: { open } }));
  }
  s.setAgentOpen = setAgentOpen;
  window.__tbEditorChrome = {
    enableAgentToggle() {
      const group = document.getElementById("agent-rail-group");
      const btn = document.getElementById("toggle-agent");
      if (group) group.hidden = false;
      if (btn) btn.hidden = false;
    },
    setAgentOpen,
    isAgentOpen() {
      return root.classList.contains("agent-open");
    },
    openInspector,
    openPage,
    openMedia,
    closePrimary,
    openPanel(panel) {
      const name = String(panel || "").toLowerCase();
      if (name === "media") openMedia();
      else if (name === "info" || name === "page") openPage("info");
      else if (name === "history") openPage("history");
      else openInspector(name === "inspector" ? "section" : name || "section");
      return { panel: name || "section" };
    }
  };
  function refreshAfterStructural(highlightIndex) {
    renderSections();
    renderSectionFields(highlightIndex ?? s.selectedSection);
    renderMeta();
    markDirty();
    return persistPreview(highlightIndex ?? s.selectedSection, "Agent updated preview\u2026");
  }
  s.refreshAfterStructural = refreshAfterStructural;
  function applyLiveLeaf(path, value) {
    const str = value == null ? "" : String(value);
    setByPath(s.draft, path, typeof value === "number" || typeof value === "boolean" ? value : str);
    if (path.startsWith("metadata.")) {
      const patch = documentMetaPatch(path.slice("metadata.".length), str);
      if (patch) postToFrame("setDocumentMeta", patch);
    } else if (/\.(src|href)$/.test(path)) {
      postToFrame("setAttr", { path, attr: path.endsWith(".src") ? "src" : "href", value: str });
    } else {
      postToFrame("setText", { path, value: str });
    }
    markDirty();
    const input = document.getElementById(pathToFieldId(path));
    if (input && "value" in input) input.value = str;
  }
  s.applyLiveLeaf = applyLiveLeaf;
  s.setByPath = setByPath;
  s.getByPath = getByPath;
  s.clearPreviewPersistTimer = clearPreviewPersistTimer;
  window.__tbVisualEditor = createVisualEditorFacade(s);
  window.dispatchEvent(new CustomEvent("tb-visual-editor-ready", { detail: { pageId: boot.id } }));
  syncWebMcpChip();
  window.addEventListener("tb-webmcp-ready", syncWebMcpChip);
  setTimeout(syncWebMcpChip, 100);
  setTimeout(syncWebMcpChip, 500);
}
export {
  bootEditor
};
