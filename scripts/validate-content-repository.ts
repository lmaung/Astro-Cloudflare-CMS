import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { validateBlock } from '../src/components/blocks/registry';
import { pageSchema } from '../src/domain/content';
import { navigationSchema, siteSettingsSchema } from '../src/domain/globals';

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
  navigationSchema.parse(await readJson(path.join(contentRoot, 'globals', 'navigation.json')));

  for (const file of pageFiles) {
    const source = await readFile(path.join(pagesDirectory, file), 'utf8');
    const page = pageSchema.parse(JSON.parse(source));
    const expectedSlug = file.slice(0, -'.json'.length);
    if (page.slug !== expectedSlug) throw new Error(`${file} must have slug "${expectedSlug}".`);
    page.blocks.forEach((block) => validateBlock(block.type, block.content));

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

  console.log(`Validated ${pageFiles.length} page file(s) in ${contentRoot}.`);
}

await validate();
