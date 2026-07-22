import { z } from 'zod';
import { contentGridSchema } from '../components/blocks/content-grid/content-grid.schema';
import { heroContentSchema } from '../components/blocks/hero/hero.schema';
import { richTextContentSchema } from '../components/blocks/rich-text/rich-text.schema';

const metadata = { id: z.string().min(1), name: z.string().min(1).max(100), description: z.string().max(240).default('') };
export const reusableEntrySchema = z.union([
  z.object({ ...metadata, type: z.literal('core/hero'), content: heroContentSchema, refinableFields: z.array(z.enum(['eyebrow', 'heading', 'body', 'action'])).default([]) }),
  z.object({ ...metadata, type: z.literal('core/rich-text'), content: richTextContentSchema, refinableFields: z.array(z.enum(['heading', 'paragraphs'])).default([]) }),
  z.object({ ...metadata, type: z.literal('core/content-grid'), content: contentGridSchema, refinableFields: z.array(z.enum(['eyebrow', 'heading', 'introduction', 'layout', 'alignment', 'surface', 'spacing', 'items'])).default([]) }),
]);

export const reusableLibrarySchema = z.object({ blocks: z.array(reusableEntrySchema).max(100).default([]) }).superRefine((library, context) => {
  const ids = new Set<string>();
  library.blocks.forEach((block, index) => { if (ids.has(block.id)) context.addIssue({ code: 'custom', path: ['blocks', index, 'id'], message: 'Reusable block IDs must be unique.' }); ids.add(block.id); });
});

export const reusableInstanceSchema = z.object({ sourceId: z.string().min(1), overrides: z.record(z.string(), z.unknown()).default({}) });
export type ReusableLibrary = z.infer<typeof reusableLibrarySchema>;

export function resolveReusableBlock<T extends { type: string; content: unknown; reusable?: { sourceId: string; overrides: Record<string, unknown> } | undefined }>(block: T, library: ReusableLibrary): T {
  if (!block.reusable) return block;
  const source = library.blocks.find((entry) => entry.id === block.reusable?.sourceId);
  if (!source || source.type !== block.type) return block;
  const allowed = new Set(source.refinableFields);
  const overrides = Object.fromEntries(Object.entries(block.reusable.overrides).filter(([key]) => allowed.has(key as never)));
  return { ...block, content: { ...source.content, ...overrides } };
}
