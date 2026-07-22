import { pageSchema, type PageDocument } from '../domain/content';
import { validateBlock } from '../components/blocks/registry';
import { ProviderError, type ContentReader, type ContentWriter, type Versioned } from './contracts';

export type GitHubFile = {
  content: string;
  sha: string;
};

export interface GitHubTransport {
  readFile(path: string): Promise<GitHubFile | null>;
  commitFile(input: {
    path: string;
    content: string;
    expectedBlobSha: string;
    message: string;
  }): Promise<{ blobSha: string }>;
}

function safePagePath(slug: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new ProviderError('unsafe_path', 'Page slug contains unsupported characters.');
  }
  return `pages/${slug}.json`;
}

export class GitHubContentProvider implements ContentReader, ContentWriter {
  constructor(private readonly transport: GitHubTransport) {}

  async readPage(slug: string): Promise<Versioned<PageDocument>> {
    const file = await this.transport.readFile(safePagePath(slug));
    if (!file) throw new ProviderError('not_found', `Page not found: ${slug}`);
    try {
      const data = pageSchema.parse(JSON.parse(file.content));
      data.blocks.forEach((block) => validateBlock(block.type, block.content));
      return { data, revision: file.sha };
    } catch (error) {
      throw new ProviderError('invalid_content', `GitHub content is invalid: ${String(error)}`);
    }
  }

  async listPages(): Promise<Versioned<Array<Pick<PageDocument, 'id' | 'slug' | 'status' | 'title'>>>> {
    throw new ProviderError('unavailable', 'Page listing is provided by the deployed admin gateway.');
  }

  async createPage(): Promise<Versioned<PageDocument> & { collectionRevision: string }> {
    throw new ProviderError('unavailable', 'Page creation is provided by the deployed admin gateway.');
  }

  async deletePage(): Promise<{ deleted: true; slug: string; collectionRevision: string }> {
    throw new ProviderError('unavailable', 'Page deletion is provided by the deployed admin gateway.');
  }

  async writePage(page: PageDocument, expectedRevision: string): Promise<Versioned<PageDocument>> {
    const current = await this.readPage(page.slug);
    if (current.revision !== expectedRevision) {
      throw new ProviderError('stale_revision', 'The GitHub file changed after it was loaded.');
    }
    const data = pageSchema.parse(page);
    data.blocks.forEach((block) => validateBlock(block.type, block.content));
    const content = `${JSON.stringify(data, null, 2)}\n`;
    try {
      const result = await this.transport.commitFile({
        path: safePagePath(data.slug),
        content,
        expectedBlobSha: expectedRevision,
        message: `Update ${data.title}`,
      });
      return { data, revision: result.blobSha };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError('unavailable', `GitHub write failed: ${String(error)}`);
    }
  }
}
