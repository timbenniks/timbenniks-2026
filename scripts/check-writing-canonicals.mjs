import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://timbenniks.dev';
const WRITING_DIR = 'src/content/writing';

function isOwnHost(hostname) {
  return (
    hostname === 'timbenniks.dev' ||
    hostname === 'www.timbenniks.dev' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.vercel.app')
  );
}

function frontmatterField(text, key) {
  const m = text.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  if (!m) return '';
  return m[1].trim().replace(/^["']|["']$/g, '');
}

/**
 * Walk every writing entry and classify canonical_url as identical, external,
 * or same-domain-but-different-slug.
 */
export function classifyWritingCanonicals(dir = WRITING_DIR) {
  const identical = [];
  const external = [];
  const mismatch = [];
  const empty = [];

  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  for (const file of files) {
    const id = file.replace(/\.md$/, '');
    const live = `${SITE}/writing/${id}`;
    const raw = frontmatterField(readFileSync(join(dir, file), 'utf8'), 'canonical_url');
    if (!raw) {
      empty.push({ id, live });
      continue;
    }
    let url;
    try {
      url = new URL(raw, SITE);
    } catch {
      mismatch.push({ id, live, canonical: raw });
      continue;
    }
    if (!isOwnHost(url.hostname)) {
      external.push({ id, live, canonical: url.href });
      continue;
    }
    const expected = new URL(live).pathname.replace(/\/$/, '');
    const actual = url.pathname.replace(/\/$/, '');
    if (actual === expected) identical.push({ id, live, canonical: url.href });
    else mismatch.push({ id, live, canonical: url.href });
  }

  return { identical, external, mismatch, empty };
}

export function assertWritingCanonicals(dir = WRITING_DIR) {
  const { mismatch } = classifyWritingCanonicals(dir);
  if (mismatch.length === 0) return;
  const lines = mismatch.map((m) => `  ${m.id}\n    live:      ${m.live}\n    canonical: ${m.canonical}`);
  throw new Error(
    `Same-domain canonical_url does not match the live slug (would 404):\n${lines.join('\n')}`,
  );
}

const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] && resolve(process.argv[1]) === thisFile;
if (invoked) {
  const result = classifyWritingCanonicals();
  console.log(`identical: ${result.identical.length}`);
  console.log(`external:  ${result.external.length}`);
  console.log(`empty:     ${result.empty.length}`);
  console.log(`mismatch:  ${result.mismatch.length}`);
  for (const m of result.mismatch) {
    console.log(`- ${m.id}`);
    console.log(`    live:      ${m.live}`);
    console.log(`    canonical: ${m.canonical}`);
  }
  if (result.mismatch.length) process.exit(1);
}
