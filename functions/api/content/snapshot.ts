import { readAdminConfig, type AdminEnv } from '../../lib/config';
import { readPage } from '../../lib/content-repository';
import { readGlobal } from '../../lib/global-repository';
import { createGitHubClient } from '../../lib/github';
import { json, type PagesHandler } from '../../lib/runtime';

export const onRequestGet: PagesHandler<AdminEnv> = async ({ env }) => {
  try {
    const config = readAdminConfig(env); const client = createGitHubClient(config);
    const [page, settings, navigation] = await Promise.all([readPage(client, config, 'home'), readGlobal(client, config, 'site-settings'), readGlobal(client, config, 'navigation')]);
    return json({ page: page.data, settings: settings.data, navigation: navigation.data });
  } catch {
    return json({ code: 'unavailable', message: 'The latest published content is temporarily unavailable.' }, 503);
  }
};
