import { z } from 'zod';

export const blockStatusSchema = z.enum(['active', 'hidden']).default('active');

export const pageStatusSchema = z.enum(['published', 'archived']).default('published');

export const pageSlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and single hyphens.');

export const blockEnvelopeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  status: blockStatusSchema,
  content: z.unknown(),
});

export const pageSchema = z.object({
  id: z.string().min(1),
  slug: pageSlugSchema,
  status: pageStatusSchema,
  title: z.string().min(1).max(120),
  seo: z.object({
    title: z.string().max(120).default(''),
    description: z.string().max(200).default(''),
  }).default({ title: '', description: '' }),
  blocks: z.array(blockEnvelopeSchema),
});

export type BlockEnvelope = z.infer<typeof blockEnvelopeSchema>;
export type PageDocument = z.infer<typeof pageSchema>;
