/**
 * In-editor OpenAI agent — docked rail (not a floating overlay).
 * Talks to /api/admin/webmcp/chat; tools run via __tbVisualEditor.
 */
import { createUi, appendBubble } from './webmcp-agent-ui.js';
import { SYSTEM_PROMPT, runAgentTurn } from './webmcp-agent-loop.js';
import type { ChatMessage } from './webmcp-agent-loop.js';
import { errorMessage } from './lib/tools.js';

/**
 * The chip above the composer. `detail` is optional and not part of the
 * `AgentRail` contract other clusters call through.
 */
interface AgentContext {
  label: string;
  detail?: string;
  body: string;
}

async function boot(): Promise<void> {
  const statusRes = await fetch('/api/admin/webmcp/chat');
  if (!statusRes.ok) return;
  const status: { enabled?: boolean } = await statusRes.json();
  if (!status.enabled) {
    console.info('[webmcp-agent] skipped — set OPENAI_API_KEY on the server for the Agent rail.');
    return;
  }

  const mount = document.getElementById('agent-mount');
  const panel = document.getElementById('agent-panel');
  if (!mount || !panel) {
    console.warn('[webmcp-agent] agent rail mount missing');
    return;
  }

  panel.classList.remove('is-disabled');
  window.__tbEditorChrome?.enableAgentToggle();

  const ui = createUi(mount);
  const messages: ChatMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }];
  let busy = false;
  let pendingContext: AgentContext | null = null;

  function renderContextChip(): void {
    if (!pendingContext) {
      ui.context.hidden = true;
      ui.contextLabel.textContent = '';
      ui.contextDetail.textContent = '';
      ui.contextDetail.hidden = true;
      ui.input.placeholder = 'Edit this page…';
      return;
    }
    ui.context.hidden = false;
    ui.contextLabel.textContent = pendingContext.label;
    const detail = String(pendingContext.detail || '').trim();
    ui.contextDetail.textContent = detail;
    ui.contextDetail.hidden = !detail;
    ui.input.placeholder = 'What should we change?';
  }

  function clearContext(): void {
    pendingContext = null;
    renderContextChip();
  }

  /**
   * Attach section/page context as a chip above the composer (not in the textarea).
   * On send, `body` is prepended to the user message for the model.
   */
  function setContext(ctx: AgentContext, { open = true }: { open?: boolean } = {}): void {
    const label = String(ctx?.label || '').trim();
    const body = String(ctx?.body || '').trim();
    if (!label || !body) return;
    pendingContext = {
      label,
      detail: String(ctx?.detail || '').trim(),
      body,
    };
    renderContextChip();
    if (open) window.__tbEditorChrome?.setAgentOpen(true);
    requestAnimationFrame(() => ui.input.focus());
  }

  /** @deprecated Prefer setContext — kept for callers that only have a text blob. */
  function draftPrompt(text: string, { open = true }: { open?: boolean } = {}): void {
    const body = String(text || '').trim();
    if (!body) return;
    const first = body.split('\n').find((l) => l.trim()) || 'Editor context';
    setContext({ label: first.slice(0, 72), body }, { open });
  }

  window.__tbAgent = {
    setContext,
    clearContext,
    draftPrompt,
    focusComposer() {
      window.__tbEditorChrome?.setAgentOpen(true);
      ui.input.focus();
    },
  };

  ui.contextClear.addEventListener('click', () => {
    clearContext();
    ui.input.focus();
  });

  appendBubble(
    ui.log,
    'assistant',
    'I edit this page through WebMCP while you watch the preview. Try: “Add an FAQ about consulting.”',
  );

  ui.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const text = ui.input.value.trim();
    if (!text) return;
    if (!window.__tbEditorChrome?.isAgentOpen()) {
      window.__tbEditorChrome?.setAgentOpen(true);
    }
    const ctx = pendingContext;
    const content = ctx ? `${ctx.body}\n\n${text}` : text;
    ui.input.value = '';
    clearContext();
    const display = ctx ? `${text}\n\n↳ ${ctx.label}` : text;
    appendBubble(ui.log, 'user', display);
    messages.push({ role: 'user', content });
    busy = true;
    ui.send.disabled = true;
    let navigatedAway = false;
    try {
      const outcome = await runAgentTurn(ui, messages);
      navigatedAway = Boolean(outcome?.navigatedAway);
    } catch (err) {
      appendBubble(ui.log, 'assistant', errorMessage(err), 'error');
    } finally {
      busy = false;
      ui.send.disabled = false;
      if (!navigatedAway && document.body.contains(ui.input)) ui.input.focus();
    }
  });

  ui.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ui.form.requestSubmit();
    }
  });

  console.info('[webmcp-agent] OpenAI agent rail ready');
}

function start(): void {
  const go = () => {
    boot().catch((err: unknown) => console.warn('[webmcp-agent]', errorMessage(err)));
  };
  if (window.__tbVisualEditor) go();
  else window.addEventListener('tb-visual-editor-ready', go, { once: true });
}

start();
