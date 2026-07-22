import { defineBlock } from '../types';
import { contentGridSchema } from './content-grid.schema';

export const contentGridDefinition = defineBlock({
  type: 'core/content-grid',
  version: 1,
  schema: contentGridSchema,
  defaults: () => ({
    eyebrow: 'What we offer',
    heading: 'A flexible content section',
    introduction: 'Choose a registered one, two, or three-column presentation without adding presentation code to content.',
    layout: 'three-column' as const,
    alignment: 'start' as const,
    surface: 'default' as const,
    spacing: 'default' as const,
    items: [
      { id: 'item-one', heading: 'First item', body: 'Use concise supporting content for this section.' },
      { id: 'item-two', heading: 'Second item', body: 'Items stack in a meaningful reading order on smaller screens.' },
      { id: 'item-three', heading: 'Third item', body: 'Optional images and actions remain schema validated.' },
    ],
  }),
  editor: { title: 'Content grid', description: 'One, two, or three-column content and card layouts.' },
});
