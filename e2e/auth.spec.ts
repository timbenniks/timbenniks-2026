import { test, expect } from '@playwright/test';
import { ADMIN_PASSWORD, loginViaUi } from './helpers';

test.describe('admin auth', () => {
  // These tests need a clean session (no storageState).
  test.use({ storageState: { cookies: [], origins: [] } });

  test('unauthenticated /admin redirects to login with next', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin/);
    await expect(page.locator('#login')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Admin login' })).toBeVisible();
  });

  test('unauthenticated nested admin route redirects with next', async ({ page }) => {
    await page.goto('/admin/site');
    await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fsite/);
  });

  test('admin APIs return 401 without session', async ({ request }) => {
    const endpoints = [
      '/api/admin/pages',
      '/api/admin/site',
      '/api/admin/changes',
      '/api/admin/content/writing',
      '/api/admin/cloudinary/search',
    ];
    for (const url of endpoints) {
      const res = await request.get(url);
      expect(res.status(), url).toBe(401);
    }
  });

  test('invalid password shows error and stays on login', async ({ page }) => {
    await page.goto('/admin/login');
    await page.locator('#password').fill('wrong-password');
    await page.locator('#login button[type="submit"]').click();
    await expect(page.locator('#err')).toHaveText('Invalid password');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('valid password signs in and lands on pages desk', async ({ page }) => {
    await loginViaUi(page);
    await expect(page.getByRole('heading', { name: 'Pages', exact: true })).toBeVisible();
    await expect(page.locator('#pages-overview')).toBeVisible();
  });

  test('login honors next query param', async ({ page }) => {
    await page.goto('/admin/login?next=%2Fadmin%2Fmedia');
    await page.locator('#password').fill(ADMIN_PASSWORD);
    await page.locator('#login button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin\/media/);
  });

  test('logout clears session and blocks admin', async ({ page }) => {
    await loginViaUi(page);
    await page.locator('#logout').click();
    await expect(page).toHaveURL(/\/admin\/login/);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
