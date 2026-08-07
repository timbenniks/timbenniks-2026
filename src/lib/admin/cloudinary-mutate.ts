/** Cloudinary upload signatures + metadata updates (admin-only). */

import { createHash } from 'node:crypto';
import { basicAuth } from './cloudinary-http';
import {
  getCloudinarySearchScope,
  resolveSearchFolder,
  type CloudinarySearchScope,
} from './cloudinary-scope';

/** True when public_id is under an allowlisted folder (or no folder constraint). */
export function assertPublicIdInScope(
  publicId: string,
  scope: CloudinarySearchScope = getCloudinarySearchScope(),
): { ok: true } | { ok: false; error: string } {
  const id = publicId.replace(/^\/+/, '').trim();
  if (!id) return { ok: false, error: 'publicId is required' };

  if (scope.prefix) {
    const p = scope.prefix.replace(/\*$/, '').replace(/\/?$/, '/');
    if (!id.startsWith(p) && id !== p.replace(/\/$/, '')) {
      return { ok: false, error: `Asset must be under prefix “${scope.prefix}”` };
    }
  }

  if (!scope.folders.length) return { ok: true };

  const allowed = scope.folders.some((folder) => {
    const f = folder.replace(/\/$/, '');
    return id === f || id.startsWith(`${f}/`);
  });
  if (!allowed) {
    return {
      ok: false,
      error: `Asset “${id}” is outside allowed folders: ${scope.folders.join(', ')}`,
    };
  }
  return { ok: true };
}

/** Resolve and validate an upload destination folder (required for signed upload). */
export function resolveUploadFolder(
  requested: string | undefined,
  scope: CloudinarySearchScope = getCloudinarySearchScope(),
): { folder: string; error?: string } {
  const res = resolveSearchFolder(requested, scope);
  if (res.error) return { folder: '', error: res.error };

  let folder = res.folder;
  if (!folder) {
    folder = scope.folders[0] || scope.defaultFolder || '';
  }
  if (!folder) {
    return {
      folder: '',
      error: 'Set CLOUDINARY_SEARCH_FOLDERS (or pass folder) for uploads',
    };
  }

  if (scope.folders.length) {
    const allowed = scope.folders.find((f) => f.toLowerCase() === folder!.toLowerCase());
    if (!allowed) {
      return {
        folder: '',
        error: `Folder “${folder}” is not allowed. Use one of: ${scope.folders.join(', ')}`,
      };
    }
    folder = allowed;
  }
  return { folder };
}

/**
 * Cloudinary signed upload params (SHA-1 of sorted key=value pairs + api_secret).
 * @see https://cloudinary.com/documentation/authentication_signatures
 */
export function cloudinarySign(params: Record<string, string | number>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');
}

export type SignUploadResult =
  | {
      ok: true;
      cloudName: string;
      apiKey: string;
      timestamp: number;
      folder: string;
      signature: string;
      /** Optional context string for upload (caption|alt). */
      context?: string;
      tags?: string;
    }
  | { ok: false; status: number; error: string };

export function signUploadParams(opts: {
  folder?: string;
  title?: string;
  description?: string;
  tags?: string[];
}): SignUploadResult {
  const scope = getCloudinarySearchScope();
  if (!scope.cloudName || !scope.apiKey || !scope.apiSecret) {
    return {
      ok: false,
      status: 503,
      error:
        'Cloudinary upload needs PUBLIC_CLOUDINARY_CLOUD_NAME, PUBLIC_CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET',
    };
  }

  const folderRes = resolveUploadFolder(opts.folder, scope);
  if (folderRes.error || !folderRes.folder) {
    return { ok: false, status: 400, error: folderRes.error || 'Invalid folder' };
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signParams: Record<string, string | number> = {
    timestamp,
    folder: folderRes.folder,
  };

  const contextParts: string[] = [];
  if (opts.title?.trim()) contextParts.push(`caption=${escapeContextValue(opts.title.trim())}`);
  if (opts.description?.trim()) {
    contextParts.push(`alt=${escapeContextValue(opts.description.trim())}`);
  }
  const context = contextParts.length ? contextParts.join('|') : undefined;
  if (context) signParams.context = context;

  const tags =
    Array.isArray(opts.tags) && opts.tags.length
      ? opts.tags.map((t) => String(t).trim()).filter(Boolean).join(',')
      : undefined;
  if (tags) signParams.tags = tags;

  const signature = cloudinarySign(signParams, scope.apiSecret);

  return {
    ok: true,
    cloudName: scope.cloudName,
    apiKey: scope.apiKey,
    timestamp,
    folder: folderRes.folder,
    signature,
    ...(context ? { context } : {}),
    ...(tags ? { tags } : {}),
  };
}

function escapeContextValue(value: string): string {
  // Cloudinary context uses | and = as separators; strip them from values.
  return value.replace(/[|=]/g, ' ').trim();
}

export type UpdateAssetMetaResult =
  | {
      ok: true;
      publicId: string;
      secureUrl: string;
      tags: string[];
      title: string | null;
      description: string | null;
      width?: number;
      height?: number;
    }
  | { ok: false; status: number; error: string };

/** Update tags + Media Library title/description (context.caption / context.alt). */
export async function updateAssetMeta(opts: {
  publicId: string;
  tags?: string[];
  title?: string | null;
  description?: string | null;
}): Promise<UpdateAssetMetaResult> {
  const scope = getCloudinarySearchScope();
  if (!scope.cloudName || !scope.apiKey || !scope.apiSecret) {
    return {
      ok: false,
      status: 503,
      error: 'Cloudinary is not configured on the server',
    };
  }

  const publicId = opts.publicId.replace(/^\/+/, '').trim();
  const scopeCheck = assertPublicIdInScope(publicId, scope);
  if (!scopeCheck.ok) {
    return { ok: false, status: 400, error: scopeCheck.error };
  }

  const body = new URLSearchParams();
  if (Array.isArray(opts.tags)) {
    body.set('tags', opts.tags.map((t) => String(t).trim()).filter(Boolean).join(','));
  }

  // Always send context when either field is present so clears work.
  if (opts.title !== undefined || opts.description !== undefined) {
    const caption = opts.title == null ? '' : escapeContextValue(String(opts.title));
    const alt = opts.description == null ? '' : escapeContextValue(String(opts.description));
    body.set('context', `caption=${caption}|alt=${alt}`);
  }

  if (![...body.keys()].length) {
    return { ok: false, status: 400, error: 'Nothing to update (tags, title, or description)' };
  }

  const encodedId = publicId
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');

  const url = `https://api.cloudinary.com/v1_1/${scope.cloudName}/resources/image/upload/${encodedId}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: basicAuth(scope.apiKey, scope.apiSecret),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return { ok: false, status: 502, error: text.slice(0, 400) || `Cloudinary error ${res.status}` };
  }

  if (!res.ok) {
    const errMsg =
      (data.error as { message?: string } | undefined)?.message ||
      `Cloudinary update failed (${res.status})`;
    return { ok: false, status: res.status >= 400 && res.status < 600 ? res.status : 502, error: errMsg };
  }

  const context =
    data.context && typeof data.context === 'object' && !Array.isArray(data.context)
      ? (data.context as Record<string, string>)
      : {};

  return {
    ok: true,
    publicId: String(data.public_id || publicId),
    secureUrl: String(data.secure_url || data.url || ''),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    title: context.caption?.trim() || null,
    description: context.alt?.trim() || null,
    width: typeof data.width === 'number' ? data.width : undefined,
    height: typeof data.height === 'number' ? data.height : undefined,
  };
}
