import { apiFetch } from './lib/api.js';
import { escapeHtml } from './lib/utils.js';
import { bindStatus, bindChip } from './lib/chrome.js';
import { diffJson, formatPatchHtml } from './lib/json-diff.js';
import {
  clearAllDrafts,
  clearPageDraft,
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
}): string {
  const { patch, additions, deletions } = diffJson(opts.before, opts.after);
  const stats = `+${additions} −${deletions}`;
  const patchHtml = patch
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
const siteDiff = requireEl('site-diff');
const publishBtn = requireEl<HTMLButtonElement>('publish');
const discardBtn = requireEl<HTMLButtonElement>('discard');
const commitMsg = requireEl<HTMLInputElement>('commit-msg');

const setStatus = bindStatus(statusEl);
const setChip = bindChip(chip);

let baseline: Baseline | null = null;

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

    const siteTouched =
      Boolean(siteDraft?.site) &&
      JSON.stringify(siteDraft?.site) !== JSON.stringify(baseline.site);

    const hasChanges = pages.length > 0 || siteTouched;
    const targetHint = baseline.preferLocal
      ? 'local working tree (src/content/*.json)'
      : baseline.mainBranch;

    if (!hasChanges) {
      setChip('No drafts', 'ok');
      setStatus(
        baseline.preferLocal
          ? 'No local drafts — Publish writes JSON files on disk.'
          : baseline.configured
            ? `No local drafts — publish target is ${baseline.mainBranch}`
            : 'No local drafts. Configure GitHub to publish to main.',
        'ok',
      );
      summary.hidden = true;
      pagesPanel.hidden = true;
      sitePanel.hidden = true;
      pagesList.innerHTML = '';
      siteDiff.innerHTML = '';
      publishBtn.disabled = true;
      discardBtn.disabled = true;
      return;
    }

    const n = pages.length + (siteTouched ? 1 : 0);
    setChip(`${n} draft${n === 1 ? '' : 's'}`, 'dirty');
    setStatus(
      `${pages.length} page${pages.length === 1 ? '' : 's'}${siteTouched ? ' · site chrome' : ''} ready to publish`,
      'ok',
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
      <p class="hint">Expand a draft to review the JSON diff against published content.</p>
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

    publishBtn.disabled = false;
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
        ? 'Publish local drafts to src/content/*.json on disk?'
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
    const payload: { message: string; pages?: Record<string, PageData>; site?: SiteChrome } = {
      message: commitMsg.value.trim() || 'content: publish drafts',
      ...(Object.keys(pages).length ? { pages } : {}),
      ...(siteRec?.site ? { site: siteRec.site } : {}),
    };
    const data = await apiFetch<PublishResponse>('/api/admin/changes/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      errorMessage: 'Publish failed',
    });
    await clearAllDrafts();
    setStatus(`Published · ${data.mode} · ${data.commit}`, 'ok');
    setChip('Published', 'ok');
    await loadChanges();
  } catch (err) {
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
