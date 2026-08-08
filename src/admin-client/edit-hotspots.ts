/**
 * Hover CTAs on live pages when edit markup is enabled (TB_EDIT_MODE).
 * Deeplinks into `/admin/pages/:id?section=&path=` — not used inside the editor iframe.
 *
 * The chip is mounted inside the hovered `[data-section]` (absolute) so moving the
 * pointer onto it never leaves the hover target.
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

function editorHref(pageId: string, section: number, path?: string | null): string {
  const url = new URL(`/admin/pages/${encodeURIComponent(pageId)}`, location.origin);
  url.searchParams.set('section', String(section));
  if (path) url.searchParams.set('path', path);
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
      /* Pin near the hovered field instead of the section corner. */
      right: auto;
    }
    .tb-edit-hotspot:hover,
    .tb-edit-hotspot:focus-visible {
      background: #e85d3a;
      outline: none;
    }
    .tb-edit-hotspot .tb-edit-hotspot-mark {
      display: inline-block;
      width: 0.4rem;
      height: 0.4rem;
      border-radius: 999px;
      background: #e85d3a;
      flex-shrink: 0;
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

  function clearHide() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function hide() {
    clearHide();
    tip.classList.remove('is-on', 'is-field');
    tip.style.top = '';
    tip.style.left = '';
    tip.style.right = '';
    activeKey = '';
    hostSection = null;
    tip.remove();
  }

  function scheduleHide() {
    clearHide();
    hideTimer = setTimeout(hide, 220);
  }

  function placeInSection(section: Element, field: Element | null) {
    if (tip.parentElement !== section) section.appendChild(tip);

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

  function showFor(target: Element) {
    const field = target.closest('[data-edit]');
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

    const kind = section.getAttribute('data-section-kind') || `Section ${sectionIndex}`;
    const path = field?.getAttribute('data-edit') || null;
    const key = `${pageId}:${sectionIndex}:${path || ''}`;

    clearHide();
    hostSection = section;

    if (key !== activeKey) {
      activeKey = key;
      const text = path
        ? `Edit ${prettyField(path, sectionIndex)}`
        : `Edit ${prettyKind(kind)}`;
      if (labelEl) labelEl.textContent = text;
      tip.href = editorHref(pageId, sectionIndex, path);
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
      // Still inside the chip or its host section → keep showing.
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
        if (hostSection && hostSection.contains(related)) return;
        if (related.closest('[data-section]')) return;
      }
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('.tb-edit-hotspot') || e.target.closest('[data-section]')) {
        scheduleHide();
      }
    },
    true,
  );

  window.addEventListener(
    'scroll',
    () => {
      if (tip.classList.contains('is-on') && hostSection) {
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
