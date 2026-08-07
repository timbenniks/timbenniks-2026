# Visual page editor

Storyblok-inspired visual editor for marketing pages in `src/content/pages.json`, plus site chrome in `src/content/site.json`.

Git CMS model on Vercel: **Save** commits to a working **`cms`** branch; **Changes** reviews the diff; **Publish** merges `cms` → **`main`** (Vercel deploys from `main`).

## Local

1. Set `ADMIN_PASSWORD` (optional in `astro dev` — auth bypassed if unset).
2. Set `GITHUB_TOKEN` + `GITHUB_REPO` for the full cms → main workflow (required for Save/Changes/Publish parity with production).
3. `npm run dev`
4. Open [http://localhost:4321/admin](http://localhost:4321/admin)
5. Edit a page → **Save** (commits to `cms`) → open **Changes** → **Publish to main**

Without `GITHUB_TOKEN`, Save only updates the local working tree (no commit). Changes/Publish will report that GitHub is not configured.

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

The API rejects reserved paths (`/admin`, `/api`, `/search`, `/writing/…`, fixed hub paths, etc.) and collisions. New pages get a hero placeholder and are written to the **`cms`** branch only (not live until Publish).

## Git CMS workflow (`cms` → `main`)

```
Editor Save  →  commit on cms branch
Changes desk →  review diffs / page summaries
Publish      →  merge cms → main  →  Vercel deploy
             →  reset cms tip to main
```

| Action | Where | Effect |
|---|---|---|
| **Save** | Page / site editor | Commit `pages.json` or `site.json` on **`cms`** (`cms: update …`) |
| **Changes** | `/admin/changes` | Compare `main...cms`, list changed pages/files, diffs |
| **Publish** | Changes desk | Merge `cms` into `main`, then force-reset `cms` to `main` |
| **Discard** | Changes desk | Reset `cms` to `main` (drop unpublished work) |

Admin list/edit/preview read from the **`cms`** branch (with a short in-memory cache after Save). The public site always serves the deployed filesystem from **`main`**.

## Site chrome editor

[`/admin/site`](http://localhost:4321/admin/site) edits nav links, footer columns, newsletter copy, and the footer blurb.

- Preview draft keeps structural edits snappy in-session
- **Save** commits to `cms`
- Publish from **Changes**

## Layout (page editor)

```
┌──────────────────────────────┬────────────────┬────┐
│ Top: page / devices / Save   │                │ico │
│──────────────────────────────│ Primary panel  │nav │
│ Live preview (dominant)      │ + Agent (opt.) │    │
└──────────────────────────────┴────────────────┴────┘
```

Right **activity rail** (top → bottom):

1. **Inspector** — Layers / Section / Meta (same sidebar; click again to close)
2. **Page** — Info / History (replaces Inspector; mutually exclusive)
3. **Agent** — stacks beside the open primary panel (when `OPENAI_API_KEY` is set)
4. Exit links — Pages / Site chrome / Changes

- **Preview** (center): real site in an iframe (`?edit=1`); device toggles (Desktop / Mobile / Full)
- **Inspector:** Layers (section list, reorder / duplicate / delete / add), Section fields, Meta for SEO
- **Info:** page id, path, live URL, edit/publish status, last commit on main, branch names
- **History:** recent commits touching `pages.json` on the `cms` branch (highlights `cms: update <pageId>`)
- Top bar: undo/redo, status chip, Changes link, **Save**

Selecting a block in the preview opens Inspector → Section.

## Editing model

1. Hover a **block** in the preview → orange outline
2. Click the block → form rail fills; floating chrome shows kind + `⋯`
3. Click a leaf field → input focuses; typing updates the preview live
4. Nested lists (FAQ, CTAs, gallery, timeline, inventory, …): add / reorder / remove in the form
5. Layers: drag the grip to reorder (or use move buttons)
6. Between-block `+` inserts a section
7. Status: **Unsaved** vs **Saved on cms**
8. **Save** (⌘S) — commit to `cms`; **⇧⌘S** opens Changes
9. Undo / Redo (⌘Z / ⇧⌘Z)

Structural/query edits push an in-memory preview draft and reload the iframe (avoids Vite wiping the editor). **Save** persists to GitHub `cms`. **Publish** is only on the Changes desk.

Image URL fields open the **Cloudinary Media Library** via Browse Cloudinary (`PUBLIC_CLOUDINARY_CLOUD_NAME` + `PUBLIC_CLOUDINARY_API_KEY`).

## WebMCP (browser agents)

The page editor registers WebMCP tools so Chrome’s Model Context Tool Inspector (or MCP-B’s embedded agent) can edit the open page while the preview updates live. See [`docs/admin-webmcp.md`](./admin-webmcp.md) for the demo setup.

## Production (Vercel)

| Variable | Purpose |
|---|---|
| `ADMIN_PASSWORD` | Required. Gates `/admin` and `/api/admin/*` |
| `GITHUB_TOKEN` | Token with `contents:write` on the repo |
| `GITHUB_REPO` | e.g. `timbenniks/timbenniks-2026` |
| `GITHUB_BRANCH` | Publish target, default `main` |
| `GITHUB_CMS_BRANCH` | Working branch, default `cms` |
| `OPENAI_API_KEY` | Optional. Enables the in-editor Agent sidebar (WebMCP tool chat) |
| `OPENAI_WEBMCP_MODEL` | Optional. Chat model, default `gpt-4.1` |
| `OPENAI_WEBMCP_VISION_MODEL` | Optional. Vision rank when `search_images` passes `vision:true` (default: chat model or `gpt-4o`) |
| `CLOUDINARY_API_SECRET` | Optional. Enables Agent `search_images` / Admin Cloudinary search |
| `CLOUDINARY_SEARCH_FOLDERS` | Comma-separated folder allowlist (default `website`) |
| `CLOUDINARY_SEARCH_FOLDER` | Default folder when agent omits one; `*` / `all` / omit = all allowlisted folders |
| `CLOUDINARY_SEARCH_TAGS` | Optional required tags |
| `CLOUDINARY_SEARCH_PREFIX` | Optional public_id prefix |
| `CLOUDINARY_VISION_CANDIDATES` | Optional. Max thumbs for vision fallback (default `20`) |
| `PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud for Browse + Agent |
| `PUBLIC_CLOUDINARY_API_KEY` | Cloudinary API key for Browse + Agent |
| `TB_EDIT_MODE` | Optional. `1`/`true` stamps `data-edit` / `data-section` on **all** pages for that build (debugging). Leave unset on production — public HTML stays clean. `/admin/preview/*` always gets edit markup so the visual editor works without this flag. |
| `PUBLIC_TB_EDIT_MODE` | Same as `TB_EDIT_MODE` (either works) |
| `TB_PREVIEW_DURABLE` | Optional. Set `1` locally to force the Vercel preview path (write preview drafts to the durable cms artifact) |

### Edit markup vs production HTML

Public pages are prerendered **without** `data-edit` / `data-section` attributes and without the bridge stub, unless `TB_EDIT_MODE` is set.

The visual editor iframe loads `/admin/preview/:id?edit=1` (SSR). That path always stamps edit hooks and includes the bridge loader — independent of `TB_EDIT_MODE` — so production can stay a clean site while admin editing still works.

### Preview drafts on Vercel

Local preview sync uses process memory + `.cache/admin-preview/`. That does **not** work across Vercel serverless isolates (PUT on one instance, iframe GET on another).

When `VERCEL` is set (or `TB_PREVIEW_DURABLE=1`) **and** GitHub is configured, preview sync (`mode: 'preview'`) writes the page into a **dedicated artifact** on the **`cms`** branch: `src/content/.admin-preview-drafts.json` (message like `cms: preview-draft <pageId>`). That file is **not** `pages.json` — structural preview ticks no longer commit full page content into the intentional CMS document.

`loadPage` in admin preview order: memory/disk draft → durable GitHub preview draft → `pages.json` on cms → filesystem. Intentional **Save** still updates `pages.json` via `savePageToCms` and removes that page’s entry from the preview-drafts artifact. Publish deletes the artifact before merging cms → main so ephemeral drafts never land on `main`.

If `main` has branch protection that blocks merges, Publish will fail until the token is allowed to merge (or you merge the compare URL on GitHub).

## Technical notes

- Edit DOM hooks (`data-edit`, `data-section`) are gated by [`isEditMarkupEnabled()`](../src/lib/admin/edit-mode.ts): always on for `/admin/preview/*`, otherwise only when `TB_EDIT_MODE` is set
- `BaseLayout` includes the bridge stub only when edit markup is enabled; it dynamically imports `/admin/bridge.js` for `?edit=1` iframes
- Middleware marks `/admin/preview/*` so `loadPage` / `loadSiteChrome` prefer cms + in-memory drafts
- postMessage channel: `tb-ve` with same-origin `targetOrigin` + `event.origin` checks
- Shared admin client kit: [`public/admin/lib/api.js`](../public/admin/lib/api.js) (`apiFetch`), utils, messaging, logout
- Page editor modules: [`public/admin/editor.js`](../public/admin/editor.js) boots [`public/admin/editor/`](../public/admin/editor/) (catalog, runtime, facade, …)
- Shared GitHub helpers: [`src/lib/admin/github-git.ts`](../src/lib/admin/github-git.ts) (`putFile` retries once on 409; `listCommits` for History sidebar)
- Page editor history API: `GET /api/admin/pages/:id/history` (cms commits for `pages.json` + last main commit)
- Page ids = keys of `pages.json` (kebab-case)
- Preview draft store: `globalThis` + `.cache/admin-preview/` locally; on Vercel, durable artifact `src/content/.admin-preview-drafts.json` on `cms` via `savePageDraft` (`mode: 'draft-durable'`) — not `pages.json`
- Dashboard shells use [`AdminLayout.astro`](../src/components/admin/AdminLayout.astro)