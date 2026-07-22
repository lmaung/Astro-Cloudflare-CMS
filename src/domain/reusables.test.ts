import { describe, expect, it } from 'vitest';
import { heroDefinition } from '../components/blocks/hero/hero.definition';
import { resolveReusableBlock, reusableLibrarySchema } from './reusables';

describe('reusable blocks', () => {
  const source = { id: 'shared-hero', name: 'Shared hero', description: '', type: 'core/hero' as const, content: heroDefinition.defaults(), refinableFields: ['heading'] as const };
  it('propagates shared fields and applies only declared refinements', () => {
    const library = reusableLibrarySchema.parse({ blocks: [source] });
    const resolved = resolveReusableBlock({ id: 'instance', type: 'core/hero', status: 'active', content: {}, reusable: { sourceId: 'shared-hero', overrides: { heading: 'Page heading', body: 'Not allowed' } } }, library);
    expect(resolved.content).toMatchObject({ heading: 'Page heading', body: heroDefinition.defaults().body });
  });
  it('rejects duplicate reusable IDs', () => {
    expect(() => reusableLibrarySchema.parse({ blocks: [source, source] })).toThrow('Reusable block IDs must be unique');
  });
});
