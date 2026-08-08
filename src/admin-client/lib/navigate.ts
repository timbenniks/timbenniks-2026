/**
 * Hard top-level navigation for admin desk/editor.
 * Setting location during an agent tool loop is often cancelled by the next chat
 * fetch or by focusing the composer in finally — callers must stop the turn first.
 */
export function editorPathFor(pageId: unknown): string {
  return `/admin/pages/${encodeURIComponent(String(pageId || '').trim())}`;
}

/** @returns the href that was navigated to */
export function hardNavigate(pathOrUrl: string): string {
  const url = new URL(pathOrUrl, window.location.href);
  const href = url.href;
  const path = `${url.pathname}${url.search}${url.hash}`;

  // Real anchor navigation is more reliable than location.* in async tool handlers.
  const a = document.createElement('a');
  a.href = path;
  a.setAttribute('data-astro-reload', '');
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();

  try {
    if (window.top && window.top !== window.self) {
      window.top.location.replace(href);
      return href;
    }
  } catch {
    /* cross-origin top */
  }
  window.location.replace(href);
  return href;
}
