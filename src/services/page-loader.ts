import path from 'node:path';
import { heroDefinition } from '../components/blocks/hero/hero.definition';
import { richTextDefinition } from '../components/blocks/rich-text/rich-text.definition';
import type { PageDocument } from '../domain/content';
import { LocalFilesystemProvider } from '../providers/local-filesystem';

const fallbackPage: PageDocument = {
  id: 'page-home',
  slug: 'home',
  title: 'Astro Boilerplate CMS',
  blocks: [
    { id: 'hero-home', type: heroDefinition.type, status: 'active', content: heroDefinition.defaults() },
    {
      id: 'rich-text-home',
      type: richTextDefinition.type,
      status: 'active',
      content: richTextDefinition.defaults(),
    },
  ],
};

export async function loadHomePage(): Promise<PageDocument> {
  const contentRoot = path.resolve(
    process.env.CONTENT_REPO_PATH ?? path.join(process.cwd(), '..', 'astro-boilerplate-cms-content'),
  );
  try {
    return (await new LocalFilesystemProvider(contentRoot).readPage('home')).data;
  } catch {
    return fallbackPage;
  }
}
