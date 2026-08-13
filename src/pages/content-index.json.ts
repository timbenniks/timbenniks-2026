import type { APIRoute } from 'astro';
import { jsonResponse } from '../lib/markdown';
import { buildAgentIndex } from '../lib/agent-index';

export const GET: APIRoute = async () => jsonResponse(await buildAgentIndex());
