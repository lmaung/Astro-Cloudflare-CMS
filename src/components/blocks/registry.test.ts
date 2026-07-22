import { describe, expect, it } from 'vitest';
import { blockDefinitions, validateBlock } from './registry';

describe('block registry', () => {
  it('has unique type identifiers and valid defaults', () => {
    const types = blockDefinitions.map((definition) => definition.type);
    expect(new Set(types).size).toBe(types.length);
    for (const definition of blockDefinitions) {
      expect(() => definition.schema.parse(definition.defaults())).not.toThrow();
    }
  });

  it('rejects unknown blocks', () => {
    expect(() => validateBlock('unknown/block', {})).toThrow('Unknown block type');
  });
});
