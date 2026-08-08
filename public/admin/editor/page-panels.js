/**
 * Page Info + Git history panes.
 * @param {Record<string, any>} s mutable editor session
 */
import { apiFetch } from '../lib/api.js';
import { escapeHtml } from '../lib/utils.js';
import { listDraftPageIds } from '../lib/draft-store.js';

export function createPagePanels(s) {
  function formatCommitDate(iso) {
    if (!iso) return '—';
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  function editStatusLabel() {
    if (s.dirtyChip?.dataset.state === 'saving') return 'Saving…';
    if (s.dirtyChip?.dataset.state === 'error') return 'Save error';
    return s.dirty ? 'Unsaved' : 'Draft saved';
  }

  async function fetchChangesStatus(force = false) {
    if (!force && s.changesCache) return s.changesCache;
    try {
      const baseline = await apiFetch('/api/admin/changes', {
        errorMessage: 'Could not load publish status',
      });
      const draftIds = await listDraftPageIds();
      const hasThisDraft = draftIds.includes(s.boot.id);
      s.changesCache = {
        ...baseline,
        draftIds,
        hasThisDraft,
        aheadBy: draftIds.length,
      };
    } catch (err) {
      s.changesCache = {
        configured: false,
        error: err.message || String(err),
        aheadBy: 0,
        pages: [],
        draftIds: [],
        hasThisDraft: false,
      };
    }
    return s.changesCache;
  }

  async function fetchHistory(force = false) {
    if (!force && s.historyCache) return s.historyCache;
    try {
      s.historyCache = await apiFetch(`/api/admin/pages/${s.boot.id}/history`, {
        errorMessage: 'Could not load history',
      });
    } catch (err) {
      s.historyCache = {
        configured: false,
        error: err.message || String(err),
        commits: [],
        lastPublish: null,
      };
    }
    return s.historyCache;
  }

  async function refreshInfoPane() {
    if (!s.infoFieldsEl) return;
    s.infoFieldsEl.innerHTML = '<p class="hint">Loading…</p>';
    const [changes, history] = await Promise.all([
      fetchChangesStatus(true),
      fetchHistory(false),
    ]);
    if (s.primary !== 'page' || s.pageTab !== 'info') return;

    const title = s.draft?.metadata?.title || s.boot.id;
    const path = s.slugPath;
    let publishLabel = 'Unknown';
    if (changes.hasThisDraft || s.dirty) {
      publishLabel = 'Local draft pending publish';
    } else if ((changes.draftIds || []).length) {
      publishLabel = `${changes.draftIds.length} other draft${changes.draftIds.length === 1 ? '' : 's'} pending`;
    } else {
      publishLabel = 'In sync with main';
    }

    const last = history.lastPublish;
    const lastHtml = last
      ? last.htmlUrl
        ? `<a href="${escapeHtml(last.htmlUrl)}" target="_blank" rel="noopener">${escapeHtml(last.shortSha)}</a> · ${escapeHtml(formatCommitDate(last.date))}`
        : `${escapeHtml(last.shortSha)} · ${escapeHtml(formatCommitDate(last.date))}`
      : history.configured === false
        ? '—'
        : 'No commits on main yet';

    const mainB = changes.mainBranch || history.mainBranch || 'main';

    s.infoFieldsEl.innerHTML = `
      <dl class="info-dl">
        <div><dt>Page id</dt><dd><code>${escapeHtml(s.boot.id)}</code></dd></div>
        <div><dt>Title</dt><dd>${escapeHtml(title)}</dd></div>
        <div><dt>Path</dt><dd><code>${escapeHtml(path)}</code></dd></div>
        <div><dt>Live URL</dt><dd><a href="${escapeHtml(s.liveUrl)}" target="_blank" rel="noopener">${escapeHtml(s.liveUrl)}</a></dd></div>
        <div><dt>Edit status</dt><dd id="info-edit-status">${escapeHtml(editStatusLabel())}</dd></div>
        <div><dt>Publish status</dt><dd>${escapeHtml(publishLabel)}</dd></div>
        <div><dt>Last on main</dt><dd>${lastHtml}</dd></div>
        <div><dt>Publish target</dt><dd><code>${escapeHtml(mainB)}</code></dd></div>
      </dl>
      <p class="info-actions">
        <a class="open-live" href="/admin/changes">Review &amp; publish</a>
      </p>
    `;
  }

  function syncInfoEditStatus() {
    const el = document.getElementById('info-edit-status');
    if (el) el.textContent = editStatusLabel();
  }

  async function refreshHistoryPanel(force = false) {
    if (!s.historyFieldsEl) return;
    s.historyFieldsEl.innerHTML = '<p class="hint">Loading…</p>';
    const data = await fetchHistory(force);
    if (s.primary !== 'page' || s.pageTab !== 'history') return;

    if (!data.configured) {
      s.historyFieldsEl.innerHTML = `<p class="hint">${escapeHtml(data.error || 'GitHub is not configured. Set GITHUB_TOKEN and GITHUB_REPO to see commit history.')}</p>`;
      return;
    }

    const commits = data.commits || [];
    if (!commits.length) {
      s.historyFieldsEl.innerHTML = '<p class="hint">No commits touch pages.json on main yet.</p>';
      return;
    }

    s.historyFieldsEl.innerHTML = `
      <p class="hint history-path">Commits touching <code>${escapeHtml(data.path || 'src/content/pages.json')}</code> on <code>${escapeHtml(data.mainBranch || data.cmsBranch || 'main')}</code></p>
      <ul class="commit-list">
        ${commits
          .map((c) => {
            const msg = escapeHtml(c.message || '(no message)');
            const meta = [
              escapeHtml(c.shortSha || ''),
              escapeHtml(formatCommitDate(c.date)),
              c.author ? escapeHtml(c.author) : null,
            ]
              .filter(Boolean)
              .join(' · ');
            const body = c.htmlUrl
              ? `<a href="${escapeHtml(c.htmlUrl)}" target="_blank" rel="noopener">${msg}</a>`
              : msg;
            return `<li><div class="commit-msg">${body}</div><div class="meta">${meta}</div></li>`;
          })
          .join('')}
      </ul>
    `;
  }

  return {
    refreshInfoPane,
    syncInfoEditStatus,
    refreshHistoryPanel,
    fetchChangesStatus,
  };
}
