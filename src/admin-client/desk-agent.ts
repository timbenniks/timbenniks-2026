/**
 * Pages desk Agent — two-column chat on /admin for create / open / ship.
 */
import { createUi, appendBubble } from './webmcp-agent-ui.js';
import { DESK_SYSTEM_PROMPT, runAgentTurn } from './webmcp-agent-loop.js';
import type { ChatMessage } from './webmcp-agent-loop.js';
import { errorMessage } from './lib/tools.js';

async function boot(): Promise<void> {
  const statusRes = await fetch('/api/admin/webmcp/chat');
  if (!statusRes.ok) return;
  const status: { enabled?: boolean } = await statusRes.json();
  if (!status.enabled) {
    const panel = document.getElementById('desk-agent-panel');
    if (panel) {
      panel.classList.add('is-disabled');
      const mount = document.getElementById('desk-agent-mount');
      if (mount) {
        mount.replaceChildren();
        const note = document.createElement('p');
        note.className = 'desk-agent-disabled';
        note.textContent =
          'Set OPENAI_API_KEY on the server to enable the desk Agent (create pages, open editor, publish).';
        mount.append(note);
      }
    }
    console.info('[desk-agent] skipped — set OPENAI_API_KEY for the desk Agent.');
    return;
  }

  const mount = document.getElementById('desk-agent-mount');
  if (!mount) {
    console.warn('[desk-agent] mount missing');
    return;
  }

  const ui = createUi(mount, {
    title: 'Agent',
    placeholder: 'Create a page, open one, or publish…',
    logId: 'tb-desk-agent-log',
  });

  const messages: ChatMessage[] = [{ role: 'system', content: DESK_SYSTEM_PROMPT }];
  let busy = false;

  appendBubble(
    ui.log,
    'assistant',
    'I manage pages from this desk — create, open the visual editor, check pending changes, and offer Publish. Try: “Create a page at /ai-workshop titled AI Workshop, then open it.”',
  );

  ui.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const text = ui.input.value.trim();
    if (!text) return;
    ui.input.value = '';
    appendBubble(ui.log, 'user', text);
    messages.push({ role: 'user', content: text });
    busy = true;
    ui.send.disabled = true;
    let navigatedAway = false;
    try {
      const outcome = await runAgentTurn(ui, messages, { surface: 'desk' });
      navigatedAway = Boolean(outcome?.navigatedAway);
    } catch (err) {
      appendBubble(ui.log, 'assistant', errorMessage(err), 'error');
    } finally {
      busy = false;
      ui.send.disabled = false;
      // focus() after location.replace can cancel the pending navigation
      if (!navigatedAway) ui.input.focus();
    }
  });

  ui.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ui.form.requestSubmit();
    }
  });

  console.info('[desk-agent] ready');
}

function start(): void {
  const go = () => {
    boot().catch((err: unknown) => console.warn('[desk-agent]', errorMessage(err)));
  };
  if (window.__tbDeskAgent || window.__tbVisualEditor) go();
  else window.addEventListener('tb-desk-agent-ready', go, { once: true });
}

start();
