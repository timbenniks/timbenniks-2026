/** Pages overview: expandable hub panels with lazy content lists. */

import { apiFetch } from './lib/api.js';
import {
  clearEntryDraft,
  getEntryDraft,
  listEntryDrafts,
  setEntryDraft,
  type EntryDraftRecord,
} from './lib/draft-store.js';
import type { AdminContentItem, ListHubContentResult } from '../lib/admin/content-index';

const PAGE_SIZE = 20;

const KIND_FOR_SOURCE: Record<string, AdminContentItem['kind']> = {
  writing: 'article',
  speaking: 'talk',
  videos: 'video',
  projects: 'project',
};

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
    const editable = panel.dataset.editable === '1';
    const drafts = editable ? await listEntryDrafts(source) : [];
    const draftById = new Map(drafts.map((d) => [d.id, d]));

    // New entries only exist as local drafts until published: list them first.
    if (reset && !state.q) {
      for (const d of drafts.filter((d) => d.isNew)) {
        list.appendChild(
          renderItem(
            { kind: KIND_FOR_SOURCE[source] ?? 'talk', id: d.id, title: d.title || d.id, meta: 'Not published yet' },
            source,
            { draft: d, editable },
          ),
        );
      }
    }

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

    const effectiveOrder = (item: AdminContentItem): number => {
      const o = draftById.get(item.id)?.data.order;
      return typeof o === 'number' ? o : (item.order ?? 999);
    };
    if (source === 'projects') {
      items.sort((a, b) => effectiveOrder(a) - effectiveOrder(b) || a.title.localeCompare(b.title));
    }
    for (const item of items) {
      const li = renderItem(item, source, { draft: draftById.get(item.id), editable });
      if (source === 'projects' && editable && !state.q) {
        li.dataset.order = String(effectiveOrder(item));
        li.dataset.publishedOrder = String(item.order ?? 999);
        addReorderButtons(li, list);
      }
      list.appendChild(li);
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
    const drafts = panel.dataset.editable === '1' ? await listEntryDrafts('videos') : [];
    const draftById = new Map(drafts.map((d) => [d.id, d]));
    for (const d of drafts.filter((d) => d.isNew && d.data.playlist === playlistId)) {
      nested.appendChild(
        renderItem({ kind: 'video', id: d.id, title: d.title || d.id, meta: 'Not published yet' }, source, {
          nested: true,
          draft: d,
          editable: true,
        }),
      );
    }
    if (items.length === 0 && nested.childElementCount === 0) {
      const empty = document.createElement('li');
      empty.className = 'child-empty';
      empty.textContent = 'No videos';
      nested.appendChild(empty);
    } else {
      for (const item of items) {
        nested.appendChild(
          renderItem(item, source, { nested: true, draft: draftById.get(item.id), editable: panel.dataset.editable === '1' }),
        );
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

function renderItem(
  item: AdminContentItem,
  source: string,
  opts: { nested?: boolean; draft?: EntryDraftRecord | undefined; editable?: boolean } = {},
) {
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

  if (opts.draft) {
    const chip = document.createElement('span');
    const deleting = opts.draft.op === 'delete';
    chip.className = deleting ? 'chip error' : 'chip dirty';
    chip.dataset.draftChip = '1';
    chip.textContent = deleting ? 'Delete staged' : opts.draft.isNew ? 'New draft' : 'Local draft';
    chip.title = 'Publish from Changes';
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
    if (!opts.editable) edit.title = 'Editing coming soon';
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

/** Up/down buttons on a project row. Moving renumbers every project 1..n and stages the changed `order` values as drafts. */
function addReorderButtons(li: HTMLElement, list: Element) {
  const actions = li.querySelector('.child-actions');
  if (!actions) return;
  const wrap = document.createElement('span');
  wrap.className = 'reorder';
  for (const [dir, label] of [
    [-1, '↑'],
    [1, '↓'],
  ] as const) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ghost';
    btn.textContent = label;
    btn.title = dir < 0 ? 'Move up' : 'Move down';
    btn.setAttribute('aria-label', btn.title);
    btn.addEventListener('click', () => void moveProject(li, list, dir));
    wrap.appendChild(btn);
  }
  actions.prepend(wrap);
}

async function moveProject(li: HTMLElement, list: Element, dir: -1 | 1) {
  const sibling = dir < 0 ? li.previousElementSibling : li.nextElementSibling;
  if (!(sibling instanceof HTMLElement) || !sibling.dataset.order) return;
  if (dir < 0) list.insertBefore(li, sibling);
  else list.insertBefore(sibling, li);

  const rows = [...list.querySelectorAll<HTMLElement>(':scope > .child-row[data-order]')];
  for (const [i, row] of rows.entries()) {
    const order = i + 1;
    if (Number(row.dataset.order) === order) continue;
    row.dataset.order = String(order);
    const id = row.dataset.id ?? '';
    const title = row.querySelector('.child-title')?.textContent ?? id;
    const existing = await getEntryDraft('projects', id);
    if (existing?.op === 'delete') continue;
    const data = { ...(existing?.data ?? {}), order };
    const onlyOrder = Object.keys(data).length === 1 && !existing?.body;
    if (onlyOrder && !existing?.isNew && Number(row.dataset.publishedOrder) === order) {
      await clearEntryDraft('projects', id);
      setRowChip(row, null);
      continue;
    }
    await setEntryDraft({
      collection: 'projects',
      id,
      isNew: existing?.isNew ?? false,
      path: existing?.path,
      op: 'upsert',
      title,
      data,
      body: existing?.body,
    });
    setRowChip(row, existing?.isNew ? 'New draft' : 'Local draft');
  }
}

function setRowChip(row: HTMLElement, text: string | null) {
  const titleRow = row.querySelector('.child-title-row');
  let chip = titleRow?.querySelector<HTMLElement>('.chip[data-draft-chip]');
  if (!text) {
    chip?.remove();
    return;
  }
  if (!chip && titleRow) {
    chip = document.createElement('span');
    chip.className = 'chip dirty';
    chip.dataset.draftChip = '1';
    chip.title = 'Publish from Changes';
    titleRow.appendChild(chip);
  }
  if (chip) chip.textContent = text;
}
