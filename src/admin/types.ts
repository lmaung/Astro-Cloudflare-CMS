import type { RJSFSchema } from '@rjsf/utils';
import type { PageDocument } from '../domain/content';

export type CatalogBlock = {
  type: string;
  version: number;
  editor: { title: string; description: string };
  defaults: Record<string, unknown>;
  schema: RJSFSchema;
};

export type Catalog = {
  generated: true;
  blocks: CatalogBlock[];
};

export type LocalPageResponse = {
  data: PageDocument;
  revision: string;
};
