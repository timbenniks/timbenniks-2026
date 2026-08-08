/**
 * Types for the vendored DOMPurify ESM build at `public/admin/vendor/purify.es.mjs`
 * (copied from node_modules/dompurify). Re-uses the published types so the
 * vendored copy can't drift from the API it claims to have.
 */
import type DOMPurify from 'dompurify';

declare const purify: typeof DOMPurify;
export default purify;
