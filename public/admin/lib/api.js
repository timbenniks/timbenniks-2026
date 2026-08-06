/** Shared admin JSON fetch with safe error parsing. */

export class ApiError extends Error {
  constructor(message, { status, data } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function parseJsonResponse(res) {
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

/**
 * fetch + JSON parse. Throws ApiError on !ok or non-JSON body.
 * @param {string} url
 * @param {RequestInit & { errorMessage?: string }} [init]
 */
export async function apiFetch(url, init = {}) {
  const { errorMessage, ...fetchInit } = init;
  const res = await fetch(url, fetchInit);
  const data = await parseJsonResponse(res);
  if (!res.ok) {
    const msg =
      (data && typeof data === 'object' && data.error) ||
      errorMessage ||
      `Request failed (${res.status})`;
    throw new ApiError(String(msg), { status: res.status, data });
  }
  return data;
}
