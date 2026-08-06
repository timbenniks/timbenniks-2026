import { isAdminPreviewRequest } from './request-context';

function envFlag(value: unknown): boolean {
  if (value == null) return false;
  const v = String(value).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/**
 * When true, stamp `data-edit` / `data-section` hooks and allow the preview bridge stub.
 *
 * Enabled when:
 * - Rendering `/admin/preview/*` (SSR visual editor iframe) — always, so production
 *   public HTML can stay clean while the editor still works
 * - `TB_EDIT_MODE` or `PUBLIC_TB_EDIT_MODE` is truthy (optional; stamps hooks on all
 *   pages for that build/deploy, e.g. local debugging)
 *
 * Unset on production → public site HTML has no editor DOM attributes.
 */
export function isEditMarkupEnabled(): boolean {
  if (isAdminPreviewRequest()) return true;

  return (
    envFlag(process.env.TB_EDIT_MODE) ||
    envFlag(process.env.PUBLIC_TB_EDIT_MODE) ||
    envFlag(import.meta.env.TB_EDIT_MODE) ||
    envFlag(import.meta.env.PUBLIC_TB_EDIT_MODE)
  );
}
