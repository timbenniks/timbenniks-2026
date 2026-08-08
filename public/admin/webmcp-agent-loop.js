// Generated from src/admin-client by `npm run build:admin` — do not edit.
import {
  appendBubble,
  beginAssistantStream,
  endAssistantStream,
  showThinking,
  hideThinking,
  appendActionCard,
  appendImageResults,
  appendOpenEditorCard
} from "./webmcp-agent-ui.js";
import { setBubbleMarkdown } from "./lib/render-agent-markdown.js";
import { editorPathFor, hardNavigate } from "./lib/navigate.js";
import {
  DESK_TOOL_ALLOWLIST,
  defersToPropose,
  errorMessage,
  metadataKeys,
  openAiToolDefs,
  pageIdFrom,
  runTool
} from "./lib/tools.js";
const SYSTEM_PROMPT = `You are co-editing Tim Benniks' marketing site in a live visual editor.

Orienting:
- Prefer get_editor_state or list_pages first when you need to know where you are or which pages exist.
- To create a page: create_page, then open_page. Only pass force:true on open_page if the human confirms discarding dirty unsaved state (or save first).

Sections & lists:
- Prefer existing section kinds from list_section_kinds. Never invent kinds.
- Call describe_section BEFORE nested FAQ / timeline / gallery / list edits. Prefer add_list_item, remove_list_item, and move_list_item over blind patch_section of whole arrays.
- For whole-block rewrites use patch_section or replace_section.
- Content query fields (source, limit, tags, playlist, columns, window, \u2026) auto-reload the preview via set_field \u2014 no structural flag needed.

Live vs propose:
- For copy edits the human wants applied now, use set_field so the preview updates live.
- For alternate copy the human should choose (A/B lines, optional rewrites), call propose_changes with set_field (or patch_section) items \u2014 do NOT apply those yourself.
- Never call save_to_cms, publish_changes, discard_changes, or apply_site_patch directly. Always use propose_changes with those tools as items so the UI shows Apply / Save / Publish cards.
- propose_changes items must use only: set_field, set_image, save_to_cms, patch_section, add_section, update_metadata, publish_changes, discard_changes, apply_site_patch. Include a short human label and exact args.

Images:
- Call get_image_library_config once if unsure, then search_images. After search_images, tell the human to click Use on a thumbnail \u2014 do NOT call set_image unless they ask you to pick for them.
- For scene/content searches pass describe (or query) with natural language / keywords. Assets are tagged with title + description in Cloudinary \u2014 metadata search is enough. OMIT folder unless the human names one.
- Do NOT pass vision:true unless metadata results are empty or clearly wrong. Vision is a slow fallback, not the default.
- orientation is a soft preference when describe/query is multi-word. If assets is empty, say so \u2014 do not invent an image.
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
- create_page (id kebab-case, path like /ai-workshop, title). Default open:true \u2014 navigates to the visual editor immediately after create. Pass open:false only if the human said not to open.
- open_page to jump into the visual editor when asked
- For SEO audits: get_page first, then propose_changes with one or more update_metadata items (each needs pageId plus fields: title, description, keywords, image, canonical, imageAlt, noindex). Never call update_metadata directly \u2014 the human gets Apply cards.
- Never call publish_changes, discard_changes, or apply_site_patch directly \u2014 use propose_changes
- get_site before site chrome changes; propose apply_site_patch
- Keep Tim's voice: clear, concrete, short sentences
- After create_page with open:true, do not wait to narrate at length \u2014 the browser is already navigating

Do not invent page ids \u2014 list_pages first when unsure.`;
function deferDirectToolToPropose(name, originalArgs) {
  const args = originalArgs && typeof originalArgs === "object" ? originalArgs : {};
  if (name === "save_to_cms") {
    return {
      title: "Save draft",
      hint: "Saves this page as a local draft. Publish separately from /admin/changes.",
      items: [{ tool: "save_to_cms", args: {}, label: "Save page draft" }],
      shortLabel: "Save draft"
    };
  }
  if (name === "publish_changes") {
    return {
      title: "Publish changes",
      hint: "Publishes local drafts to main \u2014 goes live.",
      items: [
        {
          tool: "publish_changes",
          args: typeof args.message === "string" ? { message: args.message } : {},
          label: "Publish drafts to main"
        }
      ],
      shortLabel: "Publish"
    };
  }
  if (name === "discard_changes") {
    return {
      title: "Discard changes",
      hint: "Clears local drafts. Destructive for unpublished work.",
      items: [
        {
          tool: "discard_changes",
          args: typeof args.path === "string" ? { path: args.path } : {},
          label: "Discard local drafts"
        }
      ],
      shortLabel: "Discard"
    };
  }
  if (name === "update_metadata") {
    const pageId = pageIdFrom(args);
    const keys = metadataKeys(args);
    return {
      title: pageId ? `SEO \xB7 ${pageId}` : "Update SEO metadata",
      hint: "Applies metadata to a local draft. Review each field, then Apply.",
      items: [
        {
          tool: "update_metadata",
          args,
          label: keys.length ? `Update ${keys.join(", ")}` : "Update metadata"
        }
      ],
      shortLabel: "SEO metadata"
    };
  }
  return {
    title: "Update site chrome",
    hint: "Applies nav / footer / newsletter changes to site.json.",
    items: [{ tool: "apply_site_patch", args, label: "Update site chrome" }],
    shortLabel: "Update site chrome"
  };
}
async function executeEditorTool(name, args) {
  const api = window.__tbVisualEditor;
  if (!api) throw new Error("Editor not ready");
  return runTool(api, name, args);
}
async function callChatApi(messages, tools, { onContent } = {}) {
  const res = await fetch("/api/admin/webmcp/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ messages, tools })
  });
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok || !contentType.includes("text/event-stream")) {
    let data = null;
    try {
      data = await res.json();
    } catch {
    }
    throw new Error(data?.error || `Chat failed (${res.status})`);
  }
  if (!res.body) throw new Error("Chat stream empty");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  const toolCalls = [];
  let finishReason = null;
  let pendingRender = null;
  let renderQueued = false;
  const flushContent = () => {
    if (!onContent || renderQueued) return;
    renderQueued = true;
    const snapshot = content;
    pendingRender = Promise.resolve().then(() => onContent(snapshot)).finally(() => {
      renderQueued = false;
      if (content !== snapshot) flushContent();
    });
  };
  const handleData = (payload) => {
    if (!payload || payload === "[DONE]") return;
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
    if (typeof delta.content === "string" && delta.content) {
      content += delta.content;
      flushContent();
    }
    if (Array.isArray(delta.tool_calls)) {
      for (const part of delta.tool_calls) {
        const idx = typeof part.index === "number" ? part.index : 0;
        if (!toolCalls[idx]) {
          toolCalls[idx] = {
            id: "",
            type: "function",
            function: { name: "", arguments: "" }
          };
        }
        const dest = toolCalls[idx];
        if (part.id) dest.id = part.id;
        if (part.type) dest.type = part.type;
        if (part.function?.name) dest.function.name += part.function.name;
        if (typeof part.function?.arguments === "string") {
          dest.function.arguments += part.function.arguments;
        }
      }
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() || "";
    for (const line of parts) {
      const trimmed = line.trimEnd();
      if (!trimmed || trimmed.startsWith(":")) continue;
      if (trimmed.startsWith("data:")) {
        handleData(trimmed.slice(5).trimStart());
      }
    }
  }
  if (buffer.trim()) {
    for (const line of buffer.split("\n")) {
      const trimmed = line.trimEnd();
      if (trimmed.startsWith("data:")) handleData(trimmed.slice(5).trimStart());
    }
  }
  const inFlight = pendingRender;
  if (inFlight) await inFlight;
  if (onContent && content) await onContent(content);
  const message = {
    role: "assistant",
    content: content || null
  };
  const calls = toolCalls.filter(Boolean);
  if (calls.length) message.tool_calls = calls;
  return { message, finishReason };
}
function resultFields(result) {
  return result && typeof result === "object" ? result : {};
}
function summarizeToolArgs(args) {
  const raw = JSON.stringify(args);
  if (raw.length <= 80) return raw;
  return `${raw.slice(0, 77)}\u2026`;
}
function summarizeToolResult(result) {
  if (result == null) return "ok";
  if (typeof result === "string") return result.length > 120 ? `${result.slice(0, 117)}\u2026` : result;
  const fields = resultFields(result);
  if (fields.error) return `error: ${fields.error}`;
  if (fields.deferred) {
    return `deferred \xB7 ${fields.count || fields.items?.length || 0} action card${(fields.count || fields.items?.length) === 1 ? "" : "s"}`;
  }
  if (fields.kind) return `${fields.kind}`;
  if (Array.isArray(fields.assets)) {
    return `${fields.assets.length} images${fields.folder ? ` in ${fields.folder}` : ""}`;
  }
  if (Array.isArray(fields.sections)) {
    return `${fields.sections.length} sections \xB7 dirty=${fields.dirty}`;
  }
  if (fields.path && fields.src) return `${fields.path}`;
  if (fields.path && "value" in fields) return `${fields.path}`;
  if (fields.pageId) return `${fields.pageId} \xB7 ${fields.sectionCount} sections`;
  const raw = JSON.stringify(result);
  return raw.length > 120 ? `${raw.slice(0, 117)}\u2026` : raw;
}
async function runAgentTurn(ui, messages, { surface = "editor" } = {}) {
  const tools = openAiToolDefs(surface);
  const pendingActionCards = [];
  const flushActionCards = () => {
    while (pendingActionCards.length) {
      const proposal = pendingActionCards.shift();
      appendActionCard(ui.log, proposal, { execute: executeEditorTool });
      const n = proposal?.items?.length || 0;
      appendBubble(ui.log, "tool", `\u21B3 waiting for Apply (${n} item${n === 1 ? "" : "s"})`);
    }
  };
  const finishTurn = () => {
    flushActionCards();
  };
  let guard = 0;
  while (guard++ < 12) {
    let streamBubble = null;
    showThinking(ui.log);
    let choice;
    try {
      ({ message: choice } = await callChatApi(messages, tools, {
        onContent: async (text) => {
          if (!streamBubble) streamBubble = beginAssistantStream(ui.log);
          await setBubbleMarkdown(streamBubble, text);
          ui.log.scrollTop = ui.log.scrollHeight;
        }
      }));
    } finally {
      hideThinking(ui.log);
    }
    if (!choice) throw new Error("Empty model response");
    const bubble = streamBubble;
    const toolCalls = choice.tool_calls;
    if (!toolCalls?.length) {
      const text = choice.content?.trim() || "(no reply)";
      if (bubble) {
        endAssistantStream(bubble);
        await setBubbleMarkdown(bubble, text);
      } else {
        appendBubble(ui.log, "assistant", text);
      }
      messages.push({ role: "assistant", content: choice.content || text });
      finishTurn();
      return;
    }
    if (bubble) {
      endAssistantStream(bubble);
      if (!choice.content?.trim()) bubble.remove();
    }
    messages.push({
      role: "assistant",
      content: choice.content || null,
      tool_calls: toolCalls
    });
    for (const call of toolCalls) {
      const name = call.function?.name || "unknown";
      let args = {};
      try {
        args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        args = {};
      }
      const deferredDirect = defersToPropose(name, surface);
      let effectiveName = name;
      let shortProposeLabel = null;
      if (deferredDirect) {
        const deferred = deferDirectToolToPropose(name, args);
        args = {
          title: deferred.title,
          hint: deferred.hint,
          items: deferred.items
        };
        effectiveName = "propose_changes";
        shortProposeLabel = deferred.shortLabel;
      }
      if (deferredDirect && shortProposeLabel) {
        appendBubble(ui.log, "tool", `propose_changes \xB7 ${shortProposeLabel}`);
      } else if (effectiveName !== "propose_changes") {
        appendBubble(ui.log, "tool", `${effectiveName} ${summarizeToolArgs(args)}`);
      }
      let result;
      try {
        result = await executeEditorTool(effectiveName, args);
      } catch (err) {
        result = { error: errorMessage(err) };
      }
      const fields = resultFields(result);
      const leaveHref = name === "create_page" && fields.id && !fields.error && fields.open !== false ? fields.editorPath || editorPathFor(fields.id) : name === "open_page" && fields.navigated && (fields.editorPath || fields.pageId) ? fields.editorPath || editorPathFor(fields.pageId) : null;
      if (leaveHref) {
        appendBubble(ui.log, "tool", `\u21B3 ${summarizeToolResult(result)}`);
        appendOpenEditorCard(ui.log, {
          href: leaveHref,
          pageId: fields.id || fields.pageId
        });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result)
        });
        hardNavigate(leaveHref);
        return { navigatedAway: true, href: leaveHref };
      }
      if (effectiveName === "propose_changes" && fields.deferred && fields.items) {
        pendingActionCards.push({
          title: fields.title,
          hint: fields.hint,
          items: fields.items
        });
      } else if (name === "search_images" && fields.assets) {
        appendImageResults(ui.log, result);
      } else if (name === "set_image" && fields.src) {
        appendBubble(ui.log, "tool", `\u21B3 set ${fields.path}
${fields.src}`);
      } else if (effectiveName !== "propose_changes" || fields.error) {
        appendBubble(ui.log, "tool", `\u21B3 ${summarizeToolResult(result)}`);
      }
      const toolContent = deferredDirect && fields.deferred ? {
        deferred: true,
        redirected: "propose_changes",
        message: `${name} offered as an Apply card \u2014 waiting for the human.`,
        items: fields.items
      } : result;
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: typeof toolContent === "string" ? toolContent : JSON.stringify(toolContent)
      });
    }
  }
  appendBubble(ui.log, "assistant", "Stopped after too many tool rounds \u2014 ask me to continue.");
  finishTurn();
  return;
}
export {
  DESK_SYSTEM_PROMPT,
  DESK_TOOL_ALLOWLIST,
  SYSTEM_PROMPT,
  executeEditorTool,
  runAgentTurn
};
