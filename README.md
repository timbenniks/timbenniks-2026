# timbenniks.dev (2026)

Personal site of Tim Benniks. Writing, talks, videos, projects.

Static Astro 7 site, deployed to Vercel. Zero JS frameworks in the browser, zero hydration islands. Designed to be fast, accessible, machine-readable, and dead simple to maintain.

## Stack

- **[Astro 7](https://astro.build)** — static output, no framework runtime, content collections.
- **[Tailwind CSS 4](https://tailwindcss.com)** — design tokens declared via `@theme` in [`src/styles/global.css`](src/styles/global.css).
- **Astro Fonts API** — self-hosted Fraunces / Inter / JetBrains Mono through the Google provider, with `size-adjust` fallbacks.
- **[Pagefind](https://pagefind.app)** — build-time full-text + faceted search at [`/search`](src/pages/search.astro).
- **[lite-youtube-embed](https://github.com/paulirish/lite-youtube-embed)** — facade-pattern YouTube embeds that defer the real iframe until click.
- **[`@astrojs/sitemap`](https://docs.astro.build/en/guides/integrations-guide/sitemap/)** — `/sitemap-index.xml`, with `.md`/`.txt`/`.xml` twins and `/search` filtered out.
- **[`@astrojs/rss`](https://docs.astro.build/en/recipes/rss/)** — writing feed at `/feed.xml`.
- **View Transitions** (`<ClientRouter />`) — cross-page transitions with built-in prefetch.
- **[Plausible](https://plausible.io)** — production-only analytics, no cookies.

## Project structure

```
src/
├── admin-client/           Admin browser UI (TypeScript → public/admin via build:admin)
├── assets/                 Local images for hero / about / press-kit (astro:assets pipeline)
├── components/
│   ├── admin/              Admin layout shells
│   ├── primitives/         Tiny, single-purpose: Button, ArrowLink, Container, Section, …
│   ├── sections/           Composed page-level blocks (HeroSection, CardGridSection, …)
│   ├── Card.astro          Polymorphic card (feature / standard / row × article/video/talk/project)
│   ├── SiteNav.astro
│   └── SiteFooter.astro
├── content/
│   ├── pages.json          Marketing page metadata + sections (CMS)
│   ├── site.json           Nav, footer, newsletter chrome (CMS)
│   ├── writing/            Essays (markdown)
│   ├── videos/{playlist}/  YouTube videos (markdown stubs)
│   └── speaking/           Conference talks (frontmatter only)
├── data/
│   ├── site.ts             SITE_URL, seo defaults, copy helpers
│   └── projects.ts         Project list shown on /projects
├── lib/
│   ├── admin/              Auth, GitHub CMS, Cloudinary, preview drafts, …
│   ├── card.ts             Collection-entry → CardItem mappers
│   ├── cloudinary.ts       Cloudinary + YouTube thumbnail URL/srcset helpers
│   ├── collections.ts      loadAllSorted() — used by /llms.txt, /llms-full.txt, /sitemap.md
│   ├── markdown.ts         YAML front-matter helpers, createMarkdownRoute factory, response helpers
│   ├── schema.ts           JSON-LD builders (WebSite, WebPage, BlogPosting, BreadcrumbList)
│   ├── searchCard.ts       Pagefind result → HTML
│   ├── stats.ts            yearsActive()
│   ├── static-pages-prose.ts  Prose summaries of static pages, for /llms-full.txt
│   └── tags.ts             Canonical 17-tag taxonomy + label/normalize helpers
├── layouts/BaseLayout.astro
├── pages/                  Routes (see below) — includes /admin/*
├── styles/
│   ├── global.css          Tokens (@theme), :focus-visible, prefers-reduced-motion
│   └── article.css         Markdown body typography
└── content.config.ts       Zod schemas + glob loaders
```

Admin visual editor + WebMCP agent: [`docs/admin-editor.md`](docs/admin-editor.md), [`docs/admin-webmcp.md`](docs/admin-webmcp.md).

## Scripts

| Command              | What it does                                                      |
| -------------------- | ----------------------------------------------------------------- |
| `npm run dev`        | `build:admin` then Astro dev server at http://localhost:4321      |
| `npm run build`      | `build:admin`, `astro build`, then Pagefind into the Vercel output |
| `npm run build:admin`| Compile `src/admin-client/` → `public/admin/` (esbuild, unbundled) |
| `npm run dev:admin`  | Watch-mode admin client build (run beside `npm run dev`)          |
| `npm run preview`    | Serve the built site locally (real Pagefind index)                |
| `npm run check`      | `astro check` — type-check `.astro` + TypeScript                  |
| `npm run test:e2e`   | Playwright admin suite (`pretest:e2e` rebuilds admin client)      |

> Pagefind only exists after a real build. Use `npm run preview` (not `dev`) to test search.

## Content model

Three content collections under `src/content/`. Schemas live in [`src/content.config.ts`](src/content.config.ts) with `.loose()` to permit extra fields like `head` / `faqs` / `id` from external CMS imports.

| Collection | Loader pattern                  | Required frontmatter                                                                                         | Body |
| ---------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---- |
| `writing`  | `**/*.md`                       | `title`, `date` (+ optional `description`, `tags`, `image`, `reading_time`, `canonical_url`, `draft`)        | yes  |
| `videos`   | `*/*.md` (one dir per playlist) | `title`, `date`, `videoId`, `playlist` (+ optional `description`, `image`, `duration`, `tags`, `transcript`) | yes  |
| `speaking` | `**/*.md` (`retainBody: false`) | `conference`, `talk`, `date` (+ optional `location`, `link`)                                                 | no   |

Tags are loose `string[]` validated downstream against the canonical vocabulary in [`src/lib/tags.ts`](src/lib/tags.ts) (17 slugs, lowercase kebab-case). `tagLabel(slug)` formats them for display.

Drafts (`draft: true` on writing entries) are filtered everywhere: index, tag pages, RSS, sitemap, llms.txt, llms-full.txt, and the `.md` companion route.

## Routes

### Pages

| Path                          | Description                                                  |
| ----------------------------- | ------------------------------------------------------------ |
| `/`                           | Home — hero, thesis, recent writing, projects, videos, talks |
| `/about`                      | Bio, beliefs, career arc                                     |
| `/writing`                    | Featured + tag chips + chronological list                    |
| `/writing/[slug]`             | Full essay                                                   |
| `/writing/tag/[tag]`          | All writing for a given tag                                  |
| `/videos`                     | Featured + playlist chips + grid of all videos               |
| `/videos/[slug]`              | Single video page with `<lite-youtube>` embed                |
| `/videos/playlist/[playlist]` | All videos in a playlist                                     |
| `/speaking`                   | Hero + upcoming + chronological archive                      |
| `/projects`                   | Project cards + contact                                      |
| `/press-kit`                  | Bios, headshots, talk topics, booking                        |
| `/uses`                       | Hardware / software / A-V kit                                |
| `/search`                     | Pagefind UI with type/tag/year filters and URL-state         |
| `/admin`                      | CMS desk (auth-gated) — see [`docs/admin-editor.md`](docs/admin-editor.md) |
| `/404`                        | Static 404 page                                              |

### Machine-readable surfaces (the GEO layer)

Designed for LLM/agent consumption. See [`src/pages/agents.md.ts`](src/pages/agents.md.ts) for the contract.

| Path                 | What it is                                                                   |
| -------------------- | ---------------------------------------------------------------------------- |
| `/feed.xml`          | RSS 2.0 of writing                                                           |
| `/sitemap-index.xml` | XML sitemap (filtered: no `.md`/`.txt`/`.xml`/`/search`)                     |
| `/sitemap.md`        | Markdown mirror of the sitemap, every entry includes a `.md` companion       |
| `/robots.txt`        | Allow-all + sitemap pointer                                                  |
| `/llms.txt`          | [llmstxt.org](https://llmstxt.org) format — curated link index               |
| `/llms-full.txt`     | Full corpus inlined as markdown (every writing entry, video metadata, talks) |
| `/agents.md`         | Guide for agents about the surfaces above                                    |
| `/writing/<slug>.md` | Markdown twin of any writing page                                            |
| `/videos/<slug>.md`  | Markdown twin of any video page (frontmatter + transcript when available)    |

Article and video HTML pages emit `<link rel="alternate" type="text/markdown">` for autodiscovery.

[`vercel.json`](vercel.json) also content-negotiates: requests with `Accept: text/markdown` to a canonical URL get rewritten to the `.md` twin (with route-specific `:slug` patterns that exclude `tag/`/`playlist/`/`index`).

## Image handling

- **Local images** ([`src/assets/`](src/assets/)) go through `astro:assets` → AVIF/WebP with srcset.
- **Remote Cloudinary images** in card thumbnails go through [`src/lib/cloudinary.ts`](src/lib/cloudinary.ts) — injects `f_auto,q_auto,w_<n>` and produces a 4-step srcset. Authorized in `astro.config.mjs` via `image.remotePatterns`.
- **YouTube thumbnails** (`i.ytimg.com`/`img.youtube.com`) get quality-step srcsets (`mqdefault` / `hqdefault` / `maxresdefault`).
- All card `<img>` tags ship explicit `width` + `height` to prevent CLS.
- **YouTube embeds** use `<lite-youtube>` — a 6 KB facade that defers the real iframe until click.

## SEO and structured data

Every page emits:

- Canonical URL, full OG + Twitter card meta.
- JSON-LD: `WebSite` + `WebPage`.
- `noindex` opt-in via `<BaseLayout noindex>` (e.g. on `/search`).

Article pages also emit `BlogPosting` + `BreadcrumbList`. Listing/detail pages emit `BreadcrumbList`. Built in [`src/components/primitives/SEO.astro`](src/components/primitives/SEO.astro) and [`src/lib/schema.ts`](src/lib/schema.ts).

## Accessibility

Targeting WCAG 2.2 AA. Implemented:

- Skip-to-content link in [`BaseLayout.astro`](src/layouts/BaseLayout.astro), `<main id="main-content">`.
- `<h1>` on every page (including tag/playlist routes).
- 2 px `:focus-visible` outline globally; explicit accent-colored outlines on form fields.
- Color tokens meet AA at small text sizes (`--color-ink-subtle: #6b6b6b` on cream, `--color-cream-subtle: #9a9a9a` on dark).
- `<time datetime="…">` always valid ISO 8601.
- External links advertise themselves via visually-hidden `(opens in a new tab)`.
- Decorative background images use `alt=""` + `aria-hidden="true"`.
- `prefers-reduced-motion: reduce` disables transitions and animations globally.
- `lang="en"` on `<html>`, `role="search"` on the search form, `aria-live="polite"` on result status, `aria-pressed` on filter buttons.

## Performance

- Zero hydration JS on the **public** site. The only public client-side scripts:
  - `<ClientRouter />` for view transitions (~5.5 KB gzipped, site-wide).
  - `<lite-youtube>` on video detail pages.
  - Pagefind, dynamically imported only on `/search`.
  - Admin (`/admin/*`) loads compiled modules from `/admin/*.js` (built from `src/admin-client/`); those never ship on public pages.
- Tailwind v4 single CSS bundle (~7 KB gzipped).
- Fonts: `<Font preload>` on Fraunces only; Inter and JetBrains Mono lazy-load with `font-display: swap`.
- `vercel.json` sets `Cache-Control: public, max-age=31536000, immutable` on `/_astro/*`.

## Search

Pagefind indexes any element with `data-pagefind-body`. Filters are emitted as hidden `<span data-pagefind-filter="…">` markers from each detail page:

- `type:writing` / `type:video`
- `tag:<slug>`
- `year:<YYYY>`
- `playlist:<name>` (videos only)

The UI in [`/search`](src/pages/search.astro) supports query, type pills, tag chips with counts, year dropdown, debouncing, stale-result guarding, and full URL-state restoration (`?q=&type=&tags=&year=`).

## Configuration

- [`astro.config.ts`](astro.config.ts) — site URL, fonts, Cloudinary image service, sitemap filter, Tailwind plugin, Pagefind externalization; seeds `.env` into `process.env` via Vite `loadEnv`.
- [`vercel.json`](vercel.json) — cache headers + content-negotiation rewrites for the markdown twins.
- [`src/data/site.ts`](src/data/site.ts) — `SITE_URL`, copy, nav, footer columns.

## Deploy

Pushes to `main` deploy to Vercel automatically. The `build` script bundles Pagefind index generation, so no Vercel-specific configuration is needed beyond `vercel.json`.

After deploy, verify content negotiation works:

```sh
curl -H 'Accept: text/markdown' https://timbenniks.dev/writing/<some-slug>
# → should return the markdown twin
```
