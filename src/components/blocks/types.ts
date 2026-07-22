import type { z } from 'zod';

export type EditorMetadata = {
  title: string;
  description: string;
};

export type BlockDefinition<TSchema extends z.ZodType = z.ZodType> = {
  type: string;
  version: number;
  schema: TSchema;
  defaults: () => z.infer<TSchema>;
  editor: EditorMetadata;
};

export function defineBlock<TSchema extends z.ZodType>(
  definition: BlockDefinition<TSchema>,
): BlockDefinition<TSchema> {
  definition.schema.parse(definition.defaults());
  return definition;
}
