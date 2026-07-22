import type { PageDocument } from '../domain/content';
import type { LocalPageResponse } from './types';

type ApiError = { code?: string; message?: string };

async function parseResponse(response: Response): Promise<LocalPageResponse> {
  const payload = (await response.json()) as LocalPageResponse | ApiError;
  if (!response.ok) {
    const error = payload as ApiError;
    throw new Error(error.message ?? 'The local content service is unavailable.');
  }
  return payload as LocalPageResponse;
}

export async function loadLocalPage(): Promise<LocalPageResponse> {
  return parseResponse(await fetch('/api/local-content/home', { cache: 'no-store' }));
}

export async function saveLocalPage(
  data: PageDocument,
  expectedRevision: string,
): Promise<LocalPageResponse> {
  return parseResponse(
    await fetch('/api/local-content/home', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, expectedRevision }),
    }),
  );
}
