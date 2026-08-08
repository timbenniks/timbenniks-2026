/**
 * Agent tool loop — OpenAI chat (SSE) + __tbVisualEditor tool execution.
 */
import {
  appendBubble,
  beginAssistantStream,
  endAssistantStream,
  showThinking,
  hideThinking,
  appendActionCard,
  appendImageResults,
  appendOpenEditorCard,
  PROPOSABLE_TOOLS,
} from './webmcp-agent-ui.js';
import { setBubbleMarkdown } from './lib/render-agent-markdown.js';
import { editorPathFor, hardNavigate } from './lib/navigate.js';

/** Agent-only tools (not registered on WebMCP / Chrome Inspector). */
const AGENT_ONLY_TOOLS = new Set(['propose_changes']);

/** Desk (/admin) tool surface — lifecycle, SEO metadata, ship, site. */
const DESK_TOOL_ALLOWLIST = new Set([
  'list_pages',
  'get_page',
  'create_page',
  'open_page',
  'update_metadata',
  'get_changes',
  'publish_changes',
  'discard_changes',
  'get_site',
  'apply_site_patch',
  'propose_changes',
]);

/** Tools that must never run directly from the Agent rail — redirect to propose_changes. */
const DEFER_TO_PROPOSE = new Set([
  'save_to_cms',
  'publish_changes',
  'discard_changes',
  'apply_site_patch',
]);

const PROPOSABLE_TOOL_ENUM = [
  'set_field',
  'set_image',
  'save_to_cms',
  'patch_section',
  'add_section',
  'update_metadata',
  'publish_changes',
  'discard_changes',
  'apply_site_patch',
];

const DESK_PROPOSABLE_ENUM = [
  'update_metadata',
  'publish_changes',
  'discard_changes',
  'apply_site_patch',
];

const SYSTEM_PROMPT = `You are co-editing Tim Benniks' marketing site in a live visual editor.

Orienting:
- Prefer get_editor_state or list_pages first when you need to know where you are or which pages exist.
- To create a page: create_page, then open_page. Only pass force:true on open_page if the human confirms discarding dirty unsaved state (or save first).

Sections & lists:
- Prefer existing section kinds from list_section_kinds. Never invent kinds.
- Call describe_section BEFORE nested FAQ / timeline / gallery / list edits. Prefer add_list_item, remove_list_item, and move_list_item over blind patch_section of whole arrays.
- For whole-block rewrites use patch_section or replace_section.
- Content query fields (source, limit, tags, playlist, columns, window, …) auto-reload the preview via set_field — no structural flag needed.

Live vs propose:
- For copy edits the human wants applied now, use set_field so the preview updates live.
- For alternate copy the human should choose (A/B lines, optional rewrites), call propose_changes with set_field (or patch_section) items — do NOT apply those yourself.
- Never call save_to_cms, publish_changes, discard_changes, or apply_site_patch directly. Always use propose_changes with those tools as items so the UI shows Apply / Save / Publish cards.
- propose_changes items must use only: set_field, set_image, save_to_cms, patch_section, add_section, update_metadata, publish_changes, discard_changes, apply_site_patch. Include a short human label and exact args.

Images:
- Call get_image_library_config once if unsure, then search_images. After search_images, tell the human to click Use on a thumbnail — do NOT call set_image unless they ask you to pick for them.
- For scene/content searches pass describe (or query) with natural language / keywords. Assets are tagged with title + description in Cloudinary — metadata search is enough. OMIT folder unless the human names one.
- Do NOT pass vision:true unless metadata results are empty or clearly wrong. Vision is a slow fallback, not the default.
- orientation is a soft preference when describe/query is multi-word. If assets is empty, say so — do not invent an image.
- Never invent Cloudinary URLs. Never search outside the configured folders.
- When proposing an image to the human, include it as markdown: ![short label](https://res.cloudinary.com/...). Prefer the asset title or description as the label when present. The chat UI renders that as a thumbnail.
- Use update_asset_metadata to enrich tags/title/description when improving future search.

CMS & site:
- After save, call get_changes to narrate what is pending; offer publish via propose_changes (publish_changes item).
- Call get_site before site chrome changes; then propose apply_site_patch (never call it directly).
- Use open_panel to show inspector / media / info when demonstrating UI.

Voice & hygiene:
- Match Tim's voice: clear, concrete, no corporate fluff, short sentences.
- After structural changes, briefly say what changed so the human can look at the preview.
- Keep tool args valid JSON. Paths like sections.0.headline.lead or relative headline.lead with sectionIndex.`;

const DESK_SYSTEM_PROMPT = `You are the CMS desk agent for Tim Benniks' marketing site (pages overview at /admin).

Section layout/images are edited in the visual editor after open_page. You CAN audit and propose SEO from this desk.

Your job:
- list_pages to orient
- get_page with id (e.g. about) to read metadata + sections for audits
- create_page (id kebab-case, path like /ai-workshop, title). Default open:true — navigates to the visual editor immediately after create. Pass open:false only if the human said not to open.
- open_page to jump into the visual editor when asked
- For SEO audits: get_page first, then propose_changes with one or more update_metadata items (each needs pageId plus fields: title, description, keywords, image, canonical, imageAlt, noindex). Never call update_metadata directly — the human gets Apply cards.
- Never call publish_changes, discard_changes, or apply_site_patch directly — use propose_changes
- get_site before site chrome changes; propose apply_site_patch
- Keep Tim's voice: clear, concrete, short sentences
- After create_page with open:true, do not wait to narrate at length — the browser is already navigating

Do not invent page ids — list_pages first when unsure.`;

function normalizeProposeItems(rawItems) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  return items
    .filter(
      (item) =>
        item &&
        typeof item.tool === 'string' &&
        PROPOSABLE_TOOLS.has(item.tool) &&
        item.args &&
        typeof item.args === 'object' &&
        !Array.isArray(item.args),
    )
    .slice(0, 12)
    .map((item) => ({
      tool: item.tool,
      args: item.args,
      label: String(item.label || item.tool).slice(0, 140),
    }));
}

/**
 * Build propose_changes args when the model called a deferred tool directly.
 * @returns {{ title: string, hint?: string, items: object[], shortLabel: string }}
 */
function deferDirectToolToPropose(name, originalArgs) {
  const args = originalArgs && typeof originalArgs === 'object' ? originalArgs : {};
  if (name === 'save_to_cms') {
    return {
      title: 'Save draft',
      hint: 'Saves this page as a local draft. Publish separately from /admin/changes.',
      items: [{ tool: 'save_to_cms', args: {}, label: 'Save page draft' }],
      shortLabel: 'Save draft',
    };
  }
  if (name === 'publish_changes') {
    return {
      title: 'Publish changes',
      hint: 'Publishes local drafts to main — goes live.',
      items: [
        {
          tool: 'publish_changes',
          args: typeof args.message === 'string' ? { message: args.message } : {},
          label: 'Publish drafts to main',
        },
      ],
      shortLabel: 'Publish',
    };
  }
  if (name === 'discard_changes') {
    return {
      title: 'Discard changes',
      hint: 'Clears local drafts. Destructive for unpublished work.',
      items: [
        {
          tool: 'discard_changes',
          args: typeof args.path === 'string' ? { path: args.path } : {},
          label: 'Discard local drafts',
        },
      ],
      shortLabel: 'Discard',
    };
  }
  if (name === 'update_metadata') {
    const pageId = args.pageId || args.id || '';
    const keys = Object.keys(args).filter((k) => k !== 'pageId' && k !== 'id');
    return {
      title: pageId ? `SEO · ${pageId}` : 'Update SEO metadata',
      hint: 'Applies metadata to a local draft. Review each field, then Apply.',
      items: [
        {
          tool: 'update_metadata',
          args,
          label: keys.length ? `Update ${keys.join(', ')}` : 'Update metadata',
        },
      ],
      shortLabel: 'SEO metadata',
    };
  }
  // apply_site_patch
  return {
    title: 'Update site chrome',
    hint: 'Applies nav / footer / newsletter changes to site.json.',
    items: [{ tool: 'apply_site_patch', args, label: 'Update site chrome' }],
    shortLabel: 'Update site chrome',
  };
}

function toolDefsFromWebMcp({ allowlist = null, proposableEnum = PROPOSABLE_TOOL_ENUM } = {}) {
  const names = window.__tbWebMcp?.toolNames;
  const all = [
    ['get_editor_state', 'Current page id, dirty flag, selected section, section summaries.', {}],
    ['list_section_kinds', 'Allowed section kinds with short descriptions.', {}],
    ['get_page', 'Return page JSON. In the editor: current draft. On the desk: pass id (e.g. about).', { id: { type: 'string' } }],
    [
      'get_section',
      'One section by zero-based index.',
      { index: { type: 'integer', minimum: 0 } },
      ['index'],
    ],
    [
      'select_section',
      'Select and highlight a section in the preview.',
      { index: { type: 'integer', minimum: 0 } },
      ['index'],
    ],
    [
      'add_section',
      'Insert a section kind (placeholder content).',
      { kind: { type: 'string' }, index: { type: 'integer', minimum: 0 } },
      ['kind'],
    ],
    [
      'move_section',
      'Move a section from one index to another.',
      { from: { type: 'integer', minimum: 0 }, to: { type: 'integer', minimum: 0 } },
      ['from', 'to'],
    ],
    [
      'duplicate_section',
      'Duplicate a section.',
      { index: { type: 'integer', minimum: 0 } },
      ['index'],
    ],
    [
      'delete_section',
      'Delete a section by index.',
      { index: { type: 'integer', minimum: 0 } },
      ['index'],
    ],
    [
      'replace_section',
      'Replace an entire section object (must include kind).',
      { index: { type: 'integer', minimum: 0 }, section: { type: 'object' } },
      ['index', 'section'],
    ],
    [
      'patch_section',
      'Shallow-merge fields onto a section without changing kind.',
      { index: { type: 'integer', minimum: 0 }, patch: { type: 'object' } },
      ['index', 'patch'],
    ],
    [
      'set_field',
      'Set one field by path. Live preview for copy. Query fields (source/limit/tags/…) auto-reload preview.',
      {
        path: { type: 'string' },
        value: {},
        sectionIndex: { type: 'integer', minimum: 0 },
        structural: { type: 'boolean' },
      },
      ['path', 'value'],
    ],
    [
      'update_metadata',
      'Update SEO metadata. Editor: current page. Desk: require pageId; Agent redirects to propose_changes for Apply cards.',
      {
        pageId: { type: 'string', description: 'Required on the desk (e.g. about)' },
        title: { type: 'string' },
        description: { type: 'string' },
        keywords: { type: 'string' },
        image: { type: 'string' },
        canonical: { type: 'string' },
        imageAlt: { type: 'string' },
        noindex: { type: 'boolean' },
      },
    ],
    [
      'set_device_preview',
      'Switch preview width.',
      { mode: { type: 'string', enum: ['desktop', 'mobile', 'full'] } },
      ['mode'],
    ],
    ['undo', 'Undo last editor change.', {}],
    ['redo', 'Redo last undone change.', {}],
    ['refresh_preview', 'Force preview reload.', {}],
    [
      'get_image_library_config',
      'Allowed Cloudinary folders/tags for image search on this site.',
      {},
    ],
    [
      'search_images',
      'Search Cloudinary by tags, title, and description. Pass describe or query; use vision:true only as a fallback. Omit folder unless named.',
      {
        query: { type: 'string', description: 'Keywords (tags/title/description/filename)' },
        describe: {
          type: 'string',
          description:
            'Natural-language scene, e.g. Tim speaking on stage — matched against tags + Media Library title/description',
        },
        vision: {
          type: 'boolean',
          description:
            'Optional. If true, also vision-rank a shortlist. Prefer metadata-only first; only set when metadata fails.',
        },
        folder: {
          type: 'string',
          description: 'One allowed folder, or all / omit for the whole allowlist',
        },
        maxResults: { type: 'integer', minimum: 1, maximum: 30 },
        orientation: { type: 'string', enum: ['portrait', 'landscape', 'square'] },
        minWidth: { type: 'number' },
        maxWidth: { type: 'number' },
        minHeight: { type: 'number' },
        maxHeight: { type: 'number' },
        format: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
    ],
    [
      'set_image',
      'Apply a Cloudinary image to a field (image.src, image, metadata.image, …).',
      {
        path: { type: 'string' },
        sectionIndex: { type: 'integer', minimum: 0 },
        secureUrl: { type: 'string' },
        publicId: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' },
        alt: { type: 'string' },
      },
      ['path'],
    ],
    ['list_pages', 'List all CMS pages (id, path, title). Use before create_page or open_page.', {}],
    [
      'create_page',
      'Create a new CMS page (id kebab-case, path, title). On the desk, open defaults to true and navigates to the editor after your reply. Pass open:false to stay on the desk.',
      {
        id: { type: 'string', description: 'Page id (slug), e.g. about' },
        path: { type: 'string', description: 'URL path, e.g. /about' },
        title: { type: 'string' },
        description: { type: 'string' },
        open: {
          type: 'boolean',
          description: 'Desk only: open the visual editor after create (default true)',
        },
      },
      ['id', 'path', 'title'],
    ],
    [
      'open_page',
      'Navigate the editor to another page by id. If dirty, pass force:true only after human confirms discard (or save first).',
      {
        id: { type: 'string', description: 'Page id to open' },
        force: {
          type: 'boolean',
          description: 'Navigate even when the current page has unsaved changes',
        },
      },
      ['id'],
    ],
    [
      'describe_section',
      'Describe a section’s editable fields and list keys. Call before add/remove/move_list_item.',
      { index: { type: 'integer', description: 'Zero-based section index', minimum: 0 } },
      ['index'],
    ],
    [
      'add_list_item',
      'Append an item to a section list (items, ctas, gallery, or nested inventory). Prefer over blind patch_section arrays.',
      {
        sectionIndex: { type: 'integer', minimum: 0 },
        listKey: { type: 'string', description: 'Top-level list key, e.g. items, ctas, gallery' },
        nestedKey: { type: 'string', description: 'Nested list key under a parent item (inventory)' },
        parentItemIndex: {
          type: 'integer',
          minimum: 0,
          description: 'Required with nestedKey — index of the parent list item',
        },
        item: {
          type: 'object',
          description: 'Optional full item object; omit to use the list’s create() default',
        },
      },
      ['sectionIndex', 'listKey'],
    ],
    [
      'remove_list_item',
      'Remove an item from a section list by index. Use describe_section first.',
      {
        sectionIndex: { type: 'integer', minimum: 0 },
        listKey: { type: 'string' },
        nestedKey: { type: 'string' },
        parentItemIndex: { type: 'integer', minimum: 0 },
        itemIndex: { type: 'integer', minimum: 0, description: 'Index of the item to remove' },
      },
      ['sectionIndex', 'listKey', 'itemIndex'],
    ],
    [
      'move_list_item',
      'Reorder an item within a section list (from → to). Use describe_section first.',
      {
        sectionIndex: { type: 'integer', minimum: 0 },
        listKey: { type: 'string' },
        nestedKey: { type: 'string' },
        parentItemIndex: { type: 'integer', minimum: 0 },
        from: { type: 'integer', minimum: 0 },
        to: { type: 'integer', minimum: 0 },
      },
      ['sectionIndex', 'listKey', 'from', 'to'],
    ],
    [
      'get_changes',
      'List pending CMS branch changes vs main. Prefer before publish or discard.',
      {},
    ],
    [
      'publish_changes',
      'Do not call directly from the Agent rail — use propose_changes with publish_changes so the human gets a Publish card.',
      { message: { type: 'string', description: 'Optional publish commit message' } },
    ],
    [
      'discard_changes',
      'Do not call directly from the Agent rail — use propose_changes with discard_changes so the human gets a confirmation card.',
      {
        path: {
          type: 'string',
          description: 'Optional single content path to discard; omit to discard all',
        },
      },
    ],
    [
      'update_asset_metadata',
      'Update Cloudinary asset metadata (tags, title, description) by publicId.',
      {
        publicId: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        title: { type: 'string' },
        description: { type: 'string' },
      },
      ['publicId'],
    ],
    ['get_site', 'Return the current site.json (nav, footer, newsletter, …).', {}],
    [
      'apply_site_patch',
      'Do not call directly from the Agent rail — use propose_changes with apply_site_patch so the human gets an Apply card.',
      {
        site: { type: 'object', description: 'Full or partial site object to apply' },
        mode: {
          type: 'string',
          enum: ['preview', 'cms'],
          description: 'Ignored — always stages a local draft',
        },
      },
      ['site'],
    ],
    ['get_page_history', 'Return git history for the currently open page.', {}],
    [
      'open_panel',
      'Open an editor chrome panel: inspector/section, media library, page info, or history.',
      {
        panel: {
          type: 'string',
          enum: ['inspector', 'section', 'media', 'info', 'page', 'history'],
        },
      },
      ['panel'],
    ],
    [
      'propose_changes',
      'Defer actions for human Apply/Dismiss cards. Use for save/publish/discard/site offers and optional A/B copy — not for edits the human already asked you to make live.',
      {
        title: { type: 'string', description: 'Card heading, e.g. Save to CMS or Alternate headlines' },
        hint: { type: 'string', description: 'Optional short instruction under the title' },
        items: {
          type: 'array',
          minItems: 1,
          maxItems: 12,
          items: {
            type: 'object',
            properties: {
              tool: {
                type: 'string',
                enum: proposableEnum,
              },
              args: { type: 'object' },
              label: { type: 'string' },
            },
            required: ['tool', 'args', 'label'],
          },
        },
      },
      ['items'],
    ],
    [
      'save_to_cms',
      'Do not call directly from the Agent rail — use propose_changes with save_to_cms instead so the human gets a Save button.',
      {},
    ],
  ];

  return all
    .filter(([name]) => {
      if (allowlist && !allowlist.has(name)) return false;
      return AGENT_ONLY_TOOLS.has(name) || !names || names.includes(name);
    })
    .map(([name, description, properties, required]) => ({
      type: 'function',
      function: {
        name,
        description,
        parameters: {
          type: 'object',
          properties,
          ...(required ? { required } : {}),
        },
      },
    }));
}

async function executeEditorTool(name, args) {
  const api = window.__tbVisualEditor;
  if (!api) throw new Error('Editor not ready');

  switch (name) {
    case 'get_editor_state':
      return api.getState();
    case 'list_section_kinds':
      return api.getState().sectionKinds.map((kind) => ({ kind }));
    case 'get_page':
      if (args?.id && typeof api.getPage === 'function') {
        // Desk facade: getPage(id). Editor facade: getPage() ignores args.
        try {
          return await api.getPage(args.id);
        } catch {
          return api.getPage();
        }
      }
      return api.getPage();
    case 'get_section':
      return api.getSection(args.index);
    case 'select_section':
      return api.selectSection(args.index, { scroll: true });
    case 'add_section':
      return api.addSection({ kind: args.kind, index: args.index });
    case 'move_section':
      return api.moveSection({ from: args.from, to: args.to });
    case 'duplicate_section':
      return api.duplicateSection(args.index);
    case 'delete_section':
      return api.deleteSection(args.index);
    case 'replace_section':
      return api.replaceSection({ index: args.index, section: args.section });
    case 'patch_section':
      return api.patchSection({ index: args.index, patch: args.patch });
    case 'set_field':
      return api.setField({
        path: args.path,
        value: args.value,
        sectionIndex: args.sectionIndex,
        structural: Boolean(args.structural),
      });
    case 'update_metadata':
      return api.updateMetadata(args);
    case 'set_device_preview':
      return api.setDevice(args.mode);
    case 'undo':
      return api.undo();
    case 'redo':
      return api.redo();
    case 'refresh_preview':
      return api.refreshPreview();
    case 'search_images':
      return api.searchImages({
        query: args.query || '',
        describe: args.describe,
        vision: args.vision,
        folder: args.folder,
        maxResults: args.maxResults,
        orientation: args.orientation,
        minWidth: args.minWidth,
        maxWidth: args.maxWidth,
        minHeight: args.minHeight,
        maxHeight: args.maxHeight,
        format: args.format,
        tags: args.tags,
      });
    case 'get_image_library_config':
      return api.getImageLibraryConfig();
    case 'set_image':
      return api.setImage({
        path: args.path,
        sectionIndex: args.sectionIndex,
        secureUrl: args.secureUrl,
        publicId: args.publicId,
        width: args.width,
        height: args.height,
        alt: args.alt,
      });
    case 'list_pages':
      return api.listPages();
    case 'create_page':
      return api.createPage({
        id: args.id,
        path: args.path,
        title: args.title,
        description: args.description,
        open: args.open,
      });
    case 'open_page':
      return api.openPage({ id: args.id, force: args.force });
    case 'describe_section':
      return api.describeSection({ index: args.index });
    case 'add_list_item':
      return api.addListItem({
        sectionIndex: args.sectionIndex,
        listKey: args.listKey,
        nestedKey: args.nestedKey,
        parentItemIndex: args.parentItemIndex,
        item: args.item,
      });
    case 'remove_list_item':
      return api.removeListItem({
        sectionIndex: args.sectionIndex,
        listKey: args.listKey,
        nestedKey: args.nestedKey,
        parentItemIndex: args.parentItemIndex,
        itemIndex: args.itemIndex,
      });
    case 'move_list_item':
      return api.moveListItem({
        sectionIndex: args.sectionIndex,
        listKey: args.listKey,
        nestedKey: args.nestedKey,
        parentItemIndex: args.parentItemIndex,
        from: args.from,
        to: args.to,
      });
    case 'get_changes':
      return api.getChanges();
    case 'publish_changes':
      return api.publishChanges({ message: args.message });
    case 'discard_changes':
      return api.discardChanges({ path: args.path });
    case 'update_asset_metadata':
      return api.updateAssetMetadata({
        publicId: args.publicId,
        tags: args.tags,
        title: args.title,
        description: args.description,
      });
    case 'get_site':
      return api.getSite();
    case 'apply_site_patch':
      return api.applySitePatch({ site: args.site, mode: args.mode });
    case 'get_page_history':
      return api.getPageHistory();
    case 'open_panel':
      return api.openPanel({ panel: args.panel });
    case 'propose_changes': {
      const items = normalizeProposeItems(args.items);
      if (!items.length) {
        return { error: 'propose_changes needs at least one valid item', deferred: false };
      }
      return {
        deferred: true,
        title: typeof args.title === 'string' ? args.title.slice(0, 120) : undefined,
        hint: typeof args.hint === 'string' ? args.hint.slice(0, 200) : undefined,
        items,
        count: items.length,
      };
    }
    case 'save_to_cms':
      return api.saveToCms();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

/**
 * Read OpenAI chat.completion.chunk SSE and assemble one assistant message.
 * @param {(text: string) => void | Promise<void>} [onContent]
 */
async function callChatApi(messages, tools, { onContent } = {}) {
  const res = await fetch('/api/admin/webmcp/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ messages, tools }),
  });

  const contentType = res.headers.get('content-type') || '';
  if (!res.ok || !contentType.includes('text/event-stream')) {
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    throw new Error(data?.error || `Chat failed (${res.status})`);
  }

  if (!res.body) throw new Error('Chat stream empty');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  /** @type {Array<{ id: string, type: string, function: { name: string, arguments: string } }>} */
  const toolCalls = [];
  let finishReason = null;
  let pendingRender = null;
  let renderQueued = false;

  const flushContent = () => {
    if (!onContent || renderQueued) return;
    renderQueued = true;
    const snapshot = content;
    pendingRender = Promise.resolve()
      .then(() => onContent(snapshot))
      .finally(() => {
        renderQueued = false;
        if (content !== snapshot) flushContent();
      });
  };

  const handleData = (payload) => {
    if (!payload || payload === '[DONE]') return;
    let chunk;
    try {
      chunk = JSON.parse(payload);
    } catch {
      return;
    }
    const choice = chunk.choices?.[0];
    if (!choice) return;
    if (choice.finish_reason) finishReason = choice.finish_reason;
    const delta = choice.delta || {};
    if (typeof delta.content === 'string' && delta.content) {
      content += delta.content;
      flushContent();
    }
    if (Array.isArray(delta.tool_calls)) {
      for (const part of delta.tool_calls) {
        const idx = typeof part.index === 'number' ? part.index : 0;
        if (!toolCalls[idx]) {
          toolCalls[idx] = {
            id: '',
            type: 'function',
            function: { name: '', arguments: '' },
          };
        }
        const dest = toolCalls[idx];
        if (part.id) dest.id = part.id;
        if (part.type) dest.type = part.type;
        if (part.function?.name) dest.function.name += part.function.name;
        if (typeof part.function?.arguments === 'string') {
          dest.function.arguments += part.function.arguments;
        }
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() || '';
    for (const line of parts) {
      const trimmed = line.trimEnd();
      if (!trimmed || trimmed.startsWith(':')) continue;
      if (trimmed.startsWith('data:')) {
        handleData(trimmed.slice(5).trimStart());
      }
    }
  }
  if (buffer.trim()) {
    for (const line of buffer.split('\n')) {
      const trimmed = line.trimEnd();
      if (trimmed.startsWith('data:')) handleData(trimmed.slice(5).trimStart());
    }
  }
  if (pendingRender) await pendingRender;
  // Final paint with the complete buffer (covers a last chunk after the in-flight render).
  if (onContent && content) await onContent(content);

  const message = {
    role: 'assistant',
    content: content || null,
  };
  const calls = toolCalls.filter(Boolean);
  if (calls.length) message.tool_calls = calls;
  return { message, finishReason };
}

function summarizeToolArgs(args) {
  const raw = JSON.stringify(args);
  if (raw.length <= 80) return raw;
  return `${raw.slice(0, 77)}…`;
}

function summarizeToolResult(result) {
  if (result == null) return 'ok';
  if (typeof result === 'string') return result.length > 120 ? `${result.slice(0, 117)}…` : result;
  if (result.error) return `error: ${result.error}`;
  if (result.deferred) {
    return `deferred · ${result.count || result.items?.length || 0} action card${(result.count || result.items?.length) === 1 ? '' : 's'}`;
  }
  if (result.kind) return `${result.kind}`;
  if (Array.isArray(result.assets)) {
    return `${result.assets.length} images${result.folder ? ` in ${result.folder}` : ''}`;
  }
  if (Array.isArray(result.sections)) return `${result.sections.length} sections · dirty=${result.dirty}`;
  if (result.path && result.src) return `${result.path}`;
  if (result.path && 'value' in result) return `${result.path}`;
  if (result.pageId) return `${result.pageId} · ${result.sectionCount} sections`;
  const raw = JSON.stringify(result);
  return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw;
}

async function runAgentTurn(ui, messages, { surface = 'editor' } = {}) {
  const isDesk = surface === 'desk';
  const tools = toolDefsFromWebMcp({
    allowlist: isDesk ? DESK_TOOL_ALLOWLIST : null,
    proposableEnum: isDesk ? DESK_PROPOSABLE_ENUM : PROPOSABLE_TOOL_ENUM,
  });
  /** @type {Array<{ title?: string, hint?: string, items: object[] }>} */
  const pendingActionCards = [];

  const flushActionCards = () => {
    while (pendingActionCards.length) {
      const proposal = pendingActionCards.shift();
      appendActionCard(ui.log, proposal, { execute: executeEditorTool });
      const n = proposal.items?.length || 0;
      appendBubble(ui.log, 'tool', `↳ waiting for Apply (${n} item${n === 1 ? '' : 's'})`);
    }
  };

  const finishTurn = () => {
    flushActionCards();
  };

  let guard = 0;
  while (guard++ < 12) {
    /** @type {HTMLElement | null} */
    let streamBubble = null;
    showThinking(ui.log);
    let choice;
    try {
      ({ message: choice } = await callChatApi(messages, tools, {
        onContent: async (text) => {
          if (!streamBubble) streamBubble = beginAssistantStream(ui.log);
          await setBubbleMarkdown(streamBubble, text);
          ui.log.scrollTop = ui.log.scrollHeight;
        },
      }));
    } finally {
      hideThinking(ui.log);
    }
    if (!choice) throw new Error('Empty model response');

    const toolCalls = choice.tool_calls;
    if (!toolCalls?.length) {
      const text = choice.content?.trim() || '(no reply)';
      if (streamBubble) {
        endAssistantStream(streamBubble);
        await setBubbleMarkdown(streamBubble, text);
      } else {
        appendBubble(ui.log, 'assistant', text);
      }
      messages.push({ role: 'assistant', content: choice.content || text });
      finishTurn();
      return;
    }

    // Tool round: drop an empty streaming bubble; keep any preamble text.
    if (streamBubble) {
      endAssistantStream(streamBubble);
      if (!choice.content?.trim()) streamBubble.remove();
    }

    messages.push({
      role: 'assistant',
      content: choice.content || null,
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      const name = call.function?.name || 'unknown';
      let args = {};
      try {
        args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        args = {};
      }

      const deferredDirect =
        DEFER_TO_PROPOSE.has(name) || (isDesk && name === 'update_metadata');
      let effectiveName = name;
      let shortProposeLabel = null;
      if (deferredDirect) {
        const deferred = deferDirectToolToPropose(name, args);
        args = {
          title: deferred.title,
          hint: deferred.hint,
          items: deferred.items,
        };
        effectiveName = 'propose_changes';
        shortProposeLabel = deferred.shortLabel;
      }

      // Quieter: deferred proposes get a one-liner; explicit propose_changes skips the noisy JSON bubble.
      if (deferredDirect && shortProposeLabel) {
        appendBubble(ui.log, 'tool', `propose_changes · ${shortProposeLabel}`);
      } else if (effectiveName !== 'propose_changes') {
        appendBubble(ui.log, 'tool', `${effectiveName} ${summarizeToolArgs(args)}`);
      }

      let result;
      try {
        result = await executeEditorTool(effectiveName, args);
      } catch (err) {
        result = { error: err.message || String(err) };
      }

      // Leave the desk/editor after create/open — MUST return before the next chat fetch,
      // otherwise the pending navigation is cancelled by the streaming request.
      const leaveHref =
        name === 'create_page' && result?.id && !result.error && result.open !== false
          ? result.editorPath || editorPathFor(result.id)
          : name === 'open_page' && result?.navigated && (result.editorPath || result.pageId)
            ? result.editorPath || editorPathFor(result.pageId)
            : null;

      if (leaveHref) {
        appendBubble(ui.log, 'tool', `↳ ${summarizeToolResult(result)}`);
        appendOpenEditorCard(ui.log, {
          href: leaveHref,
          pageId: result.id || result.pageId,
        });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
        hardNavigate(leaveHref);
        return { navigatedAway: true, href: leaveHref };
      }

      if (effectiveName === 'propose_changes' && result?.deferred && result?.items) {
        // Defer DOM mount until after the model's follow-up streamed text.
        // No "↳ queued N…" bubble — cards appear quietly after final text.
        pendingActionCards.push({
          title: result.title,
          hint: result.hint,
          items: result.items,
        });
      } else if (name === 'search_images' && result?.assets) {
        appendImageResults(ui.log, result);
      } else if (name === 'set_image' && result?.src) {
        appendBubble(ui.log, 'tool', `↳ set ${result.path}\n${result.src}`);
      } else if (effectiveName !== 'propose_changes' || result?.error) {
        appendBubble(ui.log, 'tool', `↳ ${summarizeToolResult(result)}`);
      }

      // Tool message content must match what the model expects for this tool_call_id.
      const toolContent =
        deferredDirect && result?.deferred
          ? {
              deferred: true,
              redirected: 'propose_changes',
              message: `${name} offered as an Apply card — waiting for the human.`,
              items: result.items,
            }
          : result;
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: typeof toolContent === 'string' ? toolContent : JSON.stringify(toolContent),
      });
    }
  }
  appendBubble(ui.log, 'assistant', 'Stopped after too many tool rounds — ask me to continue.');
  finishTurn();
}


export {
  SYSTEM_PROMPT,
  DESK_SYSTEM_PROMPT,
  DESK_TOOL_ALLOWLIST,
  runAgentTurn,
  toolDefsFromWebMcp,
  executeEditorTool,
};
