import { test, expect } from '@playwright/test';

test.describe('admin visual page editor', () => {
  test('opens home editor with chrome and preview iframe', async ({ page }) => {
    await page.goto('/admin/pages/home');
    await expect(page).toHaveTitle(/Edit · home/);
    await expect(page.locator('.topbar')).toBeVisible();
    await expect(page.locator('.brand h1')).toHaveText('home');
    await expect(page.locator('a.back[href="/admin"]')).toBeVisible();
    await expect(page.locator('#save')).toBeVisible();
    await expect(page.locator('#dirty-chip')).toBeVisible();
    await expect(page.locator('#frame')).toHaveAttribute('src', /\/admin\/preview\/home\?edit=1/);
    await expect(page.locator('#sections')).toBeVisible();
    await expect(page.locator('#add-kind')).toBeVisible();
    await expect(page.locator('#add-section')).toBeVisible();
  });

  test('device width controls toggle preview frame class', async ({ page }) => {
    await page.goto('/admin/pages/about');
    const frame = page.locator('#preview-frame');
    await expect(frame).toHaveClass(/is-full/);

    await page.locator('[data-device="desktop"]').click();
    await expect(frame).toHaveClass(/is-desktop/);

    await page.locator('[data-device="mobile"]').click();
    await expect(frame).toHaveClass(/is-mobile/);

    await page.locator('[data-device="full"]').click();
    await expect(frame).toHaveClass(/is-full/);
  });

  test('unknown page id redirects to pages desk', async ({ page }) => {
    await page.goto('/admin/pages/does-not-exist-e2e');
    await expect(page).toHaveURL(/\/admin\/?$/);
  });

  test('preview route renders editable page', async ({ page }) => {
    await page.goto('/admin/preview/home?edit=1');
    // Preview is the public page shell with edit markup; body should render.
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('html')).toBeVisible();
  });

  test('editor marks dirty when a section field is edited', async ({ page }) => {
    await page.goto('/admin/pages/home');
    await expect(page.locator('#sections li').first()).toBeVisible({ timeout: 15_000 });
    await page.locator('#sections li').first().click();
    const field = page.locator('#section-fields input, #section-fields textarea').first();
    await expect(field).toBeVisible({ timeout: 10_000 });
    await field.fill(`e2e-dirty-${Date.now()}`);
    await expect(page.locator('#dirty-chip')).toHaveText('Unsaved');
    await expect(page.locator('#save')).toBeEnabled();
  });
});
