/**
 * WebMCP tools for the /admin pages desk (lifecycle + ship + site only).
 */
import { installDeskFacade } from './desk-facade.js';

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

function desk() {
  const api = window.__tbDeskAgent || window.__tbVisualEditor;
  if (!api) throw new Error('Desk agent is not ready yet');
  return api;
}

async function run(fn) {
  try {
    return textResult(await fn(desk()));
  } catch (err) {
    return errorResult(err);
  }
}

function buildTools() {
  return [
    {
      name: 'list_pages',
      description: 'List all CMS pages (id, path, title).',
      inputSchema: { type: 'object', properties: {} },
      async execute() {
        return run((api) => api.listPages());
      },
    },
    {
      name: 'get_page',
      description:
        'Return page JSON. Pass id on the pages desk (e.g. about). In the visual editor, omits id and returns the open draft.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Page id when calling from the desk' },
        },
      },
      async execute(args) {
        return run((api) => (args?.id ? api.getPage(args.id) : api.getPage()));
      },
    },
    {
      name: 'create_page',
      description:
        'Create a new marketing page as a local draft. Requires id (kebab-case), path (e.g. /workshop), and title. On the desk Agent, open defaults to true and navigates to the editor (stops the chat turn so navigation is not cancelled).',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          path: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          open: { type: 'boolean', description: 'Desk: open editor after create (default true)' },
        },
        required: ['id', 'path', 'title'],
      },
      async execute(args) {
        return run((api) => api.createPage(args));
      },
    },
    {
      name: 'update_metadata',
      description:
        'Update SEO metadata. In the editor: current page. On the desk: require pageId and prefer propose_changes for Apply cards.',
      inputSchema: {
        type: 'object',
        properties: {
          pageId: { type: 'string', description: 'Required on the desk' },
          title: { type: 'string' },
          description: { type: 'string' },
          keywords: { type: 'string' },
          image: { type: 'string' },
          canonical: { type: 'string' },
          imageAlt: { type: 'string' },
          noindex: { type: 'boolean' },
        },
      },
      async execute(args) {
        return run((api) => api.updateMetadata(args));
      },
    },
    {
      name: 'open_page',
      description: 'Navigate to the visual editor for a page id (leaves this desk).',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          force: { type: 'boolean' },
        },
        required: ['id'],
      },
      async execute(args) {
        return run((api) => api.openPage(args));
      },
    },
    {
      name: 'get_changes',
      description: 'Show pending cms → main changes (what would publish).',
      inputSchema: { type: 'object', properties: {} },
      async execute() {
        return run((api) => api.getChanges());
      },
    },
    {
      name: 'publish_changes',
      description:
        'Merge cms → main (goes live). Prefer human confirmation on the Agent rail via propose_changes.',
      inputSchema: {
        type: 'object',
        properties: { message: { type: 'string' } },
      },
      async execute(args) {
        return run((api) => api.publishChanges(args));
      },
    },
    {
      name: 'discard_changes',
      description: 'Discard all local drafts (destructive for unpublished work). Prefer human confirmation.',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' } },
      },
      async execute(args) {
        return run((api) => api.discardChanges(args));
      },
    },
    {
      name: 'get_site',
      description: 'Read site chrome (nav, footer, newsletter).',
      inputSchema: { type: 'object', properties: {} },
      async execute() {
        return run((api) => api.getSite());
      },
    },
    {
      name: 'apply_site_patch',
      description:
        'Write site.json. Prefer propose_changes from the Agent. Optional mode: preview.',
      inputSchema: {
        type: 'object',
        properties: {
          site: { type: 'object' },
          mode: { type: 'string', enum: ['preview'] },
        },
        required: ['site'],
      },
      async execute(args) {
        return run((api) => api.applySitePatch(args));
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
  add(navigator.modelContext, 'navigator.modelContext');
  add(document.modelContext, 'document.modelContext');
  if (navigator.modelContextTesting?.registerTool) {
    add(navigator.modelContextTesting, 'navigator.modelContextTesting');
  }
  return contexts;
}

function registerAllTools() {
  installDeskFacade();
  const tools = buildTools();
  const contexts = getModelContexts();
  const report = { tools: tools.length, contexts: [], errors: [], surface: 'desk' };

  if (!contexts.length) {
    report.errors.push('No modelContext API found.');
    window.__tbWebMcp = {
      ready: false,
      ...report,
      toolNames: tools.map((t) => t.name),
    };
    return report;
  }

  for (const { ctx, label } of contexts) {
    try {
      if (typeof ctx.provideContext === 'function') {
        ctx.provideContext({
          tools: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            execute: tool.execute,
          })),
        });
        report.contexts.push({ label, method: 'provideContext' });
        continue;
      }
      if (typeof ctx.registerTool === 'function') {
        for (const tool of tools) {
          ctx.registerTool({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            execute: tool.execute,
          });
        }
        report.contexts.push({ label, method: 'registerTool' });
      } else {
        report.errors.push(`${label}: no registerTool/provideContext`);
      }
    } catch (err) {
      report.errors.push(`${label}: ${err.message || err}`);
    }
  }

  window.__tbWebMcp = {
    ready: report.contexts.length > 0,
    ...report,
    toolNames: tools.map((t) => t.name),
  };
  console.info(
    '[webmcp-desk] registered',
    tools.length,
    'tools on',
    report.contexts.map((c) => c.label).join(', ') || '(none)',
  );
  window.dispatchEvent(new CustomEvent('tb-webmcp-ready', { detail: window.__tbWebMcp }));
  return report;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', registerAllTools, { once: true });
} else {
  registerAllTools();
}
