// HTML mirror of <Card format="search" />. Pagefind renders results client-side
// so we cannot reuse the Astro component directly; this function produces matching
// markup. Visual parity with Card.astro must be maintained by hand.

export type SearchResult = {
  url: string;
  excerpt: string;
  meta: { title?: string; date?: string; image?: string };
  filters: Record<string, string[]>;
  sub_results?: Array<{ title: string; excerpt: string; url: string }>;
  word_count: number;
};

function escapeHTML(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(+d)) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function typeLabel(t: string | undefined): string {
  if (t === 'writing') return 'Essay';
  if (t === 'video') return 'Video';
  return '';
}

export function renderSearchCardHTML(d: SearchResult): string {
  const type = d.filters?.type?.[0] ?? '';
  const title = d.meta.title ?? d.url;
  const date = formatDate(d.meta.date);
  const image = d.meta.image ?? '';
  const excerpt = d.excerpt ?? '';
  const safeTitle = escapeHTML(title);
  const safeType = escapeHTML(typeLabel(type));
  const subs = (d.sub_results ?? []).slice(1, 3);

  return `
    <li class="group border-t border-line first:border-t-0">
      <a href="${escapeHTML(d.url)}" class="grid grid-cols-1 gap-4 py-6 no-underline md:grid-cols-[140px_1fr] md:gap-6">
        ${image
          ? `<div class="aspect-video overflow-hidden rounded border border-line bg-bg-soft md:aspect-video">
               <img src="${escapeHTML(image)}" alt="" loading="lazy" decoding="async" class="h-full w-full object-cover" />
             </div>`
          : '<div class="hidden md:block"></div>'}
        <div class="min-w-0">
          <div class="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-ink-subtle">
            ${safeType ? `<span class="text-accent">${safeType}</span>` : ''}
            ${safeType && date ? '<span aria-hidden="true">·</span>' : ''}
            ${date ? `<time>${escapeHTML(date)}</time>` : ''}
          </div>
          <h3 class="mt-2 font-serif text-2xl leading-snug text-ink group-hover:underline group-hover:underline-offset-[3px]">${safeTitle}</h3>
          <p class="pf-excerpt mt-2 line-clamp-3 text-sm text-ink-muted">${excerpt}</p>
          ${subs.length
            ? `<ul class="mt-3 flex flex-col gap-1.5 border-l-2 border-line pl-3 text-xs text-ink-muted">
                 ${subs.map((s) => `<li><span class="font-medium text-ink">${escapeHTML(s.title)}</span> — ${s.excerpt}</li>`).join('')}
               </ul>`
            : ''}
        </div>
      </a>
    </li>
  `;
}
