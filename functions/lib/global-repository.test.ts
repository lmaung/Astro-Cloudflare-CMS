import { describe, expect, it, vi } from 'vitest';
import type { AdminConfig } from './config';
import { ContentRequestError } from './content-repository';
import { saveGlobalDirect, submitGlobalPullRequest } from './global-repository';
import { GitHubApiError, type GitHubClient } from './github';

const config: AdminConfig = {
  accessTeamDomain: 'https://example.cloudflareaccess.com', accessAudience: 'audience', githubToken: 'token',
  contentOwner: 'owner', contentRepo: 'content-only', contentBranch: 'main',
};
const settings = { siteName: 'Example', tagline: 'A useful site.', defaultSeo: { titleSuffix: 'Example', description: 'Description' }, footer: { copyright: '© Example' } };
const encoded = () => btoa(JSON.stringify(settings));
const changeId = '12345678-1234-4123-8123-123456789abc';

describe('global content pull requests', () => {
  it('saves validated global content directly without a pull request', async () => {
    const calls: string[] = []; let reads = 0; let blobs = 0;
    const request = vi.fn(async (path: string) => {
      calls.push(path);
      if (path.startsWith('/contents/')) return { content: encoded(), encoding: 'base64', sha: ++reads === 1 ? 'old' : 'new' };
      if (path === '/git/ref/heads/main') return { object: { sha: 'base' } };
      if (path === '/git/commits/base') return { tree: { sha: 'base-tree' } };
      if (path === '/git/blobs') return { sha: `blob-${++blobs}` };
      if (path === '/git/trees') return { sha: 'tree' };
      if (path === '/git/commits') return { sha: 'commit' };
      if (path === '/git/refs/heads/main') return {};
      throw new Error(`Unexpected request: ${path}`);
    });
    const result = await saveGlobalDirect({ request } as GitHubClient, config, 'site-settings', { data: settings, expectedRevision: 'old', changeId });
    expect(result.submission.kind).toBe('direct_save'); expect(calls.filter((path) => path === '/git/blobs')).toHaveLength(2); expect(calls).not.toContain('/pulls');
  });
  it('creates one bounded two-file draft PR commit', async () => {
    const calls: Array<{ path: string; init: RequestInit | undefined }> = []; let blobs = 0;
    const request = vi.fn(async (path: string, init?: RequestInit) => {
      calls.push({ path, init });
      if (path === '/contents/globals/site-settings.json?ref=main') return { content: encoded(), encoding: 'base64', sha: 'old-blob' };
      if (path.startsWith('/git/ref/heads/cms%2F')) throw new GitHubApiError(404, 'missing');
      if (path === '/git/ref/heads/main') return { object: { sha: 'main-commit' } };
      if (path === '/git/commits/main-commit') return { sha: 'main-commit', tree: { sha: 'main-tree' } };
      if (path === '/git/blobs') return { sha: `blob-${++blobs}` };
      if (path === '/git/trees') return { sha: 'next-tree' };
      if (path === '/git/commits') return { sha: 'next-commit' };
      if (path === '/git/refs') return { object: { sha: 'next-commit' } };
      if (path === '/pulls') return { number: 3, html_url: 'https://github.example/pull/3' };
      throw new Error(`Unexpected request: ${path}`);
    });
    const result = await submitGlobalPullRequest({ request } as GitHubClient, config, 'site-settings', { data: settings, expectedRevision: 'old-blob', changeId });
    expect(result.submission.number).toBe(3);
    const treeCall = calls.find((call) => call.path === '/git/trees');
    expect(JSON.parse(String(treeCall?.init?.body)).tree.map((entry: { path: string }) => entry.path)).toEqual([
      'globals/site-settings.json', '_validation/globals/site-settings.json',
    ]);
    expect(calls.filter((call) => call.path === '/git/blobs')).toHaveLength(2);
    expect(JSON.parse(String(calls.find((call) => call.path === '/pulls')?.init?.body))).toMatchObject({ draft: true, base: 'main' });
  });

  it('rejects a stale revision before creating Git objects', async () => {
    const request = vi.fn(async () => ({ content: encoded(), encoding: 'base64', sha: 'newer' }));
    await expect(submitGlobalPullRequest({ request } as GitHubClient, config, 'site-settings', { data: settings, expectedRevision: 'older', changeId })).rejects.toMatchObject({ code: 'stale_revision' } satisfies Partial<ContentRequestError>);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('returns the existing PR for an identical retry', async () => {
    const request = vi.fn(async (path: string) => {
      if (path === '/contents/globals/navigation.json?ref=main' || path.includes('?ref=cms%2F')) return { content: btoa(JSON.stringify({ primary: [] })), encoding: 'base64', sha: 'same' };
      if (path.startsWith('/git/ref/heads/cms%2F')) return { object: { sha: 'existing' } };
      if (path.startsWith('/pulls?')) return [{ number: 4, html_url: 'https://github.example/pull/4' }];
      throw new Error(`Unexpected request: ${path}`);
    });
    const result = await submitGlobalPullRequest({ request } as GitHubClient, config, 'navigation', { data: { primary: [] }, expectedRevision: 'same', changeId });
    expect(result.submission.number).toBe(4);
    expect(request).toHaveBeenCalledTimes(4);
  });
});
