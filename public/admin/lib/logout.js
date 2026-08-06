/** Shared admin logout button binder. */

export function bindAdminLogout(selector = '#logout') {
  document.querySelector(selector)?.addEventListener('click', async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch {
      // still redirect
    }
    location.href = '/admin/login';
  });
}
