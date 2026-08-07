/** Public Cloudinary scope payload for Admin UI / Agent (no secrets). */

import { getCloudinarySearchScope, env } from './cloudinary-scope';

function visionCandidateCap(): number {
  const n = Number(env('CLOUDINARY_VISION_CANDIDATES') || '20');
  if (!Number.isFinite(n)) return 20;
  return Math.min(24, Math.max(4, Math.round(n)));
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
    metadata: {
      note: 'Search uses tags + Media Library Title (context.caption) + Description (context.alt). Prefer describe/query; set vision:true only as a fallback.',
    },
    vision: {
      enabled: Boolean(env('OPENAI_API_KEY')),
      model:
        env('OPENAI_WEBMCP_VISION_MODEL') || env('OPENAI_WEBMCP_MODEL') || 'gpt-4o',
      maxCandidates: visionCandidateCap(),
      note: 'Optional. Pass vision:true to rerank a metadata shortlist with OpenAI vision on tiny thumbs.',
    },
  };
}
