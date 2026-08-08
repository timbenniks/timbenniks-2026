// Generated from src/admin-client by `npm run build:admin` — do not edit.
class ApiError extends Error {
  status;
  data;
  constructor(message, opts = {}) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.data = opts.data;
  }
}
async function parseJsonResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    const snippet = text.replace(/\s+/g, " ").trim().slice(0, 180);
    throw new ApiError(
      snippet ? `Non-JSON response (${res.status}): ${snippet}` : `Empty non-JSON response (${res.status})`,
      { status: res.status }
    );
  }
}
async function apiFetch(url, init = {}) {
  const { errorMessage, ...fetchInit } = init;
  const res = await fetch(url, fetchInit);
  const data = await parseJsonResponse(res);
  if (!res.ok) {
    const msg = data && typeof data === "object" && data.error || errorMessage || `Request failed (${res.status})`;
    throw new ApiError(String(msg), { status: res.status, data });
  }
  return data;
}
export {
  ApiError,
  apiFetch,
  parseJsonResponse
};
