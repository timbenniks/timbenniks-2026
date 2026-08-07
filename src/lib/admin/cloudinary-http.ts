/** Shared Cloudinary Admin API HTTP helpers. */

import { orientationFromSize } from './cloudinary-scope';

export function basicAuth(apiKey: string, apiSecret: string): string {
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
}

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
  tags: string[];
  /** Cloudinary Media Library Title (context.caption). */
  title: string | null;
  /** Cloudinary Media Library Description (context.alt). */
  description: string | null;
  context: Record<string, string>;
  createdAt: unknown;
};

export type SearchResult = {
  status: number;
  body: Record<string, unknown>;
};

/** Surface undici/Node fetch cause (ENOTFOUND, ECONNREFUSED, etc.) beyond bare "fetch failed". */
function formatFetchError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as Error & { cause?: unknown }).cause;
  if (cause instanceof Error && cause.message) {
    return `${err.message}: ${cause.message}`;
  }
  if (cause != null && typeof cause === 'object' && 'code' in cause) {
    const code = String((cause as { code?: unknown }).code || '');
    const msg =
      'message' in cause && (cause as { message?: unknown }).message
        ? String((cause as { message?: unknown }).message)
        : '';
    return [err.message, code, msg].filter(Boolean).join(': ');
  }
  return err.message || String(err);
}

function asContextMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v == null) continue;
    out[k] = String(v);
  }
  return out;
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
    const context = asContextMap(r.context);
    const title = context.caption?.trim() || context.title?.trim() || null;
    const description = context.alt?.trim() || context.description?.trim() || null;
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
      tags: Array.isArray(r.tags) ? r.tags.map(String) : [],
      title,
      description,
      context,
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
    const message = formatFetchError(err);
    return {
      ok: false,
      status: 502,
      data: { error: { message } },
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
