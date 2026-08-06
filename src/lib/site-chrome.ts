import {
  getCmsSiteCached,
  getSiteDraft,
  readSiteFile,
  readSiteForAdmin,
} from './admin/site-store';
import { isAdminPreviewRequest } from './admin/request-context';
import type { SiteChrome } from './site-schema';

/** Prefer draft / cms in admin preview; deployed file for the public site. */
export async function loadSiteChrome(): Promise<SiteChrome> {
  if (isAdminPreviewRequest()) {
    const draft = getSiteDraft();
    if (draft) return draft;
    const cms = await getCmsSiteCached();
    if (cms) return cms;
    return readSiteForAdmin();
  }
  return readSiteFile();
}
