// Generated from src/admin-client by `npm run build:admin` — do not edit.
import { registerWebMcpTools } from "./lib/tools.js";
function boot() {
  if (window.__tbVisualEditor) {
    registerWebMcpTools("editor");
    return;
  }
  window.addEventListener(
    "tb-visual-editor-ready",
    () => {
      registerWebMcpTools("editor");
    },
    { once: true }
  );
}
boot();
