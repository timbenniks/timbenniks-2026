// Generated from src/admin-client by `npm run build:admin` — do not edit.
function bindStatus(el, opts = {}) {
  const baseClass = opts.baseClass || "status";
  return function setStatus(msg, cls = "") {
    if (!el) return;
    let msgEl = el.querySelector(":scope > .status-msg");
    if (!msgEl) {
      msgEl = document.createElement("span");
      msgEl.className = "status-msg";
      msgEl.setAttribute("role", "status");
      msgEl.setAttribute("aria-live", "polite");
      for (const child of [...el.childNodes]) {
        if (child.nodeType === Node.TEXT_NODE) child.remove();
      }
      el.prepend(msgEl);
    }
    const changed = msgEl.textContent !== msg;
    msgEl.textContent = msg;
    msgEl.title = msg;
    el.className = `${baseClass} ${cls}`.trim();
    if (!changed) return;
    el.classList.remove("is-fresh");
    void el.offsetWidth;
    el.classList.add("is-fresh");
  };
}
function bindChip(el) {
  return function setChip(text, cls = "") {
    if (!el) return;
    el.textContent = text;
    el.className = `chip ${cls}`.trim();
  };
}
function bindStateChip(el, labels = {}) {
  const L = {
    dirty: "Unsaved",
    ok: "Draft saved",
    error: "Error",
    saving: "Saving\u2026",
    ...labels
  };
  return function setChip(state) {
    if (!el) return;
    el.className = "chip";
    el.dataset.state = state;
    if (state === "dirty") {
      el.classList.add("dirty");
      el.textContent = L.dirty;
    } else if (state === "ok" || state === "saved") {
      el.classList.add("ok");
      el.textContent = L.ok;
    } else if (state === "error") {
      el.classList.add("error");
      el.textContent = L.error;
    } else if (state === "saving") {
      el.textContent = L.saving;
    } else {
      el.classList.add("ok");
      el.textContent = L.ok;
    }
  };
}
export {
  bindChip,
  bindStateChip,
  bindStatus
};
