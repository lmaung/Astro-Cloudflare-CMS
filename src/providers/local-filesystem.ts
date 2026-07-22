import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { pageSchema, type PageDocument } from '../domain/content';
import { validateBlock } from '../components/blocks/registry';
import {
  ProviderError,
  type ContentReader,
  type ContentWriter,
  type Versioned,
} from './contracts';

const manifestSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.string().min(1),
});

function revisionFor(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

function safeSlug(slug: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new ProviderError('unsafe_path', 'Page slug contains unsupported characters.');
  }
  return slug;
}

export class LocalFilesystemProvider implements ContentReader, ContentWriter {
  constructor(private readonly root: string) {}

  private async verifyManifest(): Promise<void> {
    try {
      const source = await readFile(path.join(this.root, 'content-manifest.json'), 'utf8');
      manifestSchema.parse(JSON.parse(source));
    } catch (error) {
      throw new ProviderError('invalid_manifest', `Invalid content repository manifest: ${String(error)}`);
    }
  }

  private pagePath(slug: string): string {
    const candidate = path.resolve(this.root, 'pages', `${safeSlug(slug)}.json`);
    const allowedRoot = `${path.resolve(this.root, 'pages')}${path.sep}`;
    if (!candidate.startsWith(allowedRoot)) {
      throw new ProviderError('unsafe_path', 'Resolved page path escapes the content repository.');
    }
    return candidate;
  }

  async readPage(slug: string): Promise<Versioned<PageDocument>> {
    await this.verifyManifest();
    try {
      const source = await readFile(this.pagePath(slug), 'utf8');
      const data = pageSchema.parse(JSON.parse(source));
      data.blocks.forEach((block) => validateBlock(block.type, block.content));
      return { data, revision: revisionFor(source) };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError('invalid_content', `Unable to read page: ${String(error)}`);
    }
  }

  async writePage(page: PageDocument, expectedRevision: string): Promise<Versioned<PageDocument>> {
    const current = await this.readPage(page.slug);
    if (current.revision !== expectedRevision) {
      throw new ProviderError('stale_revision', 'The page changed after it was loaded. Reload before saving.');
    }

    const validated = pageSchema.parse(page);
    validated.blocks.forEach((block) => validateBlock(block.type, block.content));
    const serialized = `${JSON.stringify(validated, null, 2)}\n`;
    const destination = this.pagePath(validated.slug);
    const temporary = `${destination}.tmp`;
    await writeFile(temporary, serialized, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, destination);
    return { data: validated, revision: revisionFor(serialized) };
  }
}
