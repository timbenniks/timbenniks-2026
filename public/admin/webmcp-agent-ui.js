/**
 * Agent rail DOM: bubbles, image gallery, composer mount.
 */
import { deliveryThumbUrl } from './lib/cloudinary-url.js';
import {
  setBubbleMarkdown,
  isSafeImageUrl,
} from './lib/render-agent-markdown.js';

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (v != null && v !== false) {
      node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function cloudinaryThumb(url, width = 320) {
  return deliveryThumbUrl(url, width, '', 'limit');
}

function createUi(mount, opts = {}) {
  const title = opts.title || 'Agent';
  const placeholder = opts.placeholder || 'Edit this page…';
  const logId = opts.logId || 'tb-agent-log';
  mount.replaceChildren();
  const header = el('div', { className: 'tb-agent-header' }, [
    el('div', { className: 'tb-agent-title', text: title }),
  ]);
  const log = el('div', { className: 'tb-agent-log', id: logId });
  const form = el('form', { className: 'tb-agent-composer' });

  const context = el('div', {
    className: 'tb-agent-context',
    hidden: true,
    'aria-live': 'polite',
  });
  const contextBody = el('div', { className: 'tb-agent-context-body' });
  const contextLabel = el('div', { className: 'tb-agent-context-label' });
  const contextDetail = el('div', { className: 'tb-agent-context-detail' });
  contextBody.append(contextLabel, contextDetail);
  const contextClear = el('button', {
    type: 'button',
    className: 'tb-agent-context-clear',
    'aria-label': 'Clear section context',
    title: 'Clear context',
    text: '×',
  });
  context.append(contextBody, contextClear);

  const input = el('textarea', {
    rows: '2',
    placeholder,
    'aria-label': 'Message',
  });
  const send = el('button', { type: 'submit', className: 'primary', text: 'Send' });
  form.append(context, input, send);
  mount.append(header, log, form);
  return {
    log,
    form,
    input,
    send,
    context,
    contextLabel,
    contextDetail,
    contextClear,
  };
}

function appendBubble(log, role, text, extraClass = '') {
  const bubble = el('div', {
    className: `tb-agent-msg ${role}${extraClass ? ` ${extraClass}` : ''}`,
  });
  if (role === 'assistant' && !extraClass.includes('error')) {
    bubble.classList.add('tb-agent-md');
    if (text) void setBubbleMarkdown(bubble, text);
  } else {
    bubble.textContent = text;
  }
  log.append(bubble);
  log.scrollTop = log.scrollHeight;
  return bubble;
}

/** Create an empty streaming assistant bubble (markdown filled via setBubbleMarkdown). */
function beginAssistantStream(log) {
  hideThinking(log);
  const bubble = appendBubble(log, 'assistant', '', 'is-streaming');
  return bubble;
}

function endAssistantStream(bubble) {
  if (!bubble) return;
  bubble.classList.remove('is-streaming');
}

/** Waiting indicator shown before the first stream token (and between tool rounds). */
function showThinking(log) {
  hideThinking(log);
  const bubble = el('div', {
    className: 'tb-agent-msg assistant is-thinking',
    'aria-live': 'polite',
    'aria-label': 'Thinking',
  });
  const dots = el('span', { className: 'tb-agent-thinking-dots', 'aria-hidden': 'true' });
  dots.append(el('span'), el('span'), el('span'));
  bubble.append(dots);
  log.append(bubble);
  log.scrollTop = log.scrollHeight;
  return bubble;
}

function hideThinking(log) {
  log.querySelectorAll('.tb-agent-msg.is-thinking').forEach((node) => node.remove());
}

/** Tools humans may approve via action cards (never trust freeform model HTML). */
const PROPOSABLE_TOOLS = new Set([
  'set_field',
  'set_image',
  'save_to_cms',
  'patch_section',
  'add_section',
  'update_metadata',
  'publish_changes',
  'discard_changes',
  'apply_site_patch',
]);

function summarizeProposedArgs(tool, args) {
  if (tool === 'save_to_cms') return 'Save page as a local draft';
  if (tool === 'publish_changes') return 'Publish local drafts to main (goes live)';
  if (tool === 'discard_changes') {
    return 'Discard local drafts';
  }
  if (tool === 'apply_site_patch') {
    return 'Save site chrome as a local draft';
  }
  if (tool === 'add_section') {
    return `${args?.kind || 'section'} at index ${args?.index ?? 'end'}`;
  }
  if (tool === 'update_metadata') {
    const keys = Object.keys(args || {}).filter((k) => k !== 'pageId');
    const page = args?.pageId ? `${args.pageId}: ` : '';
    return `${page}${keys.join(', ') || 'metadata'}`;
  }
  if (tool === 'set_field') {
    const path = args?.path || '?';
    const raw = typeof args?.value === 'string' ? args.value : JSON.stringify(args?.value);
    const value = raw && raw.length > 60 ? `${raw.slice(0, 57)}…` : raw || '';
    return `${path}${value ? ` → ${value}` : ''}`;
  }
  if (tool === 'set_image') {
    return args?.path || args?.secureUrl || 'image field';
  }
  if (tool === 'patch_section') {
    return `section ${args?.index ?? '?'} · ${Object.keys(args?.patch || {}).join(', ') || 'patch'}`;
  }
  const raw = JSON.stringify(args || {});
  return raw.length > 80 ? `${raw.slice(0, 77)}…` : raw;
}

/**
 * Structured propose → click Apply cards (same trust boundary as image Use).
 * @param {HTMLElement} log
 * @param {{ title?: string, hint?: string, items: Array<{ tool: string, args: object, label?: string }> }} proposal
 * @param {{ execute: (name: string, args: object) => Promise<unknown> }} handlers
 */
function appendActionCard(log, proposal, { execute } = {}) {
  const items = (Array.isArray(proposal?.items) ? proposal.items : [])
    .filter((item) => item && PROPOSABLE_TOOLS.has(item.tool) && item.args && typeof item.args === 'object')
    .slice(0, 12)
    .map((item) => ({
      tool: item.tool,
      args: item.args,
      label: String(item.label || item.tool).slice(0, 140),
    }));

  const wrap = el('div', { className: 'tb-agent-msg tool tb-agent-action-card' });
  const head = el('div', {
    className: 'tb-agent-action-head',
    text: proposal?.title || (items.length === 1 ? items[0].label : 'Proposed changes'),
  });
  wrap.append(head);

  const hintText =
    proposal?.hint ||
    (items.some((i) => i.tool === 'save_to_cms')
      ? 'Review, then Apply to save — or Dismiss.'
      : 'Apply to run these changes on the page, or Dismiss.');
  wrap.append(el('div', { className: 'tb-agent-action-hint', text: hintText }));

  const status = el('div', { className: 'tb-agent-action-status', hidden: true });
  wrap.append(status);

  if (!items.length) {
    status.hidden = false;
    status.dataset.tone = 'err';
    status.textContent = 'No valid actions to apply.';
    log.append(wrap);
    log.scrollTop = log.scrollHeight;
    return wrap;
  }

  if (typeof execute !== 'function') {
    status.hidden = false;
    status.dataset.tone = 'err';
    status.textContent = 'Apply handler missing.';
    log.append(wrap);
    log.scrollTop = log.scrollHeight;
    return wrap;
  }

  const list = el('div', { className: 'tb-agent-action-list' });
  /** @type {Array<{ row: HTMLElement, applyBtn: HTMLButtonElement, item: object, done: boolean }>} */
  const rows = [];
  /** @type {HTMLButtonElement | null} */
  let applyAllBtn = null;
  /** @type {HTMLButtonElement | null} */
  let dismissBtn = null;

  const setStatus = (tone, text) => {
    status.hidden = false;
    status.dataset.tone = tone;
    status.textContent = text;
  };

  const maybeDisableFooter = () => {
    if (!rows.every((r) => r.done)) return;
    if (applyAllBtn) applyAllBtn.disabled = true;
    if (dismissBtn) dismissBtn.textContent = 'Done';
  };

  const markRowApplied = (entry) => {
    entry.done = true;
    entry.row.classList.add('is-applied');
    entry.applyBtn.disabled = true;
    entry.applyBtn.textContent = 'Applied';
  };

  const applyOne = async (entry) => {
    if (entry.done) return { ok: true, skipped: true };
    entry.applyBtn.disabled = true;
    entry.applyBtn.textContent = '…';
    try {
      let args = entry.item.args;
      // Re-resolve image target if path omitted or live target preferred.
      if (entry.item.tool === 'set_image') {
        const api = window.__tbVisualEditor;
        const live = api?.resolveImageTarget?.();
        if (live?.path && (!args.path || args.useLiveTarget)) {
          args = { ...args, path: live.path };
          delete args.useLiveTarget;
        }
        if (!args.path) {
          throw new Error('Select a section/image field first, then Apply.');
        }
      }
      const result = await execute(entry.item.tool, args);
      if (result && typeof result === 'object' && result.error) {
        throw new Error(result.error);
      }
      markRowApplied(entry);
      appendBubble(log, 'tool', `↳ you applied ${entry.item.label}`);
      return { ok: true, result };
    } catch (err) {
      entry.applyBtn.disabled = false;
      entry.applyBtn.textContent = entry.applyLabel || 'Apply';
      const msg = err?.message || String(err);
      setStatus('err', msg);
      return { ok: false, error: msg };
    }
  };

  for (const item of items) {
    const row = el('div', { className: 'tb-agent-action-row' });
    const body = el('div', { className: 'tb-agent-action-row-body' });
    body.append(
      el('div', { className: 'tb-agent-action-label', text: item.label }),
      el('div', {
        className: 'tb-agent-action-detail',
        text: summarizeProposedArgs(item.tool, item.args),
      }),
    );
    const applyLabel =
      items.length === 1 && item.tool === 'save_to_cms'
        ? 'Save'
        : items.length === 1 && item.tool === 'publish_changes'
          ? 'Publish'
          : items.length === 1 && item.tool === 'discard_changes'
            ? 'Discard'
            : 'Apply';
    const applyBtn = el('button', {
      type: 'button',
      className: 'tb-agent-action-apply',
      text: applyLabel,
    });
    const entry = { row, applyBtn, item, done: false, applyLabel };
    applyBtn.addEventListener('click', async () => {
      const res = await applyOne(entry);
      if (res.ok && !res.skipped) {
        setStatus('ok', items.length === 1 ? 'Applied.' : 'Item applied.');
        maybeDisableFooter();
      }
    });
    row.append(body, applyBtn);
    list.append(row);
    rows.push(entry);
  }
  wrap.append(list);

  const footer = el('div', { className: 'tb-agent-action-footer' });
  if (items.length > 1) {
    applyAllBtn = el('button', {
      type: 'button',
      className: 'tb-agent-action-apply-all',
      text: 'Apply all',
    });
    applyAllBtn.addEventListener('click', async () => {
      applyAllBtn.disabled = true;
      if (dismissBtn) dismissBtn.disabled = true;
      let ok = 0;
      let failed = 0;
      for (const entry of rows) {
        if (entry.done) {
          ok += 1;
          continue;
        }
        const res = await applyOne(entry);
        if (res.ok) ok += 1;
        else failed += 1;
      }
      if (dismissBtn) dismissBtn.disabled = false;
      if (failed) {
        applyAllBtn.disabled = false;
        setStatus('err', `Applied ${ok}, failed ${failed}. Fix selection or dismiss.`);
      } else {
        setStatus('ok', `Applied ${ok} change${ok === 1 ? '' : 's'}.`);
        maybeDisableFooter();
      }
    });
    footer.append(applyAllBtn);
  }

  dismissBtn = el('button', {
    type: 'button',
    className: 'tb-agent-action-dismiss',
    text: 'Dismiss',
  });
  dismissBtn.addEventListener('click', () => {
    wrap.classList.add('is-dismissed');
    rows.forEach((r) => {
      r.applyBtn.disabled = true;
    });
    if (applyAllBtn) applyAllBtn.disabled = true;
    dismissBtn.disabled = true;
    dismissBtn.textContent = 'Dismissed';
    if (!rows.some((r) => r.done)) {
      setStatus('ok', 'Dismissed — nothing applied.');
    }
  });
  footer.append(dismissBtn);
  wrap.append(footer);

  log.append(wrap);
  log.scrollTop = log.scrollHeight;
  return wrap;
}

function appendImageResults(log, result) {
  const assets = Array.isArray(result?.assets) ? result.assets : [];
  const api = window.__tbVisualEditor;
  const target = api?.resolveImageTarget?.() || api?.getState?.()?.imageTarget || null;
  const wrap = el('div', { className: 'tb-agent-msg tool tb-agent-gallery-wrap' });
  const visionBits = [];
  if (result?.metadata?.used && result.metadata?.terms?.length) {
    visionBits.push(`tags/title · ${result.metadata.terms.slice(0, 4).join(' ')}`);
  }
  if (result?.vision?.used) {
    visionBits.push(`vision · ${result.vision.candidates || '?'} thumbs`);
    if (result.vision.widened) visionBits.push('widened to all folders');
    if (result.vision.emptyMatches) visionBits.push('no confident match');
    if (result.vision.softOrientation) visionBits.push(`prefer ${result.vision.softOrientation}`);
  } else if (result?.vision?.error) {
    visionBits.push(String(result.vision.error).slice(0, 80));
  }
  if (result?.describe) visionBits.push(`“${String(result.describe).slice(0, 60)}”`);

  const head = el('div', { className: 'tb-agent-gallery-head' });
  head.append(
    document.createTextNode(
      [
        `${assets.length} image${assets.length === 1 ? '' : 's'}`,
        result.folder ? result.folder : '',
        ...visionBits,
      ]
        .filter(Boolean)
        .join(' · '),
    ),
  );
  wrap.append(head);

  const applyHint = el('div', { className: 'tb-agent-gallery-hint' });
  if (target?.path) {
    applyHint.append(
      document.createTextNode(`Click Use to apply → ${target.label || target.path}`),
    );
  } else {
    applyHint.append(
      document.createTextNode(
        'Select a section with an image field, then click Use — or tell me where to put it.',
      ),
    );
  }
  wrap.append(applyHint);

  if (!assets.length) {
    log.append(wrap);
    log.scrollTop = log.scrollHeight;
    return wrap;
  }

  const status = el('div', { className: 'tb-agent-gallery-status', hidden: true });
  wrap.append(status);

  const grid = el('div', { className: 'tb-agent-gallery' });
  let appliedCard = null;

  for (const asset of assets.slice(0, 12)) {
    const url = asset.secureUrl;
    if (!url || !isSafeImageUrl(url)) continue;
    const displayName = asset.title || asset.filename || asset.publicId || 'Image';
    const card = el('div', {
      className: 'tb-agent-thumb',
      title: [
        displayName,
        asset.description || '',
        asset.metadataReason || '',
        asset.visionReason || '',
        (asset.tags || []).slice(0, 6).join(', '),
      ]
        .filter(Boolean)
        .join(' — '),
    });
    card.append(
      el('img', {
        src: cloudinaryThumb(url, 240),
        alt: asset.description || asset.title || asset.filename || asset.publicId || 'Image',
        loading: 'lazy',
        referrerpolicy: 'no-referrer',
      }),
    );
    const label = el('span', {
      className: 'tb-agent-thumb-label',
      text: [
        typeof asset.visionScore === 'number'
          ? `${Math.round(asset.visionScore * 100)}%`
          : typeof asset.metadataScore === 'number' && asset.metadataScore > 0
            ? `★${asset.metadataScore}`
            : '',
        asset.orientation || '',
        (asset.tags || []).slice(0, 2).join(' ') || '',
        displayName,
      ]
        .filter(Boolean)
        .join(' · '),
    });
    card.append(label);

    const actions = el('div', { className: 'tb-agent-thumb-actions' });
    const useBtn = el('button', {
      type: 'button',
      className: 'tb-agent-use-btn',
      text: 'Use',
    });
    const openBtn = el('button', {
      type: 'button',
      className: 'tb-agent-open-btn',
      text: 'Open',
      title: 'Open full image',
    });
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(url, '_blank', 'noopener');
    });
    useBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!api?.setImage) {
        status.hidden = false;
        status.textContent = 'Editor not ready.';
        status.dataset.tone = 'err';
        return;
      }
      const liveTarget = api.resolveImageTarget?.() || target;
      if (!liveTarget?.path) {
        status.hidden = false;
        status.textContent = 'Select a section/image field first, then click Use.';
        status.dataset.tone = 'err';
        return;
      }
      useBtn.disabled = true;
      useBtn.textContent = '…';
      try {
        const alt =
          asset.description ||
          asset.title ||
          asset.visionReason ||
          asset.filename ||
          asset.publicId ||
          'Selected image';
        const applied = await api.setImage({
          path: liveTarget.path,
          secureUrl: url,
          publicId: asset.publicId,
          width: asset.width,
          height: asset.height,
          alt: String(alt).slice(0, 120),
        });
        if (appliedCard) appliedCard.classList.remove('is-applied');
        card.classList.add('is-applied');
        appliedCard = card;
        status.hidden = false;
        status.dataset.tone = 'ok';
        status.textContent = `Applied to ${applied.path || liveTarget.path}`;
        appendBubble(
          log,
          'tool',
          `↳ you chose ${displayName} → ${applied.path || liveTarget.path}`,
        );
      } catch (err) {
        status.hidden = false;
        status.dataset.tone = 'err';
        status.textContent = err.message || String(err);
      } finally {
        useBtn.disabled = false;
        useBtn.textContent = 'Use';
      }
    });
    // Whole card click = Use (faster for demo)
    card.addEventListener('click', (e) => {
      if (e.target === openBtn || openBtn.contains(e.target)) return;
      useBtn.click();
    });
    actions.append(useBtn, openBtn);
    card.append(actions);
    grid.append(card);
  }
  wrap.append(grid);
  log.append(wrap);
  log.scrollTop = log.scrollHeight;
  return wrap;
}

/**
 * Visible Open editor CTA — real <a> so a human click always works if programmatic nav fails.
 * @param {HTMLElement} log
 * @param {{ href: string, pageId?: string }} opts
 */
function appendOpenEditorCard(log, { href, pageId } = {}) {
  if (!href) return null;
  const wrap = el('div', { className: 'tb-agent-msg tool tb-agent-action-card' });
  wrap.append(
    el('div', {
      className: 'tb-agent-action-head',
      text: pageId ? `Open “${pageId}”` : 'Open editor',
    }),
    el('div', {
      className: 'tb-agent-action-hint',
      text: 'Leaving this desk for the visual editor.',
    }),
  );
  const footer = el('div', { className: 'tb-agent-action-footer' });
  const link = el('a', {
    className: 'tb-agent-action-apply-all',
    href,
    text: 'Open editor',
  });
  footer.append(link);
  wrap.append(footer);
  log.append(wrap);
  log.scrollTop = log.scrollHeight;
  return wrap;
}


export {
  el,
  createUi,
  appendBubble,
  beginAssistantStream,
  endAssistantStream,
  showThinking,
  hideThinking,
  appendActionCard,
  appendImageResults,
  appendOpenEditorCard,
  PROPOSABLE_TOOLS,
  isSafeImageUrl,
  cloudinaryThumb,
};
