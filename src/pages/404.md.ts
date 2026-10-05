import type { APIRoute } from 'astro';
import { NEGOTIATION_VARY, notFoundMarkdownBody } from '../lib/not-found-markdown';

// The build routing step preserves the 404 status when serving this static body.
export const prerender = true;

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
