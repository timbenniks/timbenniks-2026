import type { APIRoute } from 'astro';
import {
  createSessionToken,
  sessionCookieHeader,
  verifyPassword,
  isDevAuthBypass,
} from '../../../lib/admin/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const body = (await request.json().catch(() => ({}))) as { password?: string };
  if (isDevAuthBypass() || verifyPassword(body.password ?? '')) {
    const token = createSessionToken(body.password ?? 'dev');
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': sessionCookieHeader(token),
      },
    });
  }
  return new Response(JSON.stringify({ error: 'Invalid password' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
};
