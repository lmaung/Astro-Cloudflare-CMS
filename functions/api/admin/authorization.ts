import { AuthorizationError, requireSameOrigin, verifyCloudflareAccess } from '../../lib/access';
import {
  AuthorizationStoreError,
  readAuthorizationDirectory,
  replaceAuthorizationDirectory,
} from '../../lib/authorization-store';
import { ConfigurationError, readAdminConfig, type AdminEnv } from '../../lib/config';
import { json, type PagesHandler } from '../../lib/runtime';
import { authorizationDirectorySchema } from '../../../src/domain/authorization';
import { listPages, readPage } from '../../lib/content-repository';
import { createGitHubClient } from '../../lib/github';

export const onRequest: PagesHandler<AdminEnv> = async ({ request, env }) => {
  try {
    const config = readAdminConfig(env);
    const client = createGitHubClient(config);
    const identity = await verifyCloudflareAccess(request, config);
    if (request.method === 'GET') {
      const directory = await readAuthorizationDirectory(client, config);
      return json({
        data: directory.data,
        revision: directory.revision,
        currentUser: {
          email: typeof identity.email === 'string' ? identity.email : '',
        },
      });
    }
    if (request.method === 'PUT') {
      requireSameOrigin(request);
      const body = (await request.json()) as { data?: unknown; expectedRevision?: string };
      const current = await readAuthorizationDirectory(client, config);
      const candidate = authorizationDirectorySchema.parse(body.data);
      const candidateRoles = new Set(candidate.roles.map((role) => role.key));
      const removedRoles = current.data.roles.map((role) => role.key).filter((role) => !candidateRoles.has(role));
      if (removedRoles.length) {
        const pages = await listPages(client, config);
        for (const summary of pages.data) {
          const page = await readPage(client, config, summary.slug);
          const used = [...page.data.access.readRoles, ...page.data.access.writeRoles].find((role) =>
            removedRoles.includes(role),
          );
          if (used)
            return json(
              {
                code: 'role_in_use',
                message: `Role “${used}” is still used by page “${page.data.title}”. Remove that page permission first.`,
              },
              409,
            );
        }
      }
      if (typeof body.expectedRevision !== 'string' || !body.expectedRevision) {
        return json({ code: 'invalid_authorization', message: 'An authorization revision is required.' }, 422);
      }
      const saved = await replaceAuthorizationDirectory(client, config, candidate, body.expectedRevision);
      return json({
        data: saved.data,
        revision: saved.revision,
        currentUser: {
          email: typeof identity.email === 'string' ? identity.email : '',
        },
      });
    }
    return json({ code: 'method_not_allowed', message: 'Method not allowed.' }, 405);
  } catch (error) {
    if (error instanceof AuthorizationError) return json({ code: 'authorization_denied', message: error.message }, 403);
    if (error instanceof ConfigurationError || error instanceof AuthorizationStoreError) {
      return json({ code: 'dependency_unavailable', message: error.message }, 503);
    }
    return json(
      {
        code: 'invalid_authorization',
        message: error instanceof Error ? error.message : 'Authorization data is invalid.',
      },
      422,
    );
  }
};
