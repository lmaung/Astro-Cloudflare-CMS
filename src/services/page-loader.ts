import path from 'node:path';
import { heroDefinition } from '../components/blocks/hero/hero.definition';
import { richTextDefinition } from '../components/blocks/rich-text/rich-text.definition';
import type { PageDocument } from '../domain/content';
import { pageSchema } from '../domain/content';
import { navigationSchema, siteSettingsSchema, type Navigation, type SiteSettings } from '../domain/globals';
import { resolveReusableBlock, reusableLibrarySchema } from '../domain/reusables';
import { LocalFilesystemProvider } from '../providers/local-filesystem';

const fallbackPage: PageDocument = {
  id: 'page-home',
  slug: 'home',
  status: 'published',
  title: 'Astro Boilerplate CMS',
  access: { readRoles: ['public'], writeRoles: ['admin'] },
  seo: { title: '', description: '', socialImageAlt: '', noIndex: false },
  blocks: [
    {
      id: 'hero-home',
      type: heroDefinition.type,
      status: 'active',
      content: heroDefinition.defaults(),
    },
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
    const provider = new LocalFilesystemProvider(contentRoot);
    const page = (await provider.readPage('home')).data;
    if (!page.access.readRoles.includes('public')) return fallbackPage;
    const library = reusableLibrarySchema.parse((await provider.readGlobal('reusable-blocks')).data);
    return {
      ...page,
      blocks: page.blocks.map((block) => resolveReusableBlock(block, library)),
    };
  } catch {
    return fallbackPage;
  }
}

const fallbackSettings: SiteSettings = {
  siteName: 'Astro CMS',
  tagline: 'Structured content for modern websites.',
  siteUrl: 'https://example.com',
  locale: 'en',
  organization: { name: 'Astro CMS', sameAs: [] },
  defaultSeo: {
    titleSuffix: 'Astro CMS',
    description: 'Reusable Git-backed CMS platform built with Astro.',
  },
  footer: {
    copyright: '© 2026 Astro CMS',
    columns: [],
    socialLinks: [],
    legalLinks: [],
    supportingImages: [],
    newsletter: {
      enabled: false,
      heading: 'Stay informed',
      description: '',
      actionLabel: 'Subscribe',
      privacyNote: '',
    },
    appearance: { variant: 'light', overlay: 'medium' },
  },
};

const fallbackNavigation: Navigation = {
  primary: [
    { label: 'Home', href: '/' },
    { label: 'Content', href: '#content' },
  ],
};

async function readGlobal<T>(file: string, parse: (value: unknown) => T, fallback: T): Promise<T> {
  const contentRoot = path.resolve(
    process.env.CONTENT_REPO_PATH ?? path.join(process.cwd(), '..', 'astro-boilerplate-cms-content'),
  );
  try {
    return parse(
      JSON.parse(await (await import('node:fs/promises')).readFile(path.join(contentRoot, 'globals', file), 'utf8')),
    );
  } catch {
    return fallback;
  }
}

export function loadSiteSettings() {
  return readGlobal('site-settings.json', (value) => siteSettingsSchema.parse(value), fallbackSettings);
}
export function loadNavigation() {
  return readGlobal('navigation.json', (value) => navigationSchema.parse(value), fallbackNavigation);
}

export async function loadPublicNavigation(): Promise<Navigation> {
  const navigation = await loadNavigation();
  const contentRoot = path.resolve(
    process.env.CONTENT_REPO_PATH ?? path.join(process.cwd(), '..', 'astro-boilerplate-cms-content'),
  );
  try {
    const fs = await import('node:fs/promises');
    const files = (await fs.readdir(path.join(contentRoot, 'pages'))).filter((file) => file.endsWith('.json'));
    const pages = await Promise.all(
      files.map(async (file) =>
        pageSchema.parse(JSON.parse(await fs.readFile(path.join(contentRoot, 'pages', file), 'utf8'))),
      ),
    );
    const publicRoutes = new Set(
      pages
        .filter((page) => page.status === 'published' && page.access.readRoles.includes('public'))
        .map((page) => (page.slug === 'home' ? '/' : `/${page.slug}`)),
    );
    return {
      primary: navigation.primary.filter(
        (item) => !item.href.startsWith('/') || publicRoutes.has(item.href.replace(/\/$/, '') || '/'),
      ),
    };
  } catch {
    return {
      primary: navigation.primary.filter(
        (item) => item.href === '/' || item.href.startsWith('#') || item.href.startsWith('https://'),
      ),
    };
  }
}
