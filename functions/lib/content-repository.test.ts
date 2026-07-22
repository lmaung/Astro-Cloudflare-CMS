import { describe, expect, it, vi } from 'vitest';
import { heroDefinition } from '../../src/components/blocks/hero/hero.definition';
import type { AdminConfig } from './config';
import { ContentRequestError, submitPagePullRequest } from './content-repository';
import { GitHubApiError, type GitHubClient } from './github';

const config: AdminConfig = {
  accessTeamDomain: 'https://example.cloudflareaccess.com',
  accessAudience: 'audience',
  githubToken: 'github_pat_example',
  contentOwner: 'owner',
  contentRepo: 'content-only',
  contentBranch: 'main',
};

const page = {
  id: 'page-home',
  slug: 'home',
  title: 'Home',
  blocks: [{ id: 'hero', type: heroDefinition.type, status: 'active' as const, content: heroDefinition.defaults() }],
};

function encodedPage() {
  return btoa(JSON.stringify(page));
}

describe('content pull request submission', () => {
  it('creates a content-only draft branch and pull request without a deployment call', async () => {
    const calls: Array<{ path: string; init: RequestInit | undefined }> = [];
    const request = vi.fn(async (path: string, init?: RequestInit) => {
      calls.push({ path, init });
      if (path.startsWith('/contents/')) return { content: encodedPage(), encoding: 'base64', sha: 'blob-old' };
      if (path.startsWith('/git/ref/heads/cms%2F')) throw new GitHubApiError(404, 'missing');
      if (path === '/git/ref/heads/main') return { object: { sha: 'commit-main' } };
      if (path === '/git/commits/commit-main') return { sha: 'commit-main', tree: { sha: 'tree-main' } };
      if (path === '/git/blobs') return { sha: 'blob-new' };
      if (path === '/git/trees') return { sha: 'tree-new' };
      if (path === '/git/commits') return { sha: 'commit-new' };
      if (path === '/git/refs') return { object: { sha: 'commit-new' } };
      if (path === '/pulls') return { number: 12, html_url: 'https://github.example/pull/12' };
      throw new Error(`Unexpected request: ${path}`);
    });

    const result = await submitPagePullRequest({ request } as GitHubClient, config, 'home', {
      data: page,
      expectedRevision: 'blob-old',
      changeId: '12345678-1234-4123-8123-123456789abc',
    });

    expect(result.submission).toMatchObject({ kind: 'pull_request', number: 12 });
    const referenceCall = calls.find((call) => call.path === '/git/refs');
    expect(JSON.parse(String(referenceCall?.init?.body))).toMatchObject({
      ref: 'refs/heads/cms/12345678-1234-4123-8123-123456789abc',
    });
    const pullCall = calls.find((call) => call.path === '/pulls');
    expect(JSON.parse(String(pullCall?.init?.body))).toMatchObject({ base: 'main', draft: true });
    const treeCall = calls.find((call) => call.path === '/git/trees');
    expect(JSON.parse(String(treeCall?.init?.body))).toMatchObject({ base_tree: 'tree-main' });
    expect(JSON.parse(String(treeCall?.init?.body)).tree.map((entry: { path: string }) => entry.path)).toEqual([
      'pages/home.json',
      '_validation/pages/home.json',
    ]);
    expect(calls.filter((call) => call.path === '/git/blobs')).toHaveLength(2);
    expect(calls.every((call) => !call.path.includes('deploy'))).toBe(true);
  });

  it('rejects a stale content revision before creating Git objects', async () => {
    const request = vi.fn(async () => ({ content: encodedPage(), encoding: 'base64', sha: 'newer-blob' }));
    await expect(
      submitPagePullRequest({ request } as GitHubClient, config, 'home', {
        data: page,
        expectedRevision: 'old-blob',
        changeId: '12345678-1234-4123-8123-123456789abc',
      }),
    ).rejects.toMatchObject({ code: 'stale_revision' } satisfies Partial<ContentRequestError>);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('returns the existing pull request when the same change is retried', async () => {
    const request = vi.fn(async (path: string) => {
      if (path.startsWith('/contents/')) return { content: encodedPage(), encoding: 'base64', sha: 'blob-old' };
      if (path.startsWith('/git/ref/heads/cms%2F')) return { object: { sha: 'commit-existing' } };
      if (path.startsWith('/pulls?')) return [{ number: 8, html_url: 'https://github.example/pull/8' }];
      throw new Error(`Unexpected request: ${path}`);
    });
    const result = await submitPagePullRequest({ request } as GitHubClient, config, 'home', {
      data: page,
      expectedRevision: 'blob-old',
      changeId: '12345678-1234-4123-8123-123456789abc',
    });
    expect(result.submission.number).toBe(8);
    expect(request).toHaveBeenCalledTimes(4);
  });

  it('rejects reuse of a change identifier for different content', async () => {
    const different = { ...page, title: 'Different content' };
    const request = vi.fn(async (path: string) => {
      if (path === '/contents/pages/home.json?ref=main') {
        return { content: encodedPage(), encoding: 'base64', sha: 'blob-old' };
      }
      if (path.startsWith('/git/ref/heads/cms%2F')) return { object: { sha: 'commit-existing' } };
      if (path.startsWith('/contents/pages/home.json?ref=cms%2F')) {
        return { content: btoa(JSON.stringify(different)), encoding: 'base64', sha: 'blob-existing' };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    await expect(
      submitPagePullRequest({ request } as GitHubClient, config, 'home', {
        data: page,
        expectedRevision: 'blob-old',
        changeId: '12345678-1234-4123-8123-123456789abc',
      }),
    ).rejects.toMatchObject({ code: 'change_conflict' } satisfies Partial<ContentRequestError>);
  });
});
