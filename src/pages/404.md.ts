import type { APIRoute } from 'astro';
import { NEGOTIATION_VARY, notFoundMarkdownBody } from '../lib/not-found-markdown';

export const GET: APIRoute = () => {
  return new Response(notFoundMarkdownBody(), {
    status: 404,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      Vary: NEGOTIATION_VARY,
    },
  });
};
