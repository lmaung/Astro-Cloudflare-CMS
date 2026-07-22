import { z } from 'zod';

const safeHref = z.string().min(1).refine((value) => value.startsWith('/') || value.startsWith('#') || /^https:\/\//.test(value), 'Use a site-relative, anchor, or HTTPS URL.');

export const siteSettingsSchema = z.object({
  siteName: z.string().min(1).max(80),
  tagline: z.string().min(1).max(160),
  defaultSeo: z.object({ titleSuffix: z.string().max(60), description: z.string().min(1).max(200) }),
  footer: z.object({ copyright: z.string().min(1).max(160) }),
});

export const navigationSchema = z.object({
  primary: z.array(z.object({ label: z.string().min(1).max(40), href: safeHref })).max(20),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;
export type Navigation = z.infer<typeof navigationSchema>;
