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
  globals: Array<{ key: 'site-settings' | 'navigation'; title: string; description: string; schema: RJSFSchema }>;
};

export type EditorMode = 'local' | 'remote';

export type SaveSubmission = { kind: 'direct_save' };

export type GlobalResponse = { data: unknown; revision: string; mode: EditorMode; submission?: SaveSubmission };

export type PageResponse = {
  data: PageDocument;
  revision: string;
  mode: EditorMode;
  collectionRevision?: string;
  submission?: SaveSubmission;
};

export type PageSummary = Pick<PageDocument, 'id' | 'slug' | 'status' | 'title'>;
export type PageListResponse = { data: PageSummary[]; revision: string; mode: EditorMode };
