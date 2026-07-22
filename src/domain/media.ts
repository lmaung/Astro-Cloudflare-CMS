import { z } from 'zod';
import { safeHrefSchema } from './url';

export const mediaLibrarySchema = z.object({ assets: z.array(z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  src: safeHrefSchema,
  alt: z.string().min(1).max(180),
  caption: z.string().max(300).default(''),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  focalPoint: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).default({ x: 50, y: 50 }),
})).max(500).default([]) }).superRefine((library, context) => {
  const ids = new Set<string>(); library.assets.forEach((asset, index) => { if (ids.has(asset.id)) context.addIssue({ code: 'custom', path: ['assets', index, 'id'], message: 'Media IDs must be unique.' }); ids.add(asset.id); });
});

export type MediaLibrary = z.infer<typeof mediaLibrarySchema>;
