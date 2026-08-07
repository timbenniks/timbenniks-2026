import { test, expect } from '@playwright/test';
import { EXPECTED_PAGE_IDS, expectAdminNav } from './helpers';

test.describe('admin pages desk', () => {
  test('loads workspace nav and pages list', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveTitle(/Admin · Pages/);
    await expectAdminNav(page, 'pages');
    await expect(page.getByRole('heading', { name: 'Pages', exact: true })).toBeVisible();
    await expect(page.locator('#pages-overview')).toBeVisible();
  });

  test('lists all known page shells with edit links', async ({ page }) => {
    await page.goto('/admin');
    for (const id of EXPECTED_PAGE_IDS) {
      const row = page.locator(`[data-page-id="${id}"]`);
      await expect(row, id).toBeVisible();
      await expect(row.locator(`a.page-edit-layout[href="/admin/pages/${id}"]`)).toBeVisible();
    }
  });

  test('sidebar navigates to every admin desk', async ({ page }) => {
    await page.goto('/admin');

    await page.locator('.dash-nav a[href="/admin/site"]').click();
    await expect(page).toHaveURL(/\/admin\/site/);
    await expectAdminNav(page, 'site');

    await page.locator('.dash-nav a[href="/admin/media"]').click();
    await expect(page).toHaveURL(/\/admin\/media/);
    await expectAdminNav(page, 'media');

    await page.locator('.dash-nav a[href="/admin/changes"]').click();
    await expect(page).toHaveURL(/\/admin\/changes/);
    await expectAdminNav(page, 'changes');

    await page.locator('.dash-nav a[href="/admin"]').click();
    await expect(page).toHaveURL(/\/admin\/?$/);
    await expectAdminNav(page, 'pages');
  });

  test('new page form auto-fills path from id', async ({ page }) => {
    await page.goto('/admin');
    await page.locator('details.create').locator('summary').click();
    await page.locator('#new-id').fill('e2e-demo-page');
    await expect(page.locator('#new-path')).toHaveValue('/e2e-demo-page');
    await expect(page.locator('#create')).toBeVisible();
  });

  test('create page rejects empty fields', async ({ page }) => {
    await page.goto('/admin');
    await page.locator('details.create').locator('summary').click();
    await page.locator('#create').click();
    await expect(page.locator('#create-err')).not.toBeEmpty();
  });

  test('create page rejects reserved path', async ({ page }) => {
    await page.goto('/admin');
    await page.locator('details.create').locator('summary').click();
    await page.locator('#new-id').fill('admin');
    await page.locator('#new-path').fill('/admin');
    await page.locator('#new-path').dispatchEvent('input');
    await page.locator('#new-title').fill('Should fail');
    await page.locator('#create').click();
    await expect(page.locator('#create-err')).not.toBeEmpty();
    await expect(page).toHaveURL(/\/admin\/?$/);
  });

  test('hub expand loads nested content for writing', async ({ page }) => {
    await page.goto('/admin');
    const writing = page.locator('[data-page-id="writing"]');
    await writing.locator('[data-expand]').click();
    const panel = page.locator('#panel-writing');
    await expect(panel).toBeVisible();
    await expect(panel.locator('[data-list] li').first()).toBeVisible({ timeout: 15_000 });
  });

  test('content stub route renders reserved message', async ({ page }) => {
    await page.goto('/admin/content/writing/some-post');
    await expect(page.getByRole('heading', { name: 'Content editing' })).toBeVisible();
    await expect(page.getByText(/isn’t available yet|isn't available yet/)).toBeVisible();
    await expect(page.getByRole('link', { name: /Back to Pages/ })).toHaveAttribute(
      'href',
      '/admin',
    );
  });
});
