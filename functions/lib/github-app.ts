import { importPKCS8, SignJWT } from 'jose';
import type { AdminConfig } from './config';

const githubApi = 'https://api.github.com';
const githubApiVersion = '2026-03-10';

export class GitHubApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function githubRequest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${githubApi}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'astro-cloudflare-cms',
      'X-GitHub-Api-Version': githubApiVersion,
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new GitHubApiError(response.status, `GitHub API request failed with status ${response.status}.`);
  }
  return (await response.json()) as T;
}

export async function createInstallationToken(config: AdminConfig): Promise<string> {
  const key = await importPKCS8(config.githubPrivateKey, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(config.githubAppId)
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 9 * 60)
    .sign(key);
  const result = await githubRequest<{ token: string }>(
    `/app/installations/${encodeURIComponent(config.githubInstallationId)}/access_tokens`,
    jwt,
    {
      method: 'POST',
      body: JSON.stringify({
        repositories: [config.contentRepo],
        permissions: { contents: 'write', pull_requests: 'write' },
      }),
    },
  );
  return result.token;
}

export type GitHubClient = ReturnType<typeof createGitHubClient>;

export function createGitHubClient(config: AdminConfig, token: string) {
  const repositoryPath = `/repos/${encodeURIComponent(config.contentOwner)}/${encodeURIComponent(config.contentRepo)}`;
  return {
    request<T>(path: string, init?: RequestInit) {
      return githubRequest<T>(`${repositoryPath}${path}`, token, init);
    },
  };
}
