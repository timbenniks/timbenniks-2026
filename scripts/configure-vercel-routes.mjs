/** Keep content negotiation and missing URLs on the CDN, without middleware. */
import { readFile, readdir, writeFile, access } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const vary = { Vary: 'Accept, Accept-Encoding' };

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  }));
  return nested.flat();
}

export async function configureVercelRoutes(root = process.cwd()) {
  const output = resolve(root, '.vercel/output');
  const staticDir = resolve(output, 'static');
  const configPath = resolve(output, 'config.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const filesystem = config.routes.findIndex((route) => route.handle === 'filesystem');
  const fallback = config.routes.findIndex((route) => route.status === 404 && route.dest === '/404.html');
  if (filesystem < 0 || fallback < filesystem) {
    throw new Error('Astro routing changed: expected a filesystem phase followed by a static 404 fallback.');
  }
  await Promise.all(['404.html', '404.md'].map((file) => access(resolve(staticDir, file))));
  const files = new Set((await filesIn(staticDir)).map((file) => relative(staticDir, file).split(sep).join('/')));
  const twins = [];
  for (const file of [...files].sort()) {
    if (!file.endsWith('.md') || file === '404.md') continue;
    const stem = file.slice(0, -3);
    const path = stem === 'index' ? '/' : `/${stem}`;
    const html = stem === 'index' ? 'index.html' : `${stem}/index.html`;
    if (!files.has(html) && !files.has(`${stem}.html`)) continue;
    twins.push({
      src: `^${escapeRegex(path)}$`,
      has: [{ type: 'header', key: 'accept', value: '.*text/markdown.*' }],
      dest: `/${file}`,
      headers: { ...vary, 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  }
  if (!twins.some((route) => route.src === '^/$')) throw new Error('Missing homepage Markdown twin.');

  const markdown404 = {
    src: '^/404\\.md$',
    dest: '/404.md',
    status: 404,
    headers: { ...vary, 'Content-Type': 'text/markdown; charset=utf-8' },
  };
  // Match only after static files and real function routes (including API errors).
  config.routes.splice(fallback, 1,
    { ...markdown404, src: '^/.*$', missing: [{ type: 'header', key: 'accept', value: '.*text/html.*' }] },
    { src: '^/.*$', dest: '/404.html', status: 404, headers: { ...vary, 'Content-Type': 'text/html; charset=utf-8' } },
  );
  // A direct /404.md request must also retain its status before filesystem serving.
  // These must precede the filesystem phase; vercel.json rewrites run too late.
  config.routes.splice(filesystem, 0, markdown404, ...twins);
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`[routing] ${twins.length} static Markdown twins; static HTML/Markdown 404s; no routing middleware`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await configureVercelRoutes();
