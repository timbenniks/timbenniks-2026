/**
 * Pure DAM library listing — no metadata ranking, vision, or agent widen heuristics.
 * Used by Media picker /admin/media and empty Browse searches.
 */

import { cloudinarySearch, mapResources, type SearchResult } from './cloudinary-http';
import {
  buildSearchExpression,
  getCloudinarySearchScope,
  resolveSearchFolder,
  type CloudinarySearchFilters,
} from './cloudinary-scope';
import { publicScope } from './cloudinary-public';

export type BrowseBody = {
  folder?: string;
  maxResults?: number;
  nextCursor?: string;
  filters?: CloudinarySearchFilters;
};

/** List assets in allowlisted folders, newest first. */
export async function runCloudinaryBrowse(body: BrowseBody = {}): Promise<SearchResult> {
  const scope = getCloudinarySearchScope();
  if (!scope.cloudName || !scope.apiKey || !scope.apiSecret) {
    return {
      status: 503,
      body: {
        error:
          'Cloudinary Media needs PUBLIC_CLOUDINARY_CLOUD_NAME, PUBLIC_CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET on the server',
        ...publicScope(),
        enabled: false,
      },
    };
  }

  const folderRes = resolveSearchFolder(body.folder, scope, { preferDefault: false });
  if (folderRes.error) {
    return { status: 400, body: { error: folderRes.error, ...publicScope() } };
  }

  const filters = body.filters || {};
  const maxResults = Math.min(
    Math.max(Number(body.maxResults) || 48, 1),
    scope.maxResultsCap,
  );
  const expression = buildSearchExpression('', folderRes.folder, scope, filters);
  const payload: Record<string, unknown> = {
    expression,
    max_results: maxResults,
    sort_by: [{ created_at: 'desc' }],
    with_field: ['tags', 'context'],
  };
  if (body.nextCursor) payload.next_cursor = body.nextCursor;

  const primary = await cloudinarySearch(
    scope.cloudName,
    scope.apiKey,
    scope.apiSecret,
    payload,
  );
  if (!primary.ok) {
    return {
      status:
        primary.status >= 400 && primary.status < 600 ? primary.status : 502,
      body: {
        error: primary.data.error?.message || `Cloudinary error ${primary.status}`,
        details: { status: primary.status },
      },
    };
  }

  const assets = mapResources(primary.data.resources);
  const folderUsed = folderRes.folder;

  return {
    status: 200,
    body: {
      assets,
      nextCursor: primary.data.next_cursor || null,
      totalCount: primary.data.total_count ?? assets.length,
      expression,
      folder: folderUsed,
      foldersSearched: folderUsed ? [folderUsed] : scope.folders,
      filters,
      browse: true,
      describe: null,
      query: null,
      metadata: { used: false, terms: [], searchText: null },
      vision: { used: false },
      scope: publicScope(),
    },
  };
}
