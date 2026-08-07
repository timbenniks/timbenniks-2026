import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { E2E_ADMIN_PASSWORD, EXPECTED_PAGE_IDS } from './constants';

export { E2E_ADMIN_PASSWORD as ADMIN_PASSWORD, EXPECTED_PAGE_IDS };

export async function loginViaApi(request: APIRequestContext, password = E2E_ADMIN_PASSWORD) {
  const res = await request.post('/api/admin/login', {
    data: { password },
  });
  expect(res.ok(), `login should succeed (${res.status()})`).toBeTruthy();
  return res;
}

export async function loginViaUi(page: Page, password = E2E_ADMIN_PASSWORD) {
  await page.goto('/admin/login');
  await page.locator('#password').fill(password);
  await page.locator('#login button[type="submit"]').click();
  await expect(page).toHaveURL(/\/admin(?!\/login)/);
}

export async function expectAdminNav(page: Page, active: 'pages' | 'site' | 'media' | 'changes') {
  const nav = page.locator('.dash-nav');
  await expect(nav.getByRole('link', { name: /Pages/ })).toBeVisible();
  await expect(nav.getByRole('link', { name: /Site chrome/ })).toBeVisible();
  await expect(nav.getByRole('link', { name: /Media/ })).toBeVisible();
  await expect(nav.getByRole('link', { name: /Changes/ })).toBeVisible();
  await expect(nav.locator('a.active')).toHaveAttribute(
    'href',
    active === 'pages' ? '/admin' : `/admin/${active}`,
  );
}
