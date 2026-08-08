/**
 * WebMCP tools for the /admin pages desk (lifecycle + ship + site only).
 *
 * The desk surface is the `surface: 'desk' | 'both'` slice of lib/tools.ts.
 */
import { installDeskFacade } from './desk-facade.js';
import { registerWebMcpTools } from './lib/tools.js';

function boot(): void {
  installDeskFacade();
  registerWebMcpTools('desk');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
