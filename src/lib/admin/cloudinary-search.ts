/** Cloudinary Admin search orchestration (Browse / Agent). */

import {
  buildSearchExpression,
  getCloudinarySearchScope,
  orientationFromSize,
  resolveSearchFolder,
  type CloudinarySearchFilters,
  type CloudinarySearchScope,
} from './cloudinary-scope';
import {
  openaiKey,
  rankAssetsByVision,
  visionCandidateCap,
  visionHintTerms,
  visionModel,
} from './cloudinary-vision';

export type SearchBody = {
  query?: string;
  /** Natural-language scene description → OpenAI vision rerank on tiny thumbs. */
  describe?: string;
  /** If true and query is set, treat query as describe (no filename keyword search). */
  vision?: boolean;
  folder?: string;
  maxResults?: number;
  nextCursor?: string;
  orientation?: CloudinarySearchFilters['orientation'];
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  format?: string;
  tags?: string[];
};

export type MappedAsset = {
  publicId: string;
  secureUrl: string;
  width?: number;
  height?: number;
  aspectRatio: number | null;
  orientation: 'portrait' | 'landscape' | 'square' | null;
  format: string;
  bytes?: number;
  folder: string;
  filename: string;
  tags: unknown[];
  createdAt: unknown;
};

export type ScoredAsset = MappedAsset & { visionScore?: number; visionReason?: string };

export type VisionMeta = {
  used: boolean;
  describe?: string;
  model?: string;
  candidates?: number;
  hints?: string[];
  widened?: boolean;
  softOrientation?: string;
  emptyMatches?: boolean;
  error?: string;
};

export type SearchResult = {
  status: number;
  body: Record<string, unknown>;
};

export function basicAuth(apiKey: string, apiSecret: string): string {
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
}

export function mapResources(resources: Array<Record<string, unknown>> | undefined): MappedAsset[] {
  return (resources || []).map((r) => {
    const publicId = String(r.public_id || '');
    const width = typeof r.width === 'number' ? r.width : undefined;
    const height = typeof r.height === 'number' ? r.height : undefined;
    const aspectRatio =
      typeof r.aspect_ratio === 'number'
        ? r.aspect_ratio
        : width && height
          ? Math.round((width / height) * 1000) / 1000
          : null;
    return {
      publicId,
      secureUrl: String(r.secure_url || r.url || ''),
      width,
      height,
      aspectRatio,
      orientation: orientationFromSize(width, height),
      format: r.format ? String(r.format) : '',
      bytes: typeof r.bytes === 'number' ? r.bytes : undefined,
      folder:
        typeof r.folder === 'string'
          ? r.folder
          : publicId.includes('/')
            ? publicId.split('/').slice(0, -1).join('/')
            : '',
      filename: publicId.split('/').pop() || publicId,
      tags: Array.isArray(r.tags) ? r.tags : [],
      createdAt: r.created_at || null,
    };
  });
}

export async function cloudinarySearch(
  cloudName: string,
  apiKey: string,
  apiSecret: string,
  payload: Record<string, unknown>,
): Promise<{
  ok: boolean;
  status: number;
  data: {
    resources?: Array<Record<string, unknown>>;
    next_cursor?: string;
    total_count?: number;
    error?: { message?: string };
  };
  rawText: string;
}> {
  let res: Response;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/resources/search`, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(apiKey, apiSecret),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return {
      ok: false,
      status: 502,
      data: { error: { message: err instanceof Error ? err.message : String(err) } },
      rawText: '',
    };
  }
  const rawText = await res.text();
  let data: {
    resources?: Array<Record<string, unknown>>;
    next_cursor?: string;
    total_count?: number;
    error?: { message?: string };
  } = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    return {
      ok: false,
      status: 502,
      data: { error: { message: rawText.slice(0, 400) } },
      rawText,
    };
  }
  return { ok: res.ok, status: res.status, data, rawText };
}

/** OR-clause so hint terms surface older named assets into the vision shortlist. */
export function hintOrClause(terms: string[], folders: string[]): string | null {
  if (!terms.length) return null;
  const parts: string[] = [];
  for (const t of terms) {
    const safe = t.replace(/[^a-z0-9_-]/gi, '').toLowerCase();
    if (!safe) continue;

    // Bare "tim*" matches time-video-sketch, timothy, etc. — require a separator.
    if (safe === 'tim') {
      parts.push('tags=tim', 'filename:tim-*', 'filename:tim_*', 'filename:tim.*');
      for (const f of folders) {
        const folder = f.replace(/"/g, '').replace(/\/$/, '');
        if (!folder) continue;
        parts.push(
          `public_id:${folder}/tim-*`,
          `public_id:${folder}/tim_*`,
          `public_id:${folder}/Tim*`,
          `public_id:${folder}/tim`,
        );
      }
      continue;
    }

    parts.push(`filename:${safe}*`, `tags=${safe}`);
    if (folders.length) {
      for (const f of folders) {
        const folder = f.replace(/"/g, '').replace(/\/$/, '');
        if (folder) parts.push(`public_id:${folder}/${safe}*`);
      }
    } else {
      parts.push(`public_id:${safe}*`);
    }
  }
  if (!parts.length) return null;
  return `(${parts.join(' OR ')})`;
}

/** Strong scene keywords — used even when the describe text is vague. */
export const SCENE_SEED_TERMS = [
  'speaking',
  'stage',
  'talk',
  'conference',
  'keynote',
  'speaker',
  'on_stage',
  'on-stage',
];

/** Folders that usually hold real photos of Tim (prefer over website posters). */
export function personPhotoFolders(folders: string[]): string[] {
  const preferred = folders.filter((f) => /^(tim|presskit)$/i.test(f));
  return preferred.length ? preferred : folders;
}

export function publicScope() {
  const scope = getCloudinarySearchScope();
  return {
    enabled: Boolean(scope.cloudName && scope.apiKey && scope.apiSecret),
    cloudName: scope.cloudName || null,
    needsSecret: !scope.apiSecret,
    folders: scope.folders,
    defaultFolder: scope.defaultFolder,
    searchesAllFoldersByDefault: scope.defaultFolder == null,
    tags: scope.tags,
    prefix: scope.prefix || null,
    maxResultsDefault: scope.maxResultsDefault,
    filters: {
      orientation: ['portrait', 'landscape', 'square'],
      minWidth: 'number',
      maxWidth: 'number',
      minHeight: 'number',
      maxHeight: 'number',
      format: 'png|jpg|webp|…',
      tags: 'string[]',
    },
    vision: {
      enabled: Boolean(openaiKey()),
      model: visionModel(),
      maxCandidates: visionCandidateCap(),
      note: 'Pass describe (or vision:true with a scene query) to rank tiny thumbs with OpenAI vision.',
    },
  };
}

export function parseFilters(body: SearchBody): CloudinarySearchFilters {
  const filters: CloudinarySearchFilters = {};
  if (
    body.orientation === 'portrait' ||
    body.orientation === 'landscape' ||
    body.orientation === 'square'
  ) {
    filters.orientation = body.orientation;
  }
  if (Number.isFinite(body.minWidth)) filters.minWidth = Number(body.minWidth);
  if (Number.isFinite(body.maxWidth)) filters.maxWidth = Number(body.maxWidth);
  if (Number.isFinite(body.minHeight)) filters.minHeight = Number(body.minHeight);
  if (Number.isFinite(body.maxHeight)) filters.maxHeight = Number(body.maxHeight);
  if (typeof body.format === 'string' && body.format.trim()) filters.format = body.format;
  if (Array.isArray(body.tags)) filters.tags = body.tags.map(String);
  return filters;
}

type CollectParams = {
  scope: CloudinarySearchScope;
  folder: string | null;
  metadataQuery: string;
  describe: string;
  cloudFilters: CloudinarySearchFilters;
  fetchSize: number;
  nextCursor?: string | undefined;
};

type CollectedCandidates = {
  assets: MappedAsset[];
  expression: string;
  hints: string[];
  primaryOk: boolean;
  primaryStatus: number;
  primaryError?: string;
  primaryNextCursor: string | null;
  primaryTotal: number;
};

export async function collectCandidates(params: CollectParams): Promise<CollectedCandidates> {
  const { scope, folder, metadataQuery, describe, cloudFilters, fetchSize, nextCursor } = params;
  const searchFolders = folder ? [folder] : scope.folders;
  const expression = buildSearchExpression(metadataQuery, folder, scope, cloudFilters);
  const basePayload: Record<string, unknown> = {
    expression,
    max_results: fetchSize,
    sort_by: [{ created_at: 'desc' }],
    with_field: ['tags', 'context'],
  };
  if (nextCursor && !describe) basePayload.next_cursor = nextCursor;

  const primary = await cloudinarySearch(
    scope.cloudName,
    scope.apiKey,
    scope.apiSecret,
    basePayload,
  );
  if (!primary.ok) {
    return {
      assets: [],
      expression,
      hints: [],
      primaryOk: false,
      primaryStatus: primary.status,
      primaryError: primary.data.error?.message || `Cloudinary error ${primary.status}`,
      primaryNextCursor: null,
      primaryTotal: 0,
    };
  }

  const byId = new Map<string, MappedAsset>();
  const addAll = (resources: Array<Record<string, unknown>> | undefined) => {
    for (const asset of mapResources(resources)) {
      if (asset.publicId && !byId.has(asset.publicId)) byId.set(asset.publicId, asset);
    }
  };

  const hints = describe ? [...new Set([...SCENE_SEED_TERMS, ...visionHintTerms(describe)])] : [];

  if (describe) {
    // 1) Scene-keyword hits first (speaking/stage/talk/…) across scope
    const sceneClause = hintOrClause(hints, searchFolders);
    if (sceneClause) {
      const sceneExpr = buildSearchExpression('', folder, scope, cloudFilters);
      const scene = await cloudinarySearch(scope.cloudName, scope.apiKey, scope.apiSecret, {
        expression: `${sceneExpr} AND ${sceneClause}`,
        max_results: fetchSize,
        sort_by: [{ created_at: 'desc' }],
        with_field: ['tags', 'context'],
      });
      if (scene.ok) addAll(scene.data.resources);
    }

    // 2) Recent assets from Tim/Presskit (real photos), not website poster noise
    const photoFolders = personPhotoFolders(searchFolders);
    if (photoFolders.length) {
      const photoExpr = buildSearchExpression(
        '',
        null,
        { ...scope, folders: photoFolders, defaultFolder: null },
        cloudFilters,
      );
      const photos = await cloudinarySearch(scope.cloudName, scope.apiKey, scope.apiSecret, {
        expression: photoExpr,
        max_results: fetchSize,
        sort_by: [{ created_at: 'desc' }],
        with_field: ['tags', 'context'],
      });
      if (photos.ok) addAll(photos.data.resources);
    }
  }

  // 3) General recent in scope (fills remaining slots)
  addAll(primary.data.resources);

  let list = [...byId.values()];
  if (describe) list = list.slice(0, visionCandidateCap());

  return {
    assets: list,
    expression,
    hints,
    primaryOk: true,
    primaryStatus: primary.status,
    primaryNextCursor: primary.data.next_cursor || null,
    primaryTotal: primary.data.total_count ?? list.length,
  };
}

function preferOrientation(
  list: ScoredAsset[],
  softOrientation: CloudinarySearchFilters['orientation'] | undefined,
  resultLimit: number,
): ScoredAsset[] {
  if (!softOrientation) return list.slice(0, resultLimit);
  const pref = list.filter((a) => a.orientation === softOrientation);
  const rest = list.filter((a) => a.orientation !== softOrientation);
  return [...pref, ...rest].slice(0, resultLimit);
}

/** Run Admin Cloudinary search; returns HTTP status + JSON body (auth checked by route). */
export async function runCloudinarySearch(body: SearchBody): Promise<SearchResult> {
  const scope = getCloudinarySearchScope();
  if (!scope.cloudName || !scope.apiKey || !scope.apiSecret) {
    return {
      status: 503,
      body: {
        error:
          'Cloudinary Admin search needs PUBLIC_CLOUDINARY_CLOUD_NAME, PUBLIC_CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the server',
        ...publicScope(),
        enabled: false,
      },
    };
  }

  const rawQuery = typeof body.query === 'string' ? body.query.trim() : '';
  const describeRaw = typeof body.describe === 'string' ? body.describe.trim() : '';
  const visionFlag = body.vision === true;
  // Scene text for OpenAI vision (tiny thumbs). Prefer explicit `describe`.
  const describe = describeRaw || (visionFlag && rawQuery ? rawQuery : '');
  // Filename/tag keyword: keep `query` when `describe` is separate; drop it when
  // vision:true reused query as the scene description.
  const metadataQuery = describeRaw ? rawQuery : describe ? '' : rawQuery;

  const folderRes = resolveSearchFolder(
    typeof body.folder === 'string' ? body.folder : undefined,
    scope,
  );
  if (folderRes.error) {
    return { status: 400, body: { error: folderRes.error, ...publicScope() } };
  }

  if (describe && !openaiKey()) {
    return {
      status: 503,
      body: {
        error:
          'Vision search (describe) needs OPENAI_API_KEY on the server. Use plain query for filename/tag search.',
        ...publicScope(),
      },
    };
  }

  const filters = parseFilters(body);
  // For scene search, orientation is a soft preference — hard Cloudinary aspect
  // filters drop portrait stage shots and shrink the vision shortlist too early.
  const softOrientation = describe ? filters.orientation : undefined;
  const cloudFilters: CloudinarySearchFilters = describe
    ? { ...filters, orientation: undefined }
    : filters;

  const maxResults = Math.min(
    Math.max(Number(body.maxResults) || scope.maxResultsDefault, 1),
    scope.maxResultsCap,
  );
  // Scene search always pulls a fat shortlist for vision — ignore tiny maxResults from the agent.
  const fetchSize = describe
    ? Math.min(scope.maxResultsCap, Math.max(20, visionCandidateCap(), maxResults))
    : maxResults;
  const resultLimit = describe ? Math.max(maxResults, 6) : maxResults;

  const collect = (folder: string | null) =>
    collectCandidates({
      scope,
      folder,
      metadataQuery,
      describe,
      cloudFilters,
      fetchSize,
      nextCursor: body.nextCursor,
    });

  let folderUsed = folderRes.folder;
  let collected = await collect(folderUsed);
  if (!collected.primaryOk && !describe) {
    return {
      status:
        collected.primaryStatus >= 400 && collected.primaryStatus < 600
          ? collected.primaryStatus
          : 502,
      body: {
        error: collected.primaryError,
        details: { status: collected.primaryStatus },
      },
    };
  }

  let widened = false;
  if (describe && folderUsed && collected.assets.length < 10 && scope.folders.length > 1) {
    const wider = await collect(null);
    if (wider.assets.length > collected.assets.length) {
      collected = wider;
      folderUsed = null;
      widened = true;
    }
  }

  let assets: ScoredAsset[] = collected.assets;
  let visionMeta: VisionMeta = { used: false };

  if (describe) {
    try {
      if (collected.assets.length < 6 && scope.folders.length > 1 && folderUsed) {
        const wider = await collect(null);
        if (wider.assets.length > collected.assets.length) {
          collected = wider;
          folderUsed = null;
          widened = true;
          assets = wider.assets;
        }
      }

      let ranked = await rankAssetsByVision({
        describe,
        assets: collected.assets,
        cloudName: scope.cloudName,
        maxResults: Math.max(resultLimit * 2, resultLimit),
      });
      visionMeta = {
        used: true,
        describe,
        model: ranked.model,
        candidates: ranked.candidates,
        hints: collected.hints,
        widened,
        softOrientation,
      };

      if (!ranked.assets.length && folderRes.folder && !widened && scope.folders.length > 1) {
        const wider = await collect(null);
        if (wider.assets.length) {
          ranked = await rankAssetsByVision({
            describe,
            assets: wider.assets,
            cloudName: scope.cloudName,
            maxResults: Math.max(resultLimit * 2, resultLimit),
          });
          folderUsed = null;
          widened = true;
          collected = wider;
          visionMeta.widened = true;
          visionMeta.candidates = ranked.candidates;
          visionMeta.hints = wider.hints;
        }
      }

      if (ranked.assets.length) {
        assets = preferOrientation(ranked.assets, softOrientation, resultLimit);
        visionMeta.emptyMatches = false;
      } else {
        // Empty is better than returning random posters like time-video-sketch.
        visionMeta.emptyMatches = true;
        assets = [];
      }
    } catch (err) {
      visionMeta = {
        used: false,
        describe,
        hints: collected.hints,
        widened,
        softOrientation,
        error: err instanceof Error ? err.message : String(err),
      };
      assets = [];
    }
  }

  return {
    status: 200,
    body: {
      assets,
      nextCursor: describe ? null : collected.primaryNextCursor,
      totalCount: describe ? assets.length : collected.primaryTotal,
      expression: collected.expression,
      folder: folderUsed,
      foldersSearched: folderUsed ? [folderUsed] : scope.folders,
      filters: {
        ...filters,
        ...(softOrientation ? { orientationApplied: 'soft' } : {}),
      },
      describe: describe || null,
      vision: visionMeta,
      scope: publicScope(),
      hint:
        describe && visionMeta.emptyMatches
          ? 'Vision found no confident matches. Retry with describe only (omit folder), or a different scene phrase.'
          : undefined,
    },
  };
}
