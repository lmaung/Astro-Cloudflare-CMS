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

export type GitHubClient = ReturnType<typeof createGitHubClient>;

export function createGitHubClient(config: AdminConfig) {
  const repositoryPath = `/repos/${encodeURIComponent(config.contentOwner)}/${encodeURIComponent(config.contentRepo)}`;
  return {
    request<T>(path: string, init?: RequestInit) {
      return githubRequest<T>(`${repositoryPath}${path}`, config.githubToken, init);
    },
  };
}
