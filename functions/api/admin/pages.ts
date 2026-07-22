import { verifyCloudflareAccess, requireSameOrigin, AuthorizationError } from '../../lib/access';
import { ConfigurationError, readAdminConfig, type AdminEnv } from '../../lib/config';
import { ContentRequestError, createPageDirect, listPages } from '../../lib/content-repository';
import { createGitHubClient } from '../../lib/github';
import { json, type PagesHandler } from '../../lib/runtime';
import { knownRoleKeys, AuthorizationStoreError } from '../../lib/authorization-store';
import { pageSchema } from '../../../src/domain/content';
import { validatePolicyRoles } from '../../../src/domain/authorization';

function statusFor(error: ContentRequestError): number {
  if (error.code === 'not_found') return 404;
  if (error.code === 'change_conflict' || error.code === 'stale_revision') return 409;
  if (error.code === 'invalid_content' || error.code === 'unsafe_path') return 422;
  return 503;
}

export const onRequest: PagesHandler<AdminEnv> = async ({ request, env }) => {
  try {
    const config = readAdminConfig(env);
    await verifyCloudflareAccess(request, config);
    const client = createGitHubClient(config);
    if (request.method === 'GET') return json(await listPages(client, config));
    if (request.method === 'POST') {
      requireSameOrigin(request);
      const body = (await request.json()) as {
        data?: unknown;
        expectedRevision?: unknown;
        changeId?: unknown;
      };
      if (typeof body.expectedRevision !== 'string' || typeof body.changeId !== 'string')
        return json(
          {
            code: 'invalid_content',
            message: 'Expected revision and change identifier are required.',
          },
          400,
        );
      const candidate = pageSchema.parse(body.data);
      validatePolicyRoles(candidate.access, await knownRoleKeys(createGitHubClient(config), config));
      return json(
        await createPageDirect(client, config, {
          data: body.data,
          expectedRevision: body.expectedRevision,
          changeId: body.changeId,
        }),
        201,
      );
    }
    return json({ code: 'unavailable', message: 'Method not allowed.' }, 405);
  } catch (error) {
    if (error instanceof AuthorizationError) return json({ code: 'authorization_denied', message: error.message }, 403);
    if (error instanceof ConfigurationError)
      return json(
        {
          code: 'dependency_unavailable',
          message: 'The remote editor is not configured yet.',
        },
        503,
      );
    if (error instanceof AuthorizationStoreError)
      return json({ code: 'dependency_unavailable', message: error.message }, 503);
    if (error instanceof ContentRequestError)
      return json({ code: error.code, message: error.message }, statusFor(error));
    return json(
      {
        code: 'unavailable',
        message: 'The page collection is unavailable. No content was changed.',
      },
      503,
    );
  }
};
