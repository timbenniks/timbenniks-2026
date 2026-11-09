/**
 * Generic form editor for Markdown collection entries: talks, projects, videos
 * and articles, each described by a field definition from
 * src/lib/admin/entry-fields.ts.
 *
 * Save validates against the server schema and stores a local draft in
 * IndexedDB. Nothing reaches Git until the draft is published from Changes.
 */
import { apiFetch } from './lib/api.js';
import { escapeAttr, escapeHtml } from './lib/utils.js';
import { bindStatus, bindStateChip } from './lib/chrome.js';
import { clearEntryDraft, getEntryDraft, type EntryDraftRecord } from './lib/draft-store.js';
import { stageEntry, stageEntryDelete } from './lib/entries-client.js';
import { renderAgentMarkdown } from './lib/render-agent-markdown.js';
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

interface YouTubeLookup {
  videoId: string;
  title: string | null;
  image: string;
  warning?: string;
}

type Values = Record<string, unknown>;

const BODY_KEY = '$body';

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
let isNew = boot.id === null;
let draft: EntryDraftRecord | null = null;
let lastSaved = '';
let setStatus: ReturnType<typeof bindStatus> = () => undefined;

const published: Values = boot.entry?.data ?? {};
const publishedBody = boot.entry?.body ?? '';
/** Files start the body with a blank line after `---`; the textarea hides it. */
const bodyLead = !boot.entry || publishedBody.startsWith('\n') ? '\n' : '';

function fieldsFor(): EntryFieldDef[] {
  return def.fields.filter((f) => !f.only || (f.only === 'new') === isNew);
}

// —— Small helpers ————————————————————————————————————————————————————————————

function fieldId(field: EntryFieldDef): string {
  return `f-${field.key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function asString(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function wordCount(text: string): number {
  return (text.match(/[A-Za-z0-9À-ɏ]+(?:['’-][A-Za-z0-9]+)*/g) ?? []).length;
}

function readingTimeFor(body: string): string {
  return `${Math.max(1, Math.round(wordCount(body) / 230))} min read`;
}

function thumb(url: string): string {
  if (!/^https:\/\//.test(url)) return '';
  // Cloudinary: request a small rendition; anything else is shown as-is.
  const small = url.replace(/\/image\/upload\/(?:([^/]*_[^/]*)\/)?/, '/image/upload/c_limit,w_320,f_auto,q_auto/');
  return `<img src="${escapeAttr(small)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`;
}

// —— Field rendering ——————————————————————————————————————————————————————

function faqRow(q = '', a = ''): string {
  return `<div class="faq-row">
    <input data-faq="question" value="${escapeAttr(q)}" placeholder="Question" />
    <textarea data-faq="answer" rows="2" placeholder="Answer">
${escapeHtml(a)}</textarea>
    <div class="faq-actions">
      <button type="button" class="ghost" data-faq-move="-1" title="Move up" aria-label="Move up">↑</button>
      <button type="button" class="ghost" data-faq-move="1" title="Move down" aria-label="Move down">↓</button>
      <button type="button" class="ghost danger" data-faq-remove title="Remove" aria-label="Remove">✕</button>
    </div>
  </div>`;
}

function renderField(field: EntryFieldDef, value: unknown): string {
  const id = fieldId(field);
  const req = field.required ? ' <span class="req" aria-hidden="true">*</span>' : '';
  const label = `<label for="${id}">${escapeHtml(field.label)}${req}</label>`;
  const hint = field.hint ? `<p class="field-hint">${escapeHtml(field.hint)}</p>` : '';
  const ph = field.placeholder ? ` placeholder="${escapeAttr(field.placeholder)}"` : '';
  const required = field.required ? ' required' : '';
  const rows = ` rows="${field.rows ?? 3}"`;
  const cls = `field${field.span === 'full' ? ' field-span' : ''}`;
  let control = '';

  switch (field.type) {
    case 'text': {
      const list = field.suggestions?.length ? ` list="${id}-list"` : '';
      const datalist = field.suggestions?.length
        ? `<datalist id="${id}-list">${field.suggestions.map((s) => `<option value="${escapeAttr(s)}"></option>`).join('')}</datalist>`
        : '';
      control = `<input id="${id}" type="text" value="${escapeAttr(asString(value))}"${ph}${required}${list} autocomplete="off" />${datalist}`;
      break;
    }
    case 'url':
      control = `<input id="${id}" type="url" value="${escapeAttr(asString(value))}"${ph}${required} autocomplete="off" />`;
      break;
    case 'slug':
      control = `<div class="slug-input"><span class="mono">/${escapeHtml(collection)}/</span><input id="${id}" type="text" value="${escapeAttr(asString(value) || entryId || '')}" class="mono" autocomplete="off" ${isNew ? 'data-auto-slug="1"' : ''} /></div>`;
      break;
    case 'number':
      control = `<input id="${id}" type="number" step="1" value="${escapeAttr(asString(value))}"${ph}${required} />`;
      break;
    case 'boolean':
      return `<div class="${cls} field-check"><label class="check"><input id="${id}" type="checkbox" ${value === true ? 'checked' : ''} /> ${escapeHtml(field.label)}</label>${hint}</div>`;
    case 'date':
      control = `<input id="${id}" type="date" value="${escapeAttr(asString(value).slice(0, 10))}"${required} />`;
      break;
    case 'textarea':
      control = `<textarea id="${id}"${rows}${ph}${required}>
${escapeHtml(asString(value))}</textarea>`;
      break;
    case 'markdown': {
      const text = asString(value);
      return `<div class="${cls} md-field">
        <div class="md-head">
          <label for="${id}">${escapeHtml(field.label)}${req}</label>
          <span class="md-meta" data-md-meta>${wordCount(text)} words</span>
          <button type="button" class="ghost" data-md-toggle aria-pressed="false">Preview</button>
        </div>
        <textarea id="${id}" class="mono md-input"${rows}>
${escapeHtml(text)}</textarea>
        <div class="md-preview prose-admin" data-md-preview hidden></div>
        ${hint}
      </div>`;
    }
    case 'image': {
      const url = asString(value);
      return `<div class="${cls} image-field">
        ${label}
        <div class="image-row">
          <div class="image-thumb" data-image-thumb>${thumb(url)}</div>
          <div class="image-controls">
            <input id="${id}" type="url" value="${escapeAttr(url)}" placeholder="https://res.cloudinary.com/…" autocomplete="off" />
            <button type="button" class="btn-secondary-btn" data-image-browse>Browse media…</button>
          </div>
        </div>
        ${hint}
      </div>`;
    }
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
      control = `<textarea id="${id}"${rows} class="mono" placeholder="https://">
${escapeHtml(lines)}</textarea>`;
      break;
    }
    case 'faqs': {
      const items = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
      return `<fieldset class="${cls} faq-field" id="${id}">
        <legend>${escapeHtml(field.label)}</legend>${hint}
        <div class="faq-rows" data-faq-rows>${items.map((it) => faqRow(asString(it.question), asString(it.answer))).join('')}</div>
        <button type="button" class="add-btn subtle" data-faq-add>+ Add question</button>
      </fieldset>`;
    }
  }
  return `<div class="${cls}">${label}${control}${hint}</div>`;
}

// —— Reading the form ———————————————————————————————————————————————————————

/** Read the form back into frontmatter values (+ `$body`). Empty values mean “remove the key”. */
function collect(): Values {
  const out: Values = {};
  for (const field of fieldsFor()) {
    const el = document.getElementById(fieldId(field));
    if (!el) continue;
    const prev = published[field.key];
    switch (field.type) {
      case 'tags': {
        // Keep the published order; newly ticked tags go at the end.
        const checked = [...el.querySelectorAll<HTMLInputElement>('input[data-tag]:checked')].map((c) => c.value);
        const before = Array.isArray(prev) ? prev.map(String) : [];
        out[field.key] = [...before.filter((t) => checked.includes(t)), ...checked.filter((t) => !before.includes(t))];
        break;
      }
      case 'url-list':
        out[field.key] = (el as HTMLTextAreaElement).value
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean);
        break;
      case 'faqs':
        out[field.key] = [...el.querySelectorAll<HTMLElement>('.faq-row')]
          .map((row) => ({
            question: row.querySelector<HTMLInputElement>('[data-faq="question"]')?.value.trim() ?? '',
            answer: row.querySelector<HTMLTextAreaElement>('[data-faq="answer"]')?.value.trim() ?? '',
          }))
          .filter((f) => f.question || f.answer);
        break;
      case 'date': {
        const v = (el as HTMLInputElement).value;
        // Keep a published timestamp (e.g. 2025-10-04T20:37:36Z) when the day is unchanged.
        const prevText = asString(prev);
        out[field.key] = !v ? '' : prevText.startsWith(v) ? prevText : field.timestamp ? `${v}T10:00:00Z` : v;
        break;
      }
      case 'number': {
        const v = (el as HTMLInputElement).value.trim();
        out[field.key] = v === '' ? '' : Number(v);
        break;
      }
      case 'boolean': {
        const checked = (el as HTMLInputElement).checked;
        // Don't add `key: false` to files that never had the key.
        if (checked || prev !== undefined) out[field.key] = checked;
        break;
      }
      case 'markdown': {
        const v = (el as HTMLTextAreaElement).value;
        out[field.key] = v.trim() ? `${bodyLead}${v}` : '';
        break;
      }
      default:
        out[field.key] = (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value.trim();
    }
  }
  if (def.readingTimeKey && !asString(out[def.readingTimeKey]) && typeof out[BODY_KEY] === 'string') {
    out[def.readingTimeKey] = readingTimeFor(out[BODY_KEY] as string);
  }
  return out;
}

function splitBody(values: Values): { data: Values; body: string | undefined } {
  const { [BODY_KEY]: body, ...data } = values;
  return { data, body: typeof body === 'string' ? body : undefined };
}

function missingRequired(values: Values): string[] {
  return fieldsFor()
    .filter((f) => f.required)
    .filter((f) => {
      const v = values[f.key];
      return v === undefined || v === null || (typeof v === 'string' && !v.trim());
    })
    .map((f) => f.label);
}

function titleOf(values: Values): string {
  return asString(values[def.titleKey]) || entryId || `Untitled ${def.singular}`;
}

// —— Layout ————————————————————————————————————————————————————————————————

function stateLabel(): string {
  if (draft?.op === 'delete') return 'Staged for deletion';
  if (isNew) return draft ? 'New · local draft' : 'New · not saved';
  if (draft) return 'Published · local draft';
  if (def.unpublishKey && published[def.unpublishKey] === true) return 'Published file · hidden on site';
  return 'Published';
}

function renderInfo(): string {
  const path = boot.entry?.path ?? draft?.path ?? '—';
  const canUnpublish =
    !isNew && def.unpublishKey && draft?.op !== 'delete' && published[def.unpublishKey] !== true;
  return `
    <dl class="entry-info">
      <dt>Status</dt><dd id="entry-state">${escapeHtml(stateLabel())}</dd>
      <dt>File</dt><dd class="mono">${escapeHtml(path)}</dd>
    </dl>
    <div class="entry-side-actions">
      ${isNew ? '' : `<a class="btn-secondary" href="${escapeAttr(def.viewHref)}" target="_blank" rel="noopener">View on site</a>`}
      <button type="button" class="ghost" id="discard" ${draft ? '' : 'hidden'}>Discard draft</button>
      ${canUnpublish ? `<button type="button" class="ghost" id="unpublish">Hide from site</button>` : ''}
      ${isNew ? '' : `<button type="button" class="ghost danger" id="delete" ${draft?.op === 'delete' ? 'hidden' : ''}>Delete ${escapeHtml(def.singular)}</button>`}
    </div>
  `;
}

function renderYouTube(): string {
  if (!def.youtubeImport || !isNew) return '';
  return `<div class="panel yt-import">
    <label for="yt-url">Fill from YouTube</label>
    <div class="yt-row">
      <input id="yt-url" type="url" placeholder="https://www.youtube.com/watch?v=…" autocomplete="off" />
      <button type="button" id="yt-fill">Fill</button>
    </div>
    <p class="field-hint">Sets the video id, title and thumbnail. Date and duration you add yourself.</p>
  </div>`;
}

function render(values: Values) {
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
      <aside class="panel entry-side" id="entry-side">${renderInfo()}</aside>
      ${renderYouTube()}
      <form class="panel entry-form" id="entry-form" novalidate ${deleting ? 'inert' : ''}>
        <div class="entry-grid">${fieldsFor().map((f) => renderField(f, values[f.key])).join('')}</div>
      </form>
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

function onChange() {
  setDirty(isDirty());
}

// —— Actions ————————————————————————————————————————————————————————————————

async function save() {
  if (draft?.op === 'delete') return;
  const values = collect();
  const missing = missingRequired(values);
  if (missing.length) {
    setStatus(`Required: ${missing.join(', ')}`, 'error');
    return;
  }

  if (saveBtn) saveBtn.disabled = true;
  setChip('saving');
  try {
    const { data, body } = splitBody(values);
    const result = await stageEntry({ collection, id: entryId ?? undefined, data, body, title: titleOf(values) });
    entryId = result.id;
    draft = result.staged ? await getEntryDraft(collection, result.id) : null;

    if (!result.staged) {
      setStatus('No changes compared to the published version.', 'ok');
    } else if (result.file && boot.entry && result.file.path !== boot.entry.path) {
      setStatus(`Draft saved. Publishing moves it to ${result.file.path}${result.file.related?.some((r) => r.path.endsWith('writing-redirects.ts')) ? ' and redirects the old URL' : ''}.`, 'ok');
    } else {
      setStatus('Draft saved. Publish it from Changes when ready.', 'ok');
    }

    if (isNew && location.pathname.endsWith('/new')) {
      history.replaceState(null, '', `/admin/content/${collection}/${entryId.split('/').map(encodeURIComponent).join('/')}`);
    }
    lastSaved = JSON.stringify(values);
    setDirty(false);
    const h2 = root!.querySelector('.dash-intro h2');
    if (h2) h2.textContent = titleOf(values);
    refreshSide();
  } catch (err) {
    setChip('error');
    setStatus(errText(err), 'error');
    if (saveBtn) saveBtn.disabled = false;
  }
}

async function stageDelete() {
  if (!entryId || isNew) return;
  const extra = def.unpublishKey
    ? '\n\nThe file is removed and its URL will 404. Use “Hide from site” instead to keep the file.'
    : '';
  if (!confirm(`Delete “${titleOf(published)}”? It is removed when you publish from Changes.${extra}`)) return;
  await stageEntryDelete(collection, entryId, titleOf(published));
  draft = await getEntryDraft(collection, entryId);
  render(published);
  setStatus('Staged for deletion. Publish from Changes to remove it.', 'ok');
}

async function unpublish() {
  if (!def.unpublishKey) return;
  const el = document.getElementById(fieldId({ key: def.unpublishKey } as EntryFieldDef)) as HTMLInputElement | null;
  if (!el) return;
  el.checked = true;
  await save();
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
  render(withBody(published, publishedBody));
  setStatus('Draft discarded.', 'ok');
}

async function fillFromYouTube() {
  const input = document.getElementById('yt-url') as HTMLInputElement | null;
  if (!input?.value.trim()) return;
  try {
    const data = await apiFetch<YouTubeLookup>(`/api/admin/youtube?url=${encodeURIComponent(input.value.trim())}`, {
      errorMessage: 'YouTube lookup failed',
    });
    const set = (key: string, value: string | null, onlyIfEmpty: boolean) => {
      const el = document.getElementById(`f-${key}`) as HTMLInputElement | null;
      if (!el || !value || (onlyIfEmpty && el.value.trim())) return;
      el.value = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    set('videoId', data.videoId, false);
    set('title', data.title, true);
    set('image', data.image, true);
    setStatus(data.warning ?? 'Filled from YouTube. Add the date, playlist and duration, then Save.', data.warning ? 'warn' : 'ok');
  } catch (err) {
    setStatus(errText(err), 'error');
  }
}

// —— Binding ————————————————————————————————————————————————————————————————

function bindSide() {
  document.getElementById('delete')?.addEventListener('click', () => void stageDelete());
  document.getElementById('discard')?.addEventListener('click', () => void discard());
  document.getElementById('unpublish')?.addEventListener('click', () => void unpublish());
}

function bindImageFields(form: HTMLElement) {
  form.querySelectorAll<HTMLElement>('.image-field').forEach((wrap) => {
    const input = wrap.querySelector<HTMLInputElement>('input[type="url"]');
    const preview = wrap.querySelector<HTMLElement>('[data-image-thumb]');
    input?.addEventListener('input', () => {
      if (preview) preview.innerHTML = thumb(input.value.trim());
    });
    wrap.querySelector('[data-image-browse]')?.addEventListener('click', async () => {
      const { openMediaPickerModal } = await import('./editor/media-picker.js');
      const asset = await openMediaPickerModal({ setStatus: (msg, cls) => msg && setStatus(msg, cls === 'error' ? 'error' : '') });
      const url = asset?.secure_url || asset?.url;
      if (!url || !input) return;
      input.value = url;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });
}

function bindMarkdownFields(form: HTMLElement) {
  form.querySelectorAll<HTMLElement>('.md-field').forEach((wrap) => {
    const input = wrap.querySelector<HTMLTextAreaElement>('textarea');
    const preview = wrap.querySelector<HTMLElement>('[data-md-preview]');
    const meta = wrap.querySelector<HTMLElement>('[data-md-meta]');
    const toggle = wrap.querySelector<HTMLButtonElement>('[data-md-toggle]');
    input?.addEventListener('input', () => {
      if (meta) meta.textContent = `${wordCount(input.value)} words · ${readingTimeFor(input.value)}`;
    });
    toggle?.addEventListener('click', async () => {
      if (!input || !preview) return;
      const showing = !preview.hidden;
      if (showing) {
        preview.hidden = true;
        input.hidden = false;
        toggle.textContent = 'Preview';
        toggle.setAttribute('aria-pressed', 'false');
        return;
      }
      preview.innerHTML = await renderAgentMarkdown(input.value);
      preview.style.minHeight = `${input.offsetHeight}px`;
      preview.hidden = false;
      input.hidden = true;
      toggle.textContent = 'Edit';
      toggle.setAttribute('aria-pressed', 'true');
    });
  });
}

function bindFaqFields(form: HTMLElement) {
  form.querySelectorAll<HTMLElement>('.faq-field').forEach((wrap) => {
    const rows = wrap.querySelector<HTMLElement>('[data-faq-rows]');
    wrap.querySelector('[data-faq-add]')?.addEventListener('click', () => {
      rows?.insertAdjacentHTML('beforeend', faqRow());
      rows?.querySelector<HTMLInputElement>('.faq-row:last-child input')?.focus();
      onChange();
    });
    rows?.addEventListener('click', (e) => {
      const target = e.target instanceof Element ? e.target : null;
      const row = target?.closest<HTMLElement>('.faq-row');
      if (!row) return;
      if (target?.closest('[data-faq-remove]')) {
        row.remove();
        onChange();
        return;
      }
      const move = target?.closest<HTMLElement>('[data-faq-move]')?.dataset.faqMove;
      if (move === '-1' && row.previousElementSibling) row.parentElement?.insertBefore(row, row.previousElementSibling);
      if (move === '1' && row.nextElementSibling) row.parentElement?.insertBefore(row.nextElementSibling, row);
      if (move) onChange();
    });
  });
}

function bindAutoSlug(form: HTMLElement) {
  const slug = form.querySelector<HTMLInputElement>('input[data-auto-slug]');
  const title = document.getElementById(`f-${def.titleKey}`) as HTMLInputElement | null;
  if (!slug || !title) return;
  slug.addEventListener('input', () => {
    slug.dataset.autoSlug = '';
  });
  title.addEventListener('input', () => {
    if (slug.dataset.autoSlug === '1') slug.value = slugify(title.value);
  });
}

function bind() {
  const form = document.getElementById('entry-form');
  if (form) {
    form.addEventListener('input', onChange);
    form.addEventListener('change', onChange);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      void save();
    });
    bindImageFields(form);
    bindMarkdownFields(form);
    bindFaqFields(form);
    bindAutoSlug(form);
  }
  document.getElementById('yt-fill')?.addEventListener('click', () => void fillFromYouTube());
  document.getElementById('undo-delete')?.addEventListener('click', async () => {
    if (!entryId) return;
    await clearEntryDraft(collection, entryId);
    draft = null;
    render(withBody(published, publishedBody));
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

function withBody(values: Values, body: string | undefined): Values {
  return body === undefined ? values : { ...values, [BODY_KEY]: body.replace(/^\n/, '') };
}

async function init() {
  if (boot.loadError) {
    root!.innerHTML = `<p class="status error">Could not load this ${escapeHtml(def.singular)}: ${escapeHtml(boot.loadError)}</p>`;
    return;
  }
  if (entryId) {
    draft = await getEntryDraft(collection, entryId);
    if (!boot.entry) {
      if (!draft) {
        root!.innerHTML = `<div class="dash-intro"><h2>Not found</h2><p>No ${escapeHtml(def.singular)} with id <code>${escapeHtml(entryId)}</code> is published, and there is no local draft. <a href="/admin">Back to Pages</a></p></div>`;
        if (saveBtn) saveBtn.hidden = true;
        return;
      }
      isNew = true;
    }
  }
  const values =
    draft?.op === 'upsert'
      ? withBody({ ...published, ...draft.data }, draft.body ?? publishedBody)
      : withBody(published, publishedBody);
  render(values);
  if (draft?.op === 'upsert') setStatus('Showing your local draft. Publish it from Changes when ready.', 'ok');
  else if (isNew) setStatus(`Fill in the ${def.singular} and Save to keep a local draft.`);
}

void init();
