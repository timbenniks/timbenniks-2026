/** Cloudinary search scope for the admin Agent / Browse helpers. */

function env(name: string): string {
  return (
    process.env[name]?.trim() ||
    String((import.meta as { env?: Record<string, unknown> }).env?.[name] || '').trim()
  );
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
  const maxResultsCap = clampInt(env('CLOUDINARY_SEARCH_MAX_CAP'), 30, 1, 50);

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
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function resolveSearchFolder(
  requested: string | undefined,
  scope: CloudinarySearchScope,
): { folder: string | null; error?: string } {
  const req = (requested || '').trim();
  if (!scope.folders.length) {
    if (!req || req === '*' || /^all$/i.test(req)) return { folder: null };
    return { folder: req };
  }
  if (!req) {
    return { folder: scope.defaultFolder };
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
    parts.push(`(public_id:${q}* OR filename:${q}* OR tags:${q} OR context:${q})`);
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
