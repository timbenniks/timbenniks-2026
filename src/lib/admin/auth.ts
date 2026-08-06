import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'tb_admin';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret(): string {
  return process.env.ADMIN_PASSWORD ?? process.env.ADMIN_SECRET ?? '';
}

export function adminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

export function isDevAuthBypass(): boolean {
  return import.meta.env.DEV && !process.env.ADMIN_PASSWORD;
}

function tokenFor(password: string): string {
  return createHmac('sha256', secret() || 'dev').update(password).digest('hex');
}

export function createSessionToken(password: string): string {
  return tokenFor(password);
}

export function verifyPassword(password: string): boolean {
  if (isDevAuthBypass()) return true;
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  try {
    const a = Buffer.from(password);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifySessionToken(token: string | undefined): boolean {
  if (isDevAuthBypass()) return true;
  if (!token || !process.env.ADMIN_PASSWORD) return false;
  const expected = tokenFor(process.env.ADMIN_PASSWORD);
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function readSessionCookie(cookieHeader: string | null): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return match?.[1];
}

export function sessionCookieHeader(token: string): string {
  const secure = import.meta.env.PROD ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`;
}

export function clearSessionCookieHeader(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function isAdminAuthed(request: Request): boolean {
  if (isDevAuthBypass()) return true;
  const token = readSessionCookie(request.headers.get('cookie'));
  return verifySessionToken(token);
}
