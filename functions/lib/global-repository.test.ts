import { describe, expect, it, vi } from 'vitest';
import type { AdminConfig } from './config';
import { ContentRequestError } from './content-repository';
import { saveGlobalDirect } from './global-repository';
import type { GitHubClient } from './github';

const config: AdminConfig = { accessTeamDomain: 'https://example.cloudflareaccess.com', accessAudience: 'audience', memberAccessAudience: 'member-audience', githubToken: 'token', contentOwner: 'owner', contentRepo: 'content-only', contentBranch: 'main' };
const settings = { siteName: 'Example', tagline: 'A useful site.', defaultSeo: { titleSuffix: 'Example', description: 'Description' }, footer: { copyright: '© Example' } };
const changeId = '12345678-1234-4123-8123-123456789abc';

describe('direct global publishing', () => {
  it('saves validated global content directly without a pull request', async () => {
    const calls: string[] = []; let blobs = 0;
    const request = vi.fn(async (path: string) => {
      calls.push(path);
      if (path.startsWith('/contents/')) return { content: btoa(JSON.stringify(settings)), encoding: 'base64', sha: 'old' };
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

  it('rejects a stale revision before creating Git objects', async () => {
    const request = vi.fn(async () => ({ content: btoa(JSON.stringify(settings)), encoding: 'base64', sha: 'newer' }));
    await expect(saveGlobalDirect({ request } as GitHubClient, config, 'site-settings', { data: settings, expectedRevision: 'older', changeId })).rejects.toMatchObject({ code: 'stale_revision' } satisfies Partial<ContentRequestError>);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('rejects navigation links to pages that are not published', async () => {
    const navigation = { primary: [{ label: 'Missing', href: '/missing' }] };
    const request = vi.fn(async (path: string) => {
      if (path === '/contents/globals/navigation.json?ref=main') return { content: btoa(JSON.stringify({ primary: [] })), encoding: 'base64', sha: 'nav-old' };
      if (path === '/contents/pages?ref=main') return [{ name: 'home.json', type: 'file' }];
      if (path === '/git/ref/heads/main') return { object: { sha: 'head' } };
      if (path === '/contents/pages/home.json?ref=main') return { content: btoa(JSON.stringify({ id: 'page-home', slug: 'home', status: 'published', title: 'Home', seo: { title: '', description: '' }, blocks: [] })), encoding: 'base64', sha: 'home-blob' };
      throw new Error(`Unexpected request: ${path}`);
    });
    await expect(saveGlobalDirect({ request } as GitHubClient, config, 'navigation', { data: navigation, expectedRevision: 'nav-old', changeId })).rejects.toMatchObject({ code: 'invalid_content' });
  });
});
