import type { PageDocument } from '../domain/content';

export type Revision = string;

export type Versioned<T> = {
  data: T;
  revision: Revision;
};

export type ProviderErrorCode =
  | 'not_found'
  | 'invalid_content'
  | 'invalid_manifest'
  | 'unsafe_path'
  | 'stale_revision'
  | 'unavailable';

export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface ContentReader {
  readPage(slug: string): Promise<Versioned<PageDocument>>;
  listPages(): Promise<Versioned<Array<Pick<PageDocument, 'id' | 'slug' | 'status' | 'title'>>>>;
}

export interface ContentWriter {
  writePage(page: PageDocument, expectedRevision: Revision): Promise<Versioned<PageDocument>>;
  createPage(page: PageDocument, expectedRevision: Revision): Promise<Versioned<PageDocument> & { collectionRevision: Revision }>;
}
