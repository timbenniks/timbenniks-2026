# Visual page editor

Storyblok-inspired visual editor for marketing pages in `src/content/pages.json`, plus site chrome in `src/content/site.json`.

Draft staging model: **Save** stores pending work in the browser (IndexedDB); **Changes** reviews local drafts vs published content; **Publish** writes `pages.json` / `site.json` — to the local working tree in `astro dev`, or straight to GitHub **`main`** in production (Vercel deploys from `main`). Production public pages never load admin edit code.

## Local

1. Put secrets in `.env` at the repo root (gitignored). `astro.config.ts` seeds them into `process.env`; admin server modules also read via [`serverEnv()`](../src/lib/admin/server-env.ts) so `import.meta.env` works in `astro dev`.
2. Set `ADMIN_PASSWORD` (optional in `astro dev` — auth bypassed if unset).
3. Set `GITHUB_TOKEN` + `GITHUB_REPO` for **production** Publish (GitHub Contents API → `main`). In local `astro dev`, Publish always writes `src/content/*.json` on disk — even when those vars are set — so you can edit and commit yourself.
4. `npm run dev` (runs `build:admin` first via `predev`)
5. Open [http://localhost:4321/admin](http://localhost:4321/admin)
6. Edit a page → **Save** (local draft) → open **Changes** → **Publish to working tree**

Detection: [`preferLocalWorkingTree()`](../src/lib/admin/github-git.ts) is `import.meta.env.DEV`. [`usesGitHubCms()`](../src/lib/admin/github-git.ts) is true only when GitHub is configured **and** you are not in DEV.

Public pages load content with `fs.readFile` (not a Vite import). A small Vite plugin in `astro.config.ts` watches `pages.json` / `site.json` and triggers a full browser reload when those files change — so Publish-to-disk or hand-edits refresh localhost without restarting `astro dev`.

### E2E tests

```bash
npm run test:e2e:install   # once
npm run test:e2e
```

Playwright starts `astro dev` with a fixed `ADMIN_PASSWORD` (auth gating on) and clears `GITHUB_TOKEN`. Specs live in `e2e/` and cover login, pages desk, visual editor, site chrome, media, changes, and admin APIs.

## Content model

| File | Role |
|---|---|
| `src/content/pages.json` | Per-page metadata + sections. Each entry has a required `path` (e.g. `/`, `/about`, `/my-page`). |
| `src/content/site.json` | Site-wide nav, footer columns, newsletter blurb, footer human line. |

Nav and footer are **not** stored in `pages.json`.

### Fixed shells vs catch-all

Existing hubs keep thin Astro route shells (`index`, `about`, `press-kit`, `uses`, `projects`, `writing/index`, `videos/index`, `speaking/index`). They call `loadPage(id)` and stay the source of truth for those URLs (collection index behavior, etc.).

Net-new pages (any key in `pages.json` that is not a fixed id) are rendered by [`src/pages/[...slug].astro`](../src/pages/[...slug].astro). `getStaticPaths` emits every non-fixed page path. More-specific file routes always win over the catch-all.

### Create page

On `/admin`, use **New page**:

- `id` — kebab-case key in `pages.json`
- `path` — public URL (defaults to `/{id}`)
- `title` — seeds metadata

The API rejects reserved paths (`/admin`, `/api`, `/search`, `/writing/…`, fixed hub paths, etc.) and collisions. New pages get a hero placeholder and are stored as a **local draft** (not live until Publish).

### Pages overview (sitemap)

The Pages desk lists every page shell. Content hubs (`writing`, `videos`, `speaking`, `projects`) show a count badge and expand inline to browse collection entries (posts, playlists → videos, talks, projects). Pages with local drafts show a **Draft** badge.

- Children load on expand via `GET /api/admin/content/{source}` (search + pagination; videos default to playlist groups).
- **Edit layout** opens the visual page editor. **View** opens the public URL.
- **Edit** on a child links to `/admin/content/{kind}/{id}` (stub for now — collection editors are not implemented yet).

## Draft → main workflow

```
Editor Save  →  IndexedDB local draft (+ optional preview stage)
Changes desk →  review local drafts vs main baseline
Publish      →  putFile pages.json / site.json on main  →  Vercel deploy
Discard      →  clear IndexedDB drafts (main unchanged)
```

| Action | Where | Effect |
|---|---|---|
| **Save** | Page / site editor | Persist draft in IndexedDB (this browser) |
| **Changes** | `/admin/changes` | Diff local drafts vs published `main` content |
| **Publish** | Changes desk | Commit content JSON to **`main`** only |
| **Discard** | Changes desk | Clear local drafts |

Admin preview loads Astro SSR once as a baseline, then prefers **live bridge updates** (no iframe reload) for structural edits via section HTML fragments. Reload remains a rare fallback.

The public site always serves the deployed filesystem from **`main`**. Publish never writes admin/edit client code or draft databases into content files.

## Production isolation (hard invariant)

- Keep `TB_EDIT_MODE` / `PUBLIC_TB_EDIT_MODE` **unset** on Vercel production so public HTML has no `data-edit` / `data-section`.
- Bridge loads only on `/admin/preview/*?edit=1` iframes.
- IndexedDB draft store lives under `public/admin/` and is imported only by admin scripts. Same for the compiled output of `src/admin-client/` — admin client code is never pulled into public page bundles.
- `/admin` and `/api/admin` stay password-gated.

## Site chrome editor

[`/admin/site`](http://localhost:4321/admin/site) edits nav links, footer columns, newsletter copy, and the footer blurb.

- **Save** keeps a local draft
- Publish from **Changes**

## Layout (page editor)

```
┌──────────────────────────────┬────────────────┬────┐
│ Top: pages · switcher / devices│                │ico │
│──────────────────────────────│ Primary panel  │nav │
│ Live preview (dominant)      │ + Agent (opt.) │    │
└──────────────────────────────┴────────────────┴────┘
```

Right **activity rail** (top → bottom):

1. **Inspector** — Layers / Section / Meta (same sidebar; click again to close)
2. **Page** — Info / History (replaces Inspector; mutually exclusive)
3. **Media** — Cloudinary library (browse, upload, enrich tags/title/description; insert into focused image field)
4. **Agent** — stacks beside the open primary panel (when `OPENAI_API_KEY` is set)
5. Exit links — Pages / Site chrome / Media desk / Changes

- **Page switcher** (top left, beside Pages): dropdown of all pages (filter + draft badges); warns if the current draft is unsaved
- **Preview** (center): real site in an iframe (`?edit=1`); device toggles (Desktop / Mobile / Full)
- **Inspector:** Layers (section list, reorder / duplicate / delete / add), Section fields, Meta for SEO
- **Info:** page id, path, live URL, edit/publish status, last commit on main
- **History:** recent commits touching `pages.json` on **main**
- **Media:** full allowlisted library
- Top bar: undo/redo, status chip, Changes link, **Save**

Selecting a block in the preview opens Inspector → Section.

## Editing model

1. Hover a **block** in the preview → orange outline
2. Click the block → form rail fills; floating chrome shows kind + `⋯`
3. Click a plain-text leaf → type in the preview; the Inspector field updates live (Escape or click away to exit)
4. Click an **image** → form field focuses; hover the image and click **Replace** to open the Cloudinary picker
5. Nested lists (FAQ, CTAs, gallery, timeline, inventory, …): add / reorder / remove in the form
6. Layers: drag the grip to reorder (or use move buttons)
7. Between-block `+` inserts a section
8. Status: **Unsaved** vs **Draft saved**
9. **Save** (⌘S) — local draft; **⇧⌘S** opens Changes
10. Undo / Redo (⌘Z / ⇧⌘Z)

Structural edits update the preview in place when possible (bridge DOM ops + section HTML). **Publish** is only on the Changes desk.

Image URL fields use the in-admin **Media** picker (**Browse**) — same allowlisted Admin Search scope as the Agent (`CLOUDINARY_SEARCH_FOLDERS` + `CLOUDINARY_API_SECRET`). Empty search **browses all allowlisted folders** (not only `CLOUDINARY_SEARCH_FOLDER`). Uploads and metadata edits go through signed/scoped APIs only.

Standalone DAM: **`/admin/media`** (Workspace → Media) — same picker UI for library management without a page context.

Media APIs (auth-gated):

| Route | Role |
|---|---|
| `POST /api/admin/cloudinary/search` | Browse (`browse:true` / empty query) or Agent metadata/vision search; `folder: "all"` for every allowlisted folder |
| `POST /api/admin/cloudinary/sign` | Signed upload params into an allowlisted folder |
| `POST /api/admin/cloudinary/update` | Update tags + title (`context.caption`) + description (`context.alt`) |

## WebMCP (browser agents)

The page editor registers WebMCP tools so Chrome’s Model Context Tool Inspector (or MCP-B’s embedded agent) can edit the open page while the preview updates live. See [`docs/admin-webmcp.md`](./admin-webmcp.md) for the demo setup.

## Production (Vercel)

| Variable | Purpose |
|---|---|
| `ADMIN_PASSWORD` | Required. Gates `/admin` and `/api/admin/*` |
| `GITHUB_TOKEN` | Token with `contents:write` on the repo |
| `GITHUB_REPO` | e.g. `timbenniks/timbenniks-2026` |
| `GITHUB_BRANCH` | Publish target, default `main` |
| `GITHUB_CMS_BRANCH` | Legacy; unused by the draft → main workflow |
| `OPENAI_API_KEY` | Optional. Enables the in-editor Agent sidebar (WebMCP tool chat) |
| `OPENAI_WEBMCP_MODEL` | Optional. Chat model, default `gpt-4.1` |
| `OPENAI_WEBMCP_VISION_MODEL` | Optional. Vision rank when `search_images` passes `vision:true` (default: chat model or `gpt-4o`) |
| `CLOUDINARY_API_SECRET` | **Required for Media + Agent images.** Server-only; enables search, signed upload, metadata update |
| `CLOUDINARY_SEARCH_FOLDERS` | Comma-separated folder allowlist (default `website`) |
| `CLOUDINARY_SEARCH_FOLDER` | Default folder when agent omits one; `*` / `all` / omit = all allowlisted folders |
| `CLOUDINARY_SEARCH_TAGS` | Optional required tags |
| `CLOUDINARY_SEARCH_PREFIX` | Optional public_id prefix |
| `CLOUDINARY_VISION_CANDIDATES` | Optional. Max thumbs for vision fallback (default `20`) |
| `PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud for delivery + Admin Media |
| `PUBLIC_CLOUDINARY_API_KEY` | Cloudinary API key (used server-side with the secret for Admin APIs) |
| `TB_EDIT_MODE` | Optional. `1`/`true` stamps `data-edit` / `data-section` on **all** pages for that build (debugging). **Leave unset on production** — public HTML stays clean. `/admin/preview/*` always gets edit markup so the visual editor works without this flag. |
| `PUBLIC_TB_EDIT_MODE` | Same as `TB_EDIT_MODE` (either works) |

### Edit markup vs production HTML

Public pages are prerendered **without** `data-edit` / `data-section` attributes and without the bridge stub, unless `TB_EDIT_MODE` is set.

The visual editor iframe loads `/admin/preview/:id?edit=1` (SSR). That path always stamps edit hooks and includes the bridge loader — independent of `TB_EDIT_MODE` — so production can stay a clean site while admin editing still works.

Intentional drafts live in the browser (IndexedDB). Server preview drafts (memory / `.cache/admin-preview/`) exist only as a fallback for SSR reload and section-html rendering. Publish writes `src/content/pages.json` and/or `src/content/site.json` — to disk in local `astro dev`, or to GitHub `main` in production.

## Admin client build

Every admin client module is TypeScript in [`src/admin-client/`](../src/admin-client/). esbuild compiles it to `public/admin/` for the browser. Commit the **sources**; do **not** commit generated `.js` (gitignored). Only `vendor/` and CSS under `public/admin/` stay in git.

| | Sources (commit) | Served from (gitignore except vendor/CSS) |
|---|---|---|
| Admin client | `src/admin-client/**/*.ts` | `public/admin/**/*.js` |
| Vendored libraries | — | `public/admin/vendor/**` (committed) |
| Styles | — | `public/admin/*.css` (committed) |

- `npm run build:admin` — esbuild, **not** bundled; each module keeps its imports. Output paths mirror sources 1:1, so `/admin/*.js` URLs never change.
- Hooked into `predev`, `prebuild`, and `pretest:e2e`. CI runs `build:admin` before `astro check`. For an edit-refresh loop, run `npm run dev:admin` (watch) beside `npm run dev`.
- Import specifiers use a `.js` extension in `.ts` sources (`./lib/messaging.js`) — that is what the browser resolves after compilation.
- Output is cleaned before every build: files carrying the generated banner are deleted first, so a renamed/deleted source cannot leave a stale module. `vendor/` and CSS are never touched.
- Type-only modules (`lib/content.ts`, `editor/session.ts`) erase to near-empty `.js` files; everything imports them with `import type`, so Zod/schema types never reach the browser.
- `tsconfig.json` excludes `public/admin` — types are checked at the source, not twice.

Section kinds are typed end to end: `SECTION_FORM` in [`editor/catalog.ts`](../src/admin-client/editor/catalog.ts) is a `Record<SectionKind, SectionFormSpec>` and `SECTION_KINDS` in [`page-schema.ts`](../src/lib/page-schema.ts) is checked against the Zod union. The old `section-catalog-align.ts` runtime assertion is gone.

## Technical notes

- Edit DOM hooks (`data-edit`, `data-section`) are gated by [`isEditMarkupEnabled()`](../src/lib/admin/edit-mode.ts): always on for `/admin/preview/*`, otherwise only when `TB_EDIT_MODE` is set
- `BaseLayout` includes the bridge stub only when edit markup is enabled; it dynamically imports `/admin/bridge.js` for `?edit=1` iframes
- Middleware marks `/admin/preview/*` so `loadPage` / `loadSiteChrome` prefer preview drafts + main baseline
- postMessage channel: `tb-ve` with same-origin `targetOrigin` + `event.origin` checks. Both directions are typed in [`src/admin-client/lib/messaging.ts`](../src/admin-client/lib/messaging.ts) as `EditorMessages` (shell → iframe, includes `moveSection` / `removeSection` / `insertSectionHtml` / `replaceSectionHtml` / `reindexSections`) and `BridgeMessages` (iframe → shell). Add a message by adding a key there; `bridge.ts` switches exhaustively, so a missing handler is a type error
- Section metadata and document metadata are **separate** messages: `setSectionMeta` carries section kinds plus selection, `setDocumentMeta` carries the previewed page's `<title>` / `<meta name="description">`. They used to share one `setMeta` type with two incompatible payloads, which meant agent edits to title/description never reached the preview
- Draft store: [`src/admin-client/lib/draft-store.ts`](../src/admin-client/lib/draft-store.ts) (IndexedDB, admin-only)
- Section HTML: `POST /api/admin/preview/section-html` + `/admin/preview/:id/section/:index`
- Shared admin client kit: [`src/admin-client/lib/`](../src/admin-client/lib/) — `api.ts` (`apiFetch`), `utils.ts`, `logout.ts`, `messaging.ts`, `facade.ts` (the `__tbVisualEditor` contract)
- Page editor modules: [`src/admin-client/editor.ts`](../src/admin-client/editor.ts) boots [`src/admin-client/editor/`](../src/admin-client/editor/) (catalog, runtime, facade, …)
- Shared GitHub helpers: [`src/lib/admin/github-git.ts`](../src/lib/admin/github-git.ts) (`putFile` retries once on 409; `listCommits` for History sidebar)
- Server env helper: [`src/lib/admin/server-env.ts`](../src/lib/admin/server-env.ts) — reads `.env` via `process.env` and `import.meta.env` (needed in `astro dev`)
- Page editor history API: `GET /api/admin/pages/:id/history` (commits for `pages.json` on **main**)
- Page ids = keys of `pages.json` (kebab-case)
- Dashboard shells use [`AdminLayout.astro`](../src/components/admin/AdminLayout.astro)
- Agent / WebMCP details: [`docs/admin-webmcp.md`](./admin-webmcp.md)