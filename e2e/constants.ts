/** Shared e2e constants (kept out of playwright.config to avoid circular imports). */
export const E2E_ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'e2e-admin-password';

export const EXPECTED_PAGE_IDS = [
  'home',
  'about',
  'videos',
  'writing',
  'speaking',
  'projects',
  'uses',
  'press-kit',
] as const;
