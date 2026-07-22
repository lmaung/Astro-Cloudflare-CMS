import { z } from 'zod';
import { safeHrefSchema } from '../../../domain/url';

export const contentGridSchema = z.object({
  eyebrow: z.string().max(80).optional(),
  heading: z.string().min(1).max(120),
  introduction: z.string().max(500).optional(),
  layout: z.enum(['one-column', 'two-column', 'three-column', 'card-grid']).default('three-column'),
  alignment: z.enum(['start', 'center']).default('start'),
  surface: z.enum(['default', 'subtle', 'accent', 'dark']).default('default'),
  spacing: z.enum(['compact', 'default', 'spacious']).default('default'),
  items: z.array(z.object({
    id: z.string().min(1),
    heading: z.string().min(1).max(100),
    body: z.string().min(1).max(800),
    image: z.object({ src: safeHrefSchema, alt: z.string().min(1).max(160) }).optional(),
    action: z.object({ label: z.string().min(1).max(40), href: safeHrefSchema }).optional(),
  })).min(1).max(12),
});

export type ContentGrid = z.infer<typeof contentGridSchema>;
