# WebMCP visual editor demo

The page editor at `/admin/pages/:id` exposes **WebMCP tools** so a browser agent can build and ship marketing pages while you watch the live preview.

This is the demo path. Cursor skills, server MCP, and custom admin chat can reuse the same editor facade (`window.__tbVisualEditor`).

The public site registers a separate, read-only catalog (`/tools.json`, `src/scripts/public-webmcp.ts`). Admin tools never appear there.

## What you get

| Surface | Role |
|---|---|
| **Pages desk Agent** (`/admin`) | Two-column: page list + chat for create / open / publish |
| Native / polyfill WebMCP tools | Desk (~8) + page editor (~36) |
| Page editor Agent rail | In-page co-edit when a page is open |
| Live preview iframe | Updates as editor tools run |

## Killer demo script

**Start on `/admin`** (not an unrelated page):

```text
Create a page at /ai-workshop titled AI Workshop, then open it.
```

After the editor opens, continue in the **page Agent**:

```text
Build hero, image-text, FAQ (three questions about DX consulting), and a CTA strip. Find a landscape photo of Tim on stage, set it on the hero, write SEO, save, show what’s pending, then offer Publish.
```

Or from the desk after edits: “Show pending changes, then offer Publish.”

## Demo A — Chrome Model Context Tool Inspector (recommended)

Best “agent in the browser doing things for me” story.

1. Chrome 146+ (Canary/Beta fine). Enable `chrome://flags/#enable-webmcp-testing` → **Enabled** → relaunch.  
   Or join the [WebMCP origin trial](https://developer.chrome.com/docs/ai/webmcp) for your production domain (Chrome 149+).
2. Install **[Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspector)** (Chrome Labs).
3. Run the site (`npm run dev` or your Vercel preview) and open a page editor, e.g. `/admin/pages/about`.
4. Confirm the toolbar chip shows **WebMCP · 36** (or similar). Console: `[webmcp] registered … tools`.
5. Open the Inspector side panel. You should see tools like `get_editor_state`, `create_page`, `add_list_item`, `publish_changes`.
6. Prompt examples:

```text
Call get_editor_state, then add a faq section at the end. Call describe_section on it, then add_list_item three times with DX consulting Q&As.
```

```text
list_pages, then create_page id ai-workshop path /ai-workshop title "AI Workshop". open_page with that id (force if needed).
```

```text
Build a short consulting landing structure: keep the hero, add image-text, faq, and cta-strip. Fill real Tim-voice copy. Do not save to cms yet.
```

Watch layers + preview update as tools execute. When happy, `save_to_cms` (local draft), then `get_changes`, then `publish_changes` to main (Inspector calls these directly; the Agent rail shows Apply cards instead).

## Demo B — OpenAI Agents (desk + editor)

Requires `OPENAI_API_KEY`.

### Pages desk (`/admin`)

Two-column layout: page list on the left, **Agent** on the right. Desk tools: `list_pages`, `get_page`, `create_page` (auto-opens the editor after the reply unless `open:false`), `open_page`, `update_metadata` (via Apply cards), `get_changes`, `publish_changes`, `discard_changes`, `get_site`, `apply_site_patch`, plus `propose_changes`.

Cold-start demos start here — you are not stuck on About to create a workshop page. SEO audits from the desk: `get_page` → `propose_changes` with `update_metadata` items (`pageId` + fields) → Apply cards.

### Page editor (`/admin/pages/:id`)

Docked Agent rail for live co-editing (sections, lists, images, SEO). Same Propose-card rules for Save / Publish.

**Auto-apply vs choice points** (both surfaces):

| Choice | How it works |
|---|---|
| Images (editor) | `search_images` → gallery **Use** |
| Save (editor) | `propose_changes` → **Save** |
| SEO metadata (desk) | `propose_changes` → `update_metadata` → **Apply** |
| Publish / discard | `propose_changes` → **Publish** / **Discard** |
| Site chrome | `propose_changes` → `apply_site_patch` |
| Optional A/B copy (editor) | `propose_changes` with field/section items |

1. Set in `.env`:

```bash
OPENAI_API_KEY=sk-...
# optional
OPENAI_WEBMCP_MODEL=gpt-4.1
```

2. Restart `npm run dev`, open `/admin`.
3. Ask the desk Agent to create and open a page, then finish the build in the editor Agent.

## Demo C — MCP-B browser extension → Cursor

With `@mcp-b/global` loaded, the [MCP-B extension](https://chromewebstore.google.com/detail/mcp-b-extension) can aggregate tab tools into a local MCP server for Cursor / Claude Desktop. Keep the editor tab open; the agent drives the visible UI.

## Tool catalog

### Page lifecycle
| Tool | Purpose |
|---|---|
| `list_pages` | All CMS pages (id, path, title) |
| `create_page` | Create page as a local draft (`id`, `path`, `title`). Desk defaults to opening the editor after the agent reply (`open:false` to stay) |
| `open_page` | Navigate editor to a page (`force` if dirty) |
| `get_page` | Read page JSON (desk: pass `id`; editor: open draft) |

### In-page editing
| Tool | Purpose |
|---|---|
| `get_editor_state` | Page id, dirty, selection, section summaries |
| `list_section_kinds` | Allowed `kind` values + short help |
| `get_page` / `get_section` | Read JSON |
| `select_section` | Highlight in preview |
| `add_section` / `move_section` / `duplicate_section` / `delete_section` | Structure |
| `replace_section` / `patch_section` | Whole or shallow section writes |
| `describe_section` | Field + list schema for a section (call before nested edits) |
| `add_list_item` / `remove_list_item` / `move_list_item` | FAQ / timeline / gallery / CTA lists |
| `set_field` | Leaf copy (live) or query fields |
| `update_metadata` | SEO: title, description, keywords, image, canonical, imageAlt, noindex. Desk requires `pageId` and shows Apply cards |
| `set_device_preview` | `desktop` \| `mobile` \| `full` |
| `undo` / `redo` | History |
| `refresh_preview` | Force iframe sync |
| `open_panel` | Open inspector / media / info / history chrome |

### Media
| Tool | Purpose |
|---|---|
| `get_image_library_config` | Cloudinary allowlist |
| `search_images` | Search (needs `CLOUDINARY_API_SECRET`) |
| `set_image` | Apply asset to an image field |
| `update_asset_metadata` | Enrich Cloudinary title / description / tags |

### Ship
| Tool | Purpose |
|---|---|
| `save_to_cms` | Save open page as a local draft (Agent → Save card) |
| `get_changes` | Pending cms → main diff |
| `publish_changes` | Merge cms → main (Agent → Publish card) |
| `discard_changes` | Reset cms (Agent → Discard card) |
| `get_page_history` | Recent commits touching this page |

### Site chrome
| Tool | Purpose |
|---|---|
| `get_site` | Read `site.json` (nav, footer, newsletter) |
| `apply_site_patch` | Write site chrome (Agent → Apply card; `mode: preview` optional) |

### Agent-only
| Tool | Purpose |
|---|---|
| `propose_changes` | Defer whitelisted tools into Apply cards after streamed text |

## Cloudinary for the Agent

Browse Cloudinary in the form UI is a human widget. The Agent uses the Admin Search API, **scoped by env**:

| Variable | Purpose | Default |
|---|---|---|
| `CLOUDINARY_SEARCH_FOLDERS` | Comma-separated allowlist | `website` |
| `CLOUDINARY_SEARCH_FOLDER` | Default when agent omits `folder`. Single name, or `*` / `all` / omit to search **all** allowlisted folders. A comma list is treated as “all” (don’t paste FOLDERS here). | `*` (all) when unset/list |
| `CLOUDINARY_SEARCH_TAGS` | Optional required tags (AND) | — |
| `CLOUDINARY_SEARCH_PREFIX` | Optional `public_id` prefix | — |
| `CLOUDINARY_SEARCH_EXPRESSION` | Advanced: full base expression override | — |
| `CLOUDINARY_SEARCH_MAX_RESULTS` | Default page size | `12` |
| `CLOUDINARY_API_SECRET` | Required for Agent search + Media DAM | — |

Example `.env`:

```bash
CLOUDINARY_API_SECRET=...
PUBLIC_CLOUDINARY_CLOUD_NAME=...
PUBLIC_CLOUDINARY_API_KEY=...
CLOUDINARY_SEARCH_FOLDERS=website,Tim,Presskit
CLOUDINARY_SEARCH_FOLDER=*
```

The agent cannot escape the allowlist (`folder=everything` → 400). Tools: `get_image_library_config`, `search_images`, `set_image`, `update_asset_metadata`.

Humans use the same allowlist via the editor **Media** rail, field **Browse** modal, and `/admin/media`.

After `search_images`, the Agent rail shows a thumbnail gallery. **Click Use** to apply. **Open** previews the full URL.

**Proposal CTAs:** Save / Publish / Discard / site / A/B copy use `propose_changes` → action cards after the streamed reply. Direct shipping tools from the Agent rail are intercepted the same way.

`search_images` also accepts metadata filters (`orientation`, size bounds, `format`, `tags`) and optional `vision: true` fallback.

## Architecture

Sources live in TypeScript under `src/admin-client/` and compile to `/admin/*.js` via `npm run build:admin` (see [admin-editor.md](./admin-editor.md#admin-client-build)). Runtime URLs below are the compiled paths the browser loads.

```text
Browser agent (Inspector / webmcp-agent / MCP-B extension)
        │  WebMCP tool calls
        ▼
/admin/webmcp-tools.js  ← src/admin-client/webmcp-tools.ts
        │  navigator + document.modelContext
        ▼
window.__tbVisualEditor  (editor facade)
        │
        ├─ draft + layers + forms + list editors
        ├─ preview postMessage / persistPreview
        ├─ pages / changes / site / cloudinary APIs
        └─ saveToCms → IndexedDB draft → publish → main
```

Vendored polyfill: `public/admin/vendor/mcp-b-global.iife.js` (`@mcp-b/global@4.0.0`). Native Chrome `navigator.modelContext` is preserved (`nativeModelContextBehavior: 'preserve'`).

## Files

| Source | Role |
|---|---|
| [`src/admin-client/desk-facade.ts`](../src/admin-client/desk-facade.ts) | Desk `__tbVisualEditor` (lifecycle / ship / site) |
| [`src/admin-client/desk-webmcp.ts`](../src/admin-client/desk-webmcp.ts) | WebMCP tools on `/admin` |
| [`src/admin-client/desk-agent.ts`](../src/admin-client/desk-agent.ts) | Desk Agent chat boot |
| [`src/admin-client/webmcp-tools.ts`](../src/admin-client/webmcp-tools.ts) | Editor WebMCP tool registration |
| [`src/admin-client/webmcp-agent.ts`](../src/admin-client/webmcp-agent.ts) | Editor Agent rail boot |
| [`src/admin-client/webmcp-agent-loop.ts`](../src/admin-client/webmcp-agent-loop.ts) | SSE client + tool loop (`editor` / `desk` surfaces) |
| [`src/admin-client/webmcp-agent-ui.ts`](../src/admin-client/webmcp-agent-ui.ts) | Bubbles, gallery, action cards |
| [`src/admin-client/editor/facade.ts`](../src/admin-client/editor/facade.ts) | Page-editor `__tbVisualEditor` |
| [`src/admin-client/lib/tools.ts`](../src/admin-client/lib/tools.ts) | Shared tool registry (desk + editor) |
| [`src/admin-client/lib/render-agent-markdown.ts`](../src/admin-client/lib/render-agent-markdown.ts) | Comark → HTML (+ DOMPurify) |
| [`src/pages/api/admin/webmcp/chat.ts`](../src/pages/api/admin/webmcp/chat.ts) | OpenAI SSE proxy |
| `public/admin/vendor/comark-html.esm.js` | Browser Comark bundle (committed) |
| `public/admin/vendor/mcp-b-global.iife.js` | WebMCP polyfill (committed) |
| [`src/pages/admin/pages/[id].astro`](../src/pages/admin/pages/[id].astro) | Editor page + script wiring |

## Safety notes

- Tools only load on authenticated `/admin/pages/*` (same cookie gate as the editor).
- `save_to_cms` stores a **local draft**; live site needs **Publish** to main.
- Agent rail never auto-publishes / auto-discards / auto-patches site chrome — Apply cards only.
- Prefer not putting `OPENAI_API_KEY` in client-exposed env; it stays server-side via `/api/admin/webmcp/chat`.
