import { test, expect } from '@playwright/test';
import { expectAdminNav } from './helpers';

test.describe('admin changes', () => {
  test('loads changes desk with publish controls', async ({ page }) => {
    await page.goto('/admin/changes');
    await expect(page).toHaveTitle(/Admin · Changes/);
    await expectAdminNav(page, 'changes');
    await expect(page.getByRole('heading', { name: 'Changes', exact: true })).toBeVisible();
    await expect(page.locator('#publish-panel')).toBeVisible();
    await expect(page.locator('#commit-msg')).toBeVisible();
    await expect(page.locator('#publish')).toBeVisible();
    await expect(page.locator('#discard')).toBeVisible();
  });

  test('shows GitHub config banner when token is unset', async ({ page }) => {
    await page.goto('/admin/changes');
    // webServer clears GITHUB_TOKEN / GITHUB_REPO for safe e2e runs.
    await expect(page.locator('#config-banner')).toBeVisible();
    await expect(page.locator('#config-banner')).toContainText('GITHUB_TOKEN');
  });

  test('status settles after compare load', async ({ page }) => {
    await page.goto('/admin/changes');
    await expect(page.locator('#status')).not.toHaveText('Loading compare…', {
      timeout: 15_000,
    });
  });

  test('does not enable publish without GitHub config', async ({ page }) => {
    await page.goto('/admin/changes');
    await expect(page.locator('#status')).not.toHaveText('Loading compare…', {
      timeout: 15_000,
    });
    // Without GitHub, publish/discard must stay disabled — never click them in e2e.
    await expect(page.locator('#publish')).toBeDisabled();
    await expect(page.locator('#discard')).toBeDisabled();
  });
});
