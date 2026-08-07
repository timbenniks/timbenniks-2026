/**
 * Agent rail DOM: bubbles, image gallery, composer mount.
 */
import { deliveryThumbUrl } from './lib/cloudinary-url.js';
import {
  renderAgentMarkdown,
  bindAgentMarkdownMedia,
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

function createUi(mount) {
  mount.replaceChildren();
  const header = el('div', { className: 'tb-agent-header' }, [
    el('div', { className: 'tb-agent-title', text: 'Agent' }),
  ]);
  const log = el('div', { className: 'tb-agent-log', id: 'tb-agent-log' });
  const form = el('form', { className: 'tb-agent-composer' });
  const input = el('textarea', {
    rows: '2',
    placeholder: 'Edit this page…',
    'aria-label': 'Message',
  });
  const send = el('button', { type: 'submit', className: 'primary', text: 'Send' });
  form.append(input, send);
  mount.append(header, log, form);
  return { log, form, input, send };
}

function appendBubble(log, role, text, extraClass = '') {
  const bubble = el('div', {
    className: `tb-agent-msg ${role}${extraClass ? ` ${extraClass}` : ''}`,
  });
  if (role === 'assistant' && !extraClass.includes('error')) {
    bubble.classList.add('tb-agent-md');
    bubble.innerHTML = renderAgentMarkdown(text);
    bindAgentMarkdownMedia(bubble);
  } else {
    bubble.textContent = text;
  }
  log.append(bubble);
  log.scrollTop = log.scrollHeight;
  return bubble;
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


export {
  el,
  createUi,
  appendBubble,
  appendImageResults,
  isSafeImageUrl,
  cloudinaryThumb,
};
