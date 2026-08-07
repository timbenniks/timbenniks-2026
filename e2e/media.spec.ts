import { test, expect } from '@playwright/test';
import { expectAdminNav } from './helpers';

test.describe('admin media', () => {
  test('loads media library shell', async ({ page }) => {
    await page.goto('/admin/media');
    await expect(page).toHaveTitle(/Admin · Media/);
    await expectAdminNav(page, 'media');
    await expect(page.getByRole('heading', { name: 'Media', exact: true })).toBeVisible();
    await expect(page.locator('#media-dam')).toBeVisible();
    await expect(page.locator('#media-chip')).toBeVisible();
  });

  test('media picker mounts manage UI', async ({ page }) => {
    await page.goto('/admin/media');
    // Picker may show assets, empty state, or an error if Cloudinary env is missing —
    // the mount itself must still render interactive chrome.
    const dam = page.locator('#media-dam');
    await expect(dam).toBeVisible();
    await expect
      .poll(async () => dam.innerHTML(), { timeout: 15_000 })
      .not.toBe('');
  });
});
