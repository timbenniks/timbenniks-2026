/**
 * Preview iframe bridge — only active with ?edit=1 inside an iframe.
 * Loaded via dynamic import from BaseLayout when editing.
 */
import { isBlockAction, postToParent, readEditorMessage } from './lib/messaging.js';
import type { BridgeMessages, SelectKind } from './lib/messaging.js';

const params = new URLSearchParams(location.search);
const inIframe = window.parent !== window;
if (params.get('edit') === '1' && inIframe) {
  bootBridge();
}

function bootBridge() {
document.documentElement.setAttribute('data-astro-reload', '');
document.addEventListener(
  'click',
  (e) => {
    const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
    if (!a) return;
    if (a.closest('[data-edit]') || a.closest('#tb-ve-chrome') || a.closest('.tb-ve-insert')) return;
    e.preventDefault();
    e.stopPropagation();
  },
  true,
);

let style = document.getElementById('tb-ve-style');
if (!style) {
  style = document.createElement('style');
  style.id = 'tb-ve-style';
  style.textContent = `
    [data-section] {
      position: relative;
      outline: 2px solid transparent;
      outline-offset: -2px;
      transition: outline-color .12s, box-shadow .12s;
    }
    [data-section]:hover {
      outline-color: rgba(232, 93, 58, .45);
    }
    [data-section][data-section-active="1"] {
      outline-color: #e85d3a !important;
      box-shadow: inset 0 0 0 1px rgba(232, 93, 58, .2);
    }
    [data-edit] {
      cursor: pointer !important;
      outline: 1px dashed transparent;
      outline-offset: 2px;
      transition: outline-color .12s, background-color .12s;
    }
    [data-section][data-section-active="1"] [data-edit]:hover {
      outline-color: rgba(232, 93, 58, .55);
      background-color: rgba(232, 93, 58, .06);
    }
    [data-edit][data-edit-active="1"] {
      outline: 2px solid #e85d3a !important;
      outline-offset: 2px;
      background-color: rgba(232, 93, 58, .1);
    }
    #tb-ve-chrome {
      position: absolute;
      z-index: 2147483646;
      display: flex;
      align-items: center;
      gap: 0.2rem;
      padding: 0.28rem 0.3rem 0.28rem 0.55rem;
      background: #1c1917;
      color: #fff;
      border-radius: 8px;
      font: 600 11px/1.2 ui-sans-serif, system-ui, sans-serif;
      letter-spacing: 0.02em;
      box-shadow: 0 6px 18px rgba(28,25,23,.28);
      pointer-events: auto;
      white-space: nowrap;
    }
    #tb-ve-chrome .tb-ve-kind { max-width: 148px; overflow: hidden; text-overflow: ellipsis; }
    #tb-ve-chrome button {
      border: 0;
      background: transparent;
      color: #fff;
      cursor: pointer;
      padding: 0.3rem 0.4rem;
      border-radius: 5px;
      font: inherit;
      line-height: 1;
      transition: background .12s ease;
    }
    #tb-ve-chrome button:hover { background: rgba(255,255,255,.14); }
    #tb-ve-chrome .tb-ve-menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      min-width: 148px;
      background: #fff;
      color: #1c1917;
      border: 1px solid #e7e5e4;
      border-radius: 10px;
      box-shadow: 0 10px 28px rgba(28,25,23,.16);
      padding: 0.3rem;
      display: none;
    }
    #tb-ve-chrome .tb-ve-menu.open { display: block; }
    #tb-ve-chrome .tb-ve-menu button {
      display: block;
      width: 100%;
      text-align: left;
      color: #1c1917;
      padding: 0.45rem 0.6rem;
      font-weight: 550;
      font-size: 12px;
      border-radius: 6px;
    }
    #tb-ve-chrome .tb-ve-menu button:hover { background: #fff4f0; color: #e85d3a; }
    .tb-ve-insert {
      position: relative;
      height: 0;
      z-index: 2147483645;
      pointer-events: none;
    }
    .tb-ve-insert-hit {
      position: absolute;
      left: 10%;
      right: 10%;
      top: -12px;
      height: 24px;
      pointer-events: auto;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .tb-ve-insert-hit::before {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 50%;
      height: 2px;
      background: transparent;
      transition: background .15s ease;
    }
    .tb-ve-insert-btn {
      pointer-events: auto;
      width: 26px;
      height: 26px;
      border-radius: 999px;
      border: 0;
      background: #e85d3a;
      color: #fff;
      font: 700 16px/1 ui-sans-serif, system-ui, sans-serif;
      cursor: pointer;
      opacity: 0;
      transform: scale(0.82);
      transition: opacity .15s ease, transform .15s ease;
      box-shadow: 0 3px 10px rgba(232, 93, 58, .4);
      z-index: 1;
    }
    .tb-ve-insert-hit:hover::before { background: rgba(232, 93, 58, .75); }
    .tb-ve-insert-hit:hover .tb-ve-insert-btn,
    .tb-ve-insert-btn:focus {
      opacity: 1;
      transform: scale(1);
    }
  `;
  document.head.appendChild(style);
}

let kinds: string[] = [];
let selectedSection = 0;
let chromeEl: HTMLDivElement | null = null;
let menuOpen = false;

function post<K extends keyof BridgeMessages>(type: K, payload: BridgeMessages[K]) {
  postToParent(type, payload);
}

function sections() {
  return Array.from(document.querySelectorAll('[data-section]'));
}

function sectionIndexOf(el: Element | null) {
  if (!el) return -1;
  const raw = el.getAttribute('data-section');
  const n = Number(raw);
  return Number.isFinite(n) ? n : -1;
}

function clearActive() {
  document.querySelectorAll('[data-edit-active]').forEach((el) => {
    el.removeAttribute('data-edit-active');
  });
  document.querySelectorAll('[data-section-active]').forEach((el) => {
    el.removeAttribute('data-section-active');
  });
}

function findEditable(path: string | null | undefined) {
  if (!path) return null;
  try {
    return document.querySelector(`[data-edit="${CSS.escape(path)}"]`);
  } catch {
    return document.querySelector(`[data-edit="${path.replace(/"/g, '\\"')}"]`);
  }
}

function findSection(index: number) {
  return document.querySelector(`[data-section="${index}"]`);
}

function ensureChrome(): HTMLDivElement {
  if (chromeEl) return chromeEl;
  const el = document.createElement('div');
  el.id = 'tb-ve-chrome';
  el.hidden = true;
  el.innerHTML = `
    <span class="tb-ve-kind"></span>
    <button type="button" data-chrome="menu" title="Block actions" aria-haspopup="true">⋯</button>
    <div class="tb-ve-menu" role="menu">
      <button type="button" data-action="up" role="menuitem">Move up</button>
      <button type="button" data-action="down" role="menuitem">Move down</button>
      <button type="button" data-action="dup" role="menuitem">Duplicate</button>
      <button type="button" data-action="del" role="menuitem">Delete</button>
    </div>
  `;
  document.body.appendChild(el);
  const menu = el.querySelector('.tb-ve-menu');
  el.querySelector('[data-chrome="menu"]')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    menuOpen = !menuOpen;
    menu?.classList.toggle('open', menuOpen);
  });
  el.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      menuOpen = false;
      menu?.classList.remove('open');
      const action = btn.getAttribute('data-action');
      if (!isBlockAction(action)) return;
      post('blockAction', { action, sectionIndex: selectedSection });
    });
  });
  chromeEl = el;
  return el;
}

function placeChrome(sectionEl: Element | null) {
  const chrome = ensureChrome();
  if (!sectionEl) {
    chrome.hidden = true;
    return;
  }
  const kind =
    sectionEl.getAttribute('data-section-kind') ||
    kinds[selectedSection] ||
    `Section ${selectedSection}`;
  const label = chrome.querySelector('.tb-ve-kind');
  if (label) label.textContent = kind;
  chrome.hidden = false;
  menuOpen = false;
  chrome.querySelector('.tb-ve-menu')?.classList.remove('open');

  const rect = sectionEl.getBoundingClientRect();
  const top = Math.max(8, window.scrollY + rect.top - 36);
  const left = Math.min(
    window.scrollX + rect.right - chrome.offsetWidth - 8,
    window.scrollX + window.innerWidth - chrome.offsetWidth - 8,
  );
  chrome.style.top = `${top}px`;
  chrome.style.left = `${Math.max(8, left)}px`;
}

function setActiveSection(index: number, path: string | null, opts: { scroll?: boolean } = {}) {
  const shouldScroll = opts.scroll !== false;
  clearActive();
  selectedSection = index;
  const sectionEl = findSection(index);
  if (sectionEl) {
    sectionEl.setAttribute('data-section-active', '1');
    if (shouldScroll && !path) {
      sectionEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }
  if (path) {
    const el = findEditable(path);
    if (el) {
      el.setAttribute('data-edit-active', '1');
      if (shouldScroll) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }
  placeChrome(sectionEl);
}

function restoreScroll(x: number, y: number) {
  const left = Number(x) || 0;
  const top = Number(y) || 0;
  window.scrollTo(left, top);
  requestAnimationFrame(() => placeChrome(findSection(selectedSection)));
}

function setActivePath(path: string | null) {
  const match = String(path || '').match(/^sections\.(\d+)/);
  const index = match ? Number(match[1]) : selectedSection;
  setActiveSection(index, path);
}

function rebuildInsertZones() {
  document.querySelectorAll('.tb-ve-insert').forEach((el) => el.remove());
  const list = sections();
  const parent = list[0]?.parentElement;
  if (!parent) return;

  const makeZone = (atIndex: number) => {
    const zone = document.createElement('div');
    zone.className = 'tb-ve-insert';
    zone.dataset.insertAt = String(atIndex);
    zone.innerHTML = `
      <div class="tb-ve-insert-hit">
        <button type="button" class="tb-ve-insert-btn" title="Add section here" aria-label="Add section here">+</button>
      </div>
    `;
    zone.querySelector('button')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      post('addAt', { index: atIndex });
    });
    return zone;
  };

  list.forEach((sectionEl, i) => {
    parent.insertBefore(makeZone(i), sectionEl);
  });
  parent.appendChild(makeZone(list.length));
}

function onClick(e: MouseEvent) {
  if (!(e.target instanceof Element)) return;
  if (e.target.closest('#tb-ve-chrome') || e.target.closest('.tb-ve-insert')) return;

  const field = e.target.closest('[data-edit]');
  const sectionEl = e.target.closest('[data-section]');
  if (!sectionEl && !field) return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  const index = sectionIndexOf(sectionEl) >= 0
    ? sectionIndexOf(sectionEl)
    : Number(String(field?.getAttribute('data-edit') || '').match(/^sections\.(\d+)/)?.[1]);

  if (!Number.isFinite(index)) return;

  let path: string | null = null;
  let kind: SelectKind = 'text';
  let value = '';
  if (field) {
    path = field.getAttribute('data-edit');
    const isImage =
      field.tagName === 'IMG' ||
      (path &&
        (path.endsWith('.src') || path.includes('.image.') || path.includes('.gallery.')));
    kind = isImage ? 'image' : 'text';
    value = isImage
      ? field.getAttribute('src') || field.getAttribute('href') || ''
      : (field.textContent || '').replace(/\s+/g, ' ').trim();
  }

  setActiveSection(index, path);
  post('select', {
    sectionIndex: index,
    path,
    kind,
    value,
  });
}

document.addEventListener('click', onClick, true);

document.addEventListener(
  'click',
  (e) => {
    if (!chromeEl || chromeEl.hidden) return;
    if (e.target instanceof Element && e.target.closest('#tb-ve-chrome')) return;
    menuOpen = false;
    chromeEl.querySelector('.tb-ve-menu')?.classList.remove('open');
  },
  true,
);

window.addEventListener('scroll', () => {
  if (chromeEl && !chromeEl.hidden) {
    placeChrome(findSection(selectedSection));
  }
}, true);

window.addEventListener('resize', () => {
  if (chromeEl && !chromeEl.hidden) {
    placeChrome(findSection(selectedSection));
  }
});

window.addEventListener('message', (e) => {
  const msg = readEditorMessage(e);
  if (!msg) return;
  switch (msg.type) {
    case 'ping': {
      announce();
      return;
    }
    case 'setSectionMeta': {
      kinds = msg.payload.kinds || [];
      if (typeof msg.payload.selectedSection === 'number') {
        selectedSection = msg.payload.selectedSection;
      }
      return;
    }
    case 'setDocumentMeta': {
      const { title, description } = msg.payload;
      if (typeof title === 'string') document.title = title;
      if (typeof description === 'string') {
        let meta = document.querySelector('meta[name="description"]');
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('name', 'description');
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', description);
      }
      return;
    }
    case 'highlight': {
      setActivePath(msg.payload.path);
      return;
    }
    case 'highlightSection': {
      setActiveSection(msg.payload.index ?? 0, msg.payload.path || null, {
        scroll: msg.payload.scroll !== false,
      });
      return;
    }
    case 'restoreScroll': {
      restoreScroll(msg.payload.x, msg.payload.y);
      return;
    }
    case 'setText': {
      const { path, value } = msg.payload;
      const el = findEditable(path);
      if (el) el.textContent = value ?? '';
      return;
    }
    case 'setAttr': {
      const { path, attr, value } = msg.payload;
      if (!attr) return;
      let el = findEditable(path);
      // Fallback: section images that weren't stamped with data-edit yet.
      if (!el && path && attr === 'src') {
        const m = String(path).match(/^sections\.(\d+)\.(.+)$/);
        if (m) {
          const section = document.querySelector(`[data-section="${m[1]}"]`);
          const rel = m[2] ?? '';
          el =
            section?.querySelector(`[data-edit="${CSS.escape(path)}"]`) ||
            section?.querySelector(`img[data-edit$="${CSS.escape(rel)}"]`) ||
            null;
        }
      }
      if (!el) return;
      el.setAttribute(attr, value ?? '');
      // Astro/Cloudinary <Image> serves via srcset — clear it so src wins immediately.
      if (attr === 'src') {
        const found = el.tagName === 'IMG' ? [el] : Array.from(el.querySelectorAll('img'));
        for (const img of found.length ? found : [el]) {
          if (img.tagName !== 'IMG') continue;
          img.setAttribute('src', value ?? '');
          img.removeAttribute('srcset');
          img.removeAttribute('sizes');
        }
      }
      return;
    }
    case 'setHtml': {
      const { path, value } = msg.payload;
      const el = findEditable(path);
      if (el) el.innerHTML = value ?? '';
      return;
    }
    case 'moveSection': {
      const { from, to } = msg.payload;
      const list = sections();
      if (
        typeof from !== 'number' ||
        typeof to !== 'number' ||
        from < 0 ||
        to < 0 ||
        from >= list.length ||
        to >= list.length
      ) {
        return;
      }
      const el = list[from];
      const parent = el?.parentElement;
      if (!el || !parent) return;
      const target = list[to];
      if (!target) return;
      if (from < to) {
        parent.insertBefore(el, target.nextSibling);
      } else {
        parent.insertBefore(el, target);
      }
      reindexSectionDom();
      rebuildInsertZones();
      return;
    }
    case 'removeSection': {
      const el = findSection(msg.payload.index);
      if (el) el.remove();
      reindexSectionDom();
      rebuildInsertZones();
      clearActive();
      placeChrome(null);
      return;
    }
    case 'insertSectionHtml': {
      const { index, html } = msg.payload;
      const list = sections();
      const parent = list[0]?.parentElement || document.querySelector('main') || document.body;
      const wrap = document.createElement('div');
      wrap.innerHTML = html || '';
      const node = wrap.firstElementChild;
      if (!node) return;
      const at = Math.max(0, Math.min(Number(index) || 0, list.length));
      const before = list[at];
      if (!before) {
        parent.appendChild(node);
      } else {
        parent.insertBefore(node, before);
      }
      reindexSectionDom();
      rebuildInsertZones();
      return;
    }
    case 'replaceSectionHtml': {
      const { index, html } = msg.payload;
      const el = findSection(index);
      if (!el) return;
      const wrap = document.createElement('div');
      wrap.innerHTML = html || '';
      const node = wrap.firstElementChild;
      if (!node) return;
      el.replaceWith(node);
      reindexSectionDom();
      rebuildInsertZones();
      return;
    }
    case 'reindexSections': {
      if (Array.isArray(msg.payload.kinds)) {
        kinds = msg.payload.kinds;
      }
      reindexSectionDom();
      rebuildInsertZones();
      return;
    }
    default: {
      // Exhaustive at compile time; a stale peer sending an unknown type is ignored.
      const unhandled: never = msg;
      void unhandled;
    }
  }
});

function reindexSectionDom() {
  const list = sections();
  list.forEach((el, i) => {
    el.setAttribute('data-section', String(i));
    // Remap data-edit paths that start with sections.<old>.
    el.querySelectorAll('[data-edit]').forEach((field) => {
      const path = field.getAttribute('data-edit') || '';
      const m = path.match(/^sections\.(\d+)(.*)$/);
      if (!m) return;
      field.setAttribute('data-edit', `sections.${i}${m[2]}`);
    });
  });
}

function announce() {
  rebuildInsertZones();
  post('ready', {
    count: document.querySelectorAll('[data-edit]').length,
    sections: sections().length,
    href: location.pathname + location.search,
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', announce);
} else {
  announce();
}
document.addEventListener('astro:page-load', announce);
setTimeout(announce, 300);
}
