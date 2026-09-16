import type { AstroConfig, ExternalImageService, ImageTransform } from 'astro';

export interface CloudinaryServiceConfig {
  cloudName: string;
  defaultFormat?: string;
  defaultQuality?: string | number;
  fetchRemote?: boolean;
}

const PROTOCOL_RE = /^https?:\/\//;

const QUALITY_MAP: Record<string, string | number> = {
  low: 60,
  mid: 80,
  high: 90,
  max: 100,
};

function getConfig(imageConfig: AstroConfig['image']): CloudinaryServiceConfig {
  const cfg = ((imageConfig as any).service?.config ?? {}) as Partial<CloudinaryServiceConfig>;
  if (!cfg.cloudName) {
    throw new Error(
      '[cloudinary image service] `cloudName` is required. Set it in astro.config.ts under `image.service.config`.',
    );
  }
  return {
    cloudName: cfg.cloudName,
    defaultFormat: cfg.defaultFormat ?? 'auto',
    defaultQuality: cfg.defaultQuality ?? 'auto',
    fetchRemote: cfg.fetchRemote ?? true,
  };
}

function mapQuality(q: ImageTransform['quality'] | undefined, fallback: string | number): string | number {
  if (q === undefined || q === null || q === '') return fallback;
  if (typeof q === 'number') return q;
  return QUALITY_MAP[q] ?? q;
}

function buildTransform(
  options: ImageTransform,
  config: CloudinaryServiceConfig,
): string {
  const width = options.width ? Math.round(options.width) : undefined;
  const height = options.height ? Math.round(options.height) : undefined;
  const format = (options.format as string | undefined) ?? config.defaultFormat ?? 'auto';
  const quality = mapQuality(options.quality, config.defaultQuality ?? 'auto');

  const parts: string[] = [`f_${format}`, `q_${quality}`];
  if (width) parts.push(`w_${width}`);
  if (height) parts.push(`h_${height}`);
  if (width && height) parts.push('c_fill');
  return parts.join(',');
}

function parseCloudinaryUploadUrl(url: string): { cloudName: string; tail: string } | null {
  const m = url.match(/^https?:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(.+)$/);
  if (!m) return null;
  let tail = m[2];
  // Strip an existing leading transformation segment (e.g. "f_auto,q_auto,w_900/")
  // so it can be replaced cleanly. A transformation segment contains a comma
  // and at least one "x_y" pair.
  const firstSlash = tail.indexOf('/');
  if (firstSlash > 0) {
    const seg = tail.slice(0, firstSlash);
    if (seg.includes(',') && /[a-z]_[^/]+/.test(seg)) {
      tail = tail.slice(firstSlash + 1);
    }
  }
  return { cloudName: m[1], tail };
}

function resolveSrc(src: ImageTransform['src']): string {
  return typeof src === 'string' ? src : (src as { src: string }).src;
}

const service: ExternalImageService<CloudinaryServiceConfig> = {
  validateOptions(options, imageConfig) {
    if (typeof options.src !== 'string') return options;
    const config = getConfig(imageConfig);
    const trimmed = options.src.trim();

    // Bare public ID ("blog/hero-image") → normalize to a Cloudinary upload URL
    // so the rest of the pipeline has one shape to consume.
    if (!PROTOCOL_RE.test(trimmed) && !trimmed.startsWith('/')) {
      return {
        ...options,
        src: `https://res.cloudinary.com/${config.cloudName}/image/upload/${trimmed.replace(/^\/+/, '')}`,
      };
    }
    return options;
  },

  getURL(options, imageConfig) {
    const config = getConfig(imageConfig);
    const src = resolveSrc(options.src);
    const transform = buildTransform(options, config);

    const parsed = parseCloudinaryUploadUrl(src);
    if (parsed) {
      return `https://res.cloudinary.com/${parsed.cloudName}/image/upload/${transform}/${parsed.tail}`;
    }

    if (PROTOCOL_RE.test(src)) {
      if (!config.fetchRemote) return src;
      return `https://res.cloudinary.com/${config.cloudName}/image/fetch/${transform}/${encodeURIComponent(src)}`;
    }

    return `https://res.cloudinary.com/${config.cloudName}/image/upload/${transform}/${src.replace(/^\/+/, '')}`;
  },

  getSrcSet(options, imageConfig) {
    const baseWidth = options.width;
    const baseHeight = options.height;
    // Astro keeps `height` constant across srcset entries; scale it
    // proportionally so c_fill doesn't crop a thin strip.
    const aspect = baseWidth && baseHeight ? baseHeight / baseWidth : undefined;

    let entries: { width: number; descriptor: string }[] = [];

    if (options.widths?.length) {
      entries = options.widths.map((w) => ({ width: w, descriptor: `${w}w` }));
    } else if (options.densities?.length && baseWidth) {
      entries = options.densities.map((d) => {
        const factor = typeof d === 'number' ? d : parseFloat(String(d).replace(/x$/, ''));
        return {
          width: Math.round(baseWidth * factor),
          descriptor: typeof d === 'number' ? `${d}x` : String(d),
        };
      });
    }

    return entries.map((entry) => {
      const transform = {
        ...options,
        width: entry.width,
        height: aspect ? Math.round(entry.width * aspect) : options.height,
      };
      return {
        transform,
        url: service.getURL(transform, imageConfig),
        descriptor: entry.descriptor,
        attributes: {},
      };
    });
  },

  getHTMLAttributes(options) {
    const { src, width, height, format, quality, widths, densities, ...rest } = options as Record<string, unknown>;
    return {
      ...rest,
      ...(typeof width === 'number' ? { width } : {}),
      ...(typeof height === 'number' ? { height } : {}),
    };
  },
};

export default service;
