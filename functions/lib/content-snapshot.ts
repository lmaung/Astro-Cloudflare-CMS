import { canRead, type Principal } from '../../src/domain/authorization';
import { resolveReusableBlock, reusableLibrarySchema } from '../../src/domain/reusables';
import type { AdminConfig } from './config';
import { ContentRequestError, readPage } from './content-repository';
import { readGlobal } from './global-repository';
import type { GitHubClient } from './github';

export class SnapshotAuthorizationError extends Error {}

function slugFromHref(href: string): string | undefined {
  const pathname = href.split(/[?#]/, 1)[0]?.replace(/^\/+|\/+$/g, '');
  if (!pathname) return 'home';
  const candidate = pathname.startsWith('members/') ? pathname.slice('members/'.length) : pathname;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate) ? candidate : undefined;
}

export function routeForPage(page: { slug: string; access: { readRoles: string[] } }): string {
  if (page.slug === 'home') return '/';
  return page.access.readRoles.includes('public') ? `/${page.slug}` : `/members/${page.slug}`;
}

export async function buildContentSnapshot(
  client: GitHubClient,
  config: AdminConfig,
  slug: string,
  principal: Principal,
) {
  const page = await readPage(client, config, slug);
  if (page.data.status !== 'published') throw new ContentRequestError('not_found', 'Page not found.');
  if (!canRead(page.data.access, principal))
    throw new SnapshotAuthorizationError('Your account does not have permission to read this page.');
  const [settings, navigation, reusables] = await Promise.all([
    readGlobal(client, config, 'site-settings'),
    readGlobal(client, config, 'navigation'),
    readGlobal(client, config, 'reusable-blocks'),
  ]);
  const primary = await Promise.all(
    (navigation.data as { primary: Array<{ label: string; href: string }> }).primary.map(async (item) => {
      if (!item.href.startsWith('/')) return item;
      const targetSlug = slugFromHref(item.href);
      if (!targetSlug) return undefined;
      try {
        const target = await readPage(client, config, targetSlug);
        return target.data.status === 'published' && canRead(target.data.access, principal)
          ? { ...item, href: routeForPage(target.data) }
          : undefined;
      } catch {
        return undefined;
      }
    }),
  );
  const library = reusableLibrarySchema.parse(reusables.data);
  return {
    page: {
      ...page.data,
      blocks: page.data.blocks.map((block) => resolveReusableBlock(block, library)),
    },
    settings: settings.data,
    navigation: {
      primary: primary.filter((item): item is { label: string; href: string } => Boolean(item)),
    },
  };
}
