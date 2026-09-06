import { apiFetch } from './lib/api.js';
import { deepClone, escapeAttr } from './lib/utils.js';
import { icon } from './lib/icons.js';
import { bindStatus, bindStateChip } from './lib/chrome.js';
import { contentHash, getSiteDraft, setSiteDraft } from './lib/draft-store.js';
import type { NavLink, SiteChrome } from './lib/content.js';

/** `data-initial` on #app, serialized by src/pages/admin/site.astro. */
interface SiteBoot {
  site: SiteChrome;
}

/** PUT /api/admin/site */
interface SiteSaveResponse {
  ok: boolean;
  mode: 'draft';
}

/** Every element below is rendered by this module or by site.astro. */
function requireEl<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`[tb-site-editor] Missing #${id}`);
  return el as T;
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : '';
}

const root = document.getElementById('app');
if (!root) {
  console.error('[tb-site-editor] Missing #app root');
  throw new Error('Missing #app');
}
let boot: SiteBoot | null;
try {
  boot = JSON.parse(root.dataset.initial || 'null') as SiteBoot | null;
} catch (err) {
  console.error('[tb-site-editor] Invalid data-initial JSON', err);
  root.innerHTML = '<p class="status error">Site editor failed to boot: invalid payload.</p>';
  throw err;
}
if (!boot?.site) {
  root.innerHTML = '<p class="status error">Site editor failed to boot: incomplete payload.</p>';
  throw new Error('Incomplete boot payload');
}
let draft: SiteChrome = deepClone(boot.site);
const publishedSnapshot: SiteChrome = deepClone(boot.site);
const baseHash = contentHash(boot.site);
let dirty = false;

// Restore local draft if present
void getSiteDraft().then((rec) => {
  if (!rec?.site) return;
  draft = deepClone(rec.site);
  dirty = JSON.stringify(draft) !== JSON.stringify(publishedSnapshot);
  if (dirty) {
    setChip('dirty');
    setStatus('Restored local draft · Publish from Changes when ready', 'ok');
    renderNav();
    renderFooter();
    nlHeading.value = draft.newsletter?.heading || '';
    nlBody.value = draft.newsletter?.body || '';
    nlSubscribeUrl.value = draft.newsletter?.subscribeUrl || '';
    footerHuman.value = draft.footerHuman || '';
    if (saveBtn) saveBtn.disabled = false;
  }
});

root.innerHTML = `
  <div class="dash-intro">
    <h2>Site chrome</h2>
    <p>Navigation, footer columns, and newsletter copy. <strong>Save</strong> keeps a local draft; publish from <a href="/admin/changes">Changes</a>.</p>
  </div>

  <nav class="section-pills" aria-label="Sections">
    <a href="#nav" data-toc="nav">Navigation</a>
    <a href="#newsletter" data-toc="newsletter">Newsletter</a>
    <a href="#footer" data-toc="footer">Footer</a>
    <a href="#note" data-toc="note">Footer note</a>
  </nav>

  <p class="status" id="status">Edits stay in a local draft until you publish.</p>

  <section class="panel" id="nav">
    <div class="panel-head"><h2>Navigation</h2></div>
    <p class="hint">Top bar links, left → right. Brand name and Subscribe stay fixed.</p>
    <div id="nav-rows"></div>
    <button type="button" class="add-btn" id="add-nav">${icon('plus')} Add link</button>
  </section>

  <section class="panel" id="newsletter">
    <div class="panel-head"><h2>Newsletter</h2></div>
    <p class="hint">Copy in the footer subscribe block.</p>
    <div class="field">
      <label for="nl-heading">Heading</label>
      <input id="nl-heading" />
    </div>
    <div class="field">
      <label for="nl-body">Body</label>
      <textarea id="nl-body"></textarea>
    </div>
    <div class="field">
      <label for="nl-subscribe-url">LinkedIn newsletter subscription URL</label>
      <input id="nl-subscribe-url" type="url" placeholder="https://www.linkedin.com/build-relation/newsletter-follow?entityUrn=…" />
    </div>
  </section>

  <section class="panel" id="footer">
    <div class="panel-head"><h2>Footer columns</h2></div>
    <p class="hint">Link groups under the newsletter.</p>
    <div id="footer-cols"></div>
    <button type="button" class="add-btn" id="add-col">${icon('plus')} Add column</button>
  </section>

  <section class="panel" id="note">
    <div class="panel-head"><h2>Footer note</h2></div>
    <p class="hint">One-line credit under the columns.</p>
    <div class="field">
      <label for="footer-human">Blurb</label>
      <input id="footer-human" />
    </div>
  </section>
`;

const statusEl = document.getElementById('status');
const chip = document.getElementById('chip');
const saveBtn = document.querySelector<HTMLButtonElement>('#save');
const navRows = requireEl('nav-rows');
const footerCols = requireEl('footer-cols');
const nlHeading = requireEl<HTMLInputElement>('nl-heading');
const nlBody = requireEl<HTMLTextAreaElement>('nl-body');
const nlSubscribeUrl = requireEl<HTMLInputElement>('nl-subscribe-url');
const footerHuman = requireEl<HTMLInputElement>('footer-human');

const setStatus = bindStatus(statusEl);
const setChip = bindStateChip(chip);

function markDirty() {
  dirty = true;
  if (saveBtn) saveBtn.disabled = false;
  setChip('dirty');
  setStatus('Unsaved changes — save draft, then publish from Changes');
  schedulePreview();
  clearTimeout(draftAutosaveTimer);
  draftAutosaveTimer = setTimeout(() => {
    void setSiteDraft(draft, { baseHash }).catch(() => undefined);
  }, 400);
}

let previewTimer: ReturnType<typeof setTimeout> | undefined;
let draftAutosaveTimer: ReturnType<typeof setTimeout> | undefined;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(persistPreview, 400);
}

async function persistPreview() {
  try {
    await setSiteDraft(draft, { baseHash });
    await apiFetch<SiteSaveResponse>('/api/admin/site', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site: draft, mode: 'preview' }),
      errorMessage: 'Preview sync failed',
    });
    if (dirty) setStatus('Draft synced — open Preview home to check nav & footer', 'ok');
  } catch (err) {
    setStatus(errText(err) || String(err), 'error');
  }
}

function rowActions({ showMove = true }: { showMove?: boolean } = {}) {
  const move = showMove
    ? `<button type="button" class="icon-btn" data-up title="Move up">${icon('up')}</button>
       <button type="button" class="icon-btn" data-down title="Move down">${icon('down')}</button>`
    : '';
  return `<span class="row-actions">
    ${move}
    <button type="button" class="icon-btn danger" data-del title="Remove">${icon('x')}</button>
  </span>`;
}

function renderNav() {
  navRows.innerHTML = '';
  draft.nav.forEach((link, i) => {
    const row = document.createElement('div');
    row.className = 'link-row';
    row.innerHTML = `
      <input data-k="label" placeholder="Label" aria-label="Label" value="${escapeAttr(link.label)}" />
      <input data-k="href" placeholder="/path or https://" aria-label="URL" value="${escapeAttr(link.href)}" />
      ${rowActions()}
    `;
    row.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', () => {
        draft.nav[i][input.dataset.k as keyof NavLink] = input.value;
        markDirty();
      });
    });
    row.querySelector('[data-up]')?.addEventListener('click', () => {
      if (i === 0) return;
      [draft.nav[i - 1], draft.nav[i]] = [draft.nav[i], draft.nav[i - 1]];
      markDirty();
      renderNav();
    });
    row.querySelector('[data-down]')?.addEventListener('click', () => {
      if (i >= draft.nav.length - 1) return;
      [draft.nav[i + 1], draft.nav[i]] = [draft.nav[i], draft.nav[i + 1]];
      markDirty();
      renderNav();
    });
    row.querySelector('[data-del]')?.addEventListener('click', () => {
      draft.nav.splice(i, 1);
      markDirty();
      renderNav();
    });
    navRows.appendChild(row);
  });
}

function renderFooter() {
  footerCols.innerHTML = '';
  if (!Array.isArray(draft.footerColumns)) draft.footerColumns = [];

  draft.footerColumns.forEach((col, ci) => {
    if (!Array.isArray(col.links)) col.links = [];
    const card = document.createElement('div');
    card.className = 'col-card';

    const head = document.createElement('div');
    head.className = 'col-head';
    head.innerHTML = `
      <input data-k="heading" placeholder="Column heading" aria-label="Column heading" value="${escapeAttr(col.heading)}" />
      ${rowActions()}
    `;
    const headingInput = head.querySelector('input');
    headingInput?.addEventListener('input', () => {
      draft.footerColumns[ci].heading = headingInput.value;
      markDirty();
    });
    head.querySelector('[data-up]')?.addEventListener('click', () => {
      if (ci === 0) return;
      [draft.footerColumns[ci - 1], draft.footerColumns[ci]] = [
        draft.footerColumns[ci],
        draft.footerColumns[ci - 1],
      ];
      markDirty();
      renderFooter();
    });
    head.querySelector('[data-down]')?.addEventListener('click', () => {
      if (ci >= draft.footerColumns.length - 1) return;
      [draft.footerColumns[ci + 1], draft.footerColumns[ci]] = [
        draft.footerColumns[ci],
        draft.footerColumns[ci + 1],
      ];
      markDirty();
      renderFooter();
    });
    head.querySelector('[data-del]')?.addEventListener('click', () => {
      draft.footerColumns.splice(ci, 1);
      markDirty();
      renderFooter();
    });
    card.appendChild(head);

    const list = document.createElement('div');
    list.className = 'col-links';
    col.links.forEach((link, li) => {
      const row = document.createElement('div');
      row.className = 'link-row';
      row.innerHTML = `
        <input data-k="label" placeholder="Label" aria-label="Link label" value="${escapeAttr(link.label)}" />
        <input data-k="href" placeholder="Href" aria-label="Link URL" value="${escapeAttr(link.href)}" />
        ${rowActions({ showMove: false })}
      `;
      row.querySelectorAll('input').forEach((input) => {
        input.addEventListener('input', () => {
          draft.footerColumns[ci].links[li][input.dataset.k as keyof NavLink] = input.value;
          markDirty();
        });
      });
      row.querySelector('[data-del]')?.addEventListener('click', () => {
        draft.footerColumns[ci].links.splice(li, 1);
        markDirty();
        renderFooter();
      });
      list.appendChild(row);
    });
    card.appendChild(list);

    const addLink = document.createElement('button');
    addLink.type = 'button';
    addLink.className = 'add-btn subtle';
    addLink.innerHTML = `${icon('plus')} Add link`;
    addLink.addEventListener('click', () => {
      draft.footerColumns[ci].links.push({ label: 'Link', href: '/' });
      markDirty();
      renderFooter();
    });
    card.appendChild(addLink);
    footerCols.appendChild(card);
  });
}

function syncToc() {
  const ids = ['nav', 'newsletter', 'footer', 'note'];
  const links = [...document.querySelectorAll<HTMLElement>('[data-toc]')];
  const main = document.querySelector('.dash-main');
  const anchorY = (main?.getBoundingClientRect().top ?? 0) + 56;
  let active = ids[0];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.getBoundingClientRect().top <= anchorY) active = id;
  }
  links.forEach((a) => a.classList.toggle('active', a.dataset.toc === active));
}

nlHeading.value = draft.newsletter?.heading ?? '';
nlBody.value = draft.newsletter?.body ?? '';
nlSubscribeUrl.value = draft.newsletter?.subscribeUrl ?? '';
footerHuman.value = draft.footerHuman ?? '';

nlHeading.addEventListener('input', () => {
  if (!draft.newsletter) draft.newsletter = { heading: '', body: '' };
  draft.newsletter.heading = nlHeading.value;
  markDirty();
});
nlBody.addEventListener('input', () => {
  if (!draft.newsletter) draft.newsletter = { heading: '', body: '' };
  draft.newsletter.body = nlBody.value;
  markDirty();
});
nlSubscribeUrl.addEventListener('input', () => {
  draft.newsletter.subscribeUrl = nlSubscribeUrl.value.trim() || undefined;
  markDirty();
});
footerHuman.addEventListener('input', () => {
  draft.footerHuman = footerHuman.value;
  markDirty();
});

document.getElementById('add-nav')?.addEventListener('click', () => {
  draft.nav.push({ label: 'New', href: '/' });
  markDirty();
  renderNav();
});

document.getElementById('add-col')?.addEventListener('click', () => {
  draft.footerColumns.push({
    heading: 'Column',
    links: [{ label: 'Link', href: '/' }],
  });
  markDirty();
  renderFooter();
});

saveBtn?.addEventListener('click', async () => {
  saveBtn.disabled = true;
  setChip('saving');
  setStatus('Saving draft…');
  try {
    await setSiteDraft(draft, { baseHash });
    await apiFetch<SiteSaveResponse>('/api/admin/site', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ site: draft, mode: 'preview' }),
      errorMessage: 'Draft stage failed',
    }).catch(() => undefined);
    dirty = false;
    setChip('ok');
    setStatus('Draft saved locally · Publish from Changes', 'ok');
  } catch (err) {
    saveBtn.disabled = false;
    setChip('error');
    setStatus(errText(err) || String(err), 'error');
  }
});

window.addEventListener('beforeunload', (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

const mainScroll = document.querySelector('.dash-main');
mainScroll?.addEventListener('scroll', syncToc, { passive: true });
window.addEventListener('scroll', syncToc, { passive: true });

renderNav();
renderFooter();
setChip('ok');
syncToc();
