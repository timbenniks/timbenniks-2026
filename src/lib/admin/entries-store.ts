/**
 * Read, edit and publish Markdown collection entries (writing, speaking, videos,
 * projects) for the admin.
 *
 * Entries are `src/content/<collection>/**.md` files: YAML frontmatter + body.
 * Edits are applied to the parsed YAML document rather than re-serializing a
 * plain object, so keys the admin form does not know about (`id`, `head`,
 * `collection_id`, …), key order, quoting style and comments survive a save.
 *
 * Reads and writes go to the local working tree in `astro dev` and to GitHub
 * `main` elsewhere — the same split as pages.json (see github-git.ts).
 */
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { slug as githubSlug } from 'github-slugger';
import { Document, isMap, isScalar, isSeq, parseDocument, Scalar, type Node, type YAMLMap } from 'yaml';
import { entrySchemas, type EntryCollection } from '../content-schemas';
import {
  commitFiles,
  getFile,
  listTreeFiles,
  mainBranch,
  usesGitHubCms,
  type FileChange,
} from './github-git';
import { formatZodError } from './pages-store';

type ScalarStyle = Scalar.Type;

interface CollectionConfig {
  dir: string;
  /** Exact path depth below `dir` (videos = playlist/file), or null for any depth. */
  depth: number | null;
  /** Quote style for string values the admin adds or replaces. */
  stringStyle: ScalarStyle;
  /** Write new arrays inline (`[a, b]`) rather than as a block list. */
  flowArrays: boolean;
}

const COLLECTIONS: Record<EntryCollection, CollectionConfig> = {
  writing: { dir: 'src/content/writing', depth: null, stringStyle: Scalar.PLAIN, flowArrays: true },
  speaking: {
    dir: 'src/content/speaking',
    depth: null,
    stringStyle: Scalar.QUOTE_DOUBLE,
    flowArrays: true,
  },
  videos: { dir: 'src/content/videos', depth: 2, stringStyle: Scalar.PLAIN, flowArrays: false },
  projects: { dir: 'src/content/projects', depth: 1, stringStyle: Scalar.PLAIN, flowArrays: false },
};

export type EntryData = Record<string, unknown>;

export interface EntryRecord {
  collection: EntryCollection;
  id: string;
  /** Repo-relative path, e.g. `src/content/speaking/2027-03-18-foo.md`. */
  path: string;
  data: EntryData;
  body: string;
}

export interface EntryOp {
  collection: EntryCollection;
  op: 'upsert' | 'delete';
  /** Existing entry id. Omitted for a new entry. */
  id?: string;
  /** Repo-relative path for a new entry (from proposeNewEntry). */
  path?: string;
  /** Frontmatter fields to set. Empty values ('' / null / []) remove the key. */
  data?: EntryData;
  /** New body. Omit to keep the current body. */
  body?: string;
}

// —— Paths & ids ——————————————————————————————————————————————————————————

/** Same id Astro's glob loader derives: github-slug each path segment, drop `.md`. */
export function idFromRelPath(relInCollection: string): string {
  return relInCollection
    .replace(/\.md$/, '')
    .split('/')
    .map((segment) => githubSlug(segment))
    .join('/')
    .replace(/\/index$/, '');
}

function relInCollection(collection: EntryCollection, path: string): string {
  return path.slice(COLLECTIONS[collection].dir.length + 1);
}

function matchesDepth(collection: EntryCollection, rel: string): boolean {
  const depth = COLLECTIONS[collection].depth;
  return depth === null || rel.split('/').length === depth;
}

async function listLocalMarkdown(absDir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(absDir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return out;
    throw err;
  }
  for (const entry of entries) {
    const full = join(absDir, entry.name);
    if (entry.isDirectory()) out.push(...(await listLocalMarkdown(full)));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

/** Repo-relative paths of every entry file in a collection. */
async function listEntryPaths(collection: EntryCollection): Promise<string[]> {
  const { dir } = COLLECTIONS[collection];
  let paths: string[];
  if (usesGitHubCms()) {
    paths = (await listTreeFiles(dir, mainBranch())).map((f) => f.path).filter((p) => p.endsWith('.md'));
  } else {
    const cwd = process.cwd();
    paths = (await listLocalMarkdown(join(cwd, dir))).map((abs) =>
      relative(cwd, abs).split(sep).join('/'),
    );
  }
  return paths.filter((p) => matchesDepth(collection, relInCollection(collection, p)));
}

/** id → repo-relative path for a collection. */
async function entryIndex(collection: EntryCollection): Promise<Map<string, string>> {
  const index = new Map<string, string>();
  for (const path of await listEntryPaths(collection)) {
    index.set(idFromRelPath(relInCollection(collection, path)), path);
  }
  return index;
}

async function readRepoFile(path: string): Promise<string | null> {
  if (usesGitHubCms()) {
    const file = await getFile(path, mainBranch());
    return file?.content ?? null;
  }
  try {
    return await readFile(join(process.cwd(), path), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

// —— Markdown + YAML —————————————————————————————————————————————————————

/** Opening `---` line, YAML (ending in a newline), closing `---` on its own line, body. */
const FRONTMATTER = /^---\r?\n([\s\S]*?\n)?---[ \t]*(?:\r?\n|$)([\s\S]*)$/;

interface SplitMarkdown {
  frontmatter: string;
  body: string;
  /** Blank lines between the YAML and the closing `---`, kept so a no-op save is byte-identical. */
  padding: string;
}

function splitMarkdown(text: string): SplitMarkdown {
  const match = FRONTMATTER.exec(text);
  if (!match) return { frontmatter: '', body: text, padding: '' };
  const raw = match[1] ?? '';
  const trailing = /\n*$/.exec(raw)?.[0] ?? '';
  const padding = trailing.length > 1 ? trailing.slice(1) : '';
  return {
    frontmatter: raw.slice(0, raw.length - padding.length),
    body: match[2] ?? '',
    padding,
  };
}

function parseFrontmatter(frontmatter: string): Document {
  const doc = parseDocument(frontmatter);
  if (doc.errors.length) {
    throw new Error(`Invalid frontmatter: ${doc.errors[0]?.message ?? 'parse error'}`);
  }
  if (doc.contents === null) doc.contents = doc.createNode({}) as never;
  if (!isMap(doc.contents)) throw new Error('Frontmatter must be a YAML mapping');
  return doc;
}

function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}

function nodeJson(node: unknown): unknown {
  if (isScalar(node) || isSeq(node) || isMap(node)) return node.toJSON();
  return undefined;
}

function styledNode(doc: Document, value: unknown, cfg: CollectionConfig, previous?: unknown): Node {
  const node = doc.createNode(value) as Node;
  if (isScalar(node) && typeof node.value === 'string') {
    node.type = isScalar(previous) && previous.type ? previous.type : cfg.stringStyle;
  }
  if (isSeq(node)) {
    const prevItem = isSeq(previous) ? previous.items[0] : undefined;
    node.flow = isSeq(previous) ? Boolean(previous.flow) : cfg.flowArrays;
    for (const item of node.items) {
      if (isScalar(item) && typeof item.value === 'string') {
        item.type = isScalar(prevItem) && prevItem.type ? prevItem.type : cfg.stringStyle;
      }
    }
  }
  return node;
}

function renderPair(key: string, value: unknown, cfg: CollectionConfig, previous: unknown): string {
  const doc = new Document({});
  doc.set(key, styledNode(doc, value, cfg, previous));
  return doc.toString({ lineWidth: 0, flowCollectionPadding: false });
}

/** Text span of a top-level pair: from its key's line to the next key's line. */
function pairSpan(text: string, map: YAMLMap, idx: number): [number, number] {
  const lineStart = (pos: number) => text.lastIndexOf('\n', pos - 1) + 1;
  const key = map.items[idx]?.key as Node | undefined;
  const next = map.items[idx + 1]?.key as Node | undefined;
  const start = lineStart(key?.range?.[0] ?? 0);
  const end = next?.range ? lineStart(next.range[0]) : text.length;
  return [start, end];
}

/**
 * Apply form values to the YAML text. Only keys whose value actually changed are
 * rewritten, in place; every other line (unknown keys, quoting, folded
 * descriptions, comments) stays byte-identical. Empty values remove the key.
 */
function editFrontmatter(yamlText: string, data: EntryData, cfg: CollectionConfig): string {
  let text = yamlText.trim() ? yamlText.replace(/\n*$/, '\n') : '';
  for (const [key, value] of Object.entries(data)) {
    const map = parseFrontmatter(text).contents as YAMLMap;
    const idx = map.items.findIndex((p) => isScalar(p.key) && p.key.value === key);
    const previous = idx >= 0 ? map.items[idx]?.value : undefined;

    if (idx >= 0 && JSON.stringify(nodeJson(previous)) === JSON.stringify(value)) continue;
    if (isEmptyValue(value)) {
      if (idx < 0) continue;
      const [start, end] = pairSpan(text, map, idx);
      text = text.slice(0, start) + text.slice(end);
      continue;
    }

    const rendered = renderPair(key, value, cfg, previous);
    if (idx < 0) {
      text += rendered;
      continue;
    }
    const [start, end] = pairSpan(text, map, idx);
    text = text.slice(0, start) + rendered + text.slice(end);
  }
  return text;
}

function serializeMarkdown(yamlText: string, body: string, padding = ''): string {
  return `---\n${yamlText}${padding}---\n${body}`;
}

function validate(collection: EntryCollection, path: string, yamlText: string): void {
  const result = entrySchemas[collection].safeParse(parseFrontmatter(yamlText).toJS());
  if (!result.success) {
    throw new Error(`${path}: ${formatZodError(result.error)}`);
  }
}

function parseEntry(collection: EntryCollection, id: string, path: string, text: string): EntryRecord {
  const { frontmatter, body } = splitMarkdown(text);
  const doc = parseFrontmatter(frontmatter);
  return { collection, id, path, data: (doc.toJS() ?? {}) as EntryData, body };
}

// —— Public API ————————————————————————————————————————————————————————————

export async function readEntry(collection: EntryCollection, id: string): Promise<EntryRecord | null> {
  const path = (await entryIndex(collection)).get(id);
  if (!path) return null;
  const text = await readRepoFile(path);
  if (text === null) return null;
  return parseEntry(collection, id, path, text);
}

function datePrefix(value: unknown): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) throw new Error('A valid date (YYYY-MM-DD) is required');
  return s.slice(0, 10);
}

function baseSlugFor(collection: EntryCollection, data: EntryData, slugHint?: string): string {
  const hint = slugHint?.trim();
  switch (collection) {
    case 'speaking': {
      const name = githubSlug(hint || String(data.conference ?? data.talk ?? ''));
      if (!name) throw new Error('Conference name is required to name the file');
      return `${datePrefix(data.date)}-${name}`;
    }
    case 'projects':
    case 'writing': {
      const name = githubSlug(hint || String(data.title ?? ''));
      if (!name) throw new Error('Title is required to name the file');
      return name;
    }
    case 'videos':
      throw new Error('Creating videos is not supported yet');
  }
}

/** Pick a free id + path for a new entry (does not write anything). */
export async function proposeNewEntry(
  collection: EntryCollection,
  data: EntryData,
  slugHint?: string,
): Promise<{ id: string; path: string }> {
  const index = await entryIndex(collection);
  const base = baseSlugFor(collection, data, slugHint);
  let candidate = base;
  for (let n = 2; index.has(candidate); n++) candidate = `${base}-${n}`;
  return { id: candidate, path: `${COLLECTIONS[collection].dir}/${candidate}.md` };
}

const NEW_PATH = /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)?\.md$/;

function assertNewPath(collection: EntryCollection, path: string | undefined): string {
  const dir = COLLECTIONS[collection].dir;
  if (!path || !path.startsWith(`${dir}/`)) throw new Error('New entry is missing a valid path');
  const rel = relInCollection(collection, path);
  if (!NEW_PATH.test(rel) || !matchesDepth(collection, rel)) {
    throw new Error(`Invalid file name for a new ${collection} entry: ${rel}`);
  }
  return path;
}

/** Turn one op into the file write/delete it implies, validating the result. */
async function buildChange(op: EntryOp, index: Map<string, string>): Promise<FileChange> {
  const cfg = COLLECTIONS[op.collection];

  if (op.id) {
    const path = index.get(op.id);
    if (!path) throw new Error(`${op.collection}/${op.id} no longer exists`);
    if (op.op === 'delete') return { path, content: null };

    const text = await readRepoFile(path);
    if (text === null) throw new Error(`${path} could not be read`);
    const { frontmatter, body, padding } = splitMarkdown(text);
    const yaml = editFrontmatter(frontmatter, op.data ?? {}, cfg);
    validate(op.collection, path, yaml);
    return { path, content: serializeMarkdown(yaml, op.body ?? body, padding) };
  }

  if (op.op === 'delete') throw new Error('Delete needs an entry id');
  const path = assertNewPath(op.collection, op.path);
  const id = idFromRelPath(relInCollection(op.collection, path));
  if (index.has(id)) throw new Error(`${path} already exists — reopen the entry and try again`);

  const yaml = editFrontmatter('', op.data ?? {}, cfg);
  validate(op.collection, path, yaml);
  const body = op.body ?? '';
  return { path, content: serializeMarkdown(yaml, body && !body.startsWith('\n') ? `\n${body}` : body) };
}

/** Resolve ops to file changes without writing: validates drafts and powers the Changes diff. */
export async function previewEntries(
  ops: EntryOp[],
): Promise<Array<{ path: string; before: string | null; after: string | null }>> {
  const indexes = new Map<EntryCollection, Map<string, string>>();
  const out: Array<{ path: string; before: string | null; after: string | null }> = [];
  for (const op of ops) {
    let index = indexes.get(op.collection);
    if (!index) {
      index = await entryIndex(op.collection);
      indexes.set(op.collection, index);
    }
    const change = await buildChange(op, index);
    const before = op.id ? await readRepoFile(change.path) : null;
    out.push({ path: change.path, before, after: change.content });
  }
  return out;
}

export async function publishEntries(
  ops: EntryOp[],
  message: string,
): Promise<{ mode: 'github' | 'local-working'; branch: string; commit: string; written: string[] }> {
  const indexes = new Map<EntryCollection, Map<string, string>>();
  const changes: FileChange[] = [];
  for (const op of ops) {
    let index = indexes.get(op.collection);
    if (!index) {
      index = await entryIndex(op.collection);
      indexes.set(op.collection, index);
    }
    changes.push(await buildChange(op, index));
  }

  const paths = changes.map((c) => c.path);
  if (new Set(paths).size !== paths.length) throw new Error('Two drafts write the same file');

  if (usesGitHubCms()) {
    const commit = await commitFiles(changes, mainBranch(), message);
    return { mode: 'github', branch: mainBranch(), commit, written: paths };
  }

  const cwd = process.cwd();
  for (const change of changes) {
    const abs = join(cwd, change.path);
    if (change.content === null) {
      await unlink(abs).catch((err: NodeJS.ErrnoException) => {
        if (err.code !== 'ENOENT') throw err;
      });
    } else {
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, change.content, 'utf8');
    }
  }
  return { mode: 'local-working', branch: 'local', commit: 'working-tree', written: paths };
}

/** Apply a frontmatter edit to a Markdown file's text (no I/O, no validation). Used by checks. */
export function editMarkdown(collection: EntryCollection, text: string, data: EntryData): string {
  const { frontmatter, body, padding } = splitMarkdown(text);
  return serializeMarkdown(editFrontmatter(frontmatter, data, COLLECTIONS[collection]), body, padding);
}
