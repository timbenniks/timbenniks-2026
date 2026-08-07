/**
 * In-editor OpenAI agent — docked rail (not a floating overlay).
 * Talks to /api/admin/webmcp/chat; tools run via __tbVisualEditor.
 */
import { createUi, appendBubble } from './webmcp-agent-ui.js';
import { SYSTEM_PROMPT, runAgentTurn } from './webmcp-agent-loop.js';

async function boot() {
  const statusRes = await fetch('/api/admin/webmcp/chat');
  if (!statusRes.ok) return;
  const status = await statusRes.json();
  if (!status.enabled) {
    console.info(
      '[webmcp-agent] skipped — set OPENAI_API_KEY on the server for the Agent rail.',
    );
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
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
  let busy = false;

  /** Prefill the composer without sending — used by section “Ask AI” buttons. */
  function draftPrompt(text, { open = true, append = false } = {}) {
    const draft = String(text || '');
    if (!draft.trim()) return;
    if (open) window.__tbEditorChrome?.setAgentOpen(true);
    const existing = ui.input.value;
    if (append && existing.trim()) {
      const glue = existing.endsWith('\n') ? '\n' : '\n\n';
      ui.input.value = `${existing.trimEnd()}${glue}${draft}`;
    } else {
      ui.input.value = draft;
    }
    requestAnimationFrame(() => {
      ui.input.focus();
      const len = ui.input.value.length;
      ui.input.setSelectionRange(len, len);
    });
  }

  window.__tbAgent = {
    draftPrompt,
    focusComposer() {
      window.__tbEditorChrome?.setAgentOpen(true);
      ui.input.focus();
    },
  };

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
    ui.input.value = '';
    appendBubble(ui.log, 'user', text);
    messages.push({ role: 'user', content: text });
    busy = true;
    ui.send.disabled = true;
    try {
      await runAgentTurn(ui, messages);
    } catch (err) {
      appendBubble(ui.log, 'assistant', err.message || String(err), 'error');
    } finally {
      busy = false;
      ui.send.disabled = false;
      ui.input.focus();
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

function start() {
  const go = () => {
    boot().catch((err) => console.warn('[webmcp-agent]', err.message || err));
  };
  if (window.__tbVisualEditor) go();
  else window.addEventListener('tb-visual-editor-ready', go, { once: true });
}

start();
