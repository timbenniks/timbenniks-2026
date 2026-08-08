import { createHmac, timingSafeEqual } from 'node:crypto';
import { serverEnv } from './server-env';

const COOKIE = 'tb_admin';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function adminPassword(): string {
  return serverEnv('ADMIN_PASSWORD');
}

function secret(): string {
  return adminPassword() || serverEnv('ADMIN_SECRET');
}

export function adminPasswordConfigured(): boolean {
  return Boolean(adminPassword());
}

export function isDevAuthBypass(): boolean {
  return import.meta.env.DEV && !adminPassword();
}

function tokenFor(password: string): string {
  return createHmac('sha256', secret() || 'dev').update(password).digest('hex');
}

export function createSessionToken(password: string): string {
  return tokenFor(password);
}

export function verifyPassword(password: string): boolean {
  if (isDevAuthBypass()) return true;
  const expected = adminPassword();
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
  const password = adminPassword();
  if (!token || !password) return false;
  const expected = tokenFor(password);
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
