/**
 * Types for the vendored @comark/html browser bundle at
 * `public/admin/vendor/comark-html.esm.js` (see `npm run vendor:comark`).
 *
 * This declaration lives in the source tree at the path the compiled output
 * resolves at runtime, so `../vendor/comark-html.esm.js` typechecks here and
 * loads there. Hand-written: the bundle is minified, and only the surface the
 * agent markdown renderer uses is described.
 */

export interface ComarkAttrs {
  src?: string;
  alt?: string;
  href?: string;
  title?: string;
  [attr: string]: string | undefined;
}

/** A component receives the parsed node tuple and a render helper for children. */
export type ComarkComponent = (
  node: [string, ComarkAttrs | undefined, ...unknown[]],
  ctx: { render: (children: unknown[]) => Promise<string> },
) => Promise<string> | string;

export interface ComarkPlugin {
  readonly name?: string;
}

export interface ComarkRendererOptions {
  registerDefaultPlugins?: boolean;
  autoClose?: boolean;
  linkify?: boolean;
  plugins?: ComarkPlugin[];
  components?: Record<string, ComarkComponent>;
}

export function createHtmlRenderer(
  options?: ComarkRendererOptions,
): (markdown: string) => Promise<string>;

export function breaks(): ComarkPlugin;

export function security(options?: {
  blockedTags?: string[];
  allowedProtocols?: string[];
  allowDataImages?: boolean;
}): ComarkPlugin;
