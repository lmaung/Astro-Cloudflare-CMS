import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { validateBlock } from '../src/components/blocks/registry';
import { pageSchema } from '../src/domain/content';
import { navigationSchema, siteSettingsSchema } from '../src/domain/globals';
import { reusableLibrarySchema, resolveReusableBlock } from '../src/domain/reusables';

type ValidationArtifact = {
  schemaVersion: string;
  page: string;
  contentDigest: string;
  changeId: string;
};

const contentRoot = path.resolve(
  process.argv[2] ?? process.env.CONTENT_REPO_PATH ?? path.join(process.cwd(), '..', 'astro-boilerplate-cms-content'),
);

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function validate() {
  const manifest = (await readJson(path.join(contentRoot, 'content-manifest.json'))) as Record<string, unknown>;
  if (typeof manifest.id !== 'string' || manifest.schemaVersion !== '1') {
    throw new Error('content-manifest.json must contain a string id and schemaVersion "1".');
  }

  const pagesDirectory = path.join(contentRoot, 'pages');
  const pageFiles = (await readdir(pagesDirectory)).filter((file) => file.endsWith('.json')).sort();
  if (pageFiles.length === 0) throw new Error('The content repository must contain at least one pages/*.json file.');

  siteSettingsSchema.parse(await readJson(path.join(contentRoot, 'globals', 'site-settings.json')));
  const navigation = navigationSchema.parse(await readJson(path.join(contentRoot, 'globals', 'navigation.json')));
  let reusables = reusableLibrarySchema.parse({ blocks: [] });
  try { reusables = reusableLibrarySchema.parse(await readJson(path.join(contentRoot, 'globals', 'reusable-blocks.json'))); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const pages = [];
  const ids = new Set<string>();

  for (const file of pageFiles) {
    const source = await readFile(path.join(pagesDirectory, file), 'utf8');
    const page = pageSchema.parse(JSON.parse(source));
    const expectedSlug = file.slice(0, -'.json'.length);
    if (page.slug !== expectedSlug) throw new Error(`${file} must have slug "${expectedSlug}".`);
    if (ids.has(page.id)) throw new Error(`Duplicate page id: ${page.id}.`);
    ids.add(page.id); pages.push(page);
    page.blocks.forEach((block) => {
      if (block.reusable && !reusables.blocks.some((entry) => entry.id === block.reusable?.sourceId && entry.type === block.type)) throw new Error(`${file} references missing or mismatched reusable block ${block.reusable.sourceId}.`);
      validateBlock(block.type, resolveReusableBlock(block, reusables).content);
    });

    const artifactFile = path.join(contentRoot, '_validation', 'pages', file);
    try {
      const artifact = (await readJson(artifactFile)) as ValidationArtifact;
      const digest = createHash('sha256').update(source).digest('hex');
      if (
        artifact.schemaVersion !== '1' ||
        artifact.page !== page.slug ||
        artifact.contentDigest !== digest ||
        !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(artifact.changeId)
      ) {
        throw new Error(`${path.relative(contentRoot, artifactFile)} does not match ${file}.`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  const home = pages.find((page) => page.slug === 'home');
  if (!home || home.status !== 'published') throw new Error('The home page must exist and remain published.');
  const publishedRoutes = new Set(pages.filter((page) => page.status === 'published').map((page) => page.slug === 'home' ? '/' : `/${page.slug}`));
  for (const item of navigation.primary) {
    if (item.href.startsWith('/') && !publishedRoutes.has(item.href.replace(/\/$/, '') || '/')) {
      throw new Error(`Navigation link “${item.label}” does not point to a published page.`);
    }
  }

  console.log(`Validated ${pageFiles.length} page file(s) in ${contentRoot}.`);
}

await validate();
