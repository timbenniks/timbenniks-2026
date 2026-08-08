// Generated from src/admin-client by `npm run build:admin` — do not edit.
import { createUi, appendBubble } from "./webmcp-agent-ui.js";
import { SYSTEM_PROMPT, runAgentTurn } from "./webmcp-agent-loop.js";
import { errorMessage } from "./lib/tools.js";
async function boot() {
  const statusRes = await fetch("/api/admin/webmcp/chat");
  if (!statusRes.ok) return;
  const status = await statusRes.json();
  if (!status.enabled) {
    console.info("[webmcp-agent] skipped \u2014 set OPENAI_API_KEY on the server for the Agent rail.");
    return;
  }
  const mount = document.getElementById("agent-mount");
  const panel = document.getElementById("agent-panel");
  if (!mount || !panel) {
    console.warn("[webmcp-agent] agent rail mount missing");
    return;
  }
  panel.classList.remove("is-disabled");
  window.__tbEditorChrome?.enableAgentToggle();
  const ui = createUi(mount);
  const messages = [{ role: "system", content: SYSTEM_PROMPT }];
  let busy = false;
  let pendingContext = null;
  function renderContextChip() {
    if (!pendingContext) {
      ui.context.hidden = true;
      ui.contextLabel.textContent = "";
      ui.contextDetail.textContent = "";
      ui.contextDetail.hidden = true;
      ui.input.placeholder = "Edit this page\u2026";
      return;
    }
    ui.context.hidden = false;
    ui.contextLabel.textContent = pendingContext.label;
    const detail = String(pendingContext.detail || "").trim();
    ui.contextDetail.textContent = detail;
    ui.contextDetail.hidden = !detail;
    ui.input.placeholder = "What should we change?";
  }
  function clearContext() {
    pendingContext = null;
    renderContextChip();
  }
  function setContext(ctx, { open = true } = {}) {
    const label = String(ctx?.label || "").trim();
    const body = String(ctx?.body || "").trim();
    if (!label || !body) return;
    pendingContext = {
      label,
      detail: String(ctx?.detail || "").trim(),
      body
    };
    renderContextChip();
    if (open) window.__tbEditorChrome?.setAgentOpen(true);
    requestAnimationFrame(() => ui.input.focus());
  }
  function draftPrompt(text, { open = true } = {}) {
    const body = String(text || "").trim();
    if (!body) return;
    const first = body.split("\n").find((l) => l.trim()) || "Editor context";
    setContext({ label: first.slice(0, 72), body }, { open });
  }
  window.__tbAgent = {
    setContext,
    clearContext,
    draftPrompt,
    focusComposer() {
      window.__tbEditorChrome?.setAgentOpen(true);
      ui.input.focus();
    }
  };
  ui.contextClear.addEventListener("click", () => {
    clearContext();
    ui.input.focus();
  });
  appendBubble(
    ui.log,
    "assistant",
    "I edit this page through WebMCP while you watch the preview. Try: \u201CAdd an FAQ about consulting.\u201D"
  );
  ui.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    const text = ui.input.value.trim();
    if (!text) return;
    if (!window.__tbEditorChrome?.isAgentOpen()) {
      window.__tbEditorChrome?.setAgentOpen(true);
    }
    const ctx = pendingContext;
    const content = ctx ? `${ctx.body}

${text}` : text;
    ui.input.value = "";
    clearContext();
    const display = ctx ? `${text}

\u21B3 ${ctx.label}` : text;
    appendBubble(ui.log, "user", display);
    messages.push({ role: "user", content });
    busy = true;
    ui.send.disabled = true;
    let navigatedAway = false;
    try {
      const outcome = await runAgentTurn(ui, messages);
      navigatedAway = Boolean(outcome?.navigatedAway);
    } catch (err) {
      appendBubble(ui.log, "assistant", errorMessage(err), "error");
    } finally {
      busy = false;
      ui.send.disabled = false;
      if (!navigatedAway && document.body.contains(ui.input)) ui.input.focus();
    }
  });
  ui.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ui.form.requestSubmit();
    }
  });
  console.info("[webmcp-agent] OpenAI agent rail ready");
}
function start() {
  const go = () => {
    boot().catch((err) => console.warn("[webmcp-agent]", errorMessage(err)));
  };
  if (window.__tbVisualEditor) go();
  else window.addEventListener("tb-visual-editor-ready", go, { once: true });
}
start();
