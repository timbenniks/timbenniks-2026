// Generated from src/admin-client by `npm run build:admin` — do not edit.
function bindAdminLogout(selector = "#logout") {
  document.querySelector(selector)?.addEventListener("click", async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
    }
    location.href = "/admin/login";
  });
}
export {
  bindAdminLogout
};
