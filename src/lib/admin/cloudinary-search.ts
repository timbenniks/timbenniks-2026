/**
 * Agent / WebMCP Cloudinary search — metadata ranking + optional vision.
 * DAM browse/listing lives in cloudinary-browse.ts (no widen/vision heuristics).
 */

import { runCloudinaryBrowse } from './cloudinary-browse';
import {
  cloudinarySearch,
  mapResources,
  type MappedAsset,
  type SearchResult,
} from './cloudinary-http';
import { publicScope } from './cloudinary-public';
import {
  buildSearchExpression,
  getCloudinarySearchScope,
  resolveSearchFolder,
  tokenizeSearchTerms,
  type CloudinarySearchFilters,
  type CloudinarySearchScope,
} from './cloudinary-scope';
import {
  openaiKey,
  rankAssetsByVision,
  visionCandidateCap,
  visionHintTerms,
} from './cloudinary-vision';

export type { MappedAsset, SearchResult } from './cloudinary-http';
export { publicScope } from './cloudinary-public';
export { runCloudinaryBrowse } from './cloudinary-browse';

export type SearchBody = {
  query?: string;
  /** Natural-language scene / subject — searched against tags, title, description. */
  describe?: string;
  /** If true, also rank a shortlist with OpenAI vision (optional; metadata is default). */
  vision?: boolean;
  /**
   * Pure library listing (DAM / Media picker empty search).
   * Skips metadata relevance filtering; paginates by created_at.
   */
  browse?: boolean;
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

export type ScoredAsset = MappedAsset & {
  metadataScore?: number;
  metadataReason?: string;
  visionScore?: number;
  visionReason?: string;
};

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

export type MetadataMeta = {
  used: boolean;
  terms: string[];
  searchText: string | null;
};

/**
 * OR-clause so hint terms surface named assets into a vision shortlist.
 * Includes Tim-specific filename/tag boosts for this personal library (agent-only).
 */
export function hintOrClause(terms: string[], folders: string[]): string | null {
  if (!terms.length) return null;
  const parts: string[] = [];
  for (const t of terms) {
    const safe = t.replace(/[^a-z0-9_-]/gi, '').toLowerCase();
    if (!safe) continue;

    if (safe === 'tim') {
      parts.push('tags=tim', 'tags:tim', 'filename:tim-*', 'filename:tim_*', 'filename:tim.*');
      parts.push('context:tim', 'context.caption:tim', 'context.alt:tim');
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

    parts.push(
      `filename:${safe}*`,
      `tags:${safe}`,
      `context:${safe}`,
      `context.caption:${safe}`,
      `context.alt:${safe}`,
    );
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

/** Scene keywords for vision shortlist widening (agent-only). */
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

/** Score how well an asset’s tags/title/description/filename match search terms. */
export function scoreAssetMetadata(
  asset: MappedAsset,
  terms: string[],
): { score: number; reason: string } {
  if (!terms.length) return { score: 0, reason: '' };

  const tags = asset.tags.map((t) => t.toLowerCase());
  const title = (asset.title || '').toLowerCase();
  const description = (asset.description || '').toLowerCase();
  const contextBlob = Object.values(asset.context).join(' ').toLowerCase();
  const filename = asset.filename.toLowerCase();
  const publicId = asset.publicId.toLowerCase();

  let score = 0;
  const hits: string[] = [];

  for (const term of terms) {
    const t = term.toLowerCase();
    let termScore = 0;
    const where: string[] = [];

    if (tags.some((tag) => tag === t)) {
      termScore += 4;
      where.push('tag');
    } else if (tags.some((tag) => tag.includes(t) || t.includes(tag))) {
      termScore += 2;
      where.push('tag~');
    }

    if (title.includes(t)) {
      termScore += 4;
      where.push('title');
    }
    if (description.includes(t)) {
      termScore += 3;
      where.push('description');
    } else if (contextBlob.includes(t) && !title.includes(t)) {
      termScore += 2;
      where.push('context');
    }

    if (filename.includes(t) || publicId.includes(t)) {
      termScore += 1;
      where.push('id');
    }

    if (termScore > 0) {
      score += termScore;
      hits.push(`${t}(${where.join('+')})`);
    }
  }

  return {
    score,
    reason: hits.length ? hits.slice(0, 6).join(', ') : '',
  };
}

export function rankByMetadata(assets: MappedAsset[], terms: string[]): ScoredAsset[] {
  if (!terms.length) {
    return assets.map((a) => ({ ...a, metadataScore: 0, metadataReason: '' }));
  }

  const scored = assets.map((asset) => {
    const { score, reason } = scoreAssetMetadata(asset, terms);
    return { ...asset, metadataScore: score, metadataReason: reason };
  });

  scored.sort((a, b) => {
    const d = (b.metadataScore || 0) - (a.metadataScore || 0);
    if (d !== 0) return d;
    const at = a.createdAt ? String(a.createdAt) : '';
    const bt = b.createdAt ? String(b.createdAt) : '';
    return bt.localeCompare(at);
  });

  const matched = scored.filter((a) => (a.metadataScore || 0) > 0);
  return matched.length ? matched : scored;
}

type CollectParams = {
  scope: CloudinarySearchScope;
  folder: string | null;
  searchText: string;
  cloudFilters: CloudinarySearchFilters;
  fetchSize: number;
  nextCursor?: string | undefined;
  /** When true, also pull scene-hint + photo-folder shortlists (vision fallback only). */
  widenForVision?: boolean;
};

type CollectedCandidates = {
  assets: MappedAsset[];
  expression: string;
  terms: string[];
  primaryOk: boolean;
  primaryStatus: number;
  primaryError?: string;
  primaryNextCursor: string | null;
  primaryTotal: number;
};

export async function collectCandidates(params: CollectParams): Promise<CollectedCandidates> {
  const { scope, folder, searchText, cloudFilters, fetchSize, nextCursor, widenForVision } =
    params;
  const searchFolders = folder ? [folder] : scope.folders;
  const expression = buildSearchExpression(searchText, folder, scope, cloudFilters);
  const basePayload: Record<string, unknown> = {
    expression,
    max_results: fetchSize,
    sort_by: [{ created_at: 'desc' }],
    with_field: ['tags', 'context'],
  };
  if (nextCursor && !widenForVision) basePayload.next_cursor = nextCursor;

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
      terms: tokenizeSearchTerms(searchText),
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

  const terms = [
    ...new Set([
      ...tokenizeSearchTerms(searchText),
      ...(widenForVision ? [...SCENE_SEED_TERMS, ...visionHintTerms(searchText)] : []),
    ]),
  ].slice(0, 14);

  if (widenForVision && terms.length) {
    const sceneClause = hintOrClause(terms, searchFolders);
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
        max_results: Math.min(fetchSize, 20),
        sort_by: [{ created_at: 'desc' }],
        with_field: ['tags', 'context'],
      });
      if (photos.ok) addAll(photos.data.resources);
    }
  }

  addAll(primary.data.resources);

  return {
    assets: [...byId.values()],
    expression,
    terms: tokenizeSearchTerms(searchText),
    primaryOk: true,
    primaryStatus: primary.status,
    primaryNextCursor: primary.data.next_cursor || null,
    primaryTotal: primary.data.total_count ?? byId.size,
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

/**
 * Run Admin Cloudinary search for the Agent / metadata queries.
 * Empty / browse requests delegate to runCloudinaryBrowse (no agent heuristics).
 */
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
  const wantVision = body.vision === true;
  const wantBrowse = body.browse === true || (!rawQuery && !describeRaw && !wantVision);

  if (wantBrowse) {
    return runCloudinaryBrowse({
      folder: typeof body.folder === 'string' ? body.folder : undefined,
      maxResults: body.maxResults,
      nextCursor: body.nextCursor,
      filters: parseFilters(body),
    });
  }

  const searchText = [describeRaw, rawQuery].filter(Boolean).join(' ').trim();

  const folderRes = resolveSearchFolder(
    typeof body.folder === 'string' ? body.folder : undefined,
    scope,
    { preferDefault: true },
  );
  if (folderRes.error) {
    return { status: 400, body: { error: folderRes.error, ...publicScope() } };
  }

  if (wantVision && !openaiKey()) {
    return {
      status: 503,
      body: {
        error:
          'vision:true needs OPENAI_API_KEY on the server. Omit vision to search tags/title/description only.',
        ...publicScope(),
      },
    };
  }

  const filters = parseFilters(body);
  const softOrientation =
    describeRaw || tokenizeSearchTerms(searchText).length > 1 ? filters.orientation : undefined;
  const cloudFilters: CloudinarySearchFilters =
    softOrientation != null ? { ...filters, orientation: undefined } : filters;

  const maxResults = Math.min(
    Math.max(Number(body.maxResults) || scope.maxResultsDefault, 1),
    scope.maxResultsCap,
  );
  const fetchSize = wantVision
    ? Math.min(scope.maxResultsCap, Math.max(20, visionCandidateCap(), maxResults))
    : Math.min(scope.maxResultsCap, Math.max(maxResults, searchText ? 24 : maxResults));
  const resultLimit = Math.max(maxResults, describeRaw || wantVision ? 6 : maxResults);

  const collect = (folder: string | null, widenForVision = false) =>
    collectCandidates({
      scope,
      folder,
      searchText,
      cloudFilters,
      fetchSize,
      nextCursor: body.nextCursor,
      widenForVision,
    });

  let folderUsed = folderRes.folder;
  let collected = await collect(folderUsed, wantVision);
  if (!collected.primaryOk) {
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
  if (searchText && folderUsed && collected.assets.length < 8 && scope.folders.length > 1) {
    const wider = await collect(null, wantVision);
    if (wider.assets.length > collected.assets.length) {
      collected = wider;
      folderUsed = null;
      widened = true;
    }
  }

  const terms = collected.terms.length ? collected.terms : tokenizeSearchTerms(searchText);
  let assets: ScoredAsset[] = rankByMetadata(collected.assets, terms);
  const metadataMeta: MetadataMeta = {
    used: Boolean(searchText),
    terms,
    searchText: searchText || null,
  };

  let visionMeta: VisionMeta = { used: false };

  if (wantVision && searchText) {
    try {
      const shortlist = assets.slice(0, visionCandidateCap());
      let ranked = await rankAssetsByVision({
        describe: searchText,
        assets: shortlist.length ? shortlist : collected.assets.slice(0, visionCandidateCap()),
        cloudName: scope.cloudName,
        maxResults: Math.max(resultLimit * 2, resultLimit),
      });
      visionMeta = {
        used: true,
        describe: searchText,
        model: ranked.model,
        candidates: ranked.candidates,
        hints: terms,
        widened,
        softOrientation,
      };

      if (!ranked.assets.length && folderRes.folder && !widened && scope.folders.length > 1) {
        const wider = await collect(null, true);
        if (wider.assets.length) {
          const widerRanked = rankByMetadata(wider.assets, tokenizeSearchTerms(searchText));
          ranked = await rankAssetsByVision({
            describe: searchText,
            assets: widerRanked.slice(0, visionCandidateCap()),
            cloudName: scope.cloudName,
            maxResults: Math.max(resultLimit * 2, resultLimit),
          });
          folderUsed = null;
          widened = true;
          collected = wider;
          visionMeta.widened = true;
          visionMeta.candidates = ranked.candidates;
          visionMeta.hints = wider.terms;
        }
      }

      if (ranked.assets.length) {
        assets = preferOrientation(ranked.assets, softOrientation, resultLimit);
        visionMeta.emptyMatches = false;
      } else {
        assets = preferOrientation(
          rankByMetadata(collected.assets, terms),
          softOrientation,
          resultLimit,
        );
        visionMeta.emptyMatches = assets.length === 0;
        visionMeta.error = assets.length
          ? 'Vision found no confident matches; showing metadata matches instead.'
          : 'Vision and metadata found no matches.';
      }
    } catch (err) {
      visionMeta = {
        used: false,
        describe: searchText,
        hints: terms,
        widened,
        softOrientation,
        error: err instanceof Error ? err.message : String(err),
      };
      assets = preferOrientation(
        rankByMetadata(collected.assets, terms),
        softOrientation,
        resultLimit,
      );
    }
  } else {
    assets = preferOrientation(assets, softOrientation, resultLimit);
  }

  const emptyMeta = Boolean(searchText) && assets.length === 0;

  return {
    status: 200,
    body: {
      assets,
      nextCursor: wantVision ? null : collected.primaryNextCursor,
      totalCount: wantVision ? assets.length : collected.primaryTotal,
      expression: collected.expression,
      folder: folderUsed,
      foldersSearched: folderUsed ? [folderUsed] : scope.folders,
      filters: {
        ...filters,
        ...(softOrientation ? { orientationApplied: 'soft' } : {}),
      },
      browse: false,
      describe: describeRaw || null,
      query: rawQuery || null,
      metadata: metadataMeta,
      vision: visionMeta,
      scope: publicScope(),
      hint: emptyMeta
        ? 'No assets matched tags/title/description. Try different keywords, omit folder, or pass vision:true as a fallback.'
        : visionMeta.error && assets.length
          ? visionMeta.error
          : undefined,
    },
  };
}
