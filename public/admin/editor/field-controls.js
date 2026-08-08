// Generated from src/admin-client by `npm run build:admin` — do not edit.
import { icon } from "../lib/icons.js";
import { getByPath, setByPath } from "../lib/utils.js";
import { CANONICAL_TAG_OPTIONS, PLAYLIST_OPTIONS } from "./catalog.js";
import { openMediaPickerModal } from "./media-picker.js";
import { fieldLabel, humanizePath, pathToFieldId } from "./paths.js";
function errorText(err) {
  return err instanceof Error && err.message ? err.message : String(err);
}
function createFieldControls(s) {
  function coerceFieldValue(def, raw) {
    if (def.type === "number" || def.coerce === "number") {
      const n = Number(raw);
      return Number.isFinite(n) ? n : raw;
    }
    if (def.type === "boolean" || def.coerce === "boolean") {
      return raw === true || raw === "true";
    }
    return raw;
  }
  function normalizeOption(opt) {
    if (opt && typeof opt === "object" && "value" in opt) {
      const record = opt;
      return { value: String(record.value), label: String(record.label ?? record.value) };
    }
    return { value: String(opt), label: String(opt) };
  }
  function resolveFieldOptions(def) {
    if (def.optionsFrom === "canonicalTags") {
      const fromBoot = s.boot.canonicalTags;
      if (Array.isArray(fromBoot) && fromBoot.length) {
        return fromBoot.map(normalizeOption);
      }
      return CANONICAL_TAG_OPTIONS.map(normalizeOption);
    }
    if (def.optionsFrom === "playlists") {
      const fromBoot = s.boot.playlists;
      if (Array.isArray(fromBoot) && fromBoot.length) {
        return fromBoot.map(normalizeOption);
      }
      return PLAYLIST_OPTIONS.map(normalizeOption);
    }
    return (def.options || []).map(normalizeOption);
  }
  function deleteByPath(obj, path) {
    const parts = path.split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur == null || typeof cur !== "object") return;
      cur = cur[parts[i]];
    }
    if (cur && typeof cur === "object") delete cur[parts[parts.length - 1]];
  }
  function sectionIndexFromPath(path) {
    const m = String(path).match(/^sections\.(\d+)/);
    return m ? Number(m[1]) : null;
  }
  function shortFieldPath(path) {
    const m = String(path).match(/^sections\.\d+\.(.+)$/);
    return m ? m[1] : path;
  }
  function clearCardGridFiltersForSource(section) {
    if (!section || section.kind !== "card-grid") return false;
    let changed = false;
    const source = section.source;
    if (source !== "writing" && source !== "videos") {
      if ("tags" in section) {
        delete section.tags;
        changed = true;
      }
    }
    if (source !== "videos") {
      if ("playlist" in section) {
        delete section.playlist;
        changed = true;
      }
    }
    return changed;
  }
  function clearSourceDependentFilters(section) {
    let changed = clearCardGridFiltersForSource(section);
    if (section?.kind === "card-rows" && section.source !== "speaking") {
      if (section.window && section.window !== "all") {
        section.window = "all";
        changed = true;
      }
      if (section.hideWhenEmpty) {
        section.hideWhenEmpty = false;
        changed = true;
      }
    }
    return changed;
  }
  function highlightFieldInForm(path) {
    s.sectionFieldsEl?.querySelectorAll(".field.focused").forEach((el) => el.classList.remove("focused"));
    if (!path) return;
    const input = document.getElementById(pathToFieldId(path));
    if (!input) return;
    const wrap = input.closest(".field");
    if (wrap) wrap.classList.add("focused");
  }
  function focusFieldInForm(path) {
    if (!path) return;
    const input = document.getElementById(pathToFieldId(path));
    if (!input) return;
    input.focus({ preventScroll: true });
    input.closest(".field")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    highlightFieldInForm(path);
  }
  function bindLiveInput(input, path, kind) {
    input.addEventListener("focus", () => {
      s.fieldEditCheckpointed = false;
      s.selectedPath = path;
      s.postToFrame("highlight", { path });
      highlightFieldInForm(path);
    });
    input.addEventListener("input", () => {
      if (!s.fieldEditCheckpointed) {
        s.checkpoint();
        s.fieldEditCheckpointed = true;
      }
      const value = input.value;
      if (path.endsWith(".backgroundImage.src") && !String(value || "").trim()) {
        deleteByPath(s.draft, path.replace(/\.src$/, ""));
      } else {
        setByPath(s.draft, path, value);
      }
      s.markDirty();
      if (kind === "image" || path.endsWith(".src")) {
        s.postToFrame("setAttr", { path, attr: "src", value });
      } else {
        s.postToFrame("setText", { path, value });
      }
      s.selectedPath = path;
      s.postToFrame("highlight", { path });
      highlightFieldInForm(path);
      if (/^sections\.\d+\.title$/.test(path)) s.renderSections();
    });
  }
  function applyCloudinaryAsset(path, asset) {
    if (!asset) return;
    const url = asset.secure_url || asset.url;
    if (!url) return;
    s.checkpoint();
    setByPath(s.draft, path, url);
    s.markDirty();
    if (path.endsWith(".src")) {
      const base = path.slice(0, -".src".length);
      if (asset.width != null) setByPath(s.draft, `${base}.width`, asset.width);
      if (asset.height != null) setByPath(s.draft, `${base}.height`, asset.height);
      const altPath = `${base}.alt`;
      const existingAlt = getByPath(s.draft, altPath);
      if ((existingAlt == null || existingAlt === "") && (asset.display_name || asset.public_id)) {
        setByPath(s.draft, altPath, asset.display_name || asset.public_id);
      }
    }
    if (path.endsWith(".src") || path.includes(".image")) {
      s.postToFrame("setAttr", { path, attr: "src", value: url });
      if (asset.width != null) {
        s.postToFrame("setAttr", { path, attr: "width", value: String(asset.width) });
      }
      if (asset.height != null) {
        s.postToFrame("setAttr", { path, attr: "height", value: String(asset.height) });
      }
      s.postToFrame("highlight", { path });
      const match = path.match(/^sections\.(\d+)/);
      const idx = match ? Number(match[1]) : s.selectedSection;
      s.schedulePersistPreview(idx, "Updating image preview\u2026");
    }
    s.selectedPath = path;
  }
  function mountImageUrlField(wrap, path, currentValue) {
    const row = document.createElement("div");
    row.className = "image-field";
    const thumb = document.createElement("div");
    thumb.className = "image-thumb";
    const img = document.createElement("img");
    img.alt = "";
    const syncThumb = (url) => {
      if (url) {
        img.src = url;
        thumb.classList.add("has-image");
        thumb.textContent = "";
        if (!img.isConnected) thumb.appendChild(img);
      } else {
        thumb.classList.remove("has-image");
        img.removeAttribute("src");
        img.remove();
        thumb.textContent = "No image";
      }
    };
    syncThumb(currentValue == null ? "" : String(currentValue));
    const controls = document.createElement("div");
    controls.className = "image-controls";
    const input = document.createElement("input");
    input.type = "url";
    input.id = pathToFieldId(path);
    input.value = currentValue == null ? "" : String(currentValue);
    input.placeholder = "https://res.cloudinary.com/\u2026";
    bindLiveInput(input, path, "image");
    input.addEventListener("input", () => syncThumb(input.value));
    const browse = document.createElement("button");
    browse.type = "button";
    browse.className = "image-browse";
    browse.innerHTML = `${icon("media", "icon icon-sm")} Browse`;
    browse.addEventListener("click", async () => {
      browse.disabled = true;
      s.setStatus("Opening media library\u2026");
      try {
        const asset = await openMediaPickerModal({
          setStatus: s.setStatus,
          getInsertTarget: () => ({ path, label: path })
        });
        if (!asset) {
          s.setStatus("No image selected");
          return;
        }
        applyCloudinaryAsset(path, asset);
        const url = asset.secure_url || asset.url || "";
        input.value = url;
        syncThumb(url);
        const match = path.match(/^sections\.(\d+)/);
        if (match) s.renderSectionFields(Number(match[1]), path);
        else if (path.startsWith("metadata.")) s.renderMeta();
        s.setStatus("Image selected", "ok");
      } catch (err) {
        s.setStatus(errorText(err), "error");
      } finally {
        browse.disabled = false;
      }
    });
    controls.appendChild(input);
    controls.appendChild(browse);
    row.appendChild(thumb);
    row.appendChild(controls);
    wrap.appendChild(row);
    return input;
  }
  function appendFieldControl(container, path, def, opts = {}) {
    const current = getByPath(s.draft, path);
    const sectionIndex = sectionIndexFromPath(path);
    const shortPath = shortFieldPath(path);
    const wrap = document.createElement("div");
    wrap.className = "field";
    if (opts.group) wrap.dataset.group = opts.group;
    const label = def.label || (sectionIndex != null && def.key ? fieldLabel(def, sectionIndex) : humanizePath(path, sectionIndex ?? 0).label);
    if (def.hint) {
      wrap.innerHTML = `<label for="${pathToFieldId(path)}">${label}<span class="field-path">${shortPath}</span></label><p class="field-hint">${def.hint}</p>`;
    } else {
      wrap.innerHTML = `<label for="${pathToFieldId(path)}">${label}<span class="field-path">${shortPath}</span></label>`;
    }
    const isQuery = opts.group === "query";
    const persistMsg = isQuery ? "Updating collection preview\u2026" : "Updating preview\u2026";
    let control;
    const options = resolveFieldOptions(def);
    if (def.type === "multi-select") {
      const selected = Array.isArray(current) ? current.map(String) : [];
      const group = document.createElement("div");
      control = group;
      group.className = "multi-select";
      group.id = pathToFieldId(path);
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", label);
      options.forEach((opt) => {
        const row = document.createElement("label");
        row.className = "multi-select-option";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = opt.value;
        input.checked = selected.includes(opt.value);
        input.addEventListener("change", () => {
          s.checkpoint();
          const next = [...group.querySelectorAll("input:checked")].map(
            (el) => el.value
          );
          if (next.length) setByPath(s.draft, path, next);
          else deleteByPath(s.draft, path);
          s.markDirty();
          s.selectedPath = path;
          if (sectionIndex != null) {
            s.schedulePersistPreview(sectionIndex, persistMsg);
          }
        });
        const span = document.createElement("span");
        span.textContent = opt.label;
        row.appendChild(input);
        row.appendChild(span);
        group.appendChild(row);
      });
      wrap.appendChild(control);
      container.appendChild(wrap);
      return path;
    }
    if (def.type === "boolean") {
      wrap.classList.add("field-boolean");
      wrap.innerHTML = "";
      const row = document.createElement("label");
      row.className = "boolean-option";
      row.htmlFor = pathToFieldId(path);
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = pathToFieldId(path);
      input.checked = current === true;
      input.addEventListener("change", () => {
        s.checkpoint();
        setByPath(s.draft, path, input.checked);
        s.markDirty();
        s.selectedPath = path;
        if (sectionIndex != null) {
          s.schedulePersistPreview(sectionIndex, persistMsg);
        }
      });
      input.addEventListener("focus", () => {
        s.selectedPath = path;
        highlightFieldInForm(path);
      });
      const text = document.createElement("span");
      text.textContent = label;
      row.appendChild(input);
      row.appendChild(text);
      wrap.appendChild(row);
      if (def.hint) {
        const hint = document.createElement("p");
        hint.className = "field-hint";
        hint.textContent = def.hint;
        wrap.appendChild(hint);
      }
      container.appendChild(wrap);
      return path;
    }
    if (def.type === "select") {
      const select = document.createElement("select");
      control = select;
      select.id = pathToFieldId(path);
      if (def.allowEmpty) {
        const empty = document.createElement("option");
        empty.value = "";
        empty.textContent = def.emptyLabel || "Any";
        select.appendChild(empty);
      }
      options.forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        select.appendChild(o);
      });
      select.value = current == null ? "" : String(current);
      select.addEventListener("change", () => {
        s.checkpoint();
        const isSourceField = def.key === "source" || shortPath === "source";
        if (def.allowEmpty && select.value === "") {
          deleteByPath(s.draft, path);
        } else {
          setByPath(s.draft, path, coerceFieldValue(def, select.value));
        }
        if (isSourceField && sectionIndex != null) {
          clearSourceDependentFilters(s.draft.sections[sectionIndex]);
        }
        s.markDirty();
        s.selectedPath = path;
        if (isSourceField && sectionIndex != null) {
          s.renderSectionFields(sectionIndex, path);
        }
        if (sectionIndex != null) {
          s.schedulePersistPreview(sectionIndex, persistMsg);
        }
      });
      select.addEventListener("focus", () => {
        s.selectedPath = path;
        highlightFieldInForm(path);
      });
    } else if (def.type === "number") {
      const number = document.createElement("input");
      control = number;
      number.type = "number";
      number.id = pathToFieldId(path);
      if (def.min != null) number.min = String(def.min);
      if (def.max != null) number.max = String(def.max);
      number.value = current == null ? "" : String(current);
      number.addEventListener("change", () => {
        s.checkpoint();
        if (def.allowEmpty && number.value === "") {
          deleteByPath(s.draft, path);
        } else {
          setByPath(s.draft, path, coerceFieldValue(def, number.value));
        }
        s.markDirty();
        s.selectedPath = path;
        if (sectionIndex != null) {
          s.schedulePersistPreview(sectionIndex, "Updating collection preview\u2026");
        }
      });
      number.addEventListener("focus", () => {
        s.selectedPath = path;
        highlightFieldInForm(path);
      });
    } else if (def.type === "markdown" || def.type === "textarea") {
      const textarea = document.createElement("textarea");
      control = textarea;
      textarea.id = pathToFieldId(path);
      textarea.value = current == null ? "" : String(current);
      if (def.type === "markdown") textarea.classList.add("is-markdown");
      bindLiveInput(textarea, path, "text");
    } else if (def.type === "url" || path.endsWith(".src") || def.key === "src" || def.key && String(def.key).endsWith("src")) {
      mountImageUrlField(wrap, path, current == null ? "" : String(current));
      container.appendChild(wrap);
      return path;
    } else {
      const text = document.createElement("input");
      control = text;
      text.type = "text";
      text.id = pathToFieldId(path);
      text.value = current == null ? "" : String(current);
      bindLiveInput(text, path, "text");
    }
    wrap.appendChild(control);
    container.appendChild(wrap);
    return path;
  }
  function appendFieldsForPath(container, basePath, fields, itemKind) {
    if (itemKind === "string") {
      appendFieldControl(container, basePath, { key: "", type: "text", label: "Label" });
      return;
    }
    (fields || []).forEach((def) => {
      const key = def.key;
      const path = key ? `${basePath}.${key}` : basePath;
      appendFieldControl(container, path, def);
    });
  }
  const appendListItemFields = appendFieldsForPath;
  return {
    coerceFieldValue,
    normalizeOption,
    resolveFieldOptions,
    deleteByPath,
    appendFieldControl,
    applyCloudinaryAsset,
    mountImageUrlField,
    bindLiveInput,
    highlightFieldInForm,
    focusFieldInForm,
    appendFieldsForPath,
    appendListItemFields,
    clearSourceDependentFilters
  };
}
export {
  createFieldControls
};
