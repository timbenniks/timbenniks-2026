import { siteUrl } from '../data/site';

export const API_VERSION = '1';
export const RATE_LIMIT_QUOTA = 120;
export const RATE_LIMIT_WINDOW_SECONDS = 60;

type RateWindow = { startedAt: number; used: number };
const windows = new Map<string, RateWindow>();

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  resolution: string;
}

export function enumQuery(
  url: URL,
  name: string,
  allowed: readonly string[],
): string | undefined {
  const value = url.searchParams.get(name)?.trim();
  if (!value) return undefined;
  if (!allowed.includes(value)) throw new Error(`${name} must be one of: ${allowed.join(', ')}`);
  return value;
}

export function integerQuery(
  url: URL,
  name: string,
  minimum: number,
  maximum: number,
): number | undefined {
  const raw = url.searchParams.get(name)?.trim();
  if (!raw) return undefined;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be an integer`);
  const value = Number(raw);
  if (value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
  return value;
}

export function yearQuery(url: URL): string | undefined {
  const year = url.searchParams.get('year')?.trim();
  if (!year) return undefined;
  if (!/^\d{4}$/.test(year)) throw new Error('year must be a four-digit year');
  return year;
}

function clientKey(request: Request): string {
  return (
    request.headers.get('x-vercel-forwarded-for') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'anonymous'
  );
}

function rateLimit(request: Request): { remaining: number; reset: number; limited: boolean } {
  const now = Date.now();
  const key = clientKey(request);
  const current = windows.get(key);
  const expired = !current || now - current.startedAt >= RATE_LIMIT_WINDOW_SECONDS * 1000;
  const window = expired ? { startedAt: now, used: 0 } : current;

  window.used += 1;
  windows.set(key, window);

  // Keep a warm serverless instance from retaining unbounded client keys.
  if (windows.size > 10_000) {
    for (const [candidate, value] of windows) {
      if (now - value.startedAt >= RATE_LIMIT_WINDOW_SECONDS * 1000) windows.delete(candidate);
    }
  }

  return {
    remaining: Math.max(0, RATE_LIMIT_QUOTA - window.used),
    reset: Math.max(1, Math.ceil((window.startedAt + RATE_LIMIT_WINDOW_SECONDS * 1000 - now) / 1000)),
    limited: window.used > RATE_LIMIT_QUOTA,
  };
}

function apiHeaders(limit: { remaining: number; reset: number }): Headers {
  return new Headers({
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'API-Version, RateLimit, RateLimit-Policy, Retry-After',
    'API-Version': API_VERSION,
    'RateLimit-Policy': `"public";q=${RATE_LIMIT_QUOTA};w=${RATE_LIMIT_WINDOW_SECONDS}`,
    RateLimit: `"public";r=${limit.remaining};t=${limit.reset}`,
    Link: `<${siteUrl('/developers')}>; rel="service-doc", <${siteUrl('/openapi.json')}>; rel="service-desc"; type="application/vnd.oai.openapi+json;version=3.1"`,
  });
}

export function problem(
  request: Request,
  status: number,
  code: string,
  title: string,
  detail: string,
  resolution: string,
  limit = rateLimit(request),
): Response {
  const body: ProblemDetails = {
    type: siteUrl(`/developers#${code.toLowerCase().replaceAll('_', '-')}`),
    title,
    status,
    detail,
    instance: new URL(request.url).pathname,
    code,
    resolution,
  };
  const headers = apiHeaders(limit);
  headers.set('Content-Type', 'application/problem+json; charset=utf-8');
  if (status === 429) headers.set('Retry-After', String(limit.reset));
  return new Response(`${JSON.stringify(body)}\n`, { status, headers });
}

export function publicApiResponse(
  request: Request,
  data: unknown,
  status = 200,
  limit = rateLimit(request),
): Response {
  if (limit.limited) {
    return problem(
      request,
      429,
      'RATE_LIMIT_EXCEEDED',
      'Rate limit exceeded',
      `The public API allows ${RATE_LIMIT_QUOTA} requests per ${RATE_LIMIT_WINDOW_SECONDS} seconds per client.`,
      'Wait for the number of seconds in Retry-After, then retry at a lower rate.',
      limit,
    );
  }

  const headers = apiHeaders(limit);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(`${JSON.stringify(data)}\n`, { status, headers });
}

export function methodNotAllowed(request: Request, allow = 'GET'): Response {
  const response = problem(
    request,
    405,
    'METHOD_NOT_ALLOWED',
    'Method not allowed',
    `${request.method} is not supported for this endpoint.`,
    `Retry this endpoint with ${allow}.`,
  );
  response.headers.set('Allow', allow);
  return response;
}

export async function publicApiHandler(
  request: Request,
  handler: () => Promise<unknown> | unknown,
): Promise<Response> {
  const limit = rateLimit(request);
  if (limit.limited) {
    return problem(
      request,
      429,
      'RATE_LIMIT_EXCEEDED',
      'Rate limit exceeded',
      `The public API allows ${RATE_LIMIT_QUOTA} requests per ${RATE_LIMIT_WINDOW_SECONDS} seconds per client.`,
      'Wait for the number of seconds in Retry-After, then retry at a lower rate.',
      limit,
    );
  }

  try {
    return publicApiResponse(request, await handler(), 200, limit);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'The request could not be completed.';
    const notFound = /unknown|missing|not found/i.test(detail);
    return problem(
      request,
      notFound ? 404 : 400,
      notFound ? 'RESOURCE_NOT_FOUND' : 'INVALID_REQUEST',
      notFound ? 'Resource not found' : 'Invalid request',
      detail,
      notFound
        ? 'Use GET /api/v1/search or GET /api/v1/content to discover a valid content path.'
        : 'Check the parameter descriptions in /openapi.json and retry with valid values.',
      limit,
    );
  }
}
