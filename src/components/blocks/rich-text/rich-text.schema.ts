import { z } from 'zod';

export const richTextContentSchema = z.object({
  heading: z.string().min(1).max(120).optional(),
  paragraphs: z.array(z.string().min(1).max(1200)).min(1),
});

export type RichTextContent = z.infer<typeof richTextContentSchema>;
