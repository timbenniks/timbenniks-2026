/**
 * Bundle @comark/html (+ breaks/security plugins) for public/admin ESM.
 * Run: npm run vendor:comark
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const entry = join(root, 'scripts/comark-browser-entry.mjs');
const outfile = join(root, 'public/admin/vendor/comark-html.esm.js');

const result = spawnSync(
  'npx',
  [
    '--yes',
    'esbuild',
    entry,
    '--bundle',
    '--format=esm',
    '--platform=browser',
    '--target=es2022',
    '--minify',
    `--outfile=${outfile}`,
  ],
  { cwd: root, stdio: 'inherit' },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
console.log('wrote', outfile);
