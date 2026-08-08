import {
  getCmsSiteCached,
  getSiteDraft,
  readSiteFile,
  readSiteForAdmin,
} from './admin/site-store';
import { isAdminPreviewRequest } from './admin/request-context';
import type { SiteChrome } from './site-schema';

/** Prefer server preview draft / main in admin preview; deployed file for the public site. */
export async function loadSiteChrome(): Promise<SiteChrome> {
  if (isAdminPreviewRequest()) {
    const draft = getSiteDraft();
    if (draft) return draft;
    const main = await getCmsSiteCached();
    if (main) return main;
    return readSiteForAdmin();
  }
  return readSiteFile();
}
