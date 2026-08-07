import { test, expect } from '@playwright/test';
import { expectAdminNav } from './helpers';

test.describe('admin site chrome', () => {
  test('loads site editor with nav, newsletter, and footer panels', async ({ page }) => {
    await page.goto('/admin/site');
    await expect(page).toHaveTitle(/Admin · Site chrome/);
    await expectAdminNav(page, 'site');
    await expect(page.locator('#save')).toBeVisible();
    await expect(page.locator('#chip')).toBeVisible();
    await expect(page.locator('#nav')).toBeVisible();
    await expect(page.locator('#newsletter')).toBeVisible();
    await expect(page.locator('#footer')).toBeVisible();
    await expect(page.locator('#note')).toBeVisible();
    await expect(page.locator('#nl-heading')).toBeVisible();
    await expect(page.locator('#footer-human')).toBeVisible();
    await expect(page.locator('#add-nav')).toBeVisible();
    await expect(page.locator('#add-col')).toBeVisible();
  });

  test('editing a field enables Save', async ({ page }) => {
    await page.goto('/admin/site');
    await expect(page.locator('#nl-heading')).toBeVisible();
    const heading = page.locator('#nl-heading');
    const current = await heading.inputValue();
    await heading.fill(`${current} `);
    await expect(page.locator('#save')).toBeEnabled();
    // Restore without saving so local content stays clean.
    await heading.fill(current);
  });

  test('add nav link creates a row', async ({ page }) => {
    await page.goto('/admin/site');
    const before = await page.locator('#nav-rows > *').count();
    await page.locator('#add-nav').click();
    await expect(page.locator('#nav-rows > *')).toHaveCount(before + 1);
    await expect(page.locator('#save')).toBeEnabled();
  });
});
