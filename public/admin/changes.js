// Generated from src/admin-client by `npm run build:admin` — do not edit.
import { apiFetch } from "./lib/api.js";
import { escapeHtml } from "./lib/utils.js";
import { bindStatus, bindChip } from "./lib/chrome.js";
import {
  clearAllDrafts,
  clearPageDraft,
  getPageDraft,
  getSiteDraft,
  listDraftPageIds,
  loadDraftOverlay
} from "./lib/draft-store.js";
function requireEl(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`[tb-changes] Missing #${id}`);
  return el;
}
function errText(err) {
  return err instanceof Error ? err.message : "";
}
const statusEl = document.getElementById("status");
const chip = document.getElementById("chip");
const summary = requireEl("summary");
const pagesPanel = requireEl("pages-panel");
const pagesList = requireEl("pages-list");
const sitePanel = requireEl("site-panel");
const publishBtn = requireEl("publish");
const discardBtn = requireEl("discard");
const commitMsg = requireEl("commit-msg");
const setStatus = bindStatus(statusEl);
const setChip = bindChip(chip);
let baseline = null;
async function loadChanges() {
  setStatus("Loading drafts\u2026");
  setChip("Loading\u2026");
  try {
    const data = await apiFetch("/api/admin/changes", {
      errorMessage: "Failed to load baseline"
    });
    baseline = {
      pages: data.pages || {},
      site: data.site,
      mainBranch: data.mainBranch || "main",
      configured: Boolean(data.configured)
    };
    const { draftIds, siteDraft } = await loadDraftOverlay(baseline.pages);
    const pages = [];
    for (const id of draftIds) {
      const rec = await getPageDraft(id);
      if (!rec?.page) continue;
      const base = baseline.pages[id];
      const change = !base ? "added" : JSON.stringify(base) !== JSON.stringify(rec.page) ? "modified" : "unchanged";
      if (change === "unchanged") continue;
      pages.push({ id, change, title: rec.page.metadata?.title });
    }
    const siteTouched = Boolean(siteDraft?.site) && JSON.stringify(siteDraft?.site) !== JSON.stringify(baseline.site);
    const hasChanges = pages.length > 0 || siteTouched;
    if (!hasChanges) {
      setChip("No drafts", "ok");
      setStatus(
        baseline.configured ? `No local drafts \u2014 publish target is ${baseline.mainBranch}` : "No local drafts. Configure GitHub to publish to main.",
        "ok"
      );
      summary.hidden = true;
      pagesPanel.hidden = true;
      sitePanel.hidden = true;
      publishBtn.disabled = true;
      discardBtn.disabled = true;
      return;
    }
    const n = pages.length + (siteTouched ? 1 : 0);
    setChip(`${n} draft${n === 1 ? "" : "s"}`, "dirty");
    setStatus(
      `${pages.length} page${pages.length === 1 ? "" : "s"}${siteTouched ? " \xB7 site chrome" : ""} ready to publish`,
      "ok"
    );
    summary.hidden = false;
    summary.innerHTML = `
      <p>
        Local drafts \u2192 <strong>${escapeHtml(baseline.mainBranch)}</strong>
        ${baseline.configured ? "" : ' \xB7 <span class="hint">GitHub not configured (local working tree)</span>'}
      </p>
    `;
    if (pages.length) {
      pagesPanel.hidden = false;
      pagesList.innerHTML = pages.map((p) => {
        const href = `/admin/pages/${encodeURIComponent(p.id)}`;
        return `<li>
            <a href="${href}">
              <strong>${escapeHtml(p.title || p.id)}</strong>
              <span class="meta"><span class="mono">${escapeHtml(p.id)}</span> \xB7 ${escapeHtml(p.change)}</span>
            </a>
            <button type="button" class="ghost danger discard-one" data-page-id="${escapeHtml(p.id)}">Discard</button>
          </li>`;
      }).join("");
      pagesList.querySelectorAll(".discard-one").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = btn.getAttribute("data-page-id");
          if (!id || !confirm(`Discard draft for \u201C${id}\u201D?`)) return;
          await clearPageDraft(id);
          await apiFetch("/api/admin/changes/discard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pageId: id }),
            errorMessage: "Discard failed"
          }).catch(() => void 0);
          await loadChanges();
        });
      });
    } else {
      pagesPanel.hidden = true;
      pagesList.innerHTML = "";
    }
    sitePanel.hidden = !siteTouched;
    publishBtn.disabled = false;
    discardBtn.disabled = false;
  } catch (err) {
    setChip("Error", "error");
    setStatus(errText(err) || String(err), "error");
    publishBtn.disabled = true;
    discardBtn.disabled = true;
  }
}
publishBtn.addEventListener("click", async () => {
  if (!confirm("Publish local drafts to main? This updates content files and triggers deploy.")) {
    return;
  }
  publishBtn.disabled = true;
  discardBtn.disabled = true;
  setChip("Publishing\u2026");
  setStatus("Writing drafts to main\u2026");
  try {
    const draftIds = await listDraftPageIds();
    const pages = {};
    for (const id of draftIds) {
      const rec = await getPageDraft(id);
      if (rec?.page) pages[id] = rec.page;
    }
    const siteRec = await getSiteDraft();
    const payload = {
      message: commitMsg.value.trim() || "content: publish drafts",
      ...Object.keys(pages).length ? { pages } : {},
      ...siteRec?.site ? { site: siteRec.site } : {}
    };
    const data = await apiFetch("/api/admin/changes/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      errorMessage: "Publish failed"
    });
    await clearAllDrafts();
    setStatus(`Published \xB7 ${data.mode} \xB7 ${data.commit}`, "ok");
    setChip("Published", "ok");
    await loadChanges();
  } catch (err) {
    setStatus(errText(err) || String(err), "error");
    setChip("Error", "error");
    publishBtn.disabled = false;
    discardBtn.disabled = false;
  }
});
discardBtn.addEventListener("click", async () => {
  if (!confirm("Discard all local drafts? Published content on main is unchanged.")) return;
  publishBtn.disabled = true;
  discardBtn.disabled = true;
  setChip("Discarding\u2026");
  setStatus("Clearing local drafts\u2026");
  try {
    await clearAllDrafts();
    await apiFetch("/api/admin/changes/discard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
      errorMessage: "Discard failed"
    }).catch(() => void 0);
    setStatus("Discarded all local drafts", "ok");
    await loadChanges();
  } catch (err) {
    setStatus(errText(err) || String(err), "error");
    setChip("Error", "error");
    publishBtn.disabled = false;
    discardBtn.disabled = false;
  }
});
loadChanges();
