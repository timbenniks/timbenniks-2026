import { apiFetch } from './lib/api.js';
import { escapeHtml } from './lib/utils.js';
import { bindStatus, bindChip } from './lib/chrome.js';
import { diffJson, formatPatchHtml } from './lib/json-diff.js';
import {
  clearAllDrafts,
  clearEntryDraft,
  clearPageDraft,
  listEntryDrafts,
  setEntryDraft,
  type EntryDraftRecord,
  getPageDraft,
  getSiteDraft,
  listDraftPageIds,
  loadDraftOverlay,
} from './lib/draft-store.js';
import type { PageData, SiteChrome } from './lib/content.js';

/** GET /api/admin/changes */
interface ChangesResponse {
  ok: boolean;
  configured: boolean;
  preferLocal?: boolean;
  mode?: 'github' | 'local-working';
  mainBranch: string;
  pages: Record<string, PageData>;
  site: SiteChrome;
  paths: { pages: string; site: string };
  error?: string;
}

/** POST /api/admin/changes/publish */
interface PublishResponse {
  ok: boolean;
  mode: 'github' | 'local-working';
  branch: string;
  commit: string;
  written: string[];
}

/** POST /api/admin/entries/preview */
interface EntryPreviewResponse {
  ok: boolean;
  files: Array<{ path: string; before: string | null; after: string | null }>;
}

interface EntryChangeRow {
  draft: EntryDraftRecord;
  path?: string;
  before?: string | null;
  after?: string | null;
  error?: string;
}

/** The publish payload shape for one entry draft (see src/lib/admin/entries-store.ts EntryOp). */
function entryOp(d: EntryDraftRecord) {
  return d.isNew
    ? { collection: d.collection, op: d.op, path: d.path, data: d.data, body: d.body }
    : { collection: d.collection, op: d.op, id: d.id, data: d.data, body: d.body };
}

async function loadEntryRows(): Promise<EntryChangeRow[]> {
  const drafts = await listEntryDrafts();
  return Promise.all(
    drafts.map(async (draft): Promise<EntryChangeRow> => {
      try {
        const res = await apiFetch<EntryPreviewResponse>('/api/admin/entries/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries: [entryOp(draft)] }),
          errorMessage: 'Validation failed',
        });
        const file = res.files[0];
        return { draft, path: file?.path, before: file?.before, after: file?.after };
      } catch (err) {
        return { draft, error: errText(err) || 'Validation failed' };
      }
    }),
  );
}

function entryChangeLabel(row: EntryChangeRow): string {
  if (row.draft.op === 'delete') return 'delete';
  return row.draft.isNew ? 'new' : 'modified';
}

/** POST /api/admin/changes/discard */
interface DiscardResponse {
  ok: boolean;
  cleared: 'all-server' | 'partial-server';
}

interface Baseline {
  pages: Record<string, PageData>;
  site: SiteChrome;
  mainBranch: string;
  configured: boolean;
  preferLocal: boolean;
}

interface PageChangeRow {
  id: string;
  change: 'added' | 'modified';
  title?: string | undefined;
  draft: PageData;
  base: PageData | undefined;
}

/** The desk is inert without its panels — fail loudly rather than half-render. */
function requireEl<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`[tb-changes] Missing #${id}`);
  return el as T;
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : '';
}

function renderDiffDetails(opts: {
  title: string;
  meta: string;
  before: unknown;
  after: unknown;
  href?: string;
  discardPageId?: string;
  discardEntryKey?: string;
  error?: string;
}): string {
  const { patch, additions, deletions } = diffJson(opts.before, opts.after);
  const stats = `+${additions} −${deletions}`;
  const patchHtml = opts.error
    ? `<p class="status error">${escapeHtml(opts.error)}</p>`
    : patch
      ? `<pre class="diff-patch">${formatPatchHtml(patch, escapeHtml)}</pre>`
      : '<p class="hint">No textual diff.</p>';
  const actions: string[] = [];
  if (opts.href) {
    actions.push(`<a class="diff-edit" href="${escapeHtml(opts.href)}">Edit</a>`);
  }
  if (opts.discardPageId) {
    actions.push(
      `<button type="button" class="ghost danger discard-one" data-page-id="${escapeHtml(opts.discardPageId)}">Discard</button>`,
    );
  }
  if (opts.discardEntryKey) {
    actions.push(
      `<button type="button" class="ghost danger discard-entry" data-entry-key="${escapeHtml(opts.discardEntryKey)}">Discard</button>`,
    );
  }
  return `<details class="diff-file">
    <summary>
      <span class="diff-summary-main">
        <strong>${escapeHtml(opts.title)}</strong>
        <span class="meta">${escapeHtml(opts.meta)} · ${escapeHtml(stats)}</span>
      </span>
      ${actions.length ? `<span class="diff-summary-actions">${actions.join('')}</span>` : ''}
    </summary>
    ${patchHtml}
  </details>`;
}

const statusEl = document.getElementById('status');
const chip = document.getElementById('chip');
const summary = requireEl('summary');
const pagesPanel = requireEl('pages-panel');
const pagesList = requireEl('pages-list');
const sitePanel = requireEl('site-panel');
const entriesPanel = requireEl('entries-panel');
const entriesList = requireEl('entries-list');
const siteDiff = requireEl('site-diff');
const publishBtn = requireEl<HTMLButtonElement>('publish');
const discardBtn = requireEl<HTMLButtonElement>('discard');
const commitMsg = requireEl<HTMLInputElement>('commit-msg');

const setStatus = bindStatus(statusEl);
const setChip = bindChip(chip);

let baseline: Baseline | null = null;
let entryRows: EntryChangeRow[] = [];
let entryDraftsInFlight: EntryDraftRecord[] = [];

function bindEntryDiscardButtons(root: ParentNode) {
  root.querySelectorAll('.discard-entry').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const key = btn.getAttribute('data-entry-key') || '';
      const [, collection, ...rest] = key.split(':');
      const id = rest.join(':');
      if (!collection || !id || !confirm(`Discard draft for “${id}”?`)) return;
      await clearEntryDraft(collection, id);
      await loadChanges();
    });
  });
}

function bindDiscardButtons(root: ParentNode) {
  root.querySelectorAll('.discard-one').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute('data-page-id');
      if (!id || !confirm(`Discard draft for “${id}”?`)) return;
      await clearPageDraft(id);
      await apiFetch<DiscardResponse>('/api/admin/changes/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: id }),
        errorMessage: 'Discard failed',
      }).catch(() => undefined);
      await loadChanges();
    });
  });
}

async function loadChanges() {
  setStatus('Loading drafts…');
  setChip('Loading…');
  try {
    const data = await apiFetch<ChangesResponse>('/api/admin/changes', {
      errorMessage: 'Failed to load baseline',
    });
    baseline = {
      pages: data.pages || {},
      site: data.site,
      mainBranch: data.mainBranch || 'main',
      configured: Boolean(data.configured),
      preferLocal: Boolean(data.preferLocal) || data.mode === 'local-working',
    };

    const { draftIds, siteDraft } = await loadDraftOverlay(baseline.pages);
    const pages: PageChangeRow[] = [];
    for (const id of draftIds) {
      const rec = await getPageDraft(id);
      if (!rec?.page) continue;
      const base = baseline.pages[id];
      const change = !base ? 'added' : JSON.stringify(base) !== JSON.stringify(rec.page) ? 'modified' : 'unchanged';
      if (change === 'unchanged') continue;
      pages.push({ id, change, title: rec.page.metadata?.title, draft: rec.page, base });
    }

    entryRows = await loadEntryRows();

    const siteTouched =
      Boolean(siteDraft?.site) &&
      JSON.stringify(siteDraft?.site) !== JSON.stringify(baseline.site);

    const hasChanges = pages.length > 0 || siteTouched || entryRows.length > 0;
    const targetHint = baseline.preferLocal
      ? 'local working tree (src/content)'
      : baseline.mainBranch;

    if (!hasChanges) {
      setChip('No drafts', 'ok');
      setStatus(
        baseline.preferLocal
          ? 'No local drafts — Publish writes content files on disk.'
          : baseline.configured
            ? `No local drafts — publish target is ${baseline.mainBranch}`
            : 'No local drafts. Configure GitHub to publish to main.',
        'ok',
      );
      summary.hidden = true;
      pagesPanel.hidden = true;
      sitePanel.hidden = true;
      entriesPanel.hidden = true;
      pagesList.innerHTML = '';
      siteDiff.innerHTML = '';
      entriesList.innerHTML = '';
      publishBtn.disabled = true;
      discardBtn.disabled = true;
      return;
    }

    const n = pages.length + (siteTouched ? 1 : 0) + entryRows.length;
    const invalid = entryRows.filter((r) => r.error).length;
    setChip(`${n} draft${n === 1 ? '' : 's'}`, 'dirty');
    const parts = [
      pages.length ? `${pages.length} page${pages.length === 1 ? '' : 's'}` : '',
      siteTouched ? 'site chrome' : '',
      entryRows.length ? `${entryRows.length} entr${entryRows.length === 1 ? 'y' : 'ies'}` : '',
    ].filter(Boolean);
    setStatus(
      invalid
        ? `${invalid} draft${invalid === 1 ? ' has' : 's have'} errors — fix or discard before publishing`
        : `${parts.join(' · ')} ready to publish`,
      invalid ? 'error' : 'ok',
    );

    summary.hidden = false;
    summary.innerHTML = `
      <p>
        Local drafts → <strong>${escapeHtml(targetHint)}</strong>
        ${
          baseline.preferLocal
            ? ' · <span class="hint">astro dev · write to disk</span>'
            : baseline.configured
              ? ''
              : ' · <span class="hint">GitHub not configured (local working tree)</span>'
        }
      </p>
      <p class="hint">Expand a draft to review its diff against published content.</p>
    `;

    if (pages.length) {
      pagesPanel.hidden = false;
      pagesList.innerHTML = pages
        .map((p) => {
          const href = `/admin/pages/${encodeURIComponent(p.id)}`;
          return `<li>${renderDiffDetails({
            title: p.title || p.id,
            meta: `${p.id} · ${p.change}`,
            before: p.change === 'added' ? undefined : p.base,
            after: p.draft,
            href,
            discardPageId: p.id,
          })}</li>`;
        })
        .join('');
      bindDiscardButtons(pagesList);
    } else {
      pagesPanel.hidden = true;
      pagesList.innerHTML = '';
    }

    if (siteTouched && siteDraft?.site) {
      sitePanel.hidden = false;
      siteDiff.innerHTML = renderDiffDetails({
        title: 'site.json',
        meta: 'modified',
        before: baseline.site,
        after: siteDraft.site,
        href: '/admin/site',
      });
    } else {
      sitePanel.hidden = true;
      siteDiff.innerHTML = '';
    }

    if (entryRows.length) {
      entriesPanel.hidden = false;
      entriesList.innerHTML = entryRows
        .map((row) => {
          const d = row.draft;
          return `<li>${renderDiffDetails({
            title: d.title || d.id,
            meta: `${d.collection} · ${row.path ?? d.id} · ${entryChangeLabel(row)}`,
            before: row.before ?? undefined,
            after: row.after ?? undefined,
            href: `/admin/content/${encodeURIComponent(d.collection)}/${encodeURIComponent(d.id)}`,
            discardEntryKey: `entry:${d.collection}:${d.id}`,
            ...(row.error ? { error: row.error } : {}),
          })}</li>`;
        })
        .join('');
      bindEntryDiscardButtons(entriesList);
    } else {
      entriesPanel.hidden = true;
      entriesList.innerHTML = '';
    }

    publishBtn.disabled = invalid > 0;
    discardBtn.disabled = false;
  } catch (err) {
    setChip('Error', 'error');
    setStatus(errText(err) || String(err), 'error');
    publishBtn.disabled = true;
    discardBtn.disabled = true;
  }
}

publishBtn.addEventListener('click', async () => {
  const local = baseline?.preferLocal;
  if (
    !confirm(
      local
        ? 'Publish local drafts to src/content on disk?'
        : 'Publish local drafts to main? This updates content files and triggers deploy.',
    )
  ) {
    return;
  }
  publishBtn.disabled = true;
  discardBtn.disabled = true;
  setChip('Publishing…');
  setStatus(local ? 'Writing drafts to disk…' : 'Writing drafts to main…');
  try {
    const draftIds = await listDraftPageIds();
    const pages: Record<string, PageData> = {};
    for (const id of draftIds) {
      const rec = await getPageDraft(id);
      if (rec?.page) pages[id] = rec.page;
    }
    const siteRec = await getSiteDraft();
    entryDraftsInFlight = await listEntryDrafts();
    const entries = entryDraftsInFlight.map(entryOp);
    // Publishing an entry rewrites src/content, which makes `astro dev` reload this
    // page — possibly before the response lands. Clear entry drafts up front so a
    // reload can't resurrect already-published drafts; they are restored on failure.
    await Promise.all(entryDraftsInFlight.map((d) => clearEntryDraft(d.collection, d.id)));
    const payload: {
      message: string;
      pages?: Record<string, PageData>;
      site?: SiteChrome;
      entries?: ReturnType<typeof entryOp>[];
    } = {
      message: commitMsg.value.trim() || 'content: publish drafts',
      ...(Object.keys(pages).length ? { pages } : {}),
      ...(siteRec?.site ? { site: siteRec.site } : {}),
      ...(entries.length ? { entries } : {}),
    };
    const data = await apiFetch<PublishResponse>('/api/admin/changes/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      errorMessage: 'Publish failed',
    });
    entryDraftsInFlight = [];
    await clearAllDrafts();
    setStatus(`Published · ${data.mode} · ${data.commit}`, 'ok');
    setChip('Published', 'ok');
    await loadChanges();
  } catch (err) {
    await Promise.all(entryDraftsInFlight.map(({ updatedAt: _u, ...d }) => setEntryDraft(d)));
    entryDraftsInFlight = [];
    setStatus(errText(err) || String(err), 'error');
    setChip('Error', 'error');
    publishBtn.disabled = false;
    discardBtn.disabled = false;
  }
});

discardBtn.addEventListener('click', async () => {
  if (!confirm('Discard all local drafts? Published content on main is unchanged.')) return;
  publishBtn.disabled = true;
  discardBtn.disabled = true;
  setChip('Discarding…');
  setStatus('Clearing local drafts…');
  try {
    await clearAllDrafts();
    await apiFetch<DiscardResponse>('/api/admin/changes/discard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
      errorMessage: 'Discard failed',
    }).catch(() => undefined);
    setStatus('Discarded all local drafts', 'ok');
    await loadChanges();
  } catch (err) {
    setStatus(errText(err) || String(err), 'error');
    setChip('Error', 'error');
    publishBtn.disabled = false;
    discardBtn.disabled = false;
  }
});

loadChanges();
