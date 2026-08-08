// Generated from src/admin-client by `npm run build:admin` — do not edit.
import { installDeskFacade } from "./desk-facade.js";
import { registerWebMcpTools } from "./lib/tools.js";
function boot() {
  installDeskFacade();
  registerWebMcpTools("desk");
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
