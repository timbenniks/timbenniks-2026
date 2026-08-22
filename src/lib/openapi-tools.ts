import { siteUrl } from '../data/site';

const contentTypes = ['writing', 'video', 'talk', 'project', 'page'];

const rateLimitHeaders = {
  'API-Version': { description: 'Major API version.', schema: { type: 'string', example: '1' } },
  RateLimit: {
    description: 'Current service limit using the IETF HTTPAPI RateLimit structured field.',
    schema: { type: 'string', example: '"public";r=119;t=60' },
  },
  'RateLimit-Policy': {
    description: 'Quota policy using the IETF HTTPAPI RateLimit structured field.',
    schema: { type: 'string', example: '"public";q=120;w=60' },
  },
};

const errors = {
  '400': { $ref: '#/components/responses/BadRequest' },
  '404': { $ref: '#/components/responses/NotFound' },
  '405': { $ref: '#/components/responses/MethodNotAllowed' },
  '429': { $ref: '#/components/responses/RateLimited' },
  '500': { $ref: '#/components/responses/ServerError' },
};

function jsonResponse(description: string, schema: Record<string, unknown>) {
  return {
    description,
    headers: rateLimitHeaders,
    content: { 'application/json': { schema } },
  };
}

/** OpenAPI 3.1 contract for the versioned Tim Benniks read-only REST API. */
export function publicAgentOpenApi() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Tim Benniks Public API',
      version: '1.0.0',
      summary: 'Read-only content API for timbenniks.dev',
      description:
        'A public, unauthenticated REST API for agents and integrations reading Tim Benniks content. Stable endpoints use the /api/v1 path. Breaking changes receive a new major path; deprecated versions are announced with Deprecation, Sunset, and Link headers for at least 90 days.',
      contact: { name: 'Tim Benniks', email: 'hi@timbenniks.dev', url: siteUrl('/contact') },
      license: { name: 'Public website content; attribution requested', url: siteUrl('/agents.md') },
    },
    servers: [{ url: siteUrl('/'), description: 'Canonical production origin' }],
    externalDocs: { description: 'Tim Benniks Developer Resources', url: siteUrl('/developers') },
    tags: [
      { name: 'Discovery', description: 'API and integration discovery.' },
      { name: 'Content', description: 'Search and retrieve public Tim Benniks content.' },
      { name: 'Press', description: 'Public speaker and booking information.' },
    ],
    paths: {
      '/api/v1': {
        get: {
          operationId: 'getApiIndex',
          summary: 'Get the Tim Benniks Public API index',
          description: 'Health and discovery document for the stable v1 REST API.',
          tags: ['Discovery'],
          responses: {
            '200': jsonResponse('API index', { $ref: '#/components/schemas/ApiIndex' }),
            ...errors,
          },
        },
      },
      '/api/v1/search': {
        get: {
          operationId: 'searchTimBenniksContent',
          summary: 'Search Tim Benniks content',
          description: 'Search public writing, videos, talks, projects, and pages by keyword.',
          tags: ['Content'],
          parameters: [
            { name: 'query', in: 'query', required: true, description: 'Search terms.', schema: { type: 'string', minLength: 1 } },
            { name: 'type', in: 'query', schema: { type: 'string', enum: contentTypes } },
            { name: 'tag', in: 'query', schema: { type: 'string' } },
            { name: 'year', in: 'query', schema: { type: 'string', pattern: '^\\d{4}$' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 20, default: 8 } },
          ],
          responses: {
            '200': jsonResponse('Matching content', { $ref: '#/components/schemas/SearchResponse' }),
            ...errors,
          },
        },
      },
      '/api/v1/content': {
        get: {
          operationId: 'listTimBenniksContent',
          summary: 'List Tim Benniks content',
          description: 'List recent content with optional collection, tag, and year filters.',
          tags: ['Content'],
          parameters: [
            { name: 'type', in: 'query', schema: { type: 'string', enum: contentTypes, default: 'writing' } },
            { name: 'tag', in: 'query', schema: { type: 'string' } },
            { name: 'year', in: 'query', schema: { type: 'string', pattern: '^\\d{4}$' } },
            { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 12 } },
          ],
          responses: {
            '200': jsonResponse('Content list', { $ref: '#/components/schemas/ContentListResponse' }),
            ...errors,
          },
        },
      },
      '/api/v1/content/{path}': {
        get: {
          operationId: 'getTimBenniksContent',
          summary: 'Get one Tim Benniks content document',
          description: 'Return a public article, video, project, or page as markdown inside a typed JSON envelope.',
          tags: ['Content'],
          parameters: [{ name: 'path', in: 'path', required: true, allowReserved: true, description: 'Site path without a leading slash, for example writing/the-tool-catalog-is-the-product.', schema: { type: 'string', minLength: 1 } }],
          responses: {
            '200': jsonResponse('Content document', { $ref: '#/components/schemas/ContentDocument' }),
            ...errors,
          },
        },
      },
      '/api/v1/press-kit': {
        get: {
          operationId: 'getTimBenniksPressKit',
          summary: 'Get the Tim Benniks press kit',
          description: 'Return public bios, topics, photographs, facts, and booking contact details.',
          tags: ['Press'],
          responses: {
            '200': jsonResponse('Press kit', { $ref: '#/components/schemas/PressKit' }),
            ...errors,
          },
        },
      },
    },
    components: {
      schemas: {
        ApiIndex: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'version', 'status', 'documentation', 'openapi', 'endpoints'],
          properties: {
            name: { type: 'string' }, version: { type: 'string' }, status: { type: 'string', const: 'ok' },
            documentation: { type: 'string', format: 'uri' }, openapi: { type: 'string', format: 'uri' },
            endpoints: { type: 'object', additionalProperties: { type: 'string', format: 'uri' } },
          },
        },
        ContentSummary: {
          type: 'object',
          required: ['type', 'title', 'url'],
          properties: {
            type: { type: 'string', enum: contentTypes }, title: { type: 'string' }, date: { type: ['string', 'null'], format: 'date' },
            description: { type: ['string', 'null'] }, tags: { type: 'array', items: { type: 'string' } },
            url: { type: 'string', format: 'uri' }, md: { type: ['string', 'null'], format: 'uri' },
            conference: { type: ['string', 'null'] }, location: { type: ['string', 'null'] }, link: { type: ['string', 'null'] },
            source: { type: 'string' },
          },
        },
        SearchResponse: {
          type: 'object', required: ['results', 'engine'],
          properties: { results: { type: 'array', items: { $ref: '#/components/schemas/ContentSummary' } }, engine: { type: 'string', const: 'index' } },
        },
        ContentListResponse: {
          type: 'object', required: ['type', 'count', 'results'],
          properties: { type: { type: 'string', enum: contentTypes }, count: { type: 'integer', minimum: 0 }, results: { type: 'array', items: { $ref: '#/components/schemas/ContentSummary' } } },
        },
        ContentDocument: {
          type: 'object', additionalProperties: false, required: ['path', 'url', 'markdown'],
          properties: { path: { type: 'string' }, url: { type: 'string', format: 'uri' }, markdown: { type: 'string', description: 'Full markdown representation.' } },
        },
        PressKit: {
          type: 'object',
          description: 'Structured public press-kit fields. New optional assets may be added without a major version.',
          required: ['url', 'markdown', 'booking_email', 'title', 'description', 'intro', 'bios', 'topics', 'stages', 'photos', 'facts', 'downloads', 'colors'],
          properties: {
            url: { type: 'string', format: 'uri' }, markdown: { type: 'string', format: 'uri' }, booking_email: { type: 'string', format: 'email' },
            title: { type: 'string' }, description: { type: 'string' }, intro: { type: 'string' },
            bios: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['label', 'body'], properties: { label: { type: 'string' }, body: { type: 'string' } } } },
            topics: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'body'], properties: { title: { type: 'string' }, body: { type: 'string' } } } },
            stages: { type: 'array', items: { type: 'string' } },
            photos: { type: 'array', items: { type: 'object', required: ['src', 'alt'], properties: { src: { type: 'string', format: 'uri' }, alt: { type: 'string' }, label: { type: 'string' } } } },
            facts: { type: 'array', items: { type: 'object', required: ['term', 'value'], properties: { term: { type: 'string' }, value: { type: 'string' }, href: { type: 'string' } } } },
            downloads: { type: 'array', items: { type: 'object', required: ['label', 'href'], properties: { label: { type: 'string' }, href: { type: 'string' }, meta: { type: 'string' }, note: { type: 'string' } } } },
            colors: { type: 'array', items: { type: 'object', required: ['name', 'hex'], properties: { name: { type: 'string' }, hex: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' }, usage: { type: 'string' } } } },
          },
          additionalProperties: true,
        },
        Problem: {
          type: 'object', additionalProperties: true, required: ['type', 'title', 'status', 'detail', 'instance', 'code', 'resolution'],
          properties: {
            type: { type: 'string', format: 'uri-reference' }, title: { type: 'string' }, status: { type: 'integer', minimum: 400, maximum: 599 },
            detail: { type: 'string' }, instance: { type: 'string', format: 'uri-reference' }, code: { type: 'string', pattern: '^[A-Z][A-Z0-9_]+$' }, resolution: { type: 'string' },
          },
        },
      },
      responses: {
        BadRequest: { description: 'The request parameters are invalid.', headers: rateLimitHeaders, content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } } } },
        NotFound: { description: 'The requested content does not exist.', headers: rateLimitHeaders, content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } } } },
        MethodNotAllowed: { description: 'The endpoint does not support this HTTP method.', headers: { ...rateLimitHeaders, Allow: { description: 'Supported methods.', schema: { type: 'string', example: 'GET' } } }, content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } } } },
        RateLimited: { description: 'The client exhausted its current quota.', headers: { ...rateLimitHeaders, 'Retry-After': { description: 'Seconds before retrying.', schema: { type: 'integer', minimum: 1 } } }, content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } } } },
        ServerError: { description: 'The request failed unexpectedly.', headers: rateLimitHeaders, content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } } } },
      },
    },
    'x-api-versioning': {
      strategy: 'URL path major versioning (/api/v1, /api/v2)',
      compatibility: 'Additive fields may be introduced within a major version.',
      deprecation: 'Deprecated versions send Deprecation and Link rel="deprecation" headers.',
      sunset: 'Sunset is announced with an HTTP-date Sunset header at least 90 days in advance.',
    },
  };
}
