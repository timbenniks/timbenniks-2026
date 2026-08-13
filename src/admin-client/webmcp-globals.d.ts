/**
 * The WebMCP browser API, as far as the admin client uses it.
 *
 * Two implementations show up: native Chrome (`document.modelContext` as of
 * Chrome 150, with `navigator.modelContext` as a deprecated alias, plus
 * `navigator.modelContextTesting` behind chrome://flags) and the vendored
 * @mcp-b/global polyfill (`document.modelContext`). Neither ships ambient types
 * we can load here, and the two disagree on whether tools are handed over one at
 * a time (`registerTool`) or as a set (`provideContext`) — hence both optional.
 *
 * Merges with lib/globals.d.ts; that file stays untouched.
 */
import type { ToolResult, ToolSchema } from './lib/tools.js';

declare global {
  interface ModelContextTool {
    name: string;
    description: string;
    inputSchema: ToolSchema;
    execute(args?: Record<string, unknown>): Promise<ToolResult>;
  }

  interface ModelContext {
    registerTool?(tool: ModelContextTool): unknown;
    provideContext?(context: { tools: ModelContextTool[] }): unknown;
  }

  interface Navigator {
    readonly modelContext?: ModelContext;
    readonly modelContextTesting?: ModelContext;
  }

  interface Document {
    readonly modelContext?: ModelContext;
  }
}
