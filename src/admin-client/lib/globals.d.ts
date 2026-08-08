/**
 * Window globals the admin client coordinates through instead of imports.
 *
 * The editor shell, the agent rail and the WebMCP tool layer are loaded as
 * separate entry points on the same page, so they hand each other objects on
 * `window` and synchronise with CustomEvents rather than importing each other.
 * These declarations are what makes that coupling checkable.
 *
 * Each entry point may extend `Window` from its own `.d.ts` — declaration
 * merging combines them.
 */
import type { AdminFacade, DeskFacade } from './facade.js';

declare global {
  /** Editor chrome controls, installed by the editor runtime. */
  interface EditorChrome {
    enableAgentToggle(): void;
    setAgentOpen(open: boolean): void;
    isAgentOpen(): boolean;
    openInspector(tab?: string): void;
    openPage(tab?: string): void;
    openMedia(): void;
    closePrimary(): void;
    openPanel(panel?: string): { panel: string };
  }

  /** Agent rail controls, installed by the agent entry point. */
  interface AgentRail {
    setContext(
      ctx: { label: string; body: string },
      opts?: { open?: boolean },
    ): void;
    clearContext(): void;
    /** @deprecated prefer setContext, which shows a context chip instead of stuffing the composer */
    draftPrompt(text: string): void;
    focusComposer(): void;
  }

  /** What the WebMCP layer registered, surfaced for the editor's status chip. */
  interface WebMcpReport {
    ready: boolean;
    tools: number;
    contexts: { label: string; method: 'provideContext' | 'registerTool' }[];
    errors: string[];
    toolNames?: string[];
    surface?: 'desk' | 'editor';
  }

  interface Window {
    /**
     * The page editor installs the full facade; the pages desk installs the
     * smaller desk facade. Narrow with `isEditorFacade()` before reaching for
     * editor-only methods.
     */
    __tbVisualEditor?: AdminFacade;
    __tbDeskAgent?: DeskFacade;
    __tbEditorChrome?: EditorChrome;
    __tbAgent?: AgentRail;
    __tbWebMcp?: WebMcpReport;
    __webModelContextOptions?: Record<string, unknown>;
  }

  interface WindowEventMap {
    'tb-visual-editor-ready': CustomEvent<{ pageId: string }>;
    'tb-webmcp-ready': CustomEvent<WebMcpReport>;
    'tb-agent-open': CustomEvent<{ open: boolean }>;
    'tb-desk-agent-ready': CustomEvent<void>;
    'tb-desk-page-created': CustomEvent<unknown>;
  }
}
