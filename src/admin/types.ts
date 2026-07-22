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

export type EditorMode = 'local' | 'remote';

export type PullRequestSubmission = {
  kind: 'pull_request';
  number: number;
  url: string;
  branch: string;
};

export type PageResponse = {
  data: PageDocument;
  revision: string;
  mode: EditorMode;
  submission?: PullRequestSubmission;
};
