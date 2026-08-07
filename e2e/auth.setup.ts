import { test as setup, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_PASSWORD } from './helpers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '.auth/admin.json');

setup('authenticate admin', async ({ page }) => {
  await page.goto('/admin/login');
  await page.locator('#password').fill(ADMIN_PASSWORD);
  await page.locator('#login button[type="submit"]').click();
  await expect(page).toHaveURL(/\/admin(?!\/login)/);
  await page.context().storageState({ path: authFile });
});
