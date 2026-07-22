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

export async function commitFilesToMain(client: GitHubClient, branch: string, message: string, files: Array<{ path: string; content: string }>) {
  const base = await client.request<{ object: { sha: string } }>(`/git/ref/heads/${encodeURIComponent(branch)}`);
  const baseCommit = await client.request<{ tree?: { sha: string } }>(`/git/commits/${encodeURIComponent(base.object.sha)}`);
  if (!baseCommit.tree?.sha) throw new Error('GitHub returned an incomplete base commit.');
  const treeEntries = []; const revisions: Record<string, string> = {};
  for (const file of files) {
    const blob = await client.request<{ sha: string }>('/git/blobs', { method: 'POST', body: JSON.stringify({ content: file.content, encoding: 'utf-8' }) });
    revisions[file.path] = blob.sha;
    treeEntries.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const tree = await client.request<{ sha: string }>('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeEntries }) });
  const commit = await client.request<{ sha: string }>('/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: tree.sha, parents: [base.object.sha] }) });
  await client.request(`/git/refs/heads/${encodeURIComponent(branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
  return { commit: commit.sha, revisions };
}
