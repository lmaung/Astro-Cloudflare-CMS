import { z } from 'zod';
import { heroDefinition } from './hero/hero.definition';
import { richTextDefinition } from './rich-text/rich-text.definition';

export const blockDefinitions = [heroDefinition, richTextDefinition] as const;

export const blockDefinitionByType = new Map(
  blockDefinitions.map((definition) => [definition.type, definition]),
);

export function validateBlock(type: string, content: unknown): unknown {
  const definition = blockDefinitionByType.get(type);
  if (!definition) {
    throw new Error(`Unknown block type: ${type}`);
  }
  return (definition.schema as z.ZodType).parse(content);
}
