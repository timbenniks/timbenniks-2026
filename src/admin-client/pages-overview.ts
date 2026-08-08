/** Pages overview: expandable hub panels with lazy content lists. */

import { apiFetch } from './lib/api.js';
import type { AdminContentItem, ListHubContentResult } from '../lib/admin/content-index';

const PAGE_SIZE = 20;

interface PanelState {
  q: string;
  offset: number;
  total: number;
  loaded: boolean;
  loading: boolean;
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : '';
}

export function initPagesOverview(root: HTMLElement | null) {
  if (!root) return;

  root.querySelectorAll('.page-group').forEach((group) => {
    const expandBtn = group.querySelector('[data-expand]');
    const panel = group.querySelector<HTMLElement>('.child-panel');
    if (!expandBtn || !panel) return;

    const state: PanelState = { q: '', offset: 0, total: 0, loaded: false, loading: false };

    expandBtn.addEventListener('click', () => {
      const open = panel.hidden;
      panel.hidden = !open;
      expandBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      group.classList.toggle('is-open', open);
      if (open && !state.loaded) {
        void load(panel, state, true);
      }
    });

    const search = panel.querySelector<HTMLInputElement>('[data-search]');
    let debounce: ReturnType<typeof setTimeout> | undefined;
    search?.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        state.q = search.value.trim();
        void load(panel, state, true);
      }, 220);
    });

    panel.querySelector('[data-more]')?.addEventListener('click', () => {
      void load(panel, state, false);
    });

    panel.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const playlistBtn = target.closest('[data-playlist-expand]');
      if (!playlistBtn) return;
      event.preventDefault();
      const row = playlistBtn.closest<HTMLElement>('.child-row');
      if (!row) return;
      void togglePlaylist(panel, row, playlistBtn);
    });
  });
}

async function load(panel: HTMLElement, state: PanelState, reset: boolean) {
  if (state.loading) return;
  const source = panel.dataset.source;
  if (!source) return;

  const list = panel.querySelector('[data-list]');
  const footer = panel.querySelector<HTMLElement>('[data-footer]');
  const status = panel.querySelector('[data-status]');
  if (!list || !footer) return;

  if (reset) {
    state.offset = 0;
    list.replaceChildren();
  }

  state.loading = true;
  if (status) status.textContent = 'Loading…';

  try {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(state.offset),
    });
    if (state.q) params.set('q', state.q);

    const data = await apiFetch<ListHubContentResult>(`/api/admin/content/${source}?${params}`, {
      errorMessage: 'Failed to load content',
    });

    const items = Array.isArray(data.items) ? data.items : [];
    state.total = Number(data.total) || 0;
    state.loaded = true;
    state.offset += items.length;

    for (const item of items) {
      list.appendChild(renderItem(item, source));
    }

    const remaining = state.total - state.offset;
    footer.hidden = remaining <= 0;
    if (status) {
      status.textContent =
        state.total === 0
          ? 'No matches'
          : `Showing ${state.offset} of ${state.total}`;
    }
  } catch (err) {
    if (status) status.textContent = errText(err) || 'Load failed';
  } finally {
    state.loading = false;
  }
}

async function togglePlaylist(panel: HTMLElement, row: HTMLElement, btn: Element) {
  const source = panel.dataset.source;
  const playlistId = row.dataset.id;
  if (!source || !playlistId) return;

  let nested = row.querySelector<HTMLElement>('.playlist-children');
  const expanded = btn.getAttribute('aria-expanded') === 'true';

  if (expanded) {
    btn.setAttribute('aria-expanded', 'false');
    if (nested) nested.hidden = true;
    row.classList.remove('is-playlist-open');
    return;
  }

  if (!nested) {
    nested = document.createElement('ul');
    nested.className = 'playlist-children';
    nested.setAttribute('data-playlist-list', '');
    row.appendChild(nested);
  }

  btn.setAttribute('aria-expanded', 'true');
  row.classList.add('is-playlist-open');
  nested.hidden = false;

  if (nested.dataset.loaded === '1') return;

  nested.replaceChildren();
  const loading = document.createElement('li');
  loading.className = 'child-empty';
  loading.textContent = 'Loading…';
  nested.appendChild(loading);

  try {
    const params = new URLSearchParams({
      playlist: playlistId,
      limit: '100',
      offset: '0',
    });
    const search = panel.querySelector('[data-search]');
    const q = search instanceof HTMLInputElement ? search.value.trim() : '';
    if (q) params.set('q', q);

    const data = await apiFetch<ListHubContentResult>(`/api/admin/content/${source}?${params}`, {
      errorMessage: 'Failed to load playlist',
    });
    nested.replaceChildren();
    const items = Array.isArray(data.items) ? data.items : [];
    if (items.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'child-empty';
      empty.textContent = 'No videos';
      nested.appendChild(empty);
    } else {
      for (const item of items) {
        nested.appendChild(renderItem(item, source, { nested: true }));
      }
    }
    nested.dataset.loaded = '1';
  } catch (err) {
    nested.replaceChildren();
    const fail = document.createElement('li');
    fail.className = 'child-empty';
    fail.textContent = errText(err) || 'Load failed';
    nested.appendChild(fail);
  }
}

function renderItem(item: AdminContentItem, source: string, opts: { nested?: boolean } = {}) {
  const li = document.createElement('li');
  li.className = opts.nested ? 'child-row is-nested' : 'child-row';
  li.dataset.kind = item.kind || '';
  li.dataset.id = item.id || '';

  const main = document.createElement('div');
  main.className = 'child-row-main';

  if (item.kind === 'playlist') {
    const expand = document.createElement('button');
    expand.type = 'button';
    expand.className = 'playlist-expand';
    expand.setAttribute('data-playlist-expand', '');
    expand.setAttribute('aria-expanded', 'false');
    expand.title = 'Show videos';
    expand.innerHTML =
      '<svg class="icon chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4l4 4-4 4" /></svg>';
    main.appendChild(expand);
  }

  const text = document.createElement('div');
  text.className = 'child-text';

  const titleRow = document.createElement('div');
  titleRow.className = 'child-title-row';

  const title = document.createElement('span');
  title.className = 'child-title';
  title.textContent = item.title || item.id || 'Untitled';
  titleRow.appendChild(title);

  if (item.draft) {
    const chip = document.createElement('span');
    chip.className = 'chip dirty';
    chip.textContent = 'Draft';
    titleRow.appendChild(chip);
  }

  if (item.kind === 'playlist' && item.childCount != null) {
    const chip = document.createElement('span');
    chip.className = 'count-badge';
    chip.textContent = String(item.childCount);
    titleRow.appendChild(chip);
  }

  text.appendChild(titleRow);

  const metaParts = [];
  if (item.date) metaParts.push(item.date);
  if (item.meta) metaParts.push(item.meta);
  if (metaParts.length) {
    const meta = document.createElement('div');
    meta.className = 'child-meta';
    meta.textContent = metaParts.join(' · ');
    text.appendChild(meta);
  }

  main.appendChild(text);
  li.appendChild(main);

  const actions = document.createElement('div');
  actions.className = 'child-actions';

  if (item.href) {
    const view = document.createElement('a');
    view.className = 'child-view';
    view.href = item.href;
    view.target = item.external ? '_blank' : '_self';
    view.rel = item.external ? 'noopener noreferrer' : '';
    view.textContent = item.external ? 'Open' : 'View';
    actions.appendChild(view);
  }

  const editKind = editKindFor(item.kind, source);
  if (editKind && item.kind !== 'playlist') {
    const edit = document.createElement('a');
    edit.className = 'child-edit';
    edit.href = `/admin/content/${editKind}/${item.id}`;
    edit.title = 'Editing coming soon';
    edit.textContent = 'Edit';
    actions.appendChild(edit);
  }

  li.appendChild(actions);
  return li;
}

function editKindFor(kind: string, source: string): string | null {
  if (kind === 'article') return 'writing';
  if (kind === 'video') return 'videos';
  if (kind === 'talk') return 'speaking';
  if (kind === 'project') return 'projects';
  if (kind === 'playlist') return null;
  return source || null;
}
