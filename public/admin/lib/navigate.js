// Generated from src/admin-client by `npm run build:admin` — do not edit.
function editorPathFor(pageId, opts) {
  const base = `/admin/pages/${encodeURIComponent(String(pageId || "").trim())}`;
  if (!opts) return base;
  const params = new URLSearchParams();
  if (opts.section != null && Number.isFinite(opts.section)) {
    params.set("section", String(opts.section));
  }
  if (opts.path) params.set("path", opts.path);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}
function hardNavigate(pathOrUrl) {
  const url = new URL(pathOrUrl, window.location.href);
  const href = url.href;
  const path = `${url.pathname}${url.search}${url.hash}`;
  const a = document.createElement("a");
  a.href = path;
  a.setAttribute("data-astro-reload", "");
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  try {
    if (window.top && window.top !== window.self) {
      window.top.location.replace(href);
      return href;
    }
  } catch {
  }
  window.location.replace(href);
  return href;
}
export {
  editorPathFor,
  hardNavigate
};
