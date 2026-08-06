import type { APIRoute } from 'astro';
import { isAdminAuthed } from '../../../../lib/admin/auth';

export const prerender = false;

const DEFAULT_MODEL = 'gpt-4.1';
const MAX_MESSAGES = 40;

type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: unknown;
  tool_call_id?: string;
  name?: string;
};

function openaiKey(): string {
  const fromProcess = process.env.OPENAI_API_KEY?.trim() || '';
  const fromVite = String(import.meta.env.OPENAI_API_KEY || '').trim();
  return fromProcess || fromVite;
}

export const GET: APIRoute = async ({ request }) => {
  if (!isAdminAuthed(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  return new Response(
    JSON.stringify({
      enabled: Boolean(openaiKey()),
      model:
        process.env.OPENAI_WEBMCP_MODEL?.trim() ||
        String(import.meta.env.OPENAI_WEBMCP_MODEL || '').trim() ||
        DEFAULT_MODEL,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
};

export const POST: APIRoute = async ({ request }) => {
  if (!isAdminAuthed(request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const key = openaiKey();
  if (!key) {
    return new Response(
      JSON.stringify({
        error: 'OPENAI_API_KEY is not configured on the server',
      }),
      { status: 503 },
    );
  }

  let body: {
    messages?: ChatMessage[];
    tools?: unknown[];
    model?: string;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
  if (!messages.length) {
    return new Response(JSON.stringify({ error: 'messages required' }), { status: 400 });
  }

  const model =
    (typeof body.model === 'string' && body.model.trim()) ||
    process.env.OPENAI_WEBMCP_MODEL?.trim() ||
    String(import.meta.env.OPENAI_WEBMCP_MODEL || '').trim() ||
    DEFAULT_MODEL;

  const payload: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.4,
  };
  if (Array.isArray(body.tools) && body.tools.length) {
    payload.tools = body.tools;
    payload.tool_choice = 'auto';
  }

  const baseUrl = (
    process.env.OPENAI_BASE_URL ||
    String(import.meta.env.OPENAI_BASE_URL || '') ||
    'https://api.openai.com/v1'
  ).replace(/\/$/, '');

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const cause = err instanceof Error ? (err as Error & { cause?: unknown }).cause : null;
    const code =
      cause && typeof cause === 'object' && 'code' in cause
        ? String((cause as { code?: string }).code)
        : '';
    const hostname =
      cause && typeof cause === 'object' && 'hostname' in cause
        ? String((cause as { hostname?: string }).hostname)
        : '';
    const hint =
      code === 'ENOTFOUND'
        ? ` DNS lookup failed for ${hostname || 'OpenAI host'}. If Astro was started from a restricted Cursor terminal, restart it in your own terminal (or with full network).`
        : '';
    return new Response(
      JSON.stringify({
        error: `OpenAI request failed: ${err instanceof Error ? err.message : String(err)}.${hint}`,
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: { message: text.slice(0, 500) } };
  }

  if (!res.ok) {
    const errMsg =
      (data as { error?: { message?: string } })?.error?.message ||
      `OpenAI error ${res.status}`;
    return new Response(JSON.stringify({ error: errMsg, details: data }), {
      status: res.status >= 400 && res.status < 600 ? res.status : 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
};
