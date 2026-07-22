import { readAdminConfig, type AdminEnv } from '../../lib/config';
import { ContentRequestError } from '../../lib/content-repository';
import { createGitHubClient } from '../../lib/github';
import { json, type PagesHandler } from '../../lib/runtime';
import { principalFor } from '../../../src/domain/authorization';
import { buildContentSnapshot, SnapshotAuthorizationError } from '../../lib/content-snapshot';

export const onRequestGet: PagesHandler<AdminEnv> = async ({ env, request }) => {
  try {
    const config = readAdminConfig(env);
    const client = createGitHubClient(config);
    const requestedSlug = new URL(request.url).searchParams.get('slug') ?? 'home';
    const slug = requestedSlug === '' ? 'home' : requestedSlug;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return json({ code: 'not_found', message: 'Page not found.' }, 404);
    return json(await buildContentSnapshot(client, config, slug, principalFor()));
  } catch (error) {
    if (error instanceof SnapshotAuthorizationError)
      return json(
        {
          code: 'authentication_required',
          message: 'Sign in to view this page.',
        },
        401,
      );
    if (error instanceof ContentRequestError && error.code === 'not_found')
      return json({ code: 'not_found', message: 'Page not found.' }, 404);
    return json(
      {
        code: 'unavailable',
        message: 'The latest published content is temporarily unavailable.',
      },
      503,
    );
  }
};
