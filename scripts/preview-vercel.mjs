/** Local verification of built static routing + the real Astro function.
 * Uses Vercel's route merger; this is a test harness, not a Vercel CDN emulator.
 */
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getTransformedRoutes, mergeRoutes } from '@vercel/routing-utils';

const root = resolve('.vercel/output');
const staticRoot = resolve(root, 'static');
const built = JSON.parse(await readFile(resolve(root, 'config.json'), 'utf8'));
const project = JSON.parse(await readFile('vercel.json', 'utf8'));
const transformed = getTransformedRoutes(project);
if (transformed.error) throw new Error(transformed.error.message);
const routes = mergeRoutes({ userRoutes: transformed.routes, builds: [{ use: '@astrojs/vercel', entrypoint: '.', routes: built.routes }] });
const files = new Set((await readdir(staticRoot, { recursive: true, withFileTypes: true }))
  .filter((file) => file.isFile())
  .map((file) => `/${relative(staticRoot, resolve(file.parentPath, file.name))}`));
const mime = { '.html': 'text/html; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };

function staticFile(path) {
  return [path, `${path}.html`, `${path.replace(/\/$/, '')}/index.html`].find((candidate) => files.has(candidate));
}

function matches(condition, request) {
  if (condition.type !== 'header') throw new Error(`Unsupported test condition: ${condition.type}`);
  const value = request.headers.get(condition.key);
  return value !== null && (!condition.value || new RegExp(`^(?:${condition.value})$`).test(value));
}

let renderer;
async function respond(request) {
  const path = decodeURI(new URL(request.url).pathname);
  const headers = new Headers();
  async function serve(file, status = 200) {
    headers.set('Content-Type', headers.get('Content-Type') ?? mime[extname(file)] ?? 'application/octet-stream');
    headers.set('X-Preview-Runtime', 'static');
    return new Response(await readFile(resolve(staticRoot, `.${file}`)), { status, headers });
  }
  for (const route of routes) {
    if (route.middlewarePath) throw new Error('Routing middleware unexpectedly present');
    if (route.handle) {
      if (route.handle !== 'filesystem') throw new Error(`Unsupported test phase: ${route.handle}`);
      const file = staticFile(path);
      if (file) return serve(file);
      continue;
    }
    const regex = new RegExp(route.src);
    if (!regex.test(path) || (route.methods && !route.methods.includes(request.method))) continue;
    if (route.has?.some((condition) => !matches(condition, request))) continue;
    if (route.missing?.some((condition) => matches(condition, request))) continue;
    for (const [key, value] of Object.entries(route.headers ?? {})) headers.set(key, path.replace(regex, value));
    if (route.status >= 300 && route.status < 400) return new Response(null, { status: route.status, headers });
    if (route.continue) continue;
    const dest = route.dest && path.replace(regex, route.dest);
    if (dest === '_render' || dest === '/_render') {
      if (!renderer) {
        const functionDir = resolve(root, 'functions/_render.func');
        const runtime = JSON.parse(await readFile(resolve(functionDir, '.vc-config.json'), 'utf8'));
        renderer = (await import(pathToFileURL(resolve(functionDir, runtime.handler)).href)).default;
      }
      const response = await renderer.fetch(request);
      for (const [key, value] of headers) if (!response.headers.has(key)) response.headers.set(key, value);
      response.headers.set('X-Preview-Runtime', 'function');
      return response;
    }
    const file = dest && staticFile(dest);
    if (file) return serve(file, route.status ?? 200);
    if (route.check) continue;
    throw new Error(`Unresolved route: ${JSON.stringify(route)}`);
  }
  throw new Error(`No route for ${path}`);
}

const server = createServer(async (req, res) => {
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const request = new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method, headers: req.headers,
      ...(body.length ? { body, duplex: 'half' } : {}),
    });
    const response = await respond(request);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(req.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    res.writeHead(500);
    res.end('Build preview failed');
  }
});
server.listen(Number(process.env.PORT ?? 4338), '127.0.0.1', () => console.log('Built Vercel preview listening on', server.address()));
