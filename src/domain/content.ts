import { z } from 'zod';

export const blockStatusSchema = z.enum(['active', 'hidden']).default('active');

export const blockEnvelopeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  status: blockStatusSchema,
  content: z.unknown(),
});

export const pageSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  blocks: z.array(blockEnvelopeSchema),
});

export type BlockEnvelope = z.infer<typeof blockEnvelopeSchema>;
export type PageDocument = z.infer<typeof pageSchema>;
