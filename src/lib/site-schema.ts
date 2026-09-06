import { z } from 'astro/zod';

export const navLinkSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

export const footerColumnSchema = z.object({
  heading: z.string().min(1),
  links: z.array(navLinkSchema).min(1),
});

export const siteChromeSchema = z.object({
  nav: z.array(navLinkSchema),
  newsletter: z.object({
    heading: z.string().min(1),
    body: z.string().min(1),
    subscribeUrl: z.url().startsWith("https://").optional(),
  }),
  footerColumns: z.array(footerColumnSchema),
  footerHuman: z.string().min(1),
});

export type NavLink = z.infer<typeof navLinkSchema>;
export type FooterColumn = z.infer<typeof footerColumnSchema>;
export type SiteChrome = z.infer<typeof siteChromeSchema>;
