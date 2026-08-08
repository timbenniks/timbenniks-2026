/** Cloudinary search scope for the admin Agent / Browse helpers. */

import { serverEnv } from './server-env';

export function env(name: string): string {
  return serverEnv(name);
}

function splitList(raw: string): string[] {
  return raw
    .split(/[,|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type CloudinarySearchScope = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  /** Folders the agent may search. Empty = no folder constraint (not recommended). */
  folders: string[];
  /**
   * Default folder when the agent omits one.
   * `null` = search the entire allowlist (`CLOUDINARY_SEARCH_FOLDERS`).
   */
  defaultFolder: string | null;
  /** Optional tags that must match (AND). */
  tags: string[];
  /** Optional public_id prefix, e.g. website/ */
  prefix: string;
  /** Hard override for the base expression (advanced). */
  baseExpression: string;
  maxResultsDefault: number;
  maxResultsCap: number;
};

/**
 * Parse CLOUDINARY_SEARCH_FOLDER.
 * - empty / `*` / `all` → search all allowlisted folders
 * - comma list (often a copy-paste of FOLDERS) → search all
 * - single name → that folder (must be in allowlist when allowlist is set)
 */
export function parseDefaultFolder(raw: string, folders: string[]): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '*' || /^all$/i.test(trimmed)) return null;

  const parts = splitList(trimmed);
  if (parts.length > 1) return null;

  const one = parts[0]!;
  if (!folders.length) return one;
  const allowed = folders.find((f) => f.toLowerCase() === one.toLowerCase());
  return allowed || one;
}

export function getCloudinarySearchScope(): CloudinarySearchScope {
  const cloudName = env('PUBLIC_CLOUDINARY_CLOUD_NAME');
  const apiKey = env('PUBLIC_CLOUDINARY_API_KEY') || env('CLOUDINARY_API_KEY');
  const apiSecret = env('CLOUDINARY_API_SECRET');

  const folders = splitList(env('CLOUDINARY_SEARCH_FOLDERS') || 'website');
  const defaultFolder = parseDefaultFolder(env('CLOUDINARY_SEARCH_FOLDER'), folders);
  const tags = splitList(env('CLOUDINARY_SEARCH_TAGS'));
  const prefix = env('CLOUDINARY_SEARCH_PREFIX');
  const baseExpression = env('CLOUDINARY_SEARCH_EXPRESSION');
  const maxResultsDefault = clampInt(env('CLOUDINARY_SEARCH_MAX_RESULTS'), 12, 1, 30);
  /** Browse/DAM listings can request more per page than agent search defaults. */
  const maxResultsCap = clampInt(env('CLOUDINARY_SEARCH_MAX_CAP'), 50, 1, 100);

  return {
    cloudName,
    apiKey,
    apiSecret,
    folders,
    defaultFolder,
    tags,
    prefix,
    baseExpression,
    maxResultsDefault,
    maxResultsCap,
  };
}

function clampInt(raw: string, fallback: number, min: number, max: number): number {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return fallback;
  const n = Number(trimmed);
  // Number('') is 0 (finite) — treat blank / non-positive as “use default”.
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function resolveSearchFolder(
  requested: string | undefined,
  scope: CloudinarySearchScope,
  opts?: { preferDefault?: boolean },
): { folder: string | null; error?: string } {
  const preferDefault = opts?.preferDefault !== false;
  const req = (requested || '').trim();
  if (!scope.folders.length) {
    if (!req || req === '*' || /^all$/i.test(req)) return { folder: null };
    return { folder: req };
  }
  if (!req) {
    // Agent search: narrow to CLOUDINARY_SEARCH_FOLDER when set.
    // Browse / DAM: preferDefault:false → all allowlisted folders.
    return { folder: preferDefault ? scope.defaultFolder : null };
  }
  if (req === '*' || /^all$/i.test(req)) {
    return { folder: null };
  }
  const allowed = scope.folders.find((f) => f.toLowerCase() === req.toLowerCase());
  if (!allowed) {
    return {
      folder: null,
      error: `Folder “${req}” is not allowed. Use one of: ${scope.folders.join(', ')} (or omit / all)`,
    };
  }
  return { folder: allowed };
}

export type CloudinarySearchFilters = {
  /** portrait = aspect_ratio < 0.95, landscape > 1.05, square otherwise */
  orientation?: 'portrait' | 'landscape' | 'square';
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  /** e.g. png, jpg, webp */
  format?: string;
  /** Extra tags to AND (on top of scoped tags) */
  tags?: string[];
};

function folderClause(folder: string): string {
  const f = folder.replace(/"/g, '');
  return `(folder="${f}" OR folder="${f}/*" OR public_id:${f}/*)`;
}

export function buildSearchExpression(
  query: string,
  folder: string | null,
  scope: CloudinarySearchScope,
  filters: CloudinarySearchFilters = {},
): string {
  if (scope.baseExpression) {
    const parts = [scope.baseExpression];
    appendQueryAndFilters(parts, query, filters);
    return parts.join(' AND ');
  }

  const parts = ['resource_type:image'];

  if (folder) {
    parts.push(folderClause(folder));
  } else if (scope.folders.length > 1) {
    parts.push(`(${scope.folders.map(folderClause).join(' OR ')})`);
  } else if (scope.folders.length === 1) {
    parts.push(folderClause(scope.folders[0]!));
  }

  if (scope.prefix) {
    const p = scope.prefix.replace(/"/g, '').replace(/\*$/, '');
    parts.push(`public_id:${p}*`);
  }

  for (const tag of scope.tags) {
    parts.push(`tags="${tag.replace(/"/g, '')}"`);
  }

  appendQueryAndFilters(parts, query, filters);
  return parts.join(' AND ');
}

function appendQueryAndFilters(
  parts: string[],
  query: string,
  filters: CloudinarySearchFilters,
): void {
  const q = query.trim().replace(/"/g, '');
  if (q) {
    // Multi-word → OR of per-term matches across tags, contextual title/description,
    // filename, and public_id. Single token keeps a tighter clause.
    const terms = tokenizeSearchTerms(q);
    if (terms.length <= 1) {
      const t = terms[0] || q.toLowerCase();
      parts.push(termMatchClause(t));
    } else {
      parts.push(`(${terms.map(termMatchClause).join(' OR ')})`);
    }
  }

  const orientation = filters.orientation;
  if (orientation === 'portrait') {
    parts.push('aspect_ratio<0.95');
  } else if (orientation === 'landscape') {
    parts.push('aspect_ratio>1.05');
  } else if (orientation === 'square') {
    parts.push('aspect_ratio>=0.95 AND aspect_ratio<=1.05');
  }

  if (Number.isFinite(filters.minWidth)) parts.push(`width>=${Math.round(filters.minWidth!)}`);
  if (Number.isFinite(filters.maxWidth)) parts.push(`width<=${Math.round(filters.maxWidth!)}`);
  if (Number.isFinite(filters.minHeight)) parts.push(`height>=${Math.round(filters.minHeight!)}`);
  if (Number.isFinite(filters.maxHeight)) parts.push(`height<=${Math.round(filters.maxHeight!)}`);

  if (filters.format?.trim()) {
    parts.push(`format=${filters.format.trim().replace(/[^a-z0-9]/gi, '').toLowerCase()}`);
  }

  for (const tag of filters.tags || []) {
    const t = String(tag).trim().replace(/"/g, '');
    if (t) parts.push(`tags="${t}"`);
  }
}

/** Tokenize a free-text search into Cloudinary-friendly terms (no stopwords). */
export function tokenizeSearchTerms(text: string): string[] {
  const stop = new Set([
    'a',
    'an',
    'the',
    'of',
    'on',
    'at',
    'in',
    'to',
    'for',
    'and',
    'or',
    'with',
    'my',
    'me',
    'i',
    'am',
    'is',
    'are',
    'photo',
    'photos',
    'image',
    'images',
    'picture',
    'pic',
    'shot',
    'showing',
    'show',
    'find',
    'looking',
    'like',
    'someone',
    'person',
    'people',
    'please',
    'want',
    'need',
    'use',
    'set',
    'hero',
  ]);
  const raw = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-_]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !stop.has(t));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of raw) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 12) break;
  }
  return out;
}

/** Match one term against tags, contextual title/description, filename, public_id. */
export function termMatchClause(term: string): string {
  const safe = term.replace(/[^a-z0-9_-]/gi, '').toLowerCase();
  if (!safe) return 'public_id:*';
  // Title = context.caption, Description = context.alt in Cloudinary Media Library.
  return `(tags:${safe} OR context:${safe} OR context.caption:${safe} OR context.alt:${safe} OR filename:${safe}* OR public_id:${safe}*)`;
}

export function orientationFromSize(
  width?: number,
  height?: number,
): 'portrait' | 'landscape' | 'square' | null {
  if (!width || !height) return null;
  const ratio = width / height;
  if (ratio < 0.95) return 'portrait';
  if (ratio > 1.05) return 'landscape';
  return 'square';
}
