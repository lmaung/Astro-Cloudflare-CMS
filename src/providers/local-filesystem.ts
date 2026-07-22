import { createHash } from 'node:crypto';
import { access, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { pageSchema, type PageDocument } from '../domain/content';
import { navigationSchema, siteSettingsSchema } from '../domain/globals';
import { reusableLibrarySchema } from '../domain/reusables';
import { mediaLibrarySchema } from '../domain/media';
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

  async listPages(): Promise<Versioned<Array<Pick<PageDocument, 'id' | 'slug' | 'status' | 'title'>>>> {
    await this.verifyManifest();
    const names = (await readdir(path.join(this.root, 'pages'))).filter((name) => name.endsWith('.json')).sort();
    const sources = await Promise.all(names.map((name) => readFile(path.join(this.root, 'pages', name), 'utf8')));
    const pages = sources.map((source) => pageSchema.parse(JSON.parse(source)));
    return {
      data: pages.map(({ id, slug, status, title }) => ({ id, slug, status, title })).sort((a, b) => a.title.localeCompare(b.title)),
      revision: revisionFor(sources.join('\n')),
    };
  }

  async createPage(page: PageDocument, expectedRevision: string): Promise<Versioned<PageDocument> & { collectionRevision: string }> {
    const current = await this.listPages();
    if (current.revision !== expectedRevision) throw new ProviderError('stale_revision', 'The page collection changed after it was loaded. Reload before creating a page.');
    const validated = pageSchema.parse(page);
    validated.blocks.forEach((block) => validateBlock(block.type, block.content));
    const destination = this.pagePath(validated.slug);
    try { await access(destination); throw new ProviderError('invalid_content', `A page already uses the slug “${validated.slug}”.`); }
    catch (error) { if (error instanceof ProviderError) throw error; }
    const serialized = `${JSON.stringify(validated, null, 2)}\n`;
    await writeFile(destination, serialized, { encoding: 'utf8', flag: 'wx' });
    return { data: validated, revision: revisionFor(serialized), collectionRevision: revisionFor(`${current.revision}\n${serialized}`) };
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

  async deletePage(slug: string, expectedRevision: string, confirmation: string) {
    const current = await this.readPage(slug);
    if (slug === 'home') throw new ProviderError('invalid_content', 'The home page cannot be permanently deleted.');
    if (current.revision !== expectedRevision) throw new ProviderError('stale_revision', 'The page changed after it was loaded. Reload before deleting it.');
    if (current.data.status !== 'archived') throw new ProviderError('invalid_content', 'Archive this page before permanently deleting it.');
    if (confirmation.trim() !== slug && confirmation.trim() !== current.data.title) throw new ProviderError('invalid_content', `Type “${slug}” or the exact page title to confirm permanent deletion.`);
    await unlink(this.pagePath(slug));
    const collection = await this.listPages();
    return { deleted: true as const, slug, collectionRevision: collection.revision };
  }

  async readGlobal(key: 'site-settings' | 'navigation' | 'reusable-blocks' | 'media-library'): Promise<Versioned<unknown>> {
    await this.verifyManifest();
    let source: string;
    try { source = await readFile(path.join(this.root, 'globals', `${key}.json`), 'utf8'); }
    catch (error) { if ((key === 'reusable-blocks' || key === 'media-library') && (error as NodeJS.ErrnoException).code === 'ENOENT') return { data: key === 'reusable-blocks' ? { blocks: [] } : { assets: [] }, revision: revisionFor('') }; throw error; }
    const schema = key === 'site-settings' ? siteSettingsSchema : key === 'navigation' ? navigationSchema : key === 'reusable-blocks' ? reusableLibrarySchema : mediaLibrarySchema;
    return { data: schema.parse(JSON.parse(source)), revision: revisionFor(source) };
  }

  async writeGlobal(key: 'site-settings' | 'navigation' | 'reusable-blocks' | 'media-library', data: unknown, expectedRevision: string): Promise<Versioned<unknown>> {
    const current = await this.readGlobal(key);
    if (current.revision !== expectedRevision) throw new ProviderError('stale_revision', 'Global content changed after it was loaded. Reload before saving.');
    const schema = key === 'site-settings' ? siteSettingsSchema : key === 'navigation' ? navigationSchema : key === 'reusable-blocks' ? reusableLibrarySchema : mediaLibrarySchema;
    const validated = schema.parse(data);
    const serialized = `${JSON.stringify(validated, null, 2)}\n`;
    const destination = path.join(this.root, 'globals', `${key}.json`);
    const temporary = `${destination}.tmp`;
    await writeFile(temporary, serialized, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, destination);
    return { data: validated, revision: revisionFor(serialized) };
  }
}
