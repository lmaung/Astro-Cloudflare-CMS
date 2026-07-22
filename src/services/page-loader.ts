import path from 'node:path';
import { heroDefinition } from '../components/blocks/hero/hero.definition';
import { richTextDefinition } from '../components/blocks/rich-text/rich-text.definition';
import type { PageDocument } from '../domain/content';
import { navigationSchema, siteSettingsSchema, type Navigation, type SiteSettings } from '../domain/globals';
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

const fallbackSettings: SiteSettings = {
  siteName: 'Astro CMS',
  tagline: 'Structured content for modern websites.',
  defaultSeo: { titleSuffix: 'Astro CMS', description: 'Reusable Git-backed CMS platform built with Astro.' },
  footer: { copyright: '© 2026 Astro CMS' },
};

const fallbackNavigation: Navigation = { primary: [{ label: 'Home', href: '/' }, { label: 'Content', href: '#content' }] };

async function readGlobal<T>(file: string, parse: (value: unknown) => T, fallback: T): Promise<T> {
  const contentRoot = path.resolve(process.env.CONTENT_REPO_PATH ?? path.join(process.cwd(), '..', 'astro-boilerplate-cms-content'));
  try { return parse(JSON.parse(await (await import('node:fs/promises')).readFile(path.join(contentRoot, 'globals', file), 'utf8'))); }
  catch { return fallback; }
}

export function loadSiteSettings() { return readGlobal('site-settings.json', (value) => siteSettingsSchema.parse(value), fallbackSettings); }
export function loadNavigation() { return readGlobal('navigation.json', (value) => navigationSchema.parse(value), fallbackNavigation); }
