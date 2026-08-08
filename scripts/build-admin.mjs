/**
 * Compile admin client sources from src/admin-client/ to browser ESM in public/admin/.
 *
 * File layout is preserved 1:1 so emitted URLs stay stable: BaseLayout imports
 * `/admin/bridge.js` at runtime, the admin pages reference `/admin/*.js` with
 * `is:inline`, and the e2e specs hit those paths. Nothing here is bundled —
 * each module keeps its import statements.
 *
 * Previous output is removed before every build so a renamed or deleted source
 * cannot leave a stale module behind for a script tag to keep loading. Only
 * files carrying the banner below are removed; `vendor/` (hand-vendored
 * third-party bundles) and the admin CSS are left alone.
 *
 * Run: npm run build:admin   ·   watch: npm run dev:admin
 */
import { build, context } from 'esbuild';
import { readdir, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src/admin-client');
const outDir = join(root, 'public/admin');
const banner = '// Generated from src/admin-client by `npm run build:admin` — do not edit.';

async function findSources(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await findSources(full)));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) found.push(full);
  }
  return found;
}

/** Delete every previously emitted .js (and its .js.map) under `dir`. */
async function cleanEmitted(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return 0;
    throw err;
  }
  let removed = 0;
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'vendor') removed += await cleanEmitted(full);
      continue;
    }
    if (!entry.name.endsWith('.js')) continue;
    const head = await readFile(full, 'utf8').then((text) => text.slice(0, banner.length));
    if (head !== banner) continue;
    await rm(full, { force: true });
    await rm(`${full}.map`, { force: true });
    removed += 1;
  }
  return removed;
}

const watch = process.argv.includes('--watch');
const cleaned = await cleanEmitted(outDir);
if (cleaned) console.log(`[build:admin] removed ${cleaned} previously generated file(s)`);

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: await findSources(srcDir),
  outdir: outDir,
  outbase: srcDir,
  bundle: false,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
  banner: { js: banner },
};

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  console.log('[build:admin] watching src/admin-client for changes…');
} else {
  await build(options);
}
