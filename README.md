# timbenniks.dev (2026)

Personal site of Tim Benniks. Writing, talks, videos. Built with Astro 6 + Tailwind 4.

## Stack

- **Astro 6** — static site, no framework runtime in the browser.
- **Tailwind CSS 4** — design tokens via `@theme` in `src/styles/global.css`.
- **Astro Fonts API** — self-hosted Fraunces / Inter / JetBrains Mono via Google provider.
- **Pagefind** — build-time full-text + faceted search at `/search`.
- **`@astrojs/sitemap`** — `sitemap-index.xml` generated on build.
- **`@astrojs/rss`** — feed at `/feed.xml`.
- **View Transitions** (`<ClientRouter />`) — SPA-style navigation with prefetch.
- **Plausible Analytics** — production-only, privacy-friendly.

## Scripts

| Command           | What it does                                           |
| ----------------- | ------------------------------------------------------ |
| `npm run dev`     | Dev server at http://localhost:4321                    |
| `npm run build`   | `astro build` then `pagefind --site dist`              |
| `npm run preview` | Serve the built site locally                           |
| `npm run check`   | `astro check` — type-check `.astro` and TS             |

## Content model

Three content collections under `src/content/`:

- **writing/** — markdown essays. Fields: `title`, `description`, `date`, `image`, `tags`, `reading_time`, `draft`.
- **videos/{playlist}/** — markdown stubs for each video. Fields: `title`, `description`, `date`, `videoId`, `playlist`, `duration`, `tags`, `image`.
- **speaking/** — markdown stubs for each talk (`retainBody: false`). Fields: `conference`, `talk`, `location`, `date`, `link`.

Schemas in [`src/content.config.ts`](src/content.config.ts).

## Routes

- `/` — home (hero + sections)
- `/writing`, `/writing/[slug]`, `/writing/tag/[tag]`
- `/videos`, `/videos/[slug]`, `/videos/playlist/[playlist]`
- `/speaking`
- `/about`, `/projects`, `/uses`, `/press-kit`
- `/search` — Pagefind UI
- `/feed.xml`, `/sitemap-index.xml`, `/robots.txt`, `/404`

## SEO

Every page emits canonical URL, full Open Graph + Twitter card, JSON-LD (`WebSite` + `WebPage`).
Article pages also emit `BlogPosting` + `BreadcrumbList`. Listing pages emit `BreadcrumbList`.
See [`src/components/primitives/SEO.astro`](src/components/primitives/SEO.astro) and [`src/lib/schema.ts`](src/lib/schema.ts).

## Deploy

Vercel. The `build` script handles Pagefind indexing as part of the build.
