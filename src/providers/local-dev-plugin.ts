import path from 'node:path';
import type { Plugin } from 'vite';
import { ProviderError } from './contracts';
import { LocalFilesystemProvider } from './local-filesystem';

const endpoint = '/api/admin/content/home';

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
        if (request.url !== endpoint) return next();
        try {
          if (request.method === 'GET') {
            send(response, 200, { ...(await provider.readPage('home')), mode: 'local' });
            return;
          }
          if (request.method === 'PUT') {
            const payload = (await readJson(request)) as { data?: unknown; expectedRevision?: unknown };
            if (typeof payload.expectedRevision !== 'string') {
              send(response, 400, { code: 'invalid_content', message: 'Expected revision is required.' });
              return;
            }
            send(
              response,
              200,
              { ...(await provider.writePage(payload.data as never, payload.expectedRevision)), mode: 'local' },
            );
            return;
          }
          send(response, 405, { code: 'unavailable', message: 'Method not allowed.' });
        } catch (error) {
          if (error instanceof ProviderError) {
            const status = error.code === 'stale_revision' ? 409 : 422;
            send(response, status, { code: error.code, message: error.message });
            return;
          }
          send(response, 500, { code: 'unavailable', message: 'Local content service failed.' });
        }
      });
    },
  };
}
