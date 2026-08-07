import { apiFetch } from './lib/api.js';
import { escapeHtml } from './lib/utils.js';
import { bindStatus, bindChip } from './lib/chrome.js';

const statusEl = document.getElementById('status');
const chip = document.getElementById('chip');
const summary = document.getElementById('summary');
const pagesPanel = document.getElementById('pages-panel');
const pagesList = document.getElementById('pages-list');
const filesPanel = document.getElementById('files-panel');
const filesList = document.getElementById('files-list');
const publishBtn = document.getElementById('publish');
const discardBtn = document.getElementById('discard');
const commitMsg = document.getElementById('commit-msg');

const setStatus = bindStatus(statusEl);
const setChip = bindChip(chip);

async function loadChanges() {
  setStatus('Loading compare…');
  setChip('Loading…');
  try {
    const data = await apiFetch('/api/admin/changes', {
      errorMessage: 'Failed to load changes',
    });

    if (!data.configured) {
      setChip('Not configured', 'error');
      setStatus(data.error || 'GitHub not configured', 'error');
      publishBtn.disabled = true;
      discardBtn.disabled = true;
      return;
    }

    const ahead = data.aheadBy || 0;
    const files = data.files || [];
    const pages = data.pages || [];
    const hasChanges = ahead > 0 || files.length > 0;

    if (!hasChanges) {
      setChip('In sync', 'ok');
      setStatus(`No pending changes — ${data.cmsBranch} matches ${data.mainBranch}`, 'ok');
      summary.hidden = true;
      pagesPanel.hidden = true;
      filesPanel.hidden = true;
      publishBtn.disabled = true;
      discardBtn.disabled = true;
      return;
    }

    setChip(`${ahead} commit${ahead === 1 ? '' : 's'} ahead`, 'dirty');
    setStatus(
      `${files.length} file${files.length === 1 ? '' : 's'} · ${ahead} commit${ahead === 1 ? '' : 's'} on ${data.cmsBranch}`,
      'ok',
    );

    summary.hidden = false;
    summary.innerHTML = `
      <p>
        <strong>${escapeHtml(data.cmsBranch)}</strong> →
        <strong>${escapeHtml(data.mainBranch)}</strong>
        · ${ahead} ahead
        ${data.behindBy ? ` · ${data.behindBy} behind` : ''}
        ${data.htmlUrl ? ` · <a href="${escapeHtml(data.htmlUrl)}" target="_blank" rel="noopener">View on GitHub</a>` : ''}
      </p>
      ${data.siteTouched ? '<p class="hint">Site chrome (<code>site.json</code>) is included.</p>' : ''}
    `;

    if (pages.length) {
      pagesPanel.hidden = false;
      pagesList.innerHTML = pages
        .map((p) => {
          const href = `/admin/pages/${encodeURIComponent(p.id)}`;
          return `<li>
            <a href="${href}">
              <strong>${escapeHtml(p.title || p.id)}</strong>
              <span class="meta"><span class="mono">${escapeHtml(p.id)}</span> · ${escapeHtml(p.change)}</span>
            </a>
          </li>`;
        })
        .join('');
    } else {
      pagesPanel.hidden = true;
      pagesList.innerHTML = '';
    }

    if (files.length) {
      filesPanel.hidden = false;
      filesList.innerHTML = files
        .map((f) => {
          const patch = f.patch
            ? `<pre class="diff-patch">${escapeHtml(f.patch)}</pre>`
            : '<p class="hint">No patch (binary or too large).</p>';
          return `<details class="diff-file">
            <summary>
              <span class="mono">${escapeHtml(f.filename)}</span>
              <span class="meta">${escapeHtml(f.status)} · +${f.additions} −${f.deletions}</span>
            </summary>
            ${patch}
          </details>`;
        })
        .join('');
    } else {
      filesPanel.hidden = true;
      filesList.innerHTML = '';
    }

    publishBtn.disabled = false;
    discardBtn.disabled = false;
  } catch (err) {
    setChip('Error', 'error');
    setStatus(err.message || String(err), 'error');
    publishBtn.disabled = true;
    discardBtn.disabled = true;
  }
}

publishBtn.addEventListener('click', async () => {
  if (!confirm('Merge cms into main and deploy? This publishes all pending saves.')) return;
  publishBtn.disabled = true;
  discardBtn.disabled = true;
  setChip('Publishing…');
  setStatus('Merging cms → main…');
  try {
    const data = await apiFetch('/api/admin/changes/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: commitMsg.value.trim() }),
      errorMessage: 'Publish failed',
    });
    setStatus(`Published · ${data.mode} · ${data.commit}`, 'ok');
    setChip('Published', 'ok');
    await loadChanges();
  } catch (err) {
    setStatus(err.message || String(err), 'error');
    setChip('Error', 'error');
    publishBtn.disabled = false;
    discardBtn.disabled = false;
  }
});

discardBtn.addEventListener('click', async () => {
  if (!confirm('Reset cms to main? All unpublished saves on cms will be discarded.')) return;
  publishBtn.disabled = true;
  discardBtn.disabled = true;
  setChip('Discarding…');
  setStatus('Resetting cms to main…');
  try {
    const data = await apiFetch('/api/admin/changes/discard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      errorMessage: 'Discard failed',
    });
    setStatus(`Discarded · ${data.commit}`, 'ok');
    await loadChanges();
  } catch (err) {
    setStatus(err.message || String(err), 'error');
    setChip('Error', 'error');
    publishBtn.disabled = false;
    discardBtn.disabled = false;
  }
});

loadChanges();
