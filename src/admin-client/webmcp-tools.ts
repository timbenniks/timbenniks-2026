/**
 * WebMCP tool registration for the visual page editor.
 * Works with:
 * - Native Chrome WebMCP (`document.modelContext`, `navigator.modelContext` alias) + Inspector
 * - @mcp-b/global polyfill (`document.modelContext`) + MCP-B extension / embedded agent
 *
 * The tools themselves are declared once in lib/tools.ts.
 */
import { registerWebMcpTools } from './lib/tools.js';

function boot(): void {
  if (window.__tbVisualEditor) {
    registerWebMcpTools('editor');
    return;
  }
  window.addEventListener(
    'tb-visual-editor-ready',
    () => {
      registerWebMcpTools('editor');
    },
    { once: true },
  );
}

boot();
