import { siteUrl } from '../data/site';

/**
 * Live, machine-readable versioning and deprecation policy for the public
 * REST API. Served at GET /api/v1/versions so agents can check deprecation
 * status without re-parsing prose in /developers or openapi.json.
 */
export function apiVersionsPolicy() {
  return {
    current: 'v1',
    versions: [
      {
        version: 'v1',
        path: '/api/v1',
        status: 'stable',
        deprecated: false,
        sunset: null,
      },
    ],
    policy: {
      strategy: 'URL path major versioning: breaking changes ship at a new path (/api/v1, /api/v2, ...); the previous major stays live through its notice period.',
      notice_period_days: 90,
      signals: [
        'Deprecation response header once a version enters its notice period',
        'Sunset response header (RFC 8594) with the retirement date',
        'Link response header rel="deprecation" pointing to migration notes',
      ],
      documentation: siteUrl('/developers'),
    },
  };
}
