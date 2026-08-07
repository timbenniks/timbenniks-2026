/**
 * WebMCP tool registration for the visual page editor.
 * Works with:
 * - Native Chrome WebMCP (navigator.modelContext) + Model Context Tool Inspector
 * - @mcp-b/global polyfill (document.modelContext) + MCP-B extension / embedded agent
 */

const SECTION_KIND_HELP = {
  hero: 'Primary page hero with headline, subline, CTAs, optional image',
  'quote-callout': 'Large quote / manifesto block',
  'feature-split': 'Heading + live cards from a content collection',
  'card-grid': 'Grid of collection cards (writing, videos, speaking, projects)',
  'card-rows': 'Row list of collection cards (good for speaking)',
  stats: 'Simple stats derived from a collection',
  browse: 'Browse / search entry for a collection',
  inventory: 'Grouped name/note inventory lists',
  'copy-blocks': 'Multiple labeled copy blocks',
  'photo-grid': 'Image gallery grid',
  'topic-grid': 'Topic cards + optional pills',
  factsheet: 'Term / value fact rows',
  'image-text': 'Image beside markdown body copy',
  faq: 'FAQ accordion items',
  timeline: 'Career / history timeline',
  'cta-strip': 'Short call-to-action band',
};

function textResult(payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: 'text', text }] };
}

function errorResult(err) {
  return {
    content: [{ type: 'text', text: err?.message || String(err) }],
    isError: true,
  };
}

function editor() {
  const api = window.__tbVisualEditor;
  if (!api) throw new Error('Visual editor is not ready yet');
  return api;
}

async function run(fn) {
  try {
    const value = await fn(editor());
    return textResult(value);
  } catch (err) {
    return errorResult(err);
  }
}

function buildTools() {
  return [
    {
      name: 'get_editor_state',
      description:
        'Get the current visual editor state: page id, path, dirty flag, selected section, and a short summary of all sections. Call this first.',
      inputSchema: { type: 'object', properties: {} },
      async execute() {
        return run((api) => api.getState());
      },
    },
    {
      name: 'list_section_kinds',
      description:
        'List all section kinds you can insert, with a one-line description of each.',
      inputSchema: { type: 'object', properties: {} },
      async execute() {
        return run((api) => {
          const kinds = api.getState().sectionKinds;
          return kinds.map((kind) => ({
            kind,
            description: SECTION_KIND_HELP[kind] || kind,
          }));
        });
      },
    },
    {
      name: 'get_page',
      description:
        'Return the full page JSON currently in the editor (metadata + sections). Prefer get_section for focused edits.',
      inputSchema: { type: 'object', properties: {} },
      async execute() {
        return run((api) => api.getPage());
      },
    },
    {
      name: 'get_section',
      description: 'Return one section by zero-based index.',
      inputSchema: {
        type: 'object',
        properties: {
          index: { type: 'integer', description: 'Zero-based section index', minimum: 0 },
        },
        required: ['index'],
      },
      async execute(args) {
        return run((api) => api.getSection(args.index));
      },
    },
    {
      name: 'select_section',
      description:
        'Select a section in the Layers tab and highlight it in the live preview so the human can see what you are editing.',
      inputSchema: {
        type: 'object',
        properties: {
          index: { type: 'integer', minimum: 0 },
        },
        required: ['index'],
      },
      async execute(args) {
        return run((api) => api.selectSection(args.index, { scroll: true }));
      },
    },
    {
      name: 'add_section',
      description:
        'Insert a new section with kind-specific placeholder content. The preview updates live. Then rewrite fields with set_field, patch_section, or replace_section.',
      inputSchema: {
        type: 'object',
        properties: {
          kind: {
            type: 'string',
            description: 'Section kind from list_section_kinds',
            enum: Object.keys(SECTION_KIND_HELP),
          },
          index: {
            type: 'integer',
            description: 'Insert index (default: append at end)',
            minimum: 0,
          },
        },
        required: ['kind'],
      },
      async execute(args) {
        return run((api) => api.addSection({ kind: args.kind, index: args.index }));
      },
    },
    {
      name: 'move_section',
      description: 'Move a section from one index to another. Preview updates.',
      inputSchema: {
        type: 'object',
        properties: {
          from: { type: 'integer', minimum: 0 },
          to: { type: 'integer', minimum: 0 },
        },
        required: ['from', 'to'],
      },
      async execute(args) {
        return run((api) => api.moveSection({ from: args.from, to: args.to }));
      },
    },
    {
      name: 'duplicate_section',
      description: 'Duplicate a section and insert the copy immediately after it.',
      inputSchema: {
        type: 'object',
        properties: { index: { type: 'integer', minimum: 0 } },
        required: ['index'],
      },
      async execute(args) {
        return run((api) => api.duplicateSection(args.index));
      },
    },
    {
      name: 'delete_section',
      description: 'Delete a section by index. Preview updates.',
      inputSchema: {
        type: 'object',
        properties: { index: { type: 'integer', minimum: 0 } },
        required: ['index'],
      },
      async execute(args) {
        return run((api) => api.deleteSection(args.index));
      },
    },
    {
      name: 'replace_section',
      description:
        'Replace an entire section object (must include kind). Use for rewriting a whole block. Preview reloads.',
      inputSchema: {
        type: 'object',
        properties: {
          index: { type: 'integer', minimum: 0 },
          section: {
            type: 'object',
            description: 'Full section object including kind',
          },
        },
        required: ['index', 'section'],
      },
      async execute(args) {
        return run((api) => api.replaceSection({ index: args.index, section: args.section }));
      },
    },
    {
      name: 'patch_section',
      description:
        'Shallow-merge fields onto an existing section without changing kind. Preview reloads. Good for updating title, lede, items arrays, etc.',
      inputSchema: {
        type: 'object',
        properties: {
          index: { type: 'integer', minimum: 0 },
          patch: {
            type: 'object',
            description: 'Fields to merge (do not change kind)',
          },
        },
        required: ['index', 'patch'],
      },
      async execute(args) {
        return run((api) => api.patchSection({ index: args.index, patch: args.patch }));
      },
    },
    {
      name: 'set_field',
      description:
        'Set a single field by path. Prefer this for copy edits so the preview updates live. Paths can be absolute (sections.0.headline.lead, metadata.title) or relative to sectionIndex (headline.lead). Content query fields (source, limit, tags, playlist, columns, window, hideWhenEmpty, …) and other select/number/boolean controls automatically reload the preview — structural is optional and only needed as an override.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Field path, e.g. sections.0.subline or headline.lead',
          },
          value: {
            description: 'New value (string, number, boolean, or string[] for multi-select tags)',
          },
          sectionIndex: {
            type: 'integer',
            minimum: 0,
            description: 'Required when path is relative to a section',
          },
          structural: {
            type: 'boolean',
            description:
              'Force preview reload. Usually unnecessary — query fields and select/number/boolean controls auto-reload.',
            default: false,
          },
        },
        required: ['path', 'value'],
      },
      async execute(args) {
        return run((api) =>
          api.setField({
            path: args.path,
            value: args.value,
            sectionIndex: args.sectionIndex,
            structural: Boolean(args.structural),
          }),
        );
      },
    },
    {
      name: 'update_metadata',
      description: 'Update SEO metadata fields (title, description, keywords, image, …).',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          keywords: { type: 'string' },
          image: { type: 'string', description: 'Social image URL' },
        },
      },
      async execute(args) {
        const fields = { ...args };
        delete fields.signal;
        return run((api) => api.updateMetadata(fields));
      },
    },
    {
      name: 'set_device_preview',
      description: 'Switch the live preview width: desktop, mobile, or full.',
      inputSchema: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['desktop', 'mobile', 'full'] },
        },
        required: ['mode'],
      },
      async execute(args) {
        return run((api) => api.setDevice(args.mode));
      },
    },
    {
      name: 'undo',
      description: 'Undo the last editor change.',
      inputSchema: { type: 'object', properties: {} },
      async execute() {
        return run((api) => api.undo());
      },
    },
    {
      name: 'redo',
      description: 'Redo the last undone editor change.',
      inputSchema: { type: 'object', properties: {} },
      async execute() {
        return run((api) => api.redo());
      },
    },
    {
      name: 'refresh_preview',
      description: 'Force-sync the in-memory preview draft and reload the iframe.',
      inputSchema: { type: 'object', properties: {} },
      async execute() {
        return run((api) => api.refreshPreview());
      },
    },
    {
      name: 'get_image_library_config',
      description:
        'Return allowed Cloudinary folders, default folder, optional tags/prefix for this site’s image search.',
      inputSchema: { type: 'object', properties: {} },
      async execute() {
        return run((api) => api.getImageLibraryConfig());
      },
    },
    {
      name: 'search_images',
      description:
        'Search Tim’s Cloudinary library within allowed folders. Matches tags + Media Library Title/Description (and filename). Pass describe or query for scenes. Set vision:true only as a fallback to rank tiny thumbs. Returns publicId, secureUrl, title, description, tags, metadataScore; vision adds visionScore/visionReason.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Keywords matched against tags, title, description, filename, public_id.',
          },
          describe: {
            type: 'string',
            description:
              'Natural-language scene, e.g. "Tim on stage at a conference". Searches tags + title + description (no vision unless vision:true).',
          },
          vision: {
            type: 'boolean',
            description:
              'Optional fallback. If true, also vision-rank a metadata shortlist. Prefer metadata-only first.',
          },
          folder: {
            type: 'string',
            description:
              'One allowed folder, or "all" / omit to search the entire allowlist (default when CLOUDINARY_SEARCH_FOLDER is * or a list).',
          },
          maxResults: { type: 'integer', minimum: 1, maximum: 30 },
          orientation: {
            type: 'string',
            enum: ['portrait', 'landscape', 'square'],
            description: 'Filter by aspect ratio',
          },
          minWidth: { type: 'number' },
          maxWidth: { type: 'number' },
          minHeight: { type: 'number' },
          maxHeight: { type: 'number' },
          format: { type: 'string', description: 'e.g. png, jpg, webp' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
      async execute(args) {
        return run((api) =>
          api.searchImages({
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
          }),
        );
      },
    },
    {
      name: 'set_image',
      description:
        'Set an image field from a Cloudinary asset. path like image.src or image (section-relative) or metadata.image. Prefer secureUrl from search_images.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Field path: image.src, image, backgroundImage.src, metadata.image, …',
          },
          sectionIndex: { type: 'integer', minimum: 0 },
          secureUrl: { type: 'string' },
          publicId: { type: 'string' },
          width: { type: 'number' },
          height: { type: 'number' },
          alt: { type: 'string' },
        },
        required: ['path'],
      },
      async execute(args) {
        return run((api) =>
          api.setImage({
            path: args.path,
            sectionIndex: args.sectionIndex,
            secureUrl: args.secureUrl,
            publicId: args.publicId,
            width: args.width,
            height: args.height,
            alt: args.alt,
          }),
        );
      },
    },
    {
      name: 'save_to_cms',
      description:
        'Commit the current page to the cms working branch (not live until Publish on /admin/changes). Ask the human before calling unless they explicitly asked to save.',
      inputSchema: { type: 'object', properties: {} },
      async execute() {
        return run((api) => api.saveToCms());
      },
    },
  ];
}

function getModelContexts() {
  const contexts = [];
  const seen = new Set();
  const add = (ctx, label) => {
    if (!ctx || seen.has(ctx)) return;
    seen.add(ctx);
    contexts.push({ ctx, label });
  };

  // Native Chrome WebMCP (Inspector / browser agents)
  add(navigator.modelContext, 'navigator.modelContext');
  // MCP-B polyfill / bridge
  add(document.modelContext, 'document.modelContext');
  // Some previews expose testing helpers only
  if (navigator.modelContextTesting && typeof navigator.modelContextTesting.registerTool === 'function') {
    add(navigator.modelContextTesting, 'navigator.modelContextTesting');
  }

  return contexts;
}

function registerToolOnContext(ctx, tool) {
  if (typeof ctx.registerTool === 'function') {
    ctx.registerTool({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      execute: tool.execute,
    });
    return 'registerTool';
  }
  return null;
}

function registerViaProvideContext(ctx, tools) {
  if (typeof ctx.provideContext !== 'function') return false;
  ctx.provideContext({
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      execute: tool.execute,
    })),
  });
  return true;
}

function registerAllTools() {
  const tools = buildTools();
  const contexts = getModelContexts();
  const report = { tools: tools.length, contexts: [], errors: [] };

  if (!contexts.length) {
    report.errors.push(
      'No modelContext API found. Enable chrome://flags/#enable-webmcp-testing or load @mcp-b/global.',
    );
    console.warn('[webmcp]', report.errors[0]);
    window.__tbWebMcp = { ready: false, ...report };
    return report;
  }

  for (const { ctx, label } of contexts) {
    try {
      if (registerViaProvideContext(ctx, tools)) {
        report.contexts.push({ label, method: 'provideContext' });
        continue;
      }
      let method = null;
      for (const tool of tools) {
        method = registerToolOnContext(ctx, tool) || method;
      }
      if (method) {
        report.contexts.push({ label, method });
      } else {
        report.errors.push(`${label}: no registerTool/provideContext`);
      }
    } catch (err) {
      report.errors.push(`${label}: ${err.message || err}`);
    }
  }

  window.__tbWebMcp = { ready: report.contexts.length > 0, ...report, toolNames: tools.map((t) => t.name) };
  console.info(
    '[webmcp] registered',
    tools.length,
    'tools on',
    report.contexts.map((c) => c.label).join(', ') || '(none)',
  );
  window.dispatchEvent(new CustomEvent('tb-webmcp-ready', { detail: window.__tbWebMcp }));
  return report;
}

function boot() {
  if (window.__tbVisualEditor) {
    registerAllTools();
    return;
  }
  window.addEventListener(
    'tb-visual-editor-ready',
    () => {
      registerAllTools();
    },
    { once: true },
  );
}

boot();
