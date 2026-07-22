import { defineBlock } from '../types';
import { richTextContentSchema } from './rich-text.schema';

export const richTextDefinition = defineBlock({
  type: 'core/rich-text',
  version: 1,
  schema: richTextContentSchema,
  defaults: () => ({
    heading: 'Content without presentation logic',
    paragraphs: [
      'Pages are ordered collections of validated blocks. The frontend owns rendering while the content repository stays data-only.',
    ],
  }),
  editor: {
    title: 'Rich text',
    description: 'A heading and readable text paragraphs.',
  },
});
