import { existsSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test('built routing has no middleware or dynamic 404 route', () => {
  const config = JSON.parse(readFileSync('.vercel/output/config.json', 'utf8'));
  expect(existsSync('middleware.ts')).toBe(false);
  expect(config.routes.some((route: any) => route.middlewarePath)).toBe(false);
  const filesystem = config.routes.findIndex((route: any) => route.handle === 'filesystem');
  const about = config.routes.findIndex((route: any) => route.src === '^/about$' && route.dest === '/about.md');
  expect(about).toBeGreaterThan(-1);
  expect(about).toBeLessThan(filesystem);
  expect(config.routes.filter((route: any) => route.status === 404).every((route: any) => ['/404.md', '/404.html'].includes(route.dest))).toBe(true);
  expect(config.routes.filter((route: any) => route.dest === '_render').some((route: any) => /404/.test(route.src))).toBe(false);
});

test('every built Markdown twin negotiates statically', async ({ request }) => {
  const config = JSON.parse(readFileSync('.vercel/output/config.json', 'utf8'));
  const twins = config.routes.filter((route: any) => route.has?.some((condition: any) => condition.value === '.*text/markdown.*'));
  expect(twins.length).toBeGreaterThan(100);
  for (const twin of twins) {
    const path = twin.dest === '/index.md' ? '/' : twin.dest.slice(0, -3);
    const response = await request.get(path, { headers: { Accept: 'text/markdown' } });
    expect(response.status(), path).toBe(200);
    expect(response.headers()['content-type'], path).toContain('text/markdown');
    expect(response.headers()['x-preview-runtime'], path).toBe('static');
    expect(await response.text(), path).toBe(readFileSync(`.vercel/output/static${twin.dest}`, 'utf8'));
  }
});

test('HTML, Markdown, missing assets and missing pages never invoke a function', async ({ request }) => {
  for (const path of ['/', '/about', '/about.md', '/search', '/writing', '/writing/tag/ai-engineering']) {
    const response = await request.get(path, { headers: { Accept: 'text/html' } });
    expect(response.status(), path).toBe(200);
    expect(response.headers()['x-preview-runtime'], path).toBe('static');
  }
  for (const path of ['/404.md', '/missing-page', '/writing/no-such-article', '/images/marathon.jpg', '/missing.js']) {
    for (const accept of ['text/html', 'text/markdown', '*/*', 'application/json', '']) {
      const response = await request.get(path, { headers: { Accept: accept } });
      expect(response.status(), `${path} ${accept}`).toBe(404);
      expect(response.headers()['x-preview-runtime']).toBe('static');
      expect(response.headers()['content-type']).toContain(path === '/404.md' || accept !== 'text/html' ? 'text/markdown' : 'text/html');
      expect(response.headers()['vary']).toContain('Accept');
    }
  }
});

test('API errors and admin authentication still reach the server', async ({ request }) => {
  const api = await request.get('/api/v1/does-not-exist', { headers: { Accept: 'text/markdown' } });
  expect(api.status()).toBe(404);
  expect(api.headers()['content-type']).toContain('application/problem+json');
  expect(api.headers()['x-preview-runtime']).toBe('function');
  const admin = await request.get('/admin', { maxRedirects: 0, headers: { Accept: 'text/markdown' } });
  expect(admin.status()).toBe(302);
  expect(admin.headers()['location']).toContain('/admin/login');
  const privateApi = await request.get('/api/admin/pages');
  expect(privateApi.status()).toBe(401);
});
