import { defineBlock } from '../types';
import { heroContentSchema } from './hero.schema';

export const heroDefinition = defineBlock({
  type: 'core/hero',
  version: 1,
  schema: heroContentSchema,
  defaults: () => ({
    eyebrow: 'Astro CMS platform',
    heading: 'A fast, maintainable foundation for content-driven sites',
    body: 'Structured content, accessible components, and a Git-backed publishing workflow.',
    action: { label: 'Explore the platform', href: '#content' },
  }),
  editor: {
    title: 'Hero',
    description: 'Primary page introduction with an optional action.',
  },
});
