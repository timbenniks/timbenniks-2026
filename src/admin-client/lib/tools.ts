/**
 * The single declaration of every admin agent tool.
 *
 * These tools used to be declared three times over: as WebMCP `inputSchema` for
 * the page editor, again for the pages desk, and once more as OpenAI function
 * definitions in the agent loop — which is how `get_page` ended up advertising
 * two different schemas. Everything now hangs off `TOOLS`:
 *
 * - `webMcpTools(surface)` projects the modelContext registration shape.
 * - `openAiToolDefs(surface)` projects the wire format the chat endpoint forwards.
 * - `surface` / `defer` metadata replaces the hand-kept allowlist and defer sets.
 *
 * Handler argument types are derived from each tool's own schema literal, so a
 * schema and its handler cannot drift apart.
 */
import type {
  AdminFacade,
  CloudinaryAsset,
  EditorFacade,
  ImageTarget,
  SearchImagesArgs,
  SetImageArgs,
} from './facade.js';
import { PANEL_NAMES, isEditorFacade } from './facade.js';
import type { PageMetadata, PageSection, SectionKind, SiteChrome } from './content.js';

export type WebMcpSurface = 'editor' | 'desk';

/** Which surfaces a tool is offered on. */
type ToolSurface = WebMcpSurface | 'both';

const SECTION_KIND_HELP = {
  hero: 'Primary page hero with headline, subline, CTAs, optional image',
  'quote-callout': 'Large quote / manifesto block',
  'feature-split': 'Heading + live cards from a content collection',
  'card-grid': 'Grid of collection cards (writing, videos, speaking, projects)',
  'card-rows': 'Row list of collection cards (good for speaking)',
  stats: 'Simple stats derived from a collection',
  browse: 'Browse / search entry for a collection',
  inventory: 'Grouped name/note inventory lists',
  'copy-blocks': 'Multiple labeled copy blocks',
  'photo-grid': 'Image gallery grid',
  'topic-grid': 'Topic cards + optional pills',
  factsheet: 'Term / value fact rows',
  'image-text': 'Image beside markdown body copy',
  faq: 'FAQ accordion items',
  timeline: 'Career / history timeline',
  'cta-strip': 'Short call-to-action band',
} satisfies Record<SectionKind, string>;

/** Insertable kinds, in help-map order. The `satisfies` above pins the keys. */
const SECTION_KINDS = Object.keys(SECTION_KIND_HELP) as SectionKind[];

/* -------------------------------------------------------------------------- */
/* JSON Schema subset                                                          */
/* -------------------------------------------------------------------------- */

type JsonSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';

/** The JSON Schema vocabulary the tools use — enough for WebMCP and OpenAI. */
export interface PropertySchema {
  type?: JsonSchemaType;
  description?: string;
  enum?: readonly string[];
  items?: PropertySchema;
  properties?: Readonly<Record<string, PropertySchema>>;
  required?: readonly string[];
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  default?: unknown;
}

export interface ToolSchema {
  type: 'object';
  properties: Readonly<Record<string, PropertySchema>>;
  required?: readonly string[];
}

type ValueOfProperty<P> = P extends { enum: readonly (infer E)[] }
  ? E
  : P extends { type: 'string' }
    ? string
    : P extends { type: 'integer' | 'number' }
      ? number
      : P extends { type: 'boolean' }
        ? boolean
        : P extends { type: 'array' }
          ? P extends { items: infer I }
            ? ValueOfProperty<I>[]
            : unknown[]
          : P extends { type: 'object' }
            ? Record<string, unknown>
            : unknown;

type RequiredNames<S extends ToolSchema> = S extends { required: readonly (infer R)[] }
  ? Extract<R, string>
  : never;

/** Handler arguments, derived from the tool's own schema literal. */
export type ArgsOf<S extends ToolSchema> = {
  [K in keyof S['properties'] as K extends RequiredNames<S> ? K : never]: ValueOfProperty<
    S['properties'][K]
  >;
} & {
  [K in keyof S['properties'] as K extends RequiredNames<S> ? never : K]?: ValueOfProperty<
    S['properties'][K]
  >;
};

/* -------------------------------------------------------------------------- */
/* Registry types                                                              */
/* -------------------------------------------------------------------------- */

export interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

interface ToolDefinition<S extends ToolSchema, R> {
  /** WebMCP description, used on both surfaces unless `deskDescription` overrides. */
  description: string;
  /** The desk registers a shorter, desk-flavoured description for shared tools. */
  deskDescription?: string;
  /** OpenAI description — the rail phrases deferred tools as "do not call directly". */
  agentDescription?: string;
  surface: ToolSurface;
  /**
   * Tools the rail must never run directly: `always` is rewritten into
   * propose_changes on both surfaces, `desk` only on the pages desk.
   */
  defer?: 'always' | 'desk';
  /** Never registered on modelContext — propose_changes only exists for the rail. */
  agentOnly?: true;
  schema: S;
  /** propose_changes narrows its item enum per surface. */
  agentSchema?: (surface: WebMcpSurface) => ToolSchema;
  run(api: AdminFacade, args: ArgsOf<S>): R;
}

/** A registry entry with its schema generic erased, for name-keyed dispatch. */
interface AnyTool extends Omit<ToolDefinition<ToolSchema, unknown>, 'run'> {
  run(api: AdminFacade, args: Record<string, unknown>): unknown;
}

function tool<const S extends ToolSchema, R>(def: ToolDefinition<S, R>): ToolDefinition<S, R> {
  return def;
}

/* -------------------------------------------------------------------------- */
/* Facade access                                                               */
/* -------------------------------------------------------------------------- */

/** Cloudinary search hits carry ranking fields the shared asset type omits. */
export interface ImageSearchAsset extends CloudinaryAsset {
  filename?: string;
  orientation?: string;
  metadataScore?: number;
  metadataReason?: string;
  visionScore?: number;
  visionReason?: string;
}

export interface ImageSearchResult {
  assets?: ImageSearchAsset[];
  folder?: string;
  describe?: string;
  metadata?: { used?: boolean; terms?: string[] };
  vision?: {
    used?: boolean;
    candidates?: number;
    widened?: boolean;
    emptyMatches?: boolean;
    softOrientation?: string;
    error?: unknown;
  };
}

function editorFacade(api: AdminFacade): EditorFacade {
  if (!isEditorFacade(api)) throw new Error('This tool needs the visual page editor');
  return api;
}

/**
 * The editor's live image field target. `resolveImageTarget` is not on the
 * shared facade type and the desk never has one.
 */
export function imageTargetFor(api: AdminFacade | undefined): ImageTarget | null {
  if (!api) return null;
  const live = (api as { resolveImageTarget?: () => ImageTarget | null }).resolveImageTarget?.();
  if (live) return live;
  if (isEditorFacade(api)) return api.getState().imageTarget || null;
  return null;
}

/* -------------------------------------------------------------------------- */
/* Argument normalisation                                                      */
/* -------------------------------------------------------------------------- */

/** `update_metadata` accepts `pageId` (desk) or `id`. Normalised here only. */
export function pageIdFrom(args: Record<string, unknown>): string {
  return String(args.pageId || args.id || '').trim();
}

/** The metadata fields of an `update_metadata` call, without the page selector. */
export function metadataKeys(args: Record<string, unknown>): string[] {
  return Object.keys(args).filter((key) => key !== 'pageId' && key !== 'id');
}

export function errorMessage(err: unknown): string {
  const message = err && typeof err === 'object' ? (err as { message?: unknown }).message : null;
  return typeof message === 'string' && message ? message : String(err);
}

/* -------------------------------------------------------------------------- */
/* Proposals                                                                   */
/* -------------------------------------------------------------------------- */

/** Tools a human may approve from an action card (never trust freeform model HTML). */
const PROPOSABLE_TOOL_NAMES = [
  'set_field',
  'set_image',
  'save_to_cms',
  'patch_section',
  'add_section',
  'update_metadata',
  'publish_changes',
  'discard_changes',
  'apply_site_patch',
] as const;

export type ProposableToolName = (typeof PROPOSABLE_TOOL_NAMES)[number];

export interface ProposedItem {
  tool: ProposableToolName;
  args: Record<string, unknown>;
  label: string;
}

export interface Proposal {
  title?: string | undefined;
  hint?: string | undefined;
  items: ProposedItem[];
}

export const PROPOSABLE_TOOLS: ReadonlySet<ProposableToolName> = new Set(PROPOSABLE_TOOL_NAMES);

function isProposableName(value: unknown): value is ProposableToolName {
  return typeof value === 'string' && PROPOSABLE_TOOLS.has(value as ProposableToolName);
}

/** The model can send anything: keep only well-formed items, capped at 12. */
export function normalizeProposeItems(rawItems: unknown): ProposedItem[] {
  const items = Array.isArray(rawItems) ? (rawItems as unknown[]) : [];
  const valid: ProposedItem[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as { tool?: unknown; args?: unknown; label?: unknown };
    if (!isProposableName(item.tool)) continue;
    if (!item.args || typeof item.args !== 'object' || Array.isArray(item.args)) continue;
    valid.push({
      tool: item.tool,
      args: item.args as Record<string, unknown>,
      label: String(item.label || item.tool).slice(0, 140),
    });
    if (valid.length === 12) break;
  }
  return valid;
}

/** The desk may only propose tools it is allowed to run. */
function proposableEnumFor(surface: WebMcpSurface): readonly string[] {
  if (surface === 'editor') return PROPOSABLE_TOOL_NAMES;
  return PROPOSABLE_TOOL_NAMES.filter((name) => DESK_TOOL_ALLOWLIST.has(name));
}

function proposeChangesSchema(surface: WebMcpSurface): ToolSchema {
  return {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Card heading, e.g. Save to CMS or Alternate headlines',
      },
      hint: { type: 'string', description: 'Optional short instruction under the title' },
      items: {
        type: 'array',
        minItems: 1,
        maxItems: 12,
        items: {
          type: 'object',
          properties: {
            tool: { type: 'string', enum: proposableEnumFor(surface) },
            args: { type: 'object' },
            label: { type: 'string' },
          },
          required: ['tool', 'args', 'label'],
        },
      },
    },
    required: ['items'],
  };
}

/* -------------------------------------------------------------------------- */
/* The registry                                                                */
/* -------------------------------------------------------------------------- */

export const TOOLS = {
  get_editor_state: tool({
    description:
      'Get the current visual editor state: page id, path, dirty flag, selected section, and a short summary of all sections. Call this first.',
    agentDescription: 'Current page id, dirty flag, selected section, section summaries.',
    surface: 'editor',
    schema: { type: 'object', properties: {} },
    run(api) {
      return editorFacade(api).getState();
    },
  }),

  list_section_kinds: tool({
    description: 'List all section kinds you can insert, with a one-line description of each.',
    agentDescription: 'Allowed section kinds with short descriptions.',
    surface: 'editor',
    schema: { type: 'object', properties: {} },
    run(api) {
      const kinds = editorFacade(api).getState().sectionKinds;
      return kinds.map((kind) => ({ kind, description: SECTION_KIND_HELP[kind] || kind }));
    },
  }),

  get_page: tool({
    description:
      'Return the full page JSON currently in the editor (metadata + sections). Prefer get_section for focused edits.',
    deskDescription:
      'Return page JSON. Pass id on the pages desk (e.g. about). In the visual editor, omits id and returns the open draft.',
    agentDescription:
      'Return page JSON. In the editor: current draft. On the desk: pass id (e.g. about).',
    surface: 'both',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Page id when calling from the desk' },
      },
    },
    run(api, args) {
      // The editor facade ignores the id and returns the open draft.
      return args.id ? api.getPage(args.id) : api.getPage();
    },
  }),

  get_section: tool({
    description: 'Return one section by zero-based index.',
    agentDescription: 'One section by zero-based index.',
    surface: 'editor',
    schema: {
      type: 'object',
      properties: {
        index: { type: 'integer', description: 'Zero-based section index', minimum: 0 },
      },
      required: ['index'],
    },
    run(api, args) {
      return editorFacade(api).getSection(args.index);
    },
  }),

  select_section: tool({
    description:
      'Select a section in the Layers tab and highlight it in the live preview so the human can see what you are editing.',
    agentDescription: 'Select and highlight a section in the preview.',
    surface: 'editor',
    schema: {
      type: 'object',
      properties: { index: { type: 'integer', minimum: 0 } },
      required: ['index'],
    },
    run(api, args) {
      return editorFacade(api).selectSection(args.index, { scroll: true });
    },
  }),

  add_section: tool({
    description:
      'Insert a new section with kind-specific placeholder content. The preview updates live. Then rewrite fields with set_field, patch_section, or replace_section.',
    agentDescription: 'Insert a section kind (placeholder content).',
    surface: 'editor',
    schema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          description: 'Section kind from list_section_kinds',
          enum: SECTION_KINDS,
        },
        index: {
          type: 'integer',
          description: 'Insert index (default: append at end)',
          minimum: 0,
        },
      },
      required: ['kind'],
    },
    run(api, args) {
      return editorFacade(api).addSection({ kind: args.kind, index: args.index });
    },
  }),

  move_section: tool({
    description: 'Move a section from one index to another. Preview updates.',
    agentDescription: 'Move a section from one index to another.',
    surface: 'editor',
    schema: {
      type: 'object',
      properties: {
        from: { type: 'integer', minimum: 0 },
        to: { type: 'integer', minimum: 0 },
      },
      required: ['from', 'to'],
    },
    run(api, args) {
      return editorFacade(api).moveSection({ from: args.from, to: args.to });
    },
  }),

  duplicate_section: tool({
    description: 'Duplicate a section and insert the copy immediately after it.',
    agentDescription: 'Duplicate a section.',
    surface: 'editor',
    schema: {
      type: 'object',
      properties: { index: { type: 'integer', minimum: 0 } },
      required: ['index'],
    },
    run(api, args) {
      return editorFacade(api).duplicateSection(args.index);
    },
  }),

  delete_section: tool({
    description: 'Delete a section by index. Preview updates.',
    agentDescription: 'Delete a section by index.',
    surface: 'editor',
    schema: {
      type: 'object',
      properties: { index: { type: 'integer', minimum: 0 } },
      required: ['index'],
    },
    run(api, args) {
      return editorFacade(api).deleteSection(args.index);
    },
  }),

  replace_section: tool({
    description:
      'Replace an entire section object (must include kind). Use for rewriting a whole block. Preview reloads.',
    agentDescription: 'Replace an entire section object (must include kind).',
    surface: 'editor',
    schema: {
      type: 'object',
      properties: {
        index: { type: 'integer', minimum: 0 },
        section: { type: 'object', description: 'Full section object including kind' },
      },
      required: ['index', 'section'],
    },
    run(api, args) {
      // The facade rejects unknown kinds; nothing validates the model's object here.
      return editorFacade(api).replaceSection({
        index: args.index,
        section: args.section as PageSection,
      });
    },
  }),

  patch_section: tool({
    description:
      'Shallow-merge fields onto an existing section without changing kind. Preview reloads. Good for updating title, lede, items arrays, etc.',
    agentDescription: 'Shallow-merge fields onto a section without changing kind.',
    surface: 'editor',
    schema: {
      type: 'object',
      properties: {
        index: { type: 'integer', minimum: 0 },
        patch: { type: 'object', description: 'Fields to merge (do not change kind)' },
      },
      required: ['index', 'patch'],
    },
    run(api, args) {
      return editorFacade(api).patchSection({ index: args.index, patch: args.patch });
    },
  }),

  set_field: tool({
    description:
      'Set a single field by path. Prefer this for copy edits so the preview updates live. Paths can be absolute (sections.0.headline.lead, metadata.title) or relative to sectionIndex (headline.lead). Content query fields (source, limit, tags, playlist, columns, window, hideWhenEmpty, …) and other select/number/boolean controls automatically reload the preview — structural is optional and only needed as an override.',
    agentDescription:
      'Set one field by path. Live preview for copy. Query fields (source/limit/tags/…) auto-reload preview.',
    surface: 'editor',
    schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Field path, e.g. sections.0.subline or headline.lead',
        },
        value: {
          description: 'New value (string, number, boolean, or string[] for multi-select tags)',
        },
        sectionIndex: {
          type: 'integer',
          minimum: 0,
          description: 'Required when path is relative to a section',
        },
        structural: {
          type: 'boolean',
          description:
            'Force preview reload. Usually unnecessary — query fields and select/number/boolean controls auto-reload.',
          default: false,
        },
      },
      required: ['path', 'value'],
    },
    run(api, args) {
      return editorFacade(api).setField({
        path: args.path,
        value: args.value,
        sectionIndex: args.sectionIndex,
        structural: Boolean(args.structural),
      });
    },
  }),

  update_metadata: tool({
    description:
      'Update SEO metadata fields (title, description, keywords, image, canonical, imageAlt, noindex).',
    deskDescription:
      'Update SEO metadata. In the editor: current page. On the desk: require pageId and prefer propose_changes for Apply cards.',
    agentDescription:
      'Update SEO metadata. Editor: current page. Desk: require pageId; Agent redirects to propose_changes for Apply cards.',
    surface: 'both',
    defer: 'desk',
    schema: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'Required on the desk (e.g. about)' },
        title: { type: 'string' },
        description: { type: 'string' },
        keywords: { type: 'string' },
        image: { type: 'string', description: 'Social image URL' },
        canonical: { type: 'string', description: 'Canonical URL override' },
        imageAlt: { type: 'string', description: 'Alt text for the social/OG image' },
        noindex: { type: 'boolean', description: 'If true, mark page noindex' },
      },
    },
    run(api, args) {
      const fields: Partial<PageMetadata> & Record<string, unknown> = { ...args };
      // Some modelContext hosts hand an AbortSignal to execute() alongside the args.
      delete fields.signal;
      return api.updateMetadata(fields);
    },
  }),

  set_device_preview: tool({
    description: 'Switch the live preview width: desktop, mobile, or full.',
    agentDescription: 'Switch preview width.',
    surface: 'editor',
    schema: {
      type: 'object',
      properties: { mode: { type: 'string', enum: ['desktop', 'mobile', 'full'] } },
      required: ['mode'],
    },
    run(api, args) {
      return editorFacade(api).setDevice(args.mode);
    },
  }),

  undo: tool({
    description: 'Undo the last editor change.',
    agentDescription: 'Undo last editor change.',
    surface: 'editor',
    schema: { type: 'object', properties: {} },
    run(api) {
      return editorFacade(api).undo();
    },
  }),

  redo: tool({
    description: 'Redo the last undone editor change.',
    agentDescription: 'Redo last undone change.',
    surface: 'editor',
    schema: { type: 'object', properties: {} },
    run(api) {
      return editorFacade(api).redo();
    },
  }),

  refresh_preview: tool({
    description: 'Force-sync the in-memory preview draft and reload the iframe.',
    agentDescription: 'Force preview reload.',
    surface: 'editor',
    schema: { type: 'object', properties: {} },
    run(api) {
      return editorFacade(api).refreshPreview();
    },
  }),

  get_image_library_config: tool({
    description:
      'Return allowed Cloudinary folders, default folder, optional tags/prefix for this site’s image search.',
    agentDescription: 'Allowed Cloudinary folders/tags for image search on this site.',
    surface: 'editor',
    schema: { type: 'object', properties: {} },
    run(api) {
      return editorFacade(api).getImageLibraryConfig();
    },
  }),

  search_images: tool({
    description:
      'Search Tim’s Cloudinary library within allowed folders. Matches tags + Media Library Title/Description (and filename). Pass describe or query for scenes. Set vision:true only as a fallback to rank tiny thumbs. Returns publicId, secureUrl, title, description, tags, metadataScore; vision adds visionScore/visionReason.',
    agentDescription:
      'Search Cloudinary by tags, title, and description. Pass describe or query; use vision:true only as a fallback. Omit folder unless named.',
    surface: 'editor',
    schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Keywords matched against tags, title, description, filename, public_id.',
        },
        describe: {
          type: 'string',
          description:
            'Natural-language scene, e.g. "Tim on stage at a conference". Searches tags + title + description (no vision unless vision:true).',
        },
        vision: {
          type: 'boolean',
          description:
            'Optional fallback. If true, also vision-rank a metadata shortlist. Prefer metadata-only first.',
        },
        folder: {
          type: 'string',
          description:
            'One allowed folder, or "all" / omit to search the entire allowlist (default when CLOUDINARY_SEARCH_FOLDER is * or a list).',
        },
        maxResults: { type: 'integer', minimum: 1, maximum: 30 },
        orientation: {
          type: 'string',
          enum: ['portrait', 'landscape', 'square'],
          description: 'Filter by aspect ratio',
        },
        minWidth: { type: 'number' },
        maxWidth: { type: 'number' },
        minHeight: { type: 'number' },
        maxHeight: { type: 'number' },
        format: { type: 'string', description: 'e.g. png, jpg, webp' },
        tags: { type: 'array', items: { type: 'string' } },
      },
    },
    run(api, args) {
      const search: SearchImagesArgs = {
        query: args.query || '',
        describe: args.describe,
        vision: args.vision,
        folder: args.folder,
        maxResults: args.maxResults,
        orientation: args.orientation,
        minWidth: args.minWidth,
        maxWidth: args.maxWidth,
        minHeight: args.minHeight,
        maxHeight: args.maxHeight,
        format: args.format,
        tags: args.tags,
      };
      return editorFacade(api).searchImages(search);
    },
  }),

  set_image: tool({
    description:
      'Set an image field from a Cloudinary asset. path like image.src or image (section-relative) or metadata.image. Prefer secureUrl from search_images.',
    agentDescription: 'Apply a Cloudinary image to a field (image.src, image, metadata.image, …).',
    surface: 'editor',
    schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Field path: image.src, image, backgroundImage.src, metadata.image, …',
        },
        sectionIndex: { type: 'integer', minimum: 0 },
        secureUrl: { type: 'string' },
        publicId: { type: 'string' },
        width: { type: 'number' },
        height: { type: 'number' },
        alt: { type: 'string' },
      },
      required: ['path'],
    },
    run(api, args) {
      // secureUrl is optional here: the facade rebuilds the URL from publicId.
      return editorFacade(api).setImage({
        path: args.path,
        sectionIndex: args.sectionIndex,
        secureUrl: args.secureUrl,
        publicId: args.publicId,
        width: args.width,
        height: args.height,
        alt: args.alt,
      } as SetImageArgs);
    },
  }),

  list_pages: tool({
    description: 'List all CMS pages (id, path, title). Use before create_page or open_page.',
    deskDescription: 'List all CMS pages (id, path, title).',
    surface: 'both',
    schema: { type: 'object', properties: {} },
    run(api) {
      return api.listPages();
    },
  }),

  create_page: tool({
    description: 'Create a new CMS page with id, path, and title. Optional description.',
    deskDescription:
      'Create a new marketing page as a local draft. Requires id (kebab-case), path (e.g. /workshop), and title. On the desk Agent, open defaults to true and navigates to the editor (stops the chat turn so navigation is not cancelled).',
    agentDescription:
      'Create a new CMS page (id kebab-case, path, title). On the desk, open defaults to true and navigates to the editor after your reply. Pass open:false to stay on the desk.',
    surface: 'both',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Page id (slug), e.g. about' },
        path: { type: 'string', description: 'URL path, e.g. /about' },
        title: { type: 'string' },
        description: { type: 'string' },
        open: {
          type: 'boolean',
          description: 'Desk only: open the visual editor after create (default true)',
        },
      },
      required: ['id', 'path', 'title'],
    },
    run(api, args) {
      return api.createPage({
        id: args.id,
        path: args.path,
        title: args.title,
        description: args.description,
        open: args.open,
      });
    },
  }),

  open_page: tool({
    description:
      'Navigate the editor to another page by id. Leaves this document — if the current page is dirty, pass force:true or save first.',
    deskDescription: 'Navigate to the visual editor for a page id (leaves this desk).',
    agentDescription:
      'Navigate the editor to another page by id. If dirty, pass force:true only after human confirms discard (or save first).',
    surface: 'both',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Page id to open' },
        force: {
          type: 'boolean',
          description: 'Navigate even when the current page has unsaved changes',
        },
      },
      required: ['id'],
    },
    run(api, args) {
      return api.openPage({ id: args.id, force: args.force });
    },
  }),

  describe_section: tool({
    description:
      'Describe a section’s editable fields and list keys (items, ctas, gallery, nested inventory, …). Call before add_list_item / remove_list_item / move_list_item.',
    agentDescription:
      'Describe a section’s editable fields and list keys. Call before add/remove/move_list_item.',
    surface: 'editor',
    schema: {
      type: 'object',
      properties: {
        index: { type: 'integer', description: 'Zero-based section index', minimum: 0 },
      },
      required: ['index'],
    },
    run(api, args) {
      return editorFacade(api).describeSection({ index: args.index });
    },
  }),

  add_list_item: tool({
    description:
      'Append an item to a section list. listKey is typically items, ctas, or gallery. For nested inventory lists, pass parentItemIndex + nestedKey. Optional item overrides the default create() placeholder.',
    agentDescription:
      'Append an item to a section list (items, ctas, gallery, or nested inventory). Prefer over blind patch_section arrays.',
    surface: 'editor',
    schema: {
      type: 'object',
      properties: {
        sectionIndex: { type: 'integer', minimum: 0 },
        listKey: { type: 'string', description: 'Top-level list key, e.g. items, ctas, gallery' },
        nestedKey: {
          type: 'string',
          description: 'Nested list key under a parent item (inventory)',
        },
        parentItemIndex: {
          type: 'integer',
          minimum: 0,
          description: 'Required with nestedKey — index of the parent list item',
        },
        item: {
          type: 'object',
          description: 'Optional full item object; omit to use the list’s create() default',
        },
      },
      required: ['sectionIndex', 'listKey'],
    },
    run(api, args) {
      return editorFacade(api).addListItem({
        sectionIndex: args.sectionIndex,
        listKey: args.listKey,
        nestedKey: args.nestedKey,
        parentItemIndex: args.parentItemIndex,
        item: args.item,
      });
    },
  }),

  remove_list_item: tool({
    description:
      'Remove an item from a section list by index. Respects list min counts. Use describe_section first for listKey / nested paths.',
    agentDescription: 'Remove an item from a section list by index. Use describe_section first.',
    surface: 'editor',
    schema: {
      type: 'object',
      properties: {
        sectionIndex: { type: 'integer', minimum: 0 },
        listKey: { type: 'string' },
        nestedKey: { type: 'string' },
        parentItemIndex: { type: 'integer', minimum: 0 },
        itemIndex: { type: 'integer', minimum: 0, description: 'Index of the item to remove' },
      },
      required: ['sectionIndex', 'listKey', 'itemIndex'],
    },
    run(api, args) {
      return editorFacade(api).removeListItem({
        sectionIndex: args.sectionIndex,
        listKey: args.listKey,
        nestedKey: args.nestedKey,
        parentItemIndex: args.parentItemIndex,
        itemIndex: args.itemIndex,
      });
    },
  }),

  move_list_item: tool({
    description:
      'Reorder an item within a section list (from → to). Use describe_section for listKey / nested paths.',
    agentDescription:
      'Reorder an item within a section list (from → to). Use describe_section first.',
    surface: 'editor',
    schema: {
      type: 'object',
      properties: {
        sectionIndex: { type: 'integer', minimum: 0 },
        listKey: { type: 'string' },
        nestedKey: { type: 'string' },
        parentItemIndex: { type: 'integer', minimum: 0 },
        from: { type: 'integer', minimum: 0 },
        to: { type: 'integer', minimum: 0 },
      },
      required: ['sectionIndex', 'listKey', 'from', 'to'],
    },
    run(api, args) {
      return editorFacade(api).moveListItem({
        sectionIndex: args.sectionIndex,
        listKey: args.listKey,
        nestedKey: args.nestedKey,
        parentItemIndex: args.parentItemIndex,
        from: args.from,
        to: args.to,
      });
    },
  }),

  get_changes: tool({
    description:
      'List local draft status vs published main baseline. Prefer before publish_changes or discard_changes.',
    deskDescription: 'Show pending cms → main changes (what would publish).',
    agentDescription: 'List pending CMS branch changes vs main. Prefer before publish or discard.',
    surface: 'both',
    schema: { type: 'object', properties: {} },
    run(api) {
      return api.getChanges();
    },
  }),

  publish_changes: tool({
    description: 'Publish local drafts to main (goes live). Prefer human confirmation before calling.',
    deskDescription:
      'Merge cms → main (goes live). Prefer human confirmation on the Agent rail via propose_changes.',
    agentDescription:
      'Do not call directly from the Agent rail — use propose_changes with publish_changes so the human gets a Publish card.',
    surface: 'both',
    defer: 'always',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Optional publish commit message' },
      },
    },
    run(api, args) {
      return api.publishChanges({ message: args.message });
    },
  }),

  discard_changes: tool({
    description:
      'Discard all local drafts. Prefer human confirmation — destructive for unpublished work.',
    deskDescription:
      'Discard all local drafts (destructive for unpublished work). Prefer human confirmation.',
    agentDescription:
      'Do not call directly from the Agent rail — use propose_changes with discard_changes so the human gets a confirmation card.',
    surface: 'both',
    defer: 'always',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Ignored — local drafts are cleared as a set' },
      },
    },
    run(api) {
      // Both facades clear every local draft; `path` is accepted and ignored.
      return api.discardChanges();
    },
  }),

  update_asset_metadata: tool({
    description:
      'Update Cloudinary asset metadata (tags, title, description) by publicId. Improves future search_images matching.',
    agentDescription: 'Update Cloudinary asset metadata (tags, title, description) by publicId.',
    surface: 'editor',
    schema: {
      type: 'object',
      properties: {
        publicId: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        title: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['publicId'],
    },
    run(api, args) {
      return editorFacade(api).updateAssetMetadata({
        publicId: args.publicId,
        tags: args.tags,
        title: args.title,
        description: args.description,
      });
    },
  }),

  get_site: tool({
    description: 'Return the current site.json (nav, footer, newsletter, …).',
    deskDescription: 'Read site chrome (nav, footer, newsletter).',
    surface: 'both',
    schema: { type: 'object', properties: {} },
    run(api) {
      return api.getSite();
    },
  }),

  apply_site_patch: tool({
    description:
      'Update site.json (nav, footer, newsletter). Be careful — this affects the whole site. Always stages a local draft; publish from Changes.',
    deskDescription: 'Write site.json. Prefer propose_changes from the Agent. Optional mode: preview.',
    agentDescription:
      'Do not call directly from the Agent rail — use propose_changes with apply_site_patch so the human gets an Apply card.',
    surface: 'both',
    defer: 'always',
    schema: {
      type: 'object',
      properties: {
        site: { type: 'object', description: 'Full or partial site object to apply' },
        mode: {
          type: 'string',
          enum: ['preview', 'cms'],
          description: 'Ignored — always local draft; kept for compatibility',
        },
      },
      required: ['site'],
    },
    run(api, args) {
      // Nothing validates the model's site object here; the facade and API do.
      return api.applySitePatch({ site: args.site as Partial<SiteChrome>, mode: args.mode });
    },
  }),

  get_page_history: tool({
    description: 'Return git history for the currently open page.',
    surface: 'editor',
    schema: { type: 'object', properties: {} },
    run(api) {
      return editorFacade(api).getPageHistory();
    },
  }),

  open_panel: tool({
    description:
      'Open an editor chrome panel: inspector/section, media library, page info, or history.',
    surface: 'editor',
    schema: {
      type: 'object',
      properties: {
        panel: {
          type: 'string',
          enum: PANEL_NAMES,
        },
      },
      required: ['panel'],
    },
    run(api, args) {
      return editorFacade(api).openPanel({ panel: args.panel });
    },
  }),

  propose_changes: tool({
    description:
      'Defer actions for human Apply/Dismiss cards. Use for save/publish/discard/site offers and optional A/B copy — not for edits the human already asked you to make live.',
    surface: 'both',
    agentOnly: true,
    schema: proposeChangesSchema('editor'),
    agentSchema: proposeChangesSchema,
    run(_api, args) {
      const items = normalizeProposeItems(args.items);
      if (!items.length) {
        return { error: 'propose_changes needs at least one valid item', deferred: false };
      }
      return {
        deferred: true,
        title: typeof args.title === 'string' ? args.title.slice(0, 120) : undefined,
        hint: typeof args.hint === 'string' ? args.hint.slice(0, 200) : undefined,
        items,
        count: items.length,
      };
    },
  }),

  save_to_cms: tool({
    description:
      'Save the current page as a local draft (IndexedDB). Not live until publish_changes. Ask the human before calling unless they explicitly asked to save. For site-wide nav/footer use apply_site_patch instead.',
    agentDescription:
      'Do not call directly from the Agent rail — use propose_changes with save_to_cms instead so the human gets a Save button.',
    surface: 'editor',
    defer: 'always',
    schema: { type: 'object', properties: {} },
    run(api) {
      return api.saveToCms();
    },
  }),
};

export type ToolName = keyof typeof TOOLS;

/* -------------------------------------------------------------------------- */
/* Derived sets                                                               */
/* -------------------------------------------------------------------------- */

function entries(): [ToolName, AnyTool][] {
  // Handlers are heterogeneous by design; name-keyed iteration erases their args.
  return Object.entries(TOOLS) as unknown as [ToolName, AnyTool][];
}

function appliesTo(surface: ToolSurface, target: WebMcpSurface): boolean {
  return surface === 'both' || surface === target;
}

function toolsFor(surface: WebMcpSurface): [ToolName, AnyTool][] {
  return entries().filter(([, tool]) => appliesTo(tool.surface, surface));
}

/** The desk (/admin) tool surface — lifecycle, SEO metadata, ship, site. */
export const DESK_TOOL_ALLOWLIST: ReadonlySet<ToolName> = new Set(
  toolsFor('desk').map(([name]) => name),
);

/** Tools the rail always redirects to propose_changes. */
export const DEFER_TO_PROPOSE: ReadonlySet<ToolName> = new Set(
  entries()
    .filter(([, tool]) => tool.defer === 'always')
    .map(([name]) => name),
);

function lookup(name: string): AnyTool | undefined {
  return (TOOLS as unknown as Record<string, AnyTool | undefined>)[name];
}

/** True when the rail must offer this tool as an Apply card instead of running it. */
export function defersToPropose(name: string, surface: WebMcpSurface): boolean {
  const defer = lookup(name)?.defer;
  return defer === 'always' || (defer === 'desk' && surface === 'desk');
}

/* -------------------------------------------------------------------------- */
/* Execution                                                                   */
/* -------------------------------------------------------------------------- */

/** Run a tool by name. Throws for unknown names, like the old switch default. */
export function runTool(
  api: AdminFacade,
  name: string,
  args: Record<string, unknown>,
): unknown | Promise<unknown> {
  const tool = lookup(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.run(api, args);
}

function textResult(payload: unknown): ToolResult {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
  return { content: [{ type: 'text', text }] };
}

function errorResult(err: unknown): ToolResult {
  return { content: [{ type: 'text', text: errorMessage(err) }], isError: true };
}

function surfaceFacade(surface: WebMcpSurface): AdminFacade {
  if (surface === 'desk') {
    const api = window.__tbDeskAgent || window.__tbVisualEditor;
    if (!api) throw new Error('Desk agent is not ready yet');
    return api;
  }
  const api = window.__tbVisualEditor;
  if (!api) throw new Error('Visual editor is not ready yet');
  return api;
}

/* -------------------------------------------------------------------------- */
/* Projections                                                                 */
/* -------------------------------------------------------------------------- */

export interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: ToolSchema;
  execute(args?: Record<string, unknown>): Promise<ToolResult>;
}

/** The tools one surface registers on `navigator` / `document.modelContext`. */
export function webMcpTools(surface: WebMcpSurface): WebMcpTool[] {
  return toolsFor(surface)
    .filter(([, tool]) => !tool.agentOnly)
    .map(([name, tool]) => ({
      name,
      description:
        (surface === 'desk' ? tool.deskDescription : undefined) || tool.description,
      inputSchema: tool.schema,
      async execute(args?: Record<string, unknown>): Promise<ToolResult> {
        try {
          return textResult(await tool.run(surfaceFacade(surface), args || {}));
        } catch (err) {
          return errorResult(err);
        }
      },
    }));
}

export interface OpenAiTool {
  type: 'function';
  function: { name: string; description: string; parameters: ToolSchema };
}

/**
 * OpenAI function definitions for one surface. Tools the WebMCP layer failed to
 * register are dropped so the model is never offered something that cannot run.
 */
export function openAiToolDefs(surface: WebMcpSurface): OpenAiTool[] {
  const registered = window.__tbWebMcp?.toolNames;
  return toolsFor(surface)
    .filter(([name, tool]) => tool.agentOnly || !registered || registered.includes(name))
    .map(([name, tool]) => ({
      type: 'function' as const,
      function: {
        name,
        description: tool.agentDescription || tool.description,
        parameters: tool.agentSchema ? tool.agentSchema(surface) : tool.schema,
      },
    }));
}

/* -------------------------------------------------------------------------- */
/* modelContext registration                                                   */
/* -------------------------------------------------------------------------- */

const NO_CONTEXT_ERROR =
  'No modelContext API found. Enable chrome://flags/#enable-webmcp-testing or load @mcp-b/global.';

function modelContexts(): { ctx: ModelContext; label: string }[] {
  const contexts: { ctx: ModelContext; label: string }[] = [];
  const seen = new Set<ModelContext>();
  const add = (ctx: ModelContext | undefined, label: string) => {
    if (!ctx || seen.has(ctx)) return;
    seen.add(ctx);
    contexts.push({ ctx, label });
  };

  // Native Chrome WebMCP (Inspector / browser agents)
  add(navigator.modelContext, 'navigator.modelContext');
  // MCP-B polyfill / bridge
  add(document.modelContext, 'document.modelContext');
  // Some previews expose testing helpers only
  if (typeof navigator.modelContextTesting?.registerTool === 'function') {
    add(navigator.modelContextTesting, 'navigator.modelContextTesting');
  }

  return contexts;
}

/**
 * Register one surface's tools on every modelContext implementation present and
 * publish `window.__tbWebMcp` for the editor status chip and the rail.
 */
export function registerWebMcpTools(surface: WebMcpSurface): WebMcpReport {
  const tools = webMcpTools(surface);
  const logLabel = surface === 'desk' ? '[webmcp-desk]' : '[webmcp]';
  const contexts = modelContexts();
  const report: WebMcpReport = {
    ready: false,
    tools: tools.length,
    contexts: [],
    errors: [],
    toolNames: tools.map((tool) => tool.name),
    surface,
  };

  if (!contexts.length) {
    report.errors.push(NO_CONTEXT_ERROR);
    console.warn(logLabel, NO_CONTEXT_ERROR);
    window.__tbWebMcp = report;
    return report;
  }

  for (const { ctx, label } of contexts) {
    try {
      if (typeof ctx.provideContext === 'function') {
        ctx.provideContext({ tools });
        report.contexts.push({ label, method: 'provideContext' });
        continue;
      }
      if (typeof ctx.registerTool === 'function') {
        for (const tool of tools) ctx.registerTool(tool);
        report.contexts.push({ label, method: 'registerTool' });
      } else {
        report.errors.push(`${label}: no registerTool/provideContext`);
      }
    } catch (err) {
      report.errors.push(`${label}: ${errorMessage(err)}`);
    }
  }

  report.ready = report.contexts.length > 0;
  window.__tbWebMcp = report;
  console.info(
    logLabel,
    'registered',
    tools.length,
    'tools on',
    report.contexts.map((c) => c.label).join(', ') || '(none)',
  );
  window.dispatchEvent(new CustomEvent('tb-webmcp-ready', { detail: report }));
  return report;
}
