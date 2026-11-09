/**
 * AI assistant for the entry editor (talks, projects, videos, articles).
 *
 * Reuses the page editor's OpenAI chat loop and rail UI, with its own tool set:
 * the agent reads the form, writes metadata fields live into it, and searches
 * Cloudinary for a cover image. Title, body and slug are off limits, and the
 * agent never saves: the human reviews the form and clicks Save draft.
 */
import { createUi, appendBubble } from './webmcp-agent-ui.js';
import { runAgentTurn } from './webmcp-agent-loop.js';
import type { ChatMessage } from './webmcp-agent-loop.js';
import { apiFetch } from './lib/api.js';
import { errorMessage } from './lib/tools.js';
import type { OpenAiTool } from './lib/tools.js';
import type { CloudinarySearchResult } from './lib/facade.js';
import type { EntryCollectionDefJson, EntryFieldDef } from '../lib/admin/entry-fields';

const BODY_KEY = '$body';
const MAX_BODY_CHARS = 40_000;

/** What the entry editor exposes to its assistant. */
export interface EntryAgentHost {
  def: EntryCollectionDefJson;
  /** Fields currently rendered (new-only / existing-only already filtered). */
  fields(): EntryFieldDef[];
  /** Current, unsaved form values (frontmatter + `$body`). */
  values(): Record<string, unknown>;
  /** Write one value into the form control and mark the form dirty. */
  apply(field: EntryFieldDef, value: unknown): void;
  /** True while the entry is staged for deletion (form is inert). */
  locked(): boolean;
  setStatus(message: string, tone?: 'ok' | 'error' | 'warn' | ''): void;
}

/** Keys the assistant may never write, whatever the human asks. */
function lockReason(def: EntryCollectionDefJson, field: EntryFieldDef): string | null {
  if (field.key === def.titleKey) return 'the title is yours to write';
  if (field.key === BODY_KEY || field.type === 'markdown') return 'the body is yours to write';
  if (field.type === 'slug') return 'the slug follows the title';
  if (field.key === def.readingTimeKey) return 'reading time is calculated from the body';
  return null;
}

/** Fields the "Fill metadata" button asks for: those derivable from the content itself. */
function fillableFields(def: EntryCollectionDefJson, fields: EntryFieldDef[]): EntryFieldDef[] {
  return fields.filter((f) => {
    if (lockReason(def, f)) return false;
    if (f.type === 'textarea') return f.key !== 'transcript';
    return f.type === 'tags' || f.type === 'faqs' || f.type === 'image';
  });
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return !value.trim();
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/* -------------------------------------------------------------------------- */
/* Tools                                                                       */
/* -------------------------------------------------------------------------- */

const TOOL_DEFS: OpenAiTool[] = [
  {
    type: 'function',
    function: {
      name: 'read_entry_form',
      description:
        'Read the entry being edited: every field (key, label, type, allowed options, hint, whether you may write it) and the current unsaved form values, including the title and Markdown body. Call this first.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_entry_fields',
      description:
        'Write field values into the form live (the human then clicks Save draft). Pass only the keys you change. Types: text/textarea/url/date (YYYY-MM-DD)/select = string; number; boolean; tags = array of allowed option values (replaces the selection); url-list = array of URLs; faqs = array of {question, answer} (replaces all FAQs); image = a secureUrl returned by search_images. Title, body, slug and reading time are rejected.',
      parameters: {
        type: 'object',
        properties: {
          values: {
            type: 'object',
            description: 'Field key → new value, e.g. {"description": "…", "tags": ["ai"]}',
          },
        },
        required: ['values'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_images',
      description:
        'Search Tim’s Cloudinary library by tags, title and description. Pass describe (a natural-language scene) or query (keywords). Returns assets with secureUrl, title, description, width, height.',
      parameters: {
        type: 'object',
        properties: {
          describe: { type: 'string' },
          query: { type: 'string' },
          orientation: { type: 'string', enum: ['portrait', 'landscape', 'square'] },
          maxResults: { type: 'integer', minimum: 1, maximum: 12 },
        },
      },
    },
  },
];

function systemPrompt(def: EntryCollectionDefJson): string {
  return `You are the writing assistant in Tim Benniks' admin, working on one ${def.singular} (collection "${def.collection}") in the entry editor.

Tools:
- read_entry_form: field definitions plus the current unsaved values, including title and body. Call it before changing anything, and again when the human may have edited the form since.
- set_entry_fields: writes values into the form live. The human reviews and clicks Save draft; you cannot save or publish.
- search_images: finds images in Cloudinary for the image field.

Rules:
- Never change the title, body, slug or reading time; set_entry_fields rejects them. If asked to rewrite those, put suggested text in chat for the human to paste.
- Tags: only values from that field's options. Prefer 2–5 that genuinely fit.
- Description: one or two sentences, 150–155 characters, never more than 160, works as the SEO meta description and the card lede. Concrete, no hype.
- FAQs: 3–5 questions a reader would actually search for, each answered in 1–3 sentences strictly from the content. No questions the content does not answer.
- Never invent URLs, dates, video ids, event names, locations or links. Leave a field alone when the content does not support a value.
- Images: only secureUrl values returned by search_images. Mention the chosen image in chat as markdown: ![title](secureUrl).
- Write in Tim's voice: clear, concrete, short sentences, first person where it fits, no corporate fluff.
- After writing fields, list briefly what you set and remind the human to review and Save draft.`;
}

function fillPrompt(def: EntryCollectionDefJson, fields: EntryFieldDef[], values: Record<string, unknown>): string {
  const lines = fields.map((f) => {
    const note =
      f.type === 'image'
        ? isEmpty(values[f.key])
          ? 'empty — search_images for a fitting cover and set the best match'
          : 'already set — leave it'
        : f.type === 'tags'
          ? 'pick from the allowed options'
          : f.type === 'faqs'
            ? 'replace with 3–5 FAQs answered by the content'
            : 'write or improve it';
    return `- ${f.key} (${f.label}): ${note}`;
  });
  return `Fill in the metadata for this ${def.singular} from its title and body. Do not touch the title or the body.

Fields:
${lines.join('\n')}

Read the form first, then apply everything in a single set_entry_fields call (plus search_images if needed). Finish with a short list of what you set.`;
}

/** Coerce one model-supplied value to what the form control takes, or explain why not. */
function coerce(
  field: EntryFieldDef,
  raw: unknown,
  allowedImages: Set<string>,
  current: unknown,
): { ok: true; value: unknown; note?: string } | { ok: false; reason: string } {
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());
  switch (field.type) {
    case 'boolean':
      return typeof raw === 'boolean' ? { ok: true, value: raw } : { ok: false, reason: 'expected true or false' };
    case 'number': {
      if (raw === '' || raw === null) return { ok: true, value: '' };
      const n = Number(raw);
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false, reason: 'expected a number' };
    }
    case 'date': {
      const v = str(raw);
      return !v || /^\d{4}-\d{2}-\d{2}/.test(v)
        ? { ok: true, value: v.slice(0, 10) }
        : { ok: false, reason: 'expected YYYY-MM-DD' };
    }
    case 'url': {
      const v = str(raw);
      return !v || /^https?:\/\//.test(v) ? { ok: true, value: v } : { ok: false, reason: 'expected an http(s) URL' };
    }
    case 'select': {
      const v = str(raw);
      const options = field.options ?? [];
      return !v || options.some((o) => o.value === v)
        ? { ok: true, value: v }
        : { ok: false, reason: `not one of: ${options.map((o) => o.value).join(', ')}` };
    }
    case 'tags': {
      if (!Array.isArray(raw)) return { ok: false, reason: 'expected an array of tag values' };
      const allowed = new Set((field.options ?? []).map((o) => o.value));
      const wanted = [...new Set(raw.map(str).filter(Boolean))];
      const kept = wanted.filter((t) => allowed.has(t));
      const dropped = wanted.filter((t) => !allowed.has(t));
      return {
        ok: true,
        value: kept,
        ...(dropped.length ? { note: `dropped unknown tags: ${dropped.join(', ')}` } : {}),
      };
    }
    case 'url-list': {
      if (!Array.isArray(raw)) return { ok: false, reason: 'expected an array of URLs' };
      const urls = raw.map(str).filter(Boolean);
      return urls.every((u) => /^https?:\/\//.test(u))
        ? { ok: true, value: urls }
        : { ok: false, reason: 'every entry must be an http(s) URL' };
    }
    case 'faqs': {
      if (!Array.isArray(raw)) return { ok: false, reason: 'expected an array of {question, answer}' };
      const items = raw
        .filter((it): it is Record<string, unknown> => Boolean(it) && typeof it === 'object')
        .map((it) => ({ question: str(it.question), answer: str(it.answer) }))
        .filter((it) => it.question && it.answer);
      return { ok: true, value: items.slice(0, 12) };
    }
    case 'image': {
      const v = str(raw);
      if (!v || v === str(current) || allowedImages.has(v)) return { ok: true, value: v };
      return { ok: false, reason: 'use a secureUrl returned by search_images' };
    }
    default:
      return { ok: true, value: str(raw) };
  }
}

function makeExecutor(host: EntryAgentHost) {
  const allowedImages = new Set<string>();

  return async function execute(name: string, args: Record<string, unknown>): Promise<unknown> {
    const { def } = host;
    const fields = host.fields();

    if (name === 'read_entry_form') {
      const values = host.values();
      const body = typeof values[BODY_KEY] === 'string' ? (values[BODY_KEY] as string) : undefined;
      const { [BODY_KEY]: _body, ...data } = values;
      return {
        collection: def.collection,
        kind: def.singular,
        titleKey: def.titleKey,
        fields: fields.map((f) => ({
          key: f.key,
          label: f.label,
          type: f.type,
          ...(f.required ? { required: true } : {}),
          ...(f.hint ? { hint: f.hint } : {}),
          ...(f.options?.length ? { options: f.options.map((o) => o.value) } : {}),
          writable: !lockReason(def, f),
        })),
        values: data,
        ...(body !== undefined
          ? {
              body: body.length > MAX_BODY_CHARS ? `${body.slice(0, MAX_BODY_CHARS)}\n…(truncated)` : body,
            }
          : {}),
      };
    }

    if (name === 'set_entry_fields') {
      if (host.locked()) return { error: 'This entry is staged for deletion; the form is read-only.' };
      const input = args.values;
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return { error: 'values must be an object of field key → value' };
      }
      const current = host.values();
      const applied: string[] = [];
      const rejected: { key: string; reason: string }[] = [];
      const notes: string[] = [];
      for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
        const field = fields.find((f) => f.key === key);
        if (!field) {
          rejected.push({ key, reason: 'no such field in this form' });
          continue;
        }
        const locked = lockReason(def, field);
        if (locked) {
          rejected.push({ key, reason: `not writable: ${locked}` });
          continue;
        }
        const result = coerce(field, raw, allowedImages, current[key]);
        if (!result.ok) {
          rejected.push({ key, reason: result.reason });
          continue;
        }
        host.apply(field, result.value);
        applied.push(key);
        if (result.note) notes.push(`${key}: ${result.note}`);
      }
      if (applied.length) {
        host.setStatus(`AI updated ${applied.join(', ')}. Review, then Save draft.`, 'ok');
      }
      return { applied, rejected, ...(notes.length ? { notes } : {}), saved: false };
    }

    if (name === 'search_images') {
      const data = await apiFetch<CloudinarySearchResult>('/api/admin/cloudinary/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: typeof args.query === 'string' ? args.query : '',
          ...(typeof args.describe === 'string' && args.describe ? { describe: args.describe } : {}),
          ...(typeof args.orientation === 'string' ? { orientation: args.orientation } : {}),
          maxResults: typeof args.maxResults === 'number' ? Math.min(12, args.maxResults) : 8,
        }),
        errorMessage: 'Cloudinary search failed',
      });
      const assets = (data.assets ?? []).map((a) => ({
        secureUrl: a.secureUrl,
        title: a.title,
        description: a.description,
        width: a.width,
        height: a.height,
        tags: a.tags,
      }));
      for (const a of assets) if (a.secureUrl) allowedImages.add(a.secureUrl);
      return { count: assets.length, assets };
    }

    return { error: `Unknown tool ${name}` };
  };
}

/* -------------------------------------------------------------------------- */
/* Panel                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Build the assistant panel. Returns the element straight away (the editor
 * re-renders its layout and re-inserts it); the chat boots once the server
 * says an OpenAI key is configured.
 */
export function createEntryAgent(host: EntryAgentHost): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'panel side-panel entry-agent';
  panel.id = 'entry-agent';
  panel.setAttribute('aria-label', 'AI assistant');
  // The panel sits inside the entry <form>: keep the chat's own form events from
  // reaching it (a bubbling submit would save the draft, input would mark it dirty).
  for (const type of ['submit', 'input', 'change']) {
    panel.addEventListener(type, (e) => e.stopPropagation());
  }
  void boot(panel, host).catch((err: unknown) => console.warn('[entry-agent]', errorMessage(err)));
  return panel;
}

async function boot(panel: HTMLElement, host: EntryAgentHost): Promise<void> {
  const { def } = host;
  const statusRes = await fetch('/api/admin/webmcp/chat');
  const status: { enabled?: boolean } = statusRes.ok ? await statusRes.json() : {};
  if (!status.enabled) {
    panel.classList.add('is-disabled');
    panel.innerHTML =
      '<h3 class="side-title">AI assistant</h3><p class="field-hint">Set OPENAI_API_KEY on the server to enable the assistant.</p>';
    return;
  }

  const actions = document.createElement('div');
  actions.className = 'entry-agent-actions';
  const fillBtn = document.createElement('button');
  fillBtn.type = 'button';
  fillBtn.className = 'btn-secondary btn-block';
  fillBtn.id = 'ai-fill-metadata';
  fillBtn.textContent = '✦ Fill metadata with AI';
  const fillHint = document.createElement('p');
  fillHint.className = 'field-hint';
  const fields = fillableFields(def, host.fields());
  fillHint.textContent = `Writes ${fields.map((f) => (/^[A-Z]{2,}/.test(f.label) ? f.label : f.label.toLowerCase())).join(', ')} from the title and body. Title and body stay as they are.`;
  actions.append(fillBtn, fillHint);

  const mount = document.createElement('div');
  mount.className = 'entry-agent-mount';
  panel.append(mount);

  const ui = createUi(mount, {
    title: 'AI assistant',
    placeholder: `Ask about this ${def.singular}…`,
    logId: 'tb-entry-agent-log',
  });
  mount.insertBefore(actions, ui.log);

  const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt(def) }];
  const execute = makeExecutor(host);
  let busy = false;

  appendBubble(
    ui.log,
    'assistant',
    `I can fill in this ${def.singular}'s metadata — description, tags, FAQs, image — and answer questions about it. I never change the title or body.`,
  );

  async function send(text: string, display = text): Promise<void> {
    if (busy) return;
    busy = true;
    ui.send.disabled = true;
    fillBtn.disabled = true;
    appendBubble(ui.log, 'user', display);
    messages.push({ role: 'user', content: text });
    try {
      await runAgentTurn(ui, messages, { tools: TOOL_DEFS, execute });
    } catch (err) {
      appendBubble(ui.log, 'assistant', errorMessage(err), 'error');
    } finally {
      busy = false;
      ui.send.disabled = false;
      fillBtn.disabled = false;
    }
  }

  fillBtn.addEventListener('click', () => {
    if (host.locked()) return;
    const values = host.values();
    const hasBody = def.fields.some((f) => f.key === BODY_KEY);
    const body = values[BODY_KEY];
    if (hasBody && (typeof body !== 'string' || !body.trim())) {
      host.setStatus(`Write the body first: the metadata is generated from it.`, 'warn');
      return;
    }
    if (isEmpty(values[def.titleKey])) {
      host.setStatus('Add a title first.', 'warn');
      return;
    }
    void send(fillPrompt(def, fillableFields(def, host.fields()), values), 'Fill metadata');
  });

  ui.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = ui.input.value.trim();
    if (!text || busy) return;
    ui.input.value = '';
    void send(text).then(() => ui.input.focus());
  });

  ui.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ui.form.requestSubmit();
    }
  });
}
