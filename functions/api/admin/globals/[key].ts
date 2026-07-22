import { verifyCloudflareAccess, requireSameOrigin, AuthorizationError } from '../../../lib/access';
import { ConfigurationError, readAdminConfig, type AdminEnv } from '../../../lib/config';
import { ContentRequestError } from '../../../lib/content-repository';
import { readGlobal, saveGlobalDirect } from '../../../lib/global-repository';
import { createGitHubClient } from '../../../lib/github';
import { json, type PagesHandler } from '../../../lib/runtime';

export const onRequest: PagesHandler<AdminEnv> = async ({ request, env, params }) => {
  try {
    const config = readAdminConfig(env); await verifyCloudflareAccess(request, config);
    const key = params.key; if (key !== 'site-settings' && key !== 'navigation') return json({ code: 'unsafe_path', message: 'Unsupported global content key.' }, 400);
    const client = createGitHubClient(config);
    if (request.method === 'GET') return json(await readGlobal(client, config, key));
    if (request.method === 'PUT') { requireSameOrigin(request); const body = await request.json() as { data?: unknown; expectedRevision?: unknown; changeId?: unknown }; if (typeof body.expectedRevision !== 'string' || typeof body.changeId !== 'string') return json({ code: 'invalid_content', message: 'Expected revision and change identifier are required.' }, 400); return json(await saveGlobalDirect(client, config, key, { data: body.data, expectedRevision: body.expectedRevision, changeId: body.changeId })); }
    return json({ code: 'unavailable', message: 'Method not allowed.' }, 405);
  } catch (error) {
    if (error instanceof AuthorizationError) return json({ code: 'authorization_denied', message: error.message }, 403);
    if (error instanceof ConfigurationError) return json({ code: 'dependency_unavailable', message: 'The remote editor is not configured yet.' }, 503);
    if (error instanceof ContentRequestError) return json({ code: error.code, message: error.message }, error.code === 'stale_revision' || error.code === 'change_conflict' ? 409 : error.code === 'not_found' ? 404 : 422);
    return json({ code: 'unavailable', message: 'The remote global content service is unavailable.' }, 503);
  }
};
