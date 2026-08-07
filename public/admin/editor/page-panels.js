/**
 * Page Info + Git history panes.
 * @param {Record<string, any>} s mutable editor session
 */
import { apiFetch } from '../lib/api.js';
import { escapeHtml } from '../lib/utils.js';

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
    return s.dirty ? 'Unsaved' : 'Saved on cms';
  }

  async function fetchChangesStatus(force = false) {
    if (!force && s.changesCache) return s.changesCache;
    try {
      s.changesCache = await apiFetch('/api/admin/changes', {
        errorMessage: 'Could not load publish status',
      });
    } catch (err) {
      s.changesCache = {
        configured: false,
        error: err.message || String(err),
        aheadBy: 0,
        pages: [],
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
    const pageChange = (changes.pages || []).find((p) => p.id === s.boot.id);
    let publishLabel = 'Unknown';
    if (!changes.configured) {
      publishLabel = 'GitHub not configured';
    } else if ((changes.aheadBy || 0) === 0) {
      publishLabel = 'In sync with main';
    } else if (pageChange) {
      publishLabel = `Pending publish · ${pageChange.change}`;
    } else {
      publishLabel = `${changes.aheadBy} commit${changes.aheadBy === 1 ? '' : 's'} ahead (other changes)`;
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
    const cmsB = changes.cmsBranch || history.cmsBranch || 'cms';

    s.infoFieldsEl.innerHTML = `
      <dl class="info-dl">
        <div><dt>Page id</dt><dd><code>${escapeHtml(s.boot.id)}</code></dd></div>
        <div><dt>Title</dt><dd>${escapeHtml(title)}</dd></div>
        <div><dt>Path</dt><dd><code>${escapeHtml(path)}</code></dd></div>
        <div><dt>Live URL</dt><dd><a href="${escapeHtml(s.liveUrl)}" target="_blank" rel="noopener">${escapeHtml(s.liveUrl)}</a></dd></div>
        <div><dt>Edit status</dt><dd id="info-edit-status">${escapeHtml(editStatusLabel())}</dd></div>
        <div><dt>Publish status</dt><dd>${escapeHtml(publishLabel)}</dd></div>
        <div><dt>Last on main</dt><dd>${lastHtml}</dd></div>
        <div><dt>Branches</dt><dd><code>${escapeHtml(cmsB)}</code> → <code>${escapeHtml(mainB)}</code></dd></div>
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
      s.historyFieldsEl.innerHTML = '<p class="hint">No commits touch pages.json on the cms branch yet.</p>';
      return;
    }

    const needle = `cms: update ${s.boot.id}`;
    s.historyFieldsEl.innerHTML = `
      <p class="hint history-path">Commits touching <code>${escapeHtml(data.path || 'src/content/pages.json')}</code> on <code>${escapeHtml(data.cmsBranch || 'cms')}</code></p>
      <ul class="commit-list">
        ${commits
          .map((c) => {
            const forPage = (c.message || '').includes(needle);
            const msg = escapeHtml(c.message || '(no message)');
            const meta = [
              escapeHtml(c.shortSha || ''),
              escapeHtml(formatCommitDate(c.date)),
              c.author ? escapeHtml(c.author) : null,
            ]
              .filter(Boolean)
              .join(' · ');
            const body = c.htmlUrl
              ? `<a href="${escapeHtml(c.htmlUrl)}" target="_blank" rel="noopener" class="commit-msg">${msg}</a>`
              : `<span class="commit-msg">${msg}</span>`;
            return `<li class="commit-row${forPage ? ' is-page' : ''}">${body}<div class="commit-meta">${meta}${forPage ? ' <span class="commit-badge">this page</span>' : ''}</div></li>`;
          })
          .join('')}
      </ul>
    `;
  }

  return {
    formatCommitDate,
    editStatusLabel,
    fetchChangesStatus,
    fetchHistory,
    refreshInfoPane,
    syncInfoEditStatus,
    refreshHistoryPanel,
  };
}
