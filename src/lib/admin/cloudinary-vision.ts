/** Rank Cloudinary assets with OpenAI vision on tiny thumbs (agent search fallback). */

import { env } from './cloudinary-scope';

export type VisionRankableAsset = {
  publicId: string;
  secureUrl: string;
  [key: string]: unknown;
};

export type VisionRankedAsset = VisionRankableAsset & {
  visionScore: number;
  visionReason: string;
};

export function openaiKey(): string {
  return env('OPENAI_API_KEY');
}

export function visionModel(): string {
  return env('OPENAI_WEBMCP_VISION_MODEL') || env('OPENAI_WEBMCP_MODEL') || 'gpt-4o';
}

export function visionCandidateCap(): number {
  const n = Number(env('CLOUDINARY_VISION_CANDIDATES') || '20');
  if (!Number.isFinite(n)) return 20;
  return Math.min(24, Math.max(4, Math.round(n)));
}

const HINT_SYNONYMS: Record<string, string[]> = {
  stage: ['speaking', 'talk', 'keynote', 'speaker'],
  conference: ['talk', 'keynote', 'speaking', 'meetup'],
  speaking: ['stage', 'talk', 'keynote'],
  talk: ['speaking', 'stage', 'conference'],
  speaker: ['speaking', 'stage', 'keynote'],
  keynote: ['speaking', 'stage', 'talk'],
};

/** Pull searchable hint tokens from a scene description (for Cloudinary shortlist). */
export function visionHintTerms(describe: string): string[] {
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
    'benniks', // too rare as filename prefix; "tim" covers his assets
  ]);
  const raw = describe
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !stop.has(t));

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (t: string) => {
    if (seen.has(t) || t.length < 3) return;
    seen.add(t);
    out.push(t);
  };
  for (const t of raw) {
    push(t);
    for (const syn of HINT_SYNONYMS[t] || []) push(syn);
    if (out.length >= 10) break;
  }
  return out.slice(0, 10);
}

/** Tiny JPEG for vision — Cloudinary on-the-fly transform (path-encoded). */
export function visionThumbUrl(cloudName: string, publicId: string): string {
  const id = publicId
    .replace(/^\/+/, '')
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `https://res.cloudinary.com/${cloudName}/image/upload/c_limit,w_256,h_256,q_30,f_jpg/${id}`;
}

type VisionMatch = { publicId: string; score: number; reason: string };

function normalizePublicId(id: string): string {
  return id.toLowerCase().replace(/\s+/g, ' ').trim();
}

function findCandidate<T extends VisionRankableAsset>(
  byId: Map<string, T>,
  publicId: string,
): T | undefined {
  const direct = byId.get(publicId);
  if (direct) return direct;
  const n = normalizePublicId(publicId);
  for (const [key, asset] of byId) {
    if (normalizePublicId(key) === n) return asset;
  }
  // Basename fallback (model sometimes drops folder prefix)
  const base = n.split('/').pop() || n;
  for (const [key, asset] of byId) {
    if ((normalizePublicId(key).split('/').pop() || '') === base) return asset;
  }
  return undefined;
}

function parseMatches(raw: string): VisionMatch[] {
  let data: { matches?: unknown } = {};
  try {
    data = JSON.parse(raw);
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return [];
    try {
      data = JSON.parse(m[0]!);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data.matches)) return [];
  return data.matches
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const publicId = String(o.publicId || o.public_id || '').trim();
      if (!publicId) return null;
      const score = Number(o.score);
      return {
        publicId,
        score: Number.isFinite(score) ? Math.min(1, Math.max(0, score)) : 0,
        reason: String(o.reason || '').slice(0, 200),
      };
    })
    .filter((x): x is VisionMatch => Boolean(x));
}

/**
 * Send up to ~20 low-detail thumbs + a scene description; return assets reordered
 * with visionScore / visionReason.
 */
export async function rankAssetsByVision<T extends VisionRankableAsset>(opts: {
  describe: string;
  assets: T[];
  cloudName: string;
  maxResults: number;
}): Promise<{
  assets: (T & { visionScore: number; visionReason: string })[];
  model: string;
  candidates: number;
  rawMatches: VisionMatch[];
}> {
  const key = openaiKey();
  if (!key) {
    throw new Error('OPENAI_API_KEY is required for vision image search (describe=…)');
  }

  const describe = opts.describe.trim();
  if (!describe) {
    throw new Error('describe is required for vision ranking');
  }

  const candidates = opts.assets.slice(0, visionCandidateCap());
  if (!candidates.length) {
    return { assets: [], model: visionModel(), candidates: 0, rawMatches: [] };
  }

  const model = visionModel();
  const baseUrl = (env('OPENAI_BASE_URL') || 'https://api.openai.com/v1').replace(/\/$/, '');

  const content: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: `You are ranking photos from Tim Benniks' media library for a site editor.

Scene description (what the human wants):
"""${describe.replace(/"/g, "'")}"""

Below are ${candidates.length} candidate images (low-res thumbs) with their publicId labels.
Return JSON only:
{"matches":[{"publicId":"exact-id","score":0.0,"reason":"short why"}]}

Rules:
- score 0–1 how well the image matches the scene description
- Copy publicId EXACTLY from the labels (including folder and spaces)
- Include matches with score >= 0.4, best first
- Prefer real photos of a person on stage / speaking / conference over illustrations, posters, or sketches
- If none fit, return {"matches":[]}
- Tim is a Dutch developer / conference speaker — "me" / "Tim" / "Tim Benniks" means him`,
    },
  ];

  for (const asset of candidates) {
    content.push({
      type: 'text',
      text: `publicId: ${asset.publicId}`,
    });
    content.push({
      type: 'image_url',
      image_url: {
        url: visionThumbUrl(opts.cloudName, asset.publicId),
        detail: 'low',
      },
    });
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      max_tokens: 800,
      messages: [{ role: 'user', content }],
    }),
  });

  const text = await res.text();
  let data: {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  } = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Vision rank failed: ${text.slice(0, 300)}`);
  }
  if (!res.ok) {
    throw new Error(data.error?.message || `OpenAI vision error ${res.status}`);
  }

  const raw = data.choices?.[0]?.message?.content || '{"matches":[]}';
  const rawMatches = parseMatches(raw);
  const byId = new Map(candidates.map((a) => [a.publicId, a]));

  const ranked: (T & { visionScore: number; visionReason: string })[] = [];
  const seen = new Set<string>();
  for (const m of rawMatches) {
    const asset = findCandidate(byId, m.publicId);
    if (!asset) continue;
    if (seen.has(asset.publicId)) continue;
    seen.add(asset.publicId);
    ranked.push({
      ...asset,
      visionScore: m.score,
      visionReason: m.reason,
    });
  }

  ranked.sort((a, b) => b.visionScore - a.visionScore);
  return {
    assets: ranked.slice(0, opts.maxResults),
    model,
    candidates: candidates.length,
    rawMatches,
  };
}
