/**
 * Visual editor chrome markup — topbar, panels, rails, insert modal.
 */
import type { IconName } from '../lib/icons.js';
import type { EditorBoot } from './session.js';

export interface EditorShellOpts {
  boot: Pick<EditorBoot, 'id' | 'previewUrl' | 'liveUrl'>;
  slugPath: string;
  icon: (name: IconName, cls?: string) => string;
}

export function editorShellHtml({ boot, slugPath, icon }: EditorShellOpts): string {
  const liveUrl = boot.liveUrl || boot.previewUrl.replace(/[?&]edit=1/, '').replace(/\?$/, '') || '/';
  return `
    <header class="topbar">
      <div class="brand">
        <a class="back" href="/admin">${icon('chevronLeft', 'icon icon-sm')} Pages</a>
        <div class="page-switcher" id="page-switcher">
          <div class="page-switcher-anchor">
            <button type="button" class="page-switcher-btn" id="page-switcher-btn" aria-haspopup="listbox" aria-expanded="false" title="Switch page">
              <span class="page-switcher-meta">
                <span class="page-switcher-id">${boot.id}</span>
                <span class="page-switcher-path">${slugPath}</span>
              </span>
              ${icon('down', 'icon icon-sm page-switcher-caret')}
            </button>
            <div class="page-switcher-menu" id="page-switcher-menu" role="listbox" hidden>
              <div class="page-switcher-search">
                <input type="text" id="page-switcher-filter" placeholder="Filter pages…" aria-label="Filter pages" autocomplete="off" spellcheck="false" />
              </div>
              <div class="page-switcher-list" id="page-switcher-list" role="presentation">
                <p class="hint">Loading…</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="devices" role="group" aria-label="Preview width">
        <button type="button" data-device="desktop" title="Desktop">${icon('desktop', 'icon icon-sm')} Desktop</button>
        <button type="button" data-device="mobile" title="Mobile">${icon('mobile', 'icon icon-sm')} Mobile</button>
        <button type="button" data-device="full" class="active" title="Full width">${icon('full', 'icon icon-sm')} Full</button>
      </div>
      <div class="actions">
        <div class="history-btns" role="group" aria-label="History">
          <button type="button" id="undo-btn" title="Undo (⌘Z)" aria-label="Undo" disabled>${icon('undo', 'icon icon-sm')}</button>
          <button type="button" id="redo-btn" title="Redo (⇧⌘Z)" aria-label="Redo" disabled>${icon('redo', 'icon icon-sm')}</button>
        </div>
        <span class="chip" id="dirty-chip">Saved</span>
        <a class="open-live" href="${liveUrl}" target="_blank" rel="noopener">${icon('external', 'icon icon-sm')} Open live</a>
        <a class="open-live" href="/admin/changes" title="Review &amp; publish">Changes</a>
        <button type="button" class="primary" id="save" disabled title="Save to cms (⌘S)">Save</button>
      </div>
    </header>

    <div class="preview">
      <div class="preview-frame is-full" id="preview-frame">
        <iframe id="frame" src="${boot.previewUrl}" title="Preview"></iframe>
      </div>
      <div class="status-line" id="status">
        <span class="status-msg" role="status" aria-live="polite">Loading preview…</span>
      </div>
    </div>

    <aside class="form-rail" id="form-panel">
      <div class="form-inner">
        <div class="panel-header">
          <span class="panel-title" id="inspector-title">Layers</span>
        </div>
        <div class="form-body layers-pane" id="layers-pane">
          <div class="layers-scroll">
            <ul class="section-list" id="sections"></ul>
          </div>
          <div class="add-row">
            <select id="add-kind" aria-label="Section kind"></select>
            <button type="button" id="add-section">${icon('plus', 'icon icon-sm')} Add</button>
          </div>
        </div>
        <div class="form-body" id="section-pane" hidden>
          <div class="section-heading" id="section-heading"></div>
          <div id="section-fields"></div>
        </div>
        <div class="form-body" id="meta-pane" hidden>
          <div id="meta-fields"></div>
        </div>
      </div>
    </aside>

    <aside class="page-rail" id="page-panel" hidden>
      <div class="form-inner">
        <div class="panel-header">
          <span class="panel-title" id="page-title">Info</span>
        </div>
        <div class="form-body" id="info-pane">
          <div class="info-stack" id="info-fields">
            <p class="hint">Loading…</p>
          </div>
        </div>
        <div class="form-body" id="history-pane" hidden>
          <div class="history-stack" id="history-fields">
            <p class="hint">Loading…</p>
          </div>
        </div>
      </div>
    </aside>

    <aside class="media-rail" id="media-panel" hidden>
      <div class="form-inner media-rail-inner">
        <div class="panel-header">
          <span class="panel-title">Media</span>
          <a class="panel-link hint" href="/admin/media" title="Open full Media desk">Desk</a>
        </div>
        <div class="media-rail-mount" id="media-mount"></div>
      </div>
    </aside>

    <aside class="agent-rail is-disabled" id="agent-panel" aria-label="Editor agent">
      <div class="agent-rail-inner" id="agent-mount"></div>
    </aside>

    <nav class="icon-rail" aria-label="Editor tools">
      <div class="rail-group" role="group" aria-label="Inspector">
        <button type="button" class="rail-toggle" data-primary="inspector" data-tab="layers" aria-pressed="true" title="Layers" aria-label="Layers">${icon('layers')}</button>
        <button type="button" class="rail-toggle" data-primary="inspector" data-tab="section" aria-pressed="false" title="Section" aria-label="Section">${icon('section')}</button>
        <button type="button" class="rail-toggle" data-primary="inspector" data-tab="meta" aria-pressed="false" title="Meta" aria-label="Meta">${icon('meta')}</button>
      </div>
      <div class="rail-group rail-divider" role="group" aria-label="Page">
        <button type="button" class="rail-toggle" data-primary="page" data-tab="info" aria-pressed="false" title="Info" aria-label="Info">${icon('info')}</button>
        <button type="button" class="rail-toggle" data-primary="page" data-tab="history" aria-pressed="false" title="Git history" aria-label="Git history">${icon('history')}</button>
      </div>
      <div class="rail-group rail-divider" role="group" aria-label="Media">
        <button type="button" class="rail-toggle" data-primary="media" data-tab="library" aria-pressed="false" title="Media library" aria-label="Media library">${icon('media')}</button>
      </div>
      <div class="rail-group rail-divider" role="group" aria-label="Agent" id="agent-rail-group" hidden>
        <button type="button" id="toggle-agent" class="rail-toggle" aria-pressed="false" title="Agent" aria-label="Toggle agent">
          ${icon('agent')}
        </button>
      </div>
      <div class="rail-spacer" aria-hidden="true"></div>
      <div class="rail-group rail-exit" role="group" aria-label="Leave editor">
        <a class="rail-link" href="/admin" title="All pages" aria-label="All pages">${icon('pages')}</a>
        <a class="rail-link" href="/admin/site" title="Site chrome" aria-label="Site chrome">${icon('chrome')}</a>
        <a class="rail-link" href="/admin/media" title="Media desk" aria-label="Media desk">${icon('media')}</a>
        <a class="rail-link" href="/admin/changes" title="Changes" aria-label="Changes">${icon('external')}</a>
      </div>
    </nav>

    <div class="modal-backdrop" id="insert-modal" hidden>
      <div class="modal" role="dialog" aria-labelledby="insert-title">
        <h3 id="insert-title">Insert section</h3>
        <p class="hint" id="insert-hint">Choose a block kind to insert.</p>
        <div class="add-row">
          <select id="insert-kind" aria-label="Section kind to insert"></select>
        </div>
        <div class="modal-actions">
          <button type="button" id="insert-cancel">Cancel</button>
          <button type="button" class="primary" id="insert-confirm">Insert</button>
        </div>
      </div>
    </div>
  `;
}
