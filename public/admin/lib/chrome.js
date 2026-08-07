/**
 * Shared status line + chip helpers for admin pages.
 */

/** @param {HTMLElement | null} el @param {{ baseClass?: string }} [opts] */
export function bindStatus(el, opts = {}) {
  const baseClass = opts.baseClass || 'status';
  return function setStatus(msg, cls = '') {
    if (!el) return;
    el.textContent = msg;
    el.className = `${baseClass} ${cls}`.trim();
  };
}

/** Text + optional class chip (Changes desk). */
export function bindChip(el) {
  return function setChip(text, cls = '') {
    if (!el) return;
    el.textContent = text;
    el.className = `chip ${cls}`.trim();
  };
}

/**
 * Semantic state chip (site editor + page editor dirty/saved).
 * @param {HTMLElement | null} el
 * @param {Record<string, string>} [labels]
 */
export function bindStateChip(el, labels = {}) {
  const L = {
    dirty: 'Unsaved',
    ok: 'Saved on cms',
    saved: 'Saved on cms',
    error: 'Error',
    saving: 'Saving…',
    ...labels,
  };
  return function setChip(state) {
    if (!el) return;
    el.className = 'chip';
    el.dataset.state = state;
    if (state === 'dirty') {
      el.classList.add('dirty');
      el.textContent = L.dirty;
    } else if (state === 'ok' || state === 'saved') {
      el.classList.add('ok');
      el.textContent = L.ok;
    } else if (state === 'error') {
      el.classList.add('error');
      el.textContent = L.error;
    } else if (state === 'saving') {
      el.textContent = L.saving;
    } else {
      el.classList.add('ok');
      el.textContent = L.ok;
    }
  };
}
