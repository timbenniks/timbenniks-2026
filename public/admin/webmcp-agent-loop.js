/**
 * Agent tool loop — OpenAI chat + __tbVisualEditor tool execution.
 */
import {
  appendBubble,
  appendImageResults,
} from './webmcp-agent-ui.js';

const SYSTEM_PROMPT = `You are co-editing Tim Benniks' marketing site in a live visual editor.

Rules:
- Use tools to inspect and change the page. Prefer get_editor_state first.
- Prefer existing section kinds from list_section_kinds. Never invent kinds.
- For copy edits use set_field so the preview updates live.
- Content query fields (source, limit, tags, playlist, columns, window, …) auto-reload the preview via set_field — no structural flag needed.
- For whole-block rewrites use patch_section or replace_section.
- Match Tim's voice: clear, concrete, no corporate fluff, short sentences.
- Do NOT call save_to_cms unless the human explicitly asks to save.
- For images: call get_image_library_config once if unsure, then search_images. After search_images, tell the human to click Use on a thumbnail — do NOT call set_image unless they ask you to pick for them.
- For scene/content searches pass describe (or query) with natural language / keywords. Assets are tagged with title + description in Cloudinary — metadata search is enough. OMIT folder unless the human names one.
- Do NOT pass vision:true unless metadata results are empty or clearly wrong. Vision is a slow fallback, not the default.
- orientation is a soft preference when describe/query is multi-word. If assets is empty, say so — do not invent an image.
- Never invent Cloudinary URLs. Never search outside the configured folders.
- When proposing an image to the human, include it as markdown: ![short label](https://res.cloudinary.com/...). Prefer the asset title or description as the label when present. The chat UI renders that as a thumbnail.
- After structural changes, briefly say what changed so the human can look at the preview.
- Keep tool args valid JSON. Paths like sections.0.headline.lead or relative headline.lead with sectionIndex.`;

function toolDefsFromWebMcp() {
  const names = window.__tbWebMcp?.toolNames;
  const all = [
    ['get_editor_state', 'Current page id, dirty flag, selected section, section summaries.', {}],
    ['list_section_kinds', 'Allowed section kinds with short descriptions.', {}],
    ['get_page', 'Full page JSON in the editor.', {}],
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
      'Update SEO metadata fields.',
      {
        title: { type: 'string' },
        description: { type: 'string' },
        keywords: { type: 'string' },
        image: { type: 'string' },
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
    ['save_to_cms', 'Save to cms branch. Only when the human asks.', {}],
  ];

  return all
    .filter(([name]) => !names || names.includes(name))
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
    case 'save_to_cms':
      return api.saveToCms();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function callChatApi(messages, tools) {
  const res = await fetch('/api/admin/webmcp/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, tools }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Chat failed (${res.status})`);
  return data;
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

async function runAgentTurn(ui, messages) {
  const tools = toolDefsFromWebMcp();
  let guard = 0;
  while (guard++ < 12) {
    const data = await callChatApi(messages, tools);
    const choice = data.choices?.[0]?.message;
    if (!choice) throw new Error('Empty model response');

    const toolCalls = choice.tool_calls;
    if (!toolCalls?.length) {
      const text = choice.content?.trim() || '(no reply)';
      appendBubble(ui.log, 'assistant', text);
      messages.push({ role: 'assistant', content: choice.content || text });
      return;
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
      appendBubble(ui.log, 'tool', `${name} ${summarizeToolArgs(args)}`);
      let result;
      try {
        result = await executeEditorTool(name, args);
      } catch (err) {
        result = { error: err.message || String(err) };
      }
      if (name === 'search_images' && result?.assets) {
        appendImageResults(ui.log, result);
      } else if (name === 'set_image' && result?.src) {
        appendBubble(ui.log, 'tool', `↳ set ${result.path}\n${result.src}`);
      } else {
        appendBubble(ui.log, 'tool', `↳ ${summarizeToolResult(result)}`);
      }
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: typeof result === 'string' ? result : JSON.stringify(result),
      });
    }
  }
  appendBubble(ui.log, 'assistant', 'Stopped after too many tool rounds — ask me to continue.');
}


export { SYSTEM_PROMPT, runAgentTurn, toolDefsFromWebMcp, executeEditorTool };
