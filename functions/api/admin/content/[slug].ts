import { verifyCloudflareAccess, requireSameOrigin, AuthorizationError } from '../../../lib/access';
import { ConfigurationError, readAdminConfig, type AdminEnv } from '../../../lib/config';
import { readPage, submitPagePullRequest, ContentRequestError } from '../../../lib/content-repository';
import { createGitHubClient } from '../../../lib/github';
import { json, type PagesHandler } from '../../../lib/runtime';

function statusFor(error: ContentRequestError): number {
  if (error.code === 'not_found') return 404;
  if (error.code === 'stale_revision') return 409;
  if (error.code === 'invalid_content' || error.code === 'unsafe_path') return 422;
  return 503;
}

export const onRequest: PagesHandler<AdminEnv> = async ({ request, env, params }) => {
  try {
    const config = readAdminConfig(env);
    await verifyCloudflareAccess(request, config);
    const slug = params.slug;
    if (typeof slug !== 'string') return json({ code: 'unsafe_path', message: 'A single page slug is required.' }, 400);

    const client = createGitHubClient(config);
    if (request.method === 'GET') return json(await readPage(client, config, slug));
    if (request.method === 'PUT') {
      requireSameOrigin(request);
      const length = Number(request.headers.get('Content-Length') ?? '0');
      if (length > 300_000) return json({ code: 'invalid_content', message: 'The request exceeds the 300 KB limit.' }, 413);
      const requestBody = await request.text();
      if (new TextEncoder().encode(requestBody).byteLength > 300_000) {
        return json({ code: 'invalid_content', message: 'The request exceeds the 300 KB limit.' }, 413);
      }
      let input: { data?: unknown; expectedRevision?: unknown; changeId?: unknown };
      try {
        input = JSON.parse(requestBody) as typeof input;
      } catch {
        return json({ code: 'invalid_content', message: 'The request body must be valid JSON.' }, 400);
      }
      if (typeof input.expectedRevision !== 'string' || typeof input.changeId !== 'string') {
        return json({ code: 'invalid_content', message: 'Expected revision and change identifier are required.' }, 400);
      }
      return json(
        await submitPagePullRequest(client, config, slug, {
          data: input.data,
          expectedRevision: input.expectedRevision,
          changeId: input.changeId,
        }),
      );
    }
    return json({ code: 'unavailable', message: 'Method not allowed.' }, 405);
  } catch (error) {
    if (error instanceof AuthorizationError) return json({ code: 'authorization_denied', message: error.message }, 403);
    if (error instanceof ConfigurationError) {
      return json({ code: 'dependency_unavailable', message: 'The remote editor is not configured yet.' }, 503);
    }
    if (error instanceof ContentRequestError) return json({ code: error.code, message: error.message }, statusFor(error));
    return json({ code: 'unavailable', message: 'The remote content service is unavailable. No content was changed.' }, 503);
  }
};
