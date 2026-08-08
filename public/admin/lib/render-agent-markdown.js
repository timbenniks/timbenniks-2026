/**
 * Render agent assistant markdown → sanitized rich HTML.
 * Uses Comark (autoClose for streaming) + DOMPurify. Images use Cloudinary thumbs.
 */
import { createHtmlRenderer, breaks, security } from '../vendor/comark-html.esm.js';
import DOMPurify from '../vendor/purify.es.mjs';
import { deliveryThumbUrl } from './cloudinary-url.js';

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isSafeHttpsUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSafeImageUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return false;
    return (
      u.hostname === 'res.cloudinary.com' ||
      /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

function figureHtml(url, alt = '') {
  const thumb = deliveryThumbUrl(url, 320, '', 'limit');
  const safeAlt = escapeAttr(alt || 'Image');
  const caption =
    alt && String(alt).trim()
      ? `<figcaption>${escapeAttr(alt.trim())}</figcaption>`
      : '';
  return `<figure class="tb-agent-figure"><img src="${escapeAttr(thumb)}" alt="${safeAlt}" loading="lazy" referrerpolicy="no-referrer" data-full-url="${escapeAttr(url)}" />${caption}</figure>`;
}

/** Turn bare Cloudinary URLs into markdown images (keeps existing chat UX). */
function promoteBareImageUrls(text) {
  return String(text || '').replace(
    /(^|[^!("])(https:\/\/res\.cloudinary\.com\/[^\s)<]+)/g,
    (full, prefix, url) => {
      if (prefix.endsWith('](')) return full;
      return `${prefix}![](${url})`;
    },
  );
}

const renderHtml = createHtmlRenderer({
  registerDefaultPlugins: false,
  autoClose: true,
  linkify: false,
  plugins: [
    breaks(),
    security({
      blockedTags: ['script', 'iframe', 'object', 'embed', 'link', 'style', 'base', 'meta'],
      allowedProtocols: ['https'],
      allowDataImages: false,
    }),
  ],
  components: {
    img: async ([, attrs]) => {
      const href = attrs?.src || '';
      const alt = attrs?.alt || '';
      if (!href || !isSafeImageUrl(href)) {
        return escapeAttr(alt || href || '');
      }
      return figureHtml(href, alt);
    },
    a: async ([, attrs, ...children], { render }) => {
      const href = attrs?.href || '';
      const title = attrs?.title;
      const text = await render(children);
      if (!href || !isSafeHttpsUrl(href)) {
        return text || '';
      }
      if (isSafeImageUrl(href) && (!text || text === href)) {
        return figureHtml(href, '');
      }
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
      return `<a href="${escapeAttr(href)}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
  },
});

const PURIFY = {
  USE_PROFILES: { html: true },
  ADD_TAGS: ['figure', 'figcaption'],
  ADD_ATTR: ['target', 'referrerpolicy', 'loading', 'data-full-url'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
};

async function renderAgentMarkdown(markdown) {
  const source = promoteBareImageUrls(markdown);
  let raw = await renderHtml(source);
  // Images render as <figure>; unwrap accidental <p><figure>…</figure></p> wrappers.
  raw = raw.replace(/<p>\s*(<figure[\s\S]*?<\/figure>)\s*<\/p>/gi, '$1');
  return DOMPurify.sanitize(raw, PURIFY);
}

function bindAgentMarkdownMedia(root) {
  root.querySelectorAll('img[data-full-url]').forEach((img) => {
    const full = img.getAttribute('data-full-url');
    if (!full || !isSafeImageUrl(full)) return;
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => window.open(full, '_blank', 'noopener'));
  });
}

/**
 * Update an assistant bubble's markdown HTML.
 * Concurrent calls are sequenced so only the latest text wins.
 */
async function setBubbleMarkdown(bubble, text) {
  const seq = (bubble.__mdSeq = (bubble.__mdSeq || 0) + 1);
  const html = await renderAgentMarkdown(text);
  if (bubble.__mdSeq !== seq) return;
  bubble.innerHTML = html;
  bindAgentMarkdownMedia(bubble);
}

export {
  renderAgentMarkdown,
  setBubbleMarkdown,
  bindAgentMarkdownMedia,
  isSafeImageUrl,
  isSafeHttpsUrl,
};
