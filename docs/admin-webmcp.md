# WebMCP visual editor demo

The page editor at `/admin/pages/:id` exposes **WebMCP tools** so a browser agent can build and edit marketing pages while you watch the live preview.

This is the demo path. Cursor skills, server MCP, and custom admin chat come later — they can reuse the same editor facade (`window.__tbVisualEditor`).

## What you get

| Surface | Role |
|---|---|
| Native / polyfill WebMCP tools | Agent calls `add_section`, `set_field`, `save_to_cms`, … |
| Live preview iframe | Updates as tools run |
| Undo / layers / inspector | Same human UI; agent mutations go through it |
| Optional OpenAI Agent sidebar | In-page chat when `OPENAI_API_KEY` is set |

## Demo A — Chrome Model Context Tool Inspector (recommended)

Best “agent in the browser doing things for me” story.

1. Chrome 146+ (Canary/Beta fine). Enable `chrome://flags/#enable-webmcp-testing` → **Enabled** → relaunch.  
   Or join the [WebMCP origin trial](https://developer.chrome.com/docs/ai/webmcp) for your production domain (Chrome 149+).
2. Install **[Model Context Tool Inspector](https://chromewebstore.google.com/detail/model-context-tool-inspector)** (Chrome Labs).
3. Run the site (`npm run dev` or your Vercel preview) and open a page editor, e.g. `/admin/pages/about`.
4. Confirm the toolbar chip shows **WebMCP · 18** (or similar). Console: `[webmcp] registered … tools`.
5. Open the Inspector side panel. You should see tools like `get_editor_state`, `add_section`, `set_field`.
6. Prompt examples:

```text
Call get_editor_state, then add a faq section at the end and rewrite its title and two questions about developer experience consulting.
```

```text
Select section 0, rewrite the hero subline to something sharper about AI-native DX, then switch the preview to mobile.
```

```text
Build a short consulting landing structure: keep the hero, add image-text, faq, and cta-strip. Fill real Tim-voice copy. Do not save to cms yet.
```

Watch layers + preview update as tools execute. When happy, ask it to `save_to_cms`, then publish from `/admin/changes`.

## Demo B — OpenAI Agent sidebar (icing)

The editor mounts an **Agent** rail (icon in the left toolbar) when `OPENAI_API_KEY` is set on the server. Chat goes through `/api/admin/webmcp/chat` (key never shipped to the browser). Tool calls run in-page against the WebMCP / `__tbVisualEditor` facade so the preview updates live.

1. Set in `.env`:

```bash
OPENAI_API_KEY=sk-...
# optional
OPENAI_WEBMCP_MODEL=gpt-4.1
```

2. Restart `npm run dev`, open a page editor.
3. Click the **sparkle / Agent** icon in the right rail → try: “Add an FAQ about consulting and tighten the hero subline.”

Without the env var, the Agent rail stays disabled. Chrome’s Model Context Tool Inspector still works for the pure WebMCP demo.

> Note: MCP-B’s hosted `<webmcp-agent>` widget only accepts Anthropic for chat (OpenAI there is voice-only), so this site uses a small custom OpenAI sidebar instead.

## Demo C — MCP-B browser extension → Cursor

With `@mcp-b/global` loaded, the [MCP-B extension](https://chromewebstore.google.com/detail/mcp-b-extension) can aggregate tab tools into a local MCP server for Cursor / Claude Desktop. Keep the editor tab open; the agent drives the visible UI.

## Tool catalog

| Tool | Purpose |
|---|---|
| `get_editor_state` | Page id, dirty, selection, section summaries |
| `list_section_kinds` | Allowed `kind` values + short help |
| `get_page` / `get_section` | Read JSON |
| `select_section` | Highlight in preview |
| `add_section` / `move_section` / `duplicate_section` / `delete_section` | Structure |
| `replace_section` / `patch_section` | Whole or shallow section writes |
| `set_field` | Leaf copy (live) or `structural: true` for query fields |
| `update_metadata` | SEO |
| `set_device_preview` | `desktop` \| `mobile` \| `full` |
| `undo` / `redo` | History |
| `refresh_preview` | Force iframe sync |
| `search_images` | Search Cloudinary (needs `CLOUDINARY_API_SECRET`) |
| `set_image` | Apply a Cloudinary asset to an image field |
| `save_to_cms` | Commit to `cms` branch (ask human first) |

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
| `CLOUDINARY_API_SECRET` | Required for Agent search | — |

Example `.env`:

```bash
CLOUDINARY_API_SECRET=...
CLOUDINARY_SEARCH_FOLDERS=website,Tim,Presskit
CLOUDINARY_SEARCH_FOLDER=*
# optional single default instead:
# CLOUDINARY_SEARCH_FOLDER=website
# optional:
# CLOUDINARY_SEARCH_TAGS=site
# CLOUDINARY_SEARCH_PREFIX=website/
```

The agent cannot escape the allowlist (`folder=everything` → 400). Tools: `get_image_library_config`, `search_images`, `set_image`.

After `search_images`, the Agent rail shows a thumbnail gallery. **Click Use** (or the card) to apply that asset to the selected section’s image field. **Open** previews the full Cloudinary URL. The agent is instructed to ask you to click rather than auto-applying.

`search_images` also accepts metadata filters:

- `orientation`: `portrait` | `landscape` | `square`
- `minWidth` / `maxWidth` / `minHeight` / `maxHeight`
- `format`: `png`, `jpg`, …
- `tags`: extra tags to AND

**Metadata-first search (default):** pass `describe` or `query` (e.g. `"Tim on stage at a conference"`). The API tokenizes the phrase and matches **tags**, Media Library **Title** (`context.caption`), **Description** (`context.alt`), filename, and public_id — then ranks by how many terms hit. Results include `title`, `description`, `tags`, `metadataScore`, and `metadataReason`. No vision call.

**Vision (optional fallback):** pass `vision: true` only when metadata returns nothing useful. That ranks a shortlist of tiny Cloudinary thumbs (`w_256,q_30`) with OpenAI vision. Needs `OPENAI_API_KEY`.

| Variable | Purpose | Default |
|---|---|---|
| `OPENAI_WEBMCP_VISION_MODEL` | Model for vision rank | `OPENAI_WEBMCP_MODEL` or `gpt-4o` |
| `CLOUDINARY_VISION_CANDIDATES` | Max thumbs sent to vision | `20` (cap 24) |

Results include `width`, `height`, `aspectRatio`, `orientation`, `format`, `tags`, `title`, `description`, `bytes`.

Demo prompt:

```text
Find a photo of me speaking on stage at a conference (landscape) and set it on the hero image. Do not save yet.
```

The agent should call `search_images` with `describe` + `orientation: landscape` (no `vision`), then ask you to click **Use**.

## Architecture

```text
Browser agent (Inspector / webmcp-agent / MCP-B extension)
        │  WebMCP tool calls
        ▼
public/admin/webmcp-tools.js  →  navigator + document.modelContext
        │
        ▼
window.__tbVisualEditor  (editor.js facade)
        │
        ├─ draft + layers + forms
        ├─ preview postMessage / persistPreview
        └─ saveToCms → GitHub cms branch
```

Vendored polyfill: `public/admin/vendor/mcp-b-global.iife.js` (`@mcp-b/global@4.0.0`). Native Chrome `navigator.modelContext` is preserved (`nativeModelContextBehavior: 'preserve'`).

## Files

| Path | Role |
|---|---|
| `public/admin/webmcp-tools.js` | Tool definitions + registration |
| `public/admin/webmcp-agent.js` | OpenAI Agent sidebar (tool loop in-page) |
| `src/pages/api/admin/webmcp/chat.ts` | OpenAI proxy (`OPENAI_API_KEY`) |
| `public/admin/vendor/mcp-b-global.iife.js` | WebMCP polyfill / bridge |
| `public/admin/editor.js` | `__tbVisualEditor` facade |
| `src/pages/admin/pages/[id].astro` | Script boot + env wiring |

## Safety notes

- Tools only load on authenticated `/admin/pages/*` (same cookie gate as the editor).
- `save_to_cms` still goes to the **cms** branch; live site needs **Publish**.
- Prefer not putting `OPENAI_API_KEY` in client-exposed env; it stays server-side via `/api/admin/webmcp/chat`.
