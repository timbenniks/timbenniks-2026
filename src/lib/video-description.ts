/** Generation-time cleaning for video descriptions in llms.txt, llms-full, and .md twins. */

const FOLLOW_CUT = /(?:^|\n)Follow (?:me here|us on|us here)\s*:/i;
const CTA_CUT =
  /(?:^|\n|\s)(?:Join us on Discord\b|Join our community\b|Make a free account\b)/i;
const JOIN_LINE =
  /^(Join us on Discord\b|Join our community\b|Make a free account\b)/i;
const HASHTAG_ONLY = /^(#\S+\s*)+$/;
const SOCIAL_HOST =
  /(?:twitter\.com|x\.com|github\.com|linkedin\.com|slack\.hygraph\.com|uniform\.to\/discord|community\.contentstack\.com|buymeacoff\.ee)/i;
const BARE_URL = /^(?:https?:\/\/\S+|www\.\S+)$/i;
const LABELED_SOCIAL =
  /^(?:Website|Twitter|Github|GitHub|LinkedIn|YouTube|Facebook|Instagram|Discord|Tony|Tim)\s*:\s*https?:\/\//i;
const TRAILING_SOCIAL_URL =
  /\s+(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com|github\.com|linkedin\.com|slack\.hygraph\.com|uniform\.to\/discord|community\.contentstack\.com|buymeacoff\.ee)\S*\s*$/i;

function isTrailingBoilerplate(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (HASHTAG_ONLY.test(t)) return true;
  if (JOIN_LINE.test(t)) return true;
  if (LABELED_SOCIAL.test(t)) return true;
  if (BARE_URL.test(t) && SOCIAL_HOST.test(t)) return true;
  return false;
}

export function truncateAtSentence(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const slice = flat.slice(0, max);
  const sentenceEnd = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? '),
  );
  if (sentenceEnd >= Math.min(80, Math.floor(max * 0.4))) {
    return slice.slice(0, sentenceEnd + 1).trim();
  }
  const sp = slice.lastIndexOf(' ');
  return `${(sp > 80 ? slice.slice(0, sp) : slice).trim()}…`;
}

export function firstSentence(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const m = flat.match(/^(.+?[.!?])(\s|$)/);
  return m ? m[1] : truncateAtSentence(flat, 220);
}

/** One-line paragraph: collapse whitespace, keep the full description. */
export function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function cleanVideoDescription(
  raw?: string,
  max = 300,
): string | undefined {
  if (!raw?.trim()) return undefined;
  let text = raw.replace(/\r\n/g, '\n');
  const follow = text.search(FOLLOW_CUT);
  if (follow !== -1) text = text.slice(0, follow);
  const cta = text.search(CTA_CUT);
  if (cta !== -1) text = text.slice(0, cta);
  const lines = text.split('\n');
  while (lines.length && isTrailingBoilerplate(lines[lines.length - 1]!)) {
    lines.pop();
  }
  let cleaned = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  cleaned = cleaned.replace(TRAILING_SOCIAL_URL, '').trim();
  if (!cleaned) return undefined;
  return truncateAtSentence(cleaned, max);
}
