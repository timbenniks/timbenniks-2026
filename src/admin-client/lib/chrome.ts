/**
 * Shared status line + chip helpers for admin pages.
 */

export type StatusTone = '' | 'ok' | 'error' | 'warn';

export type SetStatus = (msg: string, cls?: StatusTone) => void;

export function bindStatus(el: HTMLElement | null, opts: { baseClass?: string } = {}): SetStatus {
  const baseClass = opts.baseClass || 'status';
  return function setStatus(msg, cls = '') {
    if (!el) return;
    el.textContent = msg;
    el.className = `${baseClass} ${cls}`.trim();
  };
}

/** Text + optional class chip (Changes desk). */
export function bindChip(el: HTMLElement | null): (text: string, cls?: string) => void {
  return function setChip(text, cls = '') {
    if (!el) return;
    el.textContent = text;
    el.className = `chip ${cls}`.trim();
  };
}

export type ChipState = 'dirty' | 'ok' | 'saved' | 'error' | 'saving';

/**
 * Semantic state chip (site editor + page editor dirty/saved).
 */
export function bindStateChip(
  el: HTMLElement | null,
  labels: Partial<Record<'dirty' | 'ok' | 'error' | 'saving', string>> = {},
): (state: ChipState) => void {
  const L = {
    dirty: 'Unsaved',
    ok: 'Draft saved',
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
