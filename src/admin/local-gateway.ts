import type { PageDocument } from '../domain/content';
import type { PageResponse } from './types';

type ApiError = { code?: string; message?: string };

async function parseResponse(response: Response): Promise<PageResponse> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      response.ok
        ? 'The editor API returned an unexpected response. The remote editor may not be configured.'
        : 'The editor API is unavailable. Check the Cloudflare Pages Function configuration.',
    );
  }
  const payload = (await response.json()) as PageResponse | ApiError;
  if (!response.ok) {
    const error = payload as ApiError;
    throw new Error(error.message ?? 'The local content service is unavailable.');
  }
  return payload as PageResponse;
}

export async function loadPage(): Promise<PageResponse> {
  return parseResponse(await fetch('/api/admin/content/home', { cache: 'no-store' }));
}

export async function savePage(
  data: PageDocument,
  expectedRevision: string,
  changeId: string,
): Promise<PageResponse> {
  return parseResponse(
    await fetch('/api/admin/content/home', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, expectedRevision, changeId }),
    }),
  );
}
