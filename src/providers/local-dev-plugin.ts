import path from 'node:path';
import type { Plugin } from 'vite';
import { ProviderError } from './contracts';
import { LocalFilesystemProvider } from './local-filesystem';
import { authorizationDirectorySchema, validatePolicyRoles } from '../domain/authorization';
import { pageSchema } from '../domain/content';
import { defaultRoles } from '../../functions/lib/authorization-store';

const pagePattern = /^\/api\/admin\/content\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;
const pagesEndpoint = '/api/admin/pages';
const globalPattern = /^\/api\/admin\/globals\/(site-settings|navigation|reusable-blocks|media-library|redirects)$/;
const authorizationEndpoint = '/api/admin/authorization';

function send(response: import('node:http').ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

async function readJson(request: import('node:http').IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    total += buffer.length;
    if (total > 256_000) throw new Error('Request is too large.');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function localContentPlugin(): Plugin {
  return {
    name: 'astro-cms-local-content',
    apply: 'serve',
    configureServer(server) {
      const contentRoot = path.resolve(
        process.env.CONTENT_REPO_PATH ?? path.join(process.cwd(), '..', 'astro-boilerplate-cms-content'),
      );
      const provider = new LocalFilesystemProvider(contentRoot);

      server.middlewares.use(async (request, response, next) => {
        const globalMatch = request.url?.match(globalPattern);
        const pageMatch = request.url?.match(pagePattern);
        if (!pageMatch && request.url !== pagesEndpoint && request.url !== authorizationEndpoint && !globalMatch)
          return next();
        try {
          if (request.url === authorizationEndpoint) {
            if (request.method === 'GET') {
              const stored = await provider.readGlobal('authorization');
              const parsed = authorizationDirectorySchema.parse(stored.data);
              const byKey = new Map([...defaultRoles, ...parsed.roles].map((role) => [role.key, role]));
              return send(response, 200, {
                data: { ...parsed, roles: [...byKey.values()] },
                revision: stored.revision,
                currentUser: { email: 'local-admin@example.test' },
              });
            }
            if (request.method === 'PUT') {
              const payload = (await readJson(request)) as { data?: unknown; expectedRevision?: string };
              if (typeof payload.expectedRevision !== 'string') throw new Error('An authorization revision is required.');
              const authorization = authorizationDirectorySchema.parse(payload.data);
              const saved = await provider.writeGlobal('authorization', authorization, payload.expectedRevision);
              return send(response, 200, {
                data: saved.data,
                revision: saved.revision,
                currentUser: { email: 'local-admin@example.test' },
              });
            }
            return send(response, 405, {
              code: 'unavailable',
              message: 'Method not allowed.',
            });
          }
          if (globalMatch) {
            const key = globalMatch[1] as
              'site-settings' | 'navigation' | 'reusable-blocks' | 'media-library' | 'redirects';
            if (request.method === 'GET')
              return send(response, 200, {
                ...(await provider.readGlobal(key)),
                mode: 'local',
              });
            if (request.method === 'PUT') {
              const payload = (await readJson(request)) as {
                data?: unknown;
                expectedRevision?: unknown;
              };
              if (typeof payload.expectedRevision !== 'string')
                return send(response, 400, {
                  code: 'invalid_content',
                  message: 'Expected revision is required.',
                });
              return send(response, 200, {
                ...(await provider.writeGlobal(key, payload.data, payload.expectedRevision)),
                mode: 'local',
              });
            }
            return send(response, 405, {
              code: 'unavailable',
              message: 'Method not allowed.',
            });
          }
          if (request.url === pagesEndpoint) {
            if (request.method === 'GET')
              return send(response, 200, {
                ...(await provider.listPages()),
                mode: 'local',
              });
            if (request.method === 'POST') {
              const payload = (await readJson(request)) as {
                data?: unknown;
                expectedRevision?: unknown;
              };
              if (typeof payload.expectedRevision !== 'string')
                return send(response, 400, {
                  code: 'invalid_content',
                  message: 'Expected revision is required.',
                });
              const page = pageSchema.parse(payload.data);
              validatePolicyRoles(
                page.access,
                (authorizationDirectorySchema.parse((await provider.readGlobal('authorization')).data).roles.length ? authorizationDirectorySchema.parse((await provider.readGlobal('authorization')).data).roles : defaultRoles).map((role) => role.key),
              );
              return send(response, 201, {
                ...(await provider.createPage(payload.data as never, payload.expectedRevision)),
                mode: 'local',
              });
            }
            return send(response, 405, {
              code: 'unavailable',
              message: 'Method not allowed.',
            });
          }
          const slug = pageMatch?.[1];
          if (!slug) return next();
          if (request.method === 'GET') {
            send(response, 200, {
              ...(await provider.readPage(slug)),
              mode: 'local',
            });
            return;
          }
          if (request.method === 'PUT') {
            const payload = (await readJson(request)) as {
              data?: unknown;
              expectedRevision?: unknown;
            };
            if (typeof payload.expectedRevision !== 'string') {
              send(response, 400, {
                code: 'invalid_content',
                message: 'Expected revision is required.',
              });
              return;
            }
            const page = pageSchema.parse(payload.data);
            validatePolicyRoles(
              page.access,
              (authorizationDirectorySchema.parse((await provider.readGlobal('authorization')).data).roles.length ? authorizationDirectorySchema.parse((await provider.readGlobal('authorization')).data).roles : defaultRoles).map((role) => role.key),
            );
            send(response, 200, {
              ...(await provider.writePage(payload.data as never, payload.expectedRevision)),
              mode: 'local',
            });
            return;
          }
          if (request.method === 'DELETE') {
            const payload = (await readJson(request)) as {
              expectedRevision?: unknown;
              confirmation?: unknown;
            };
            if (typeof payload.expectedRevision !== 'string' || typeof payload.confirmation !== 'string')
              return send(response, 400, {
                code: 'invalid_content',
                message: 'Expected revision and confirmation are required.',
              });
            return send(response, 200, {
              ...(await provider.deletePage(slug, payload.expectedRevision, payload.confirmation)),
              mode: 'local',
            });
          }
          send(response, 405, {
            code: 'unavailable',
            message: 'Method not allowed.',
          });
        } catch (error) {
          if (error instanceof ProviderError) {
            const status = error.code === 'stale_revision' ? 409 : 422;
            send(response, status, {
              code: error.code,
              message: error.message,
            });
            return;
          }
          send(response, 500, {
            code: 'unavailable',
            message: 'Local content service failed.',
          });
        }
      });
    },
  };
}
