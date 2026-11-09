/**
 * Generic form editor for Markdown collection entries (talks first; projects,
 * videos and articles reuse it with their own field definitions).
 *
 * Save validates against the server schema and stores a local draft in
 * IndexedDB. Nothing reaches Git until the draft is published from Changes.
 */
import { apiFetch } from './lib/api.js';
import { escapeAttr, escapeHtml } from './lib/utils.js';
import { bindStatus, bindStateChip } from './lib/chrome.js';
import {
  clearEntryDraft,
  getEntryDraft,
  setEntryDraft,
  type EntryDraftRecord,
} from './lib/draft-store.js';
import type { EntryCollectionDefJson, EntryFieldDef } from '../lib/admin/entry-fields';
import type { EntryRecord } from '../lib/admin/entries-store';

/** `data-initial` on #app, serialized by src/pages/admin/content/[kind]/[...id].astro. */
interface EntryBoot {
  collection: string;
  /** null on /new. */
  id: string | null;
  def: EntryCollectionDefJson;
  /** Published entry, or null when new / only a local draft. */
  entry: EntryRecord | null;
  loadError: string | null;
}

interface PreviewResponse {
  ok: boolean;
  files: Array<{ path: string; before: string | null; after: string | null }>;
}

interface ProposeResponse {
  ok: boolean;
  id: string;
  path: string;
}

type FormData = Record<string, unknown>;

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const root = document.getElementById('app');
if (!root) throw new Error('[tb-entry-editor] Missing #app');

let boot: EntryBoot;
try {
  boot = JSON.parse(root.dataset.initial || 'null') as EntryBoot;
} catch (err) {
  root.innerHTML = '<p class="status error">Editor failed to boot: invalid payload.</p>';
  throw err;
}

const { def, collection } = boot;
const saveBtn = document.querySelector<HTMLButtonElement>('#save');
const setChip = bindStateChip(document.getElementById('chip'), { ok: 'Saved', dirty: 'Unsaved' });

let entryId: string | null = boot.id;
let newPath: string | undefined;
let isNew = boot.id === null;
let draft: EntryDraftRecord | null = null;
let lastSaved = '';
let setStatus: ReturnType<typeof bindStatus> = () => undefined;

const published: FormData = boot.entry?.data ?? {};

// —— Field rendering ——————————————————————————————————————————————————————

function fieldId(field: EntryFieldDef): string {
  return `f-${field.key}`;
}

function asString(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

function renderField(field: EntryFieldDef, value: unknown): string {
  const id = fieldId(field);
  const req = field.required ? ' <span class="req" aria-hidden="true">*</span>' : '';
  const label = `<label for="${id}">${escapeHtml(field.label)}${req}</label>`;
  const hint = field.hint ? `<p class="field-hint">${escapeHtml(field.hint)}</p>` : '';
  const ph = field.placeholder ? ` placeholder="${escapeAttr(field.placeholder)}"` : '';
  const required = field.required ? ' required' : '';
  const cls = `field${field.span === 'full' ? ' field-span' : ''}`;
  let control = '';

  switch (field.type) {
    case 'text':
    case 'url':
      control = `<input id="${id}" type="${field.type === 'url' ? 'url' : 'text'}" value="${escapeAttr(asString(value))}"${ph}${required} autocomplete="off" />`;
      break;
    case 'date':
      control = `<input id="${id}" type="date" value="${escapeAttr(asString(value).slice(0, 10))}"${required} />`;
      break;
    case 'textarea':
      control = `<textarea id="${id}" rows="3"${ph}${required}>${escapeHtml(asString(value))}</textarea>`;
      break;
    case 'select': {
      const current = asString(value);
      const opts = (field.options ?? [])
        .map(
          (o) =>
            `<option value="${escapeAttr(o.value)}"${o.value === current ? ' selected' : ''}>${escapeHtml(o.label)}</option>`,
        )
        .join('');
      const unknown =
        current && !(field.options ?? []).some((o) => o.value === current)
          ? `<option value="${escapeAttr(current)}" selected>${escapeHtml(current)}</option>`
          : '';
      control = `<select id="${id}"${required}><option value="">—</option>${opts}${unknown}</select>`;
      break;
    }
    case 'tags': {
      const selected = Array.isArray(value) ? value.map(String) : [];
      const known = new Set((field.options ?? []).map((o) => o.value));
      const chips = [
        ...(field.options ?? []),
        ...selected.filter((v) => !known.has(v)).map((v) => ({ value: v, label: `${v} (not canonical)` })),
      ]
        .map(
          (o) => `<label class="tag-chip">
            <input type="checkbox" data-tag value="${escapeAttr(o.value)}"${selected.includes(o.value) ? ' checked' : ''} />
            <span>${escapeHtml(o.label)}</span>
          </label>`,
        )
        .join('');
      return `<fieldset class="${cls} tag-field" id="${id}"><legend>${escapeHtml(field.label)}</legend>${hint}<div class="tag-chips">${chips}</div></fieldset>`;
    }
    case 'url-list': {
      const lines = Array.isArray(value) ? value.map(String).join('\n') : '';
      control = `<textarea id="${id}" rows="3" class="mono" placeholder="https://">${escapeHtml(lines)}</textarea>`;
      break;
    }
  }
  return `<div class="${cls}">${label}${control}${hint}</div>`;
}

/** Read the form back into frontmatter values. Empty values mean “remove the key”. */
function collect(): FormData {
  const out: FormData = {};
  for (const field of def.fields) {
    const el = document.getElementById(fieldId(field));
    if (!el) continue;
    switch (field.type) {
      case 'tags':
        out[field.key] = [...el.querySelectorAll<HTMLInputElement>('input[data-tag]:checked')].map(
          (c) => c.value,
        );
        break;
      case 'url-list':
        out[field.key] = (el as HTMLTextAreaElement).value
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        break;
      case 'date': {
        const v = (el as HTMLInputElement).value;
        // Keep a published timestamp (e.g. 2025-10-04T20:37:36Z) when the day is unchanged.
        const prev = asString(published[field.key]);
        out[field.key] = v && prev.startsWith(v) ? prev : v;
        break;
      }
      default:
        out[field.key] = (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value.trim();
    }
  }
  return out;
}

function missingRequired(data: FormData): string[] {
  return def.fields
    .filter((f) => f.required)
    .filter((f) => {
      const v = data[f.key];
      return v === undefined || v === null || (typeof v === 'string' && !v.trim());
    })
    .map((f) => f.label);
}

function titleOf(data: FormData): string {
  return asString(data[def.titleKey]) || entryId || `Untitled ${def.singular}`;
}

// —— Layout ————————————————————————————————————————————————————————————————

function stateLabel(): string {
  if (draft?.op === 'delete') return 'Staged for deletion';
  if (isNew) return draft ? 'New · local draft' : 'New · not saved';
  if (draft) return 'Published · local draft';
  return 'Published';
}

function renderInfo(): string {
  const path = boot.entry?.path ?? draft?.path ?? newPath ?? '—';
  return `
    <dl class="entry-info">
      <dt>Status</dt><dd id="entry-state">${escapeHtml(stateLabel())}</dd>
      <dt>File</dt><dd class="mono">${escapeHtml(path)}</dd>
      ${entryId && !isNew ? `<dt>Id</dt><dd class="mono">${escapeHtml(entryId)}</dd>` : ''}
    </dl>
    <div class="entry-side-actions">
      ${isNew ? '' : `<a class="btn-secondary" href="${escapeAttr(def.viewHref)}" target="_blank" rel="noopener">View on site</a>`}
      <button type="button" class="ghost" id="discard" ${draft ? '' : 'hidden'}>Discard draft</button>
      ${isNew ? '' : `<button type="button" class="ghost danger" id="delete" ${draft?.op === 'delete' ? 'hidden' : ''}>Delete ${escapeHtml(def.singular)}</button>`}
    </div>
  `;
}

function render(values: FormData) {
  const heading = isNew && !draft ? `New ${def.singular}` : titleOf(values);
  const deleting = draft?.op === 'delete';
  root!.innerHTML = `
    <p class="crumbs"><a href="/admin">Pages</a> / <span>${escapeHtml(def.plural)}</span></p>
    <div class="dash-intro">
      <h2>${escapeHtml(heading)}</h2>
      <p><strong>Save</strong> keeps a local draft in this browser. Publish it from <a href="/admin/changes">Changes</a> — that commits the file and redeploys the site.</p>
    </div>
    <p class="status" id="status"></p>
    ${
      deleting
        ? `<div class="changes-banner is-warn entry-delete-banner">This ${escapeHtml(def.singular)} is staged for deletion. It is removed when you publish from Changes.
            <button type="button" class="ghost" id="undo-delete">Undo</button></div>`
        : ''
    }
    <div class="entry-layout">
      <form class="panel entry-form" id="entry-form" novalidate ${deleting ? 'inert' : ''}>
        <div class="entry-grid">${def.fields.map((f) => renderField(f, values[f.key])).join('')}</div>
      </form>
      <aside class="panel entry-side" id="entry-side">${renderInfo()}</aside>
    </div>
  `;
  setStatus = bindStatus(document.getElementById('status'));
  bind();
  lastSaved = JSON.stringify(collect());
  setDirty(false);
}

function refreshSide() {
  const side = document.getElementById('entry-side');
  if (!side) return;
  side.innerHTML = renderInfo();
  bindSide();
}

function setDirty(dirty: boolean) {
  if (saveBtn) saveBtn.disabled = !dirty || draft?.op === 'delete';
  setChip(dirty ? 'dirty' : 'ok');
}

function isDirty(): boolean {
  return JSON.stringify(collect()) !== lastSaved;
}

// —— Actions ————————————————————————————————————————————————————————————————

async function save() {
  if (draft?.op === 'delete') return;
  const data = collect();
  const missing = missingRequired(data);
  if (missing.length) {
    setStatus(`Required: ${missing.join(', ')}`, 'error');
    return;
  }

  if (saveBtn) saveBtn.disabled = true;
  setChip('saving');
  try {
    if (isNew && !entryId) {
      const proposed = await apiFetch<ProposeResponse>(`/api/admin/entries/${collection}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
        errorMessage: 'Could not name the new file',
      });
      entryId = proposed.id;
      newPath = proposed.path;
    }

    const op = isNew
      ? { collection, op: 'upsert' as const, path: newPath ?? draft?.path, data }
      : { collection, op: 'upsert' as const, id: entryId, data };
    const preview = await apiFetch<PreviewResponse>('/api/admin/entries/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: [op] }),
      errorMessage: 'Validation failed',
    });

    const file = preview.files[0];
    if (!isNew && file && file.before === file.after) {
      // Back to the published version: nothing to stage.
      await clearEntryDraft(collection, entryId!);
      draft = null;
      setStatus('No changes compared to the published version.', 'ok');
    } else {
      draft = await setEntryDraft({
        collection,
        id: entryId!,
        isNew,
        path: isNew ? (newPath ?? draft?.path) : undefined,
        op: 'upsert',
        title: titleOf(data),
        data,
      });
      setStatus('Draft saved. Publish it from Changes when ready.', 'ok');
    }

    if (isNew && location.pathname.endsWith('/new')) {
      history.replaceState(null, '', `/admin/content/${collection}/${encodeURIComponent(entryId!)}`);
    }
    lastSaved = JSON.stringify(data);
    setDirty(false);
    const h2 = root!.querySelector('.dash-intro h2');
    if (h2) h2.textContent = titleOf(data);
    refreshSide();
  } catch (err) {
    setChip('error');
    setStatus(errText(err), 'error');
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function stageDelete() {
  if (!entryId || isNew) return;
  if (!confirm(`Delete “${titleOf(published)}”? It is removed from the site when you publish from Changes.`)) {
    return;
  }
  draft = await setEntryDraft({
    collection,
    id: entryId,
    isNew: false,
    op: 'delete',
    title: titleOf(published),
    data: {},
  });
  render(published);
  setStatus('Staged for deletion. Publish from Changes to remove it.', 'ok');
}

async function discard() {
  if (!entryId || !draft) return;
  const message = isNew
    ? 'Discard this new draft? It has not been published, so it will be gone.'
    : 'Discard your local changes and go back to the published version?';
  if (!confirm(message)) return;
  await clearEntryDraft(collection, entryId);
  draft = null;
  if (isNew) {
    location.href = '/admin';
    return;
  }
  render(published);
  setStatus('Draft discarded.', 'ok');
}

function bindSide() {
  document.getElementById('delete')?.addEventListener('click', () => void stageDelete());
  document.getElementById('discard')?.addEventListener('click', () => void discard());
}

function bind() {
  const form = document.getElementById('entry-form');
  form?.addEventListener('input', () => setDirty(isDirty()));
  form?.addEventListener('change', () => setDirty(isDirty()));
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    void save();
  });
  document.getElementById('undo-delete')?.addEventListener('click', async () => {
    if (!entryId) return;
    await clearEntryDraft(collection, entryId);
    draft = null;
    render(published);
    setStatus('Deletion undone.', 'ok');
  });
  bindSide();
}

saveBtn?.addEventListener('click', () => void save());
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    if (saveBtn && !saveBtn.disabled) void save();
  }
});
window.addEventListener('beforeunload', (e) => {
  if (saveBtn && !saveBtn.disabled) e.preventDefault();
});

// —— Boot ——————————————————————————————————————————————————————————————————

async function init() {
  if (boot.loadError) {
    root!.innerHTML = `<p class="status error">Could not load this ${escapeHtml(def.singular)}: ${escapeHtml(boot.loadError)}</p>`;
    return;
  }
  if (entryId) {
    draft = await getEntryDraft(collection, entryId);
    if (!boot.entry) {
      if (!draft) {
        root!.innerHTML = `<div class="dash-intro"><h2>Not found</h2><p>No ${escapeHtml(def.singular)} with id <code>${escapeHtml(entryId)}</code> on main, and no local draft. <a href="/admin">Back to Pages</a></p></div>`;
        if (saveBtn) saveBtn.hidden = true;
        return;
      }
      isNew = true;
      newPath = draft.path;
    }
  }
  const values = draft?.op === 'upsert' ? { ...published, ...draft.data } : published;
  render(values);
  if (draft?.op === 'upsert') setStatus('Showing your local draft. Publish it from Changes when ready.', 'ok');
  else if (isNew) setStatus(`Fill in the ${def.singular} and Save to keep a local draft.`);
}

void init();
