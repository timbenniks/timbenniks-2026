import { test, expect } from '@playwright/test';

/**
 * Smoke coverage for authenticated admin APIs used by the UI.
 * Avoids mutating content / publishing.
 */
test.describe('admin APIs (authenticated)', () => {
  test('GET /api/admin/pages lists pages', async ({ request }) => {
    const res = await request.get('/api/admin/pages');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.pages)).toBeTruthy();
    expect(body.pages.some((p: { id: string }) => p.id === 'home')).toBeTruthy();
  });

  test('GET /api/admin/pages/home returns page document', async ({ request }) => {
    const res = await request.get('/api/admin/pages/home');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.id).toBe('home');
    expect(body.page?.metadata).toBeTruthy();
  });

  test('GET /api/admin/site returns site chrome', async ({ request }) => {
    const res = await request.get('/api/admin/site');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.site).toBeTruthy();
  });

  test('GET /api/admin/changes returns published baseline', async ({ request }) => {
    const res = await request.get('/api/admin/changes');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.pages).toBeTruthy();
    expect(body.site).toBeTruthy();
    // e2e clears GitHub token — still returns baseline from filesystem
    expect(body.configured).toBe(false);
  });

  test('GET /api/admin/content/writing returns hub items', async ({ request }) => {
    const res = await request.get('/api/admin/content/writing');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.items)).toBeTruthy();
  });

  test('POST create page rejects reserved id without writing', async ({ request }) => {
    const res = await request.post('/api/admin/pages', {
      data: { id: 'admin', path: '/admin', title: 'Nope' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});
