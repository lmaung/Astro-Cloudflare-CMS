import { readAdminConfig, type AdminEnv } from '../../lib/config';
import { ContentRequestError, readPage } from '../../lib/content-repository';
import { readGlobal } from '../../lib/global-repository';
import { createGitHubClient } from '../../lib/github';
import { json, type PagesHandler } from '../../lib/runtime';
import { resolveReusableBlock, reusableLibrarySchema } from '../../../src/domain/reusables';

export const onRequestGet: PagesHandler<AdminEnv> = async ({ env, request }) => {
  try {
    const config = readAdminConfig(env); const client = createGitHubClient(config);
    const requestedSlug = new URL(request.url).searchParams.get('slug') ?? 'home';
    const slug = requestedSlug === '' ? 'home' : requestedSlug;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return json({ code: 'not_found', message: 'Page not found.' }, 404);
    const [page, settings, navigation, reusables] = await Promise.all([readPage(client, config, slug), readGlobal(client, config, 'site-settings'), readGlobal(client, config, 'navigation'), readGlobal(client, config, 'reusable-blocks')]);
    if (page.data.status !== 'published') return json({ code: 'not_found', message: 'Page not found.' }, 404);
    const library = reusableLibrarySchema.parse(reusables.data);
    return json({ page: { ...page.data, blocks: page.data.blocks.map((block) => resolveReusableBlock(block, library)) }, settings: settings.data, navigation: navigation.data });
  } catch (error) {
    if (error instanceof ContentRequestError && error.code === 'not_found') return json({ code: 'not_found', message: 'Page not found.' }, 404);
    return json({ code: 'unavailable', message: 'The latest published content is temporarily unavailable.' }, 503);
  }
};
