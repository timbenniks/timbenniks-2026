/**
 * Read a server-side env var from `.env` / the host environment.
 *
 * In `astro dev`, Astro inlines secrets onto `import.meta.env` but does **not**
 * copy them onto `process.env` (that only happens during `astro build`). Code
 * that only reads `process.env` therefore thinks vars like `ADMIN_PASSWORD` and
 * `GITHUB_TOKEN` are missing — auth falls into the “dev bypass”, publish looks
 * unconfigured, etc.
 *
 * Prefer this helper (or `process.env` after `astro.config` seeds it via
 * `loadEnv`) for any secret used by admin server modules.
 */
export function serverEnv(name: string): string {
  const fromProcess = process.env[name]?.trim() || '';
  if (fromProcess) return fromProcess;
  return String(import.meta.env[name] ?? '').trim();
}
