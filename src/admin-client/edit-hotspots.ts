/**
 * Hover CTAs on live pages when edit markup is enabled (TB_EDIT_MODE).
 * Deeplinks into `/admin/pages/:id?section=&path=` — not used inside the editor iframe.
 *
 * The chip is mounted inside the hovered `[data-section]` (absolute) so moving the
 * pointer onto it never leaves the hover target.
 *
 * Hovering `[data-edit-list]` shows an “Add …” chip that deep-links with `addList=`.
 */
function prettyKind(kind: string): string {
  return kind
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function prettyField(path: string, sectionIndex: number): string {
  const raw = path.replace(new RegExp(`^sections\\.${sectionIndex}\\.`), '');
  return raw
    .split('.')
    .map((part) => {
      if (/^\d+$/.test(part)) return `#${Number(part) + 1}`;
      return part
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    })
    .join(' · ');
}

function prettyListKey(listKey: string): string {
  const singular = listKey.replace(/s$/, '');
  return singular
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function listKeyFromPath(listPath: string): string | null {
  const parts = String(listPath || '').split('.').filter(Boolean);
  return parts[parts.length - 1] || null;
}

function editorHref(
  pageId: string,
  section: number,
  opts?: { path?: string | null; addList?: string | null },
): string {
  const url = new URL(`/admin/pages/${encodeURIComponent(pageId)}`, location.origin);
  url.searchParams.set('section', String(section));
  if (opts?.addList) url.searchParams.set('addList', opts.addList);
  else if (opts?.path) url.searchParams.set('path', opts.path);
  return url.pathname + url.search;
}

function ensureStyles() {
  if (document.getElementById('tb-edit-hotspot-style')) return;
  const style = document.createElement('style');
  style.id = 'tb-edit-hotspot-style';
  style.textContent = `
    [data-section] {
      position: relative;
    }
    [data-edit-list] {
      width: fit-content;
      max-width: 100%;
    }
    .tb-edit-hotspot {
      position: absolute;
      z-index: 40;
      top: 0.5rem;
      right: 0.5rem;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      max-width: min(280px, calc(100% - 1rem));
      padding: 0.28rem 0.55rem;
      border-radius: 999px;
      background: #1c1917;
      color: #fff;
      font: 600 11px/1.2 ui-sans-serif, system-ui, sans-serif;
      letter-spacing: 0.02em;
      text-decoration: none;
      box-shadow: 0 6px 18px rgba(28, 25, 23, 0.28);
      opacity: 0;
      pointer-events: none;
      transform: translateY(2px);
      transition: opacity 0.12s ease, transform 0.12s ease;
    }
    .tb-edit-hotspot.is-on {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }
    .tb-edit-hotspot.is-field {
      right: auto;
    }
    .tb-edit-hotspot.is-list-add {
      position: relative;
      top: auto;
      right: auto;
      left: auto;
      flex: 0 0 auto;
      align-self: center;
      background: #e85d3a;
      transform: none;
      max-width: none;
    }
    .tb-edit-hotspot.is-list-add.is-on {
      transform: none;
    }
    .tb-edit-hotspot:hover,
    .tb-edit-hotspot:focus-visible {
      background: #e85d3a;
      outline: none;
    }
    .tb-edit-hotspot.is-list-add:hover,
    .tb-edit-hotspot.is-list-add:focus-visible {
      background: #1c1917;
    }
    .tb-edit-hotspot .tb-edit-hotspot-mark {
      display: inline-block;
      width: 0.4rem;
      height: 0.4rem;
      border-radius: 999px;
      background: #e85d3a;
      flex-shrink: 0;
    }
    .tb-edit-hotspot.is-list-add .tb-edit-hotspot-mark {
      background: #fff;
    }
    .tb-edit-hotspot:hover .tb-edit-hotspot-mark,
    .tb-edit-hotspot:focus-visible .tb-edit-hotspot-mark {
      background: #fff;
    }
    .tb-edit-hotspot-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `;
  document.head.appendChild(style);
}

function bootHotspots() {
  ensureStyles();

  const tip = document.createElement('a');
  tip.className = 'tb-edit-hotspot';
  tip.innerHTML = `<span class="tb-edit-hotspot-mark" aria-hidden="true"></span><span class="tb-edit-hotspot-label"></span>`;
  tip.setAttribute('data-astro-reload', '');

  const labelEl = tip.querySelector('.tb-edit-hotspot-label');
  let hideTimer: ReturnType<typeof setTimeout> | null = null;
  let activeKey = '';
  let hostSection: Element | null = null;
  let hostList: Element | null = null;

  function clearHide() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function hide() {
    clearHide();
    tip.classList.remove('is-on', 'is-field', 'is-list-add');
    tip.style.top = '';
    tip.style.left = '';
    tip.style.right = '';
    activeKey = '';
    hostSection = null;
    hostList = null;
    tip.remove();
  }

  function scheduleHide() {
    clearHide();
    hideTimer = setTimeout(hide, 220);
  }

  function placeInSection(section: Element, field: Element | null) {
    if (tip.parentElement !== section) section.appendChild(tip);
    hostList = null;

    if (!field) {
      tip.classList.remove('is-field');
      tip.style.top = '';
      tip.style.left = '';
      tip.style.right = '';
      return;
    }

    tip.classList.add('is-field');
    const sectionRect = section.getBoundingClientRect();
    const fieldRect = field.getBoundingClientRect();
    const top = Math.max(8, fieldRect.top - sectionRect.top - 2);
    let left = fieldRect.right - sectionRect.left - (tip.offsetWidth || 120);
    left = Math.min(Math.max(8, left), Math.max(8, sectionRect.width - (tip.offsetWidth || 120) - 8));
    tip.style.top = `${Math.round(top)}px`;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.right = 'auto';
  }

  function placeInList(listEl: Element) {
    if (tip.parentElement !== listEl) listEl.appendChild(tip);
    hostList = listEl;
    tip.classList.remove('is-field');
    tip.classList.add('is-list-add');
    tip.style.top = '';
    tip.style.left = '';
    tip.style.right = '';
  }

  function showFor(target: Element) {
    const field = target.closest('[data-edit]');
    // List-add when hovering the CTA row (including labels inside it).
    // Field edit chip still wins only when the leaf is outside a list.
    const listEl = target.closest('[data-edit-list]');
    const section = target.closest('[data-section]');
    if (!section) {
      scheduleHide();
      return;
    }

    const pageId =
      section.getAttribute('data-page-id') ||
      document.documentElement.getAttribute('data-tb-page-id') ||
      '';
    if (!pageId) {
      scheduleHide();
      return;
    }

    const sectionIndex = Number(section.getAttribute('data-section'));
    if (!Number.isFinite(sectionIndex)) {
      scheduleHide();
      return;
    }

    clearHide();
    hostSection = section;

    if (listEl) {
      const listPath = listEl.getAttribute('data-edit-list') || '';
      const listKey = listKeyFromPath(listPath);
      if (!listKey) {
        scheduleHide();
        return;
      }
      const key = `${pageId}:${sectionIndex}:add:${listKey}`;
      if (key !== activeKey) {
        activeKey = key;
        const label = `Add ${prettyListKey(listKey)}`;
        if (labelEl) labelEl.textContent = label;
        tip.href = editorHref(pageId, sectionIndex, { addList: listKey });
        tip.title = `Add ${listKey} in admin editor`;
      }
      tip.classList.add('is-on');
      placeInList(listEl);
      return;
    }

    tip.classList.remove('is-list-add');
    const kind = section.getAttribute('data-section-kind') || `Section ${sectionIndex}`;
    const path = field?.getAttribute('data-edit') || null;
    const key = `${pageId}:${sectionIndex}:${path || ''}`;

    if (key !== activeKey) {
      activeKey = key;
      const text = path
        ? `Edit ${prettyField(path, sectionIndex)}`
        : `Edit ${prettyKind(kind)}`;
      if (labelEl) labelEl.textContent = text;
      tip.href = editorHref(pageId, sectionIndex, { path });
      tip.title = path
        ? `Open ${path} in admin editor`
        : `Open ${kind} (section ${sectionIndex}) in admin editor`;
    }

    tip.classList.add('is-on');
    placeInSection(section, field);
  }

  document.addEventListener(
    'pointerover',
    (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest('.tb-edit-hotspot')) {
        clearHide();
        return;
      }
      if (t.closest('[data-section]')) {
        showFor(t);
        return;
      }
      scheduleHide();
    },
    true,
  );

  document.addEventListener(
    'pointerout',
    (e) => {
      const related = e.relatedTarget;
      if (related instanceof Element) {
        if (related.closest('.tb-edit-hotspot')) return;
        if (hostList && hostList.contains(related)) return;
        if (hostSection && hostSection.contains(related)) return;
        if (related.closest('[data-section]')) return;
      }
      if (!(e.target instanceof Element)) return;
      if (
        e.target.closest('.tb-edit-hotspot') ||
        e.target.closest('[data-edit-list]') ||
        e.target.closest('[data-section]')
      ) {
        scheduleHide();
      }
    },
    true,
  );

  window.addEventListener(
    'scroll',
    () => {
      if (!tip.classList.contains('is-on')) return;
      if (tip.classList.contains('is-list-add') && hostList) {
        placeInList(hostList);
        return;
      }
      if (hostSection) {
        const field = tip.classList.contains('is-field')
          ? hostSection.querySelector('[data-edit]:hover')
          : null;
        placeInSection(hostSection, field);
      }
    },
    true,
  );

  document.addEventListener('astro:page-load', () => {
    ensureStyles();
    hide();
  });
}

bootHotspots();
