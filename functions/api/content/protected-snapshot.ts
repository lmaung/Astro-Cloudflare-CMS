import { authenticatedPrincipal, AuthorizationError } from '../../lib/access';
import { AuthorizationStoreError } from '../../lib/authorization-store';
import { readAdminConfig, type AdminEnv } from '../../lib/config';
import { ContentRequestError } from '../../lib/content-repository';
import { buildContentSnapshot, SnapshotAuthorizationError } from '../../lib/content-snapshot';
import { createGitHubClient } from '../../lib/github';
import { json, type PagesHandler } from '../../lib/runtime';

export const onRequestGet: PagesHandler<AdminEnv> = async ({ env, request }) => {
  try {
    const config = readAdminConfig(env);
    const requestedSlug = new URL(request.url).searchParams.get('slug') ?? '';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(requestedSlug))
      return json({ code: 'not_found', message: 'Page not found.' }, 404);
    const principal = await authenticatedPrincipal(
      request,
      { ...config, accessAudience: config.memberAccessAudience },
    );
    return json(await buildContentSnapshot(createGitHubClient(config), config, requestedSlug, principal));
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof SnapshotAuthorizationError) {
      return json({ code: 'authorization_denied', message: error.message }, 403);
    }
    if (error instanceof ContentRequestError && error.code === 'not_found')
      return json({ code: 'not_found', message: 'Page not found.' }, 404);
    if (error instanceof AuthorizationStoreError)
      return json({ code: 'dependency_unavailable', message: error.message }, 503);
    return json(
      {
        code: 'unavailable',
        message: 'Protected content is temporarily unavailable.',
      },
      503,
    );
  }
};
