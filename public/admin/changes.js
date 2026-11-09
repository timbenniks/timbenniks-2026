// Generated from src/admin-client by `npm run build:admin` — do not edit.
import { apiFetch } from "./lib/api.js";
import { escapeHtml } from "./lib/utils.js";
import { bindStatus, bindChip } from "./lib/chrome.js";
import { diffJson, formatPatchHtml } from "./lib/json-diff.js";
import {
  clearAllDrafts,
  clearEntryDraft,
  clearPageDraft,
  listEntryDrafts,
  getPageDraft,
  loadDraftOverlay
} from "./lib/draft-store.js";
import { entryOp, previewEntryOps, publishAllDrafts } from "./lib/entries-client.js";
async function loadEntryRows() {
  const drafts = await listEntryDrafts();
  return Promise.all(
    drafts.map(async (draft) => {
      try {
        const [file] = await previewEntryOps([entryOp(draft)]);
        return { draft, path: file?.path, before: file?.before, after: file?.after, related: file?.related ?? [] };
      } catch (err) {
        return { draft, error: errText(err) || "Validation failed" };
      }
    })
  );
}
function entryChangeLabel(row) {
  if (row.draft.op === "delete") return "delete";
  return row.draft.isNew ? "new" : "modified";
}
function requireEl(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`[tb-changes] Missing #${id}`);
  return el;
}
function errText(err) {
  return err instanceof Error ? err.message : "";
}
function renderDiffDetails(opts) {
  const { patch, additions, deletions } = diffJson(opts.before, opts.after);
  const stats = `+${additions} \u2212${deletions}`;
  const patchHtml = opts.error ? `<p class="status error">${escapeHtml(opts.error)}</p>` : patch ? `<pre class="diff-patch">${formatPatchHtml(patch, escapeHtml)}</pre>` : '<p class="hint">No textual diff.</p>';
  const actions = [];
  if (opts.href) {
    actions.push(`<a class="diff-edit" href="${escapeHtml(opts.href)}">Edit</a>`);
  }
  if (opts.discardPageId) {
    actions.push(
      `<button type="button" class="ghost danger discard-one" data-page-id="${escapeHtml(opts.discardPageId)}">Discard</button>`
    );
  }
  if (opts.discardEntryKey) {
    actions.push(
      `<button type="button" class="ghost danger discard-entry" data-entry-key="${escapeHtml(opts.discardEntryKey)}">Discard</button>`
    );
  }
  return `<details class="diff-file">
    <summary>
      <span class="diff-summary-main">
        <strong>${escapeHtml(opts.title)}</strong>
        <span class="meta">${escapeHtml(opts.meta)} \xB7 ${escapeHtml(stats)}</span>
      </span>
      ${actions.length ? `<span class="diff-summary-actions">${actions.join("")}</span>` : ""}
    </summary>
    ${patchHtml}
  </details>`;
}
const statusEl = document.getElementById("status");
const chip = document.getElementById("chip");
const summary = requireEl("summary");
const pagesPanel = requireEl("pages-panel");
const pagesList = requireEl("pages-list");
const sitePanel = requireEl("site-panel");
const entriesPanel = requireEl("entries-panel");
const entriesList = requireEl("entries-list");
const siteDiff = requireEl("site-diff");
const publishBtn = requireEl("publish");
const discardBtn = requireEl("discard");
const commitMsg = requireEl("commit-msg");
const setStatus = bindStatus(statusEl);
const setChip = bindChip(chip);
let baseline = null;
let entryRows = [];
function bindEntryDiscardButtons(root) {
  root.querySelectorAll(".discard-entry").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const key = btn.getAttribute("data-entry-key") || "";
      const [, collection, ...rest] = key.split(":");
      const id = rest.join(":");
      if (!collection || !id || !confirm(`Discard draft for \u201C${id}\u201D?`)) return;
      await clearEntryDraft(collection, id);
      await loadChanges();
    });
  });
}
function bindDiscardButtons(root) {
  root.querySelectorAll(".discard-one").forEach((btn) => {
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
}
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
      configured: Boolean(data.configured),
      preferLocal: Boolean(data.preferLocal) || data.mode === "local-working"
    };
    const { draftIds, siteDraft } = await loadDraftOverlay(baseline.pages);
    const pages = [];
    for (const id of draftIds) {
      const rec = await getPageDraft(id);
      if (!rec?.page) continue;
      const base = baseline.pages[id];
      const change = !base ? "added" : JSON.stringify(base) !== JSON.stringify(rec.page) ? "modified" : "unchanged";
      if (change === "unchanged") continue;
      pages.push({ id, change, title: rec.page.metadata?.title, draft: rec.page, base });
    }
    entryRows = await loadEntryRows();
    const siteTouched = Boolean(siteDraft?.site) && JSON.stringify(siteDraft?.site) !== JSON.stringify(baseline.site);
    const hasChanges = pages.length > 0 || siteTouched || entryRows.length > 0;
    const targetHint = baseline.preferLocal ? "local working tree (src/content)" : baseline.mainBranch;
    if (!hasChanges) {
      setChip("No drafts", "ok");
      setStatus(
        baseline.preferLocal ? "No local drafts \u2014 Publish writes content files on disk." : baseline.configured ? `No local drafts \u2014 publish target is ${baseline.mainBranch}` : "No local drafts. Configure GitHub to publish to main.",
        "ok"
      );
      summary.hidden = true;
      pagesPanel.hidden = true;
      sitePanel.hidden = true;
      entriesPanel.hidden = true;
      pagesList.innerHTML = "";
      siteDiff.innerHTML = "";
      entriesList.innerHTML = "";
      publishBtn.disabled = true;
      discardBtn.disabled = true;
      return;
    }
    const n = pages.length + (siteTouched ? 1 : 0) + entryRows.length;
    const invalid = entryRows.filter((r) => r.error).length;
    setChip(`${n} draft${n === 1 ? "" : "s"}`, "dirty");
    const parts = [
      pages.length ? `${pages.length} page${pages.length === 1 ? "" : "s"}` : "",
      siteTouched ? "site chrome" : "",
      entryRows.length ? `${entryRows.length} entr${entryRows.length === 1 ? "y" : "ies"}` : ""
    ].filter(Boolean);
    setStatus(
      invalid ? `${invalid} draft${invalid === 1 ? " has" : "s have"} errors \u2014 fix or discard before publishing` : `${parts.join(" \xB7 ")} ready to publish`,
      invalid ? "error" : "ok"
    );
    summary.hidden = false;
    summary.innerHTML = `
      <p>
        Local drafts \u2192 <strong>${escapeHtml(targetHint)}</strong>
        ${baseline.preferLocal ? ' \xB7 <span class="hint">astro dev \xB7 write to disk</span>' : baseline.configured ? "" : ' \xB7 <span class="hint">GitHub not configured (local working tree)</span>'}
      </p>
      <p class="hint">Expand a draft to review its diff against published content.</p>
    `;
    if (pages.length) {
      pagesPanel.hidden = false;
      pagesList.innerHTML = pages.map((p) => {
        const href = `/admin/pages/${encodeURIComponent(p.id)}`;
        return `<li>${renderDiffDetails({
          title: p.title || p.id,
          meta: `${p.id} \xB7 ${p.change}`,
          before: p.change === "added" ? void 0 : p.base,
          after: p.draft,
          href,
          discardPageId: p.id
        })}</li>`;
      }).join("");
      bindDiscardButtons(pagesList);
    } else {
      pagesPanel.hidden = true;
      pagesList.innerHTML = "";
    }
    if (siteTouched && siteDraft?.site) {
      sitePanel.hidden = false;
      siteDiff.innerHTML = renderDiffDetails({
        title: "site.json",
        meta: "modified",
        before: baseline.site,
        after: siteDraft.site,
        href: "/admin/site"
      });
    } else {
      sitePanel.hidden = true;
      siteDiff.innerHTML = "";
    }
    if (entryRows.length) {
      entriesPanel.hidden = false;
      entriesList.innerHTML = entryRows.map((row) => {
        const d = row.draft;
        return `<li>${renderDiffDetails({
          title: d.title || d.id,
          meta: `${d.collection} \xB7 ${row.path ?? d.id} \xB7 ${entryChangeLabel(row)}`,
          before: row.before ?? void 0,
          after: row.after ?? void 0,
          href: `/admin/content/${encodeURIComponent(d.collection)}/${d.id.split("/").map(encodeURIComponent).join("/")}`,
          discardEntryKey: `entry:${d.collection}:${d.id}`,
          ...row.error ? { error: row.error } : {}
        })}${(row.related ?? []).map(
          (r) => `<div class="diff-related">${renderDiffDetails({
            title: r.path,
            meta: r.after === null ? "removed (moved)" : "updated",
            before: r.before ?? void 0,
            after: r.after ?? void 0
          })}</div>`
        ).join("")}</li>`;
      }).join("");
      bindEntryDiscardButtons(entriesList);
    } else {
      entriesPanel.hidden = true;
      entriesList.innerHTML = "";
    }
    publishBtn.disabled = invalid > 0;
    discardBtn.disabled = false;
  } catch (err) {
    setChip("Error", "error");
    setStatus(errText(err) || String(err), "error");
    publishBtn.disabled = true;
    discardBtn.disabled = true;
  }
}
publishBtn.addEventListener("click", async () => {
  const local = baseline?.preferLocal;
  if (!confirm(
    local ? "Publish local drafts to src/content on disk?" : "Publish local drafts to main? This updates content files and triggers deploy."
  )) {
    return;
  }
  publishBtn.disabled = true;
  discardBtn.disabled = true;
  setChip("Publishing\u2026");
  setStatus(local ? "Writing drafts to disk\u2026" : "Writing drafts to main\u2026");
  try {
    const data = await publishAllDrafts({ message: commitMsg.value });
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
