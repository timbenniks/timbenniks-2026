import { AsyncLocalStorage } from 'node:async_hooks';

export type AdminRequestStore = {
  /** True while rendering /admin/preview — prefer cms branch content. */
  adminPreview: boolean;
};

export const adminRequestContext = new AsyncLocalStorage<AdminRequestStore>();

export function isAdminPreviewRequest(): boolean {
  return Boolean(adminRequestContext.getStore()?.adminPreview);
}
