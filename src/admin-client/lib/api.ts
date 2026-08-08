/** Shared admin JSON fetch with safe error parsing. */

export class ApiError extends Error {
  readonly status: number | undefined;
  readonly data: unknown;

  constructor(message: string, opts: { status?: number; data?: unknown } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.data = opts.data;
  }
}

export async function parseJsonResponse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 180);
    throw new ApiError(
      snippet
        ? `Non-JSON response (${res.status}): ${snippet}`
        : `Empty non-JSON response (${res.status})`,
      { status: res.status },
    );
  }
}

export type ApiFetchInit = RequestInit & { errorMessage?: string };

/**
 * fetch + JSON parse. Throws ApiError on !ok or non-JSON body.
 *
 * The response type is caller-asserted: these endpoints are typed on the server
 * but nothing validates the payload here, so pass the shape you expect.
 */
export async function apiFetch<T = unknown>(url: string, init: ApiFetchInit = {}): Promise<T> {
  const { errorMessage, ...fetchInit } = init;
  const res = await fetch(url, fetchInit);
  const data = await parseJsonResponse(res);
  if (!res.ok) {
    const msg =
      (data && typeof data === 'object' && (data as { error?: unknown }).error) ||
      errorMessage ||
      `Request failed (${res.status})`;
    throw new ApiError(String(msg), { status: res.status, data });
  }
  return data as T;
}
