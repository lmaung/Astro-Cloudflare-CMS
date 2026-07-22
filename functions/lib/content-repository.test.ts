import { describe, expect, it, vi } from 'vitest';
import { heroDefinition } from '../../src/components/blocks/hero/hero.definition';
import type { AdminConfig } from './config';
import { ContentRequestError, createPageDirect, deletePageDirect, listPages, savePageDirect } from './content-repository';
import { GitHubApiError, type GitHubClient } from './github';

const config: AdminConfig = { accessTeamDomain: 'https://example.cloudflareaccess.com', accessAudience: 'audience', githubToken: 'token', contentOwner: 'owner', contentRepo: 'content-only', contentBranch: 'main' };
const changeId = '12345678-1234-4123-8123-123456789abc';
const page = { id: 'page-home', slug: 'home', status: 'published' as const, title: 'Home', seo: { title: '', description: '', socialImageAlt: '', noIndex: false }, blocks: [{ id: 'hero', type: heroDefinition.type, status: 'active' as const, content: heroDefinition.defaults() }] };
const encoded = (value: unknown = page) => btoa(JSON.stringify(value));

function directSaveClient(current = page) {
  const calls: Array<{ path: string; init: RequestInit | undefined }> = []; let blobs = 0;
  const request = vi.fn(async (path: string, init?: RequestInit) => {
    calls.push({ path, init });
    if (path.startsWith('/contents/')) return { content: encoded(current), encoding: 'base64', sha: 'blob-old' };
    if (path === '/git/ref/heads/main') return { object: { sha: 'commit-main' } };
    if (path === '/git/commits/commit-main') return { tree: { sha: 'tree-main' } };
    if (path === '/git/blobs') return { sha: `blob-${++blobs}` };
    if (path === '/git/trees') return { sha: 'tree-new' };
    if (path === '/git/commits') return { sha: 'commit-new' };
    if (path === '/git/refs/heads/main') return {};
    throw new Error(`Unexpected request: ${path}`);
  });
  return { client: { request } as GitHubClient, calls };
}

describe('direct page publishing', () => {
  it('validates and atomically saves page plus proof directly to main', async () => {
    const { client, calls } = directSaveClient();
    const result = await savePageDirect(client, config, 'home', { data: page, expectedRevision: 'blob-old', changeId });
    expect(result.submission.kind).toBe('direct_save');
    expect(calls.filter((call) => call.path === '/git/blobs')).toHaveLength(2);
    expect(calls.find((call) => call.path === '/git/refs/heads/main')?.init?.method).toBe('PATCH');
    expect(calls.some((call) => call.path === '/pulls')).toBe(false);
  });

  it('rejects a stale page before creating Git objects', async () => {
    const request = vi.fn(async () => ({ content: encoded(), encoding: 'base64', sha: 'newer-blob' }));
    await expect(savePageDirect({ request } as GitHubClient, config, 'home', { data: page, expectedRevision: 'old-blob', changeId })).rejects.toMatchObject({ code: 'stale_revision' } satisfies Partial<ContentRequestError>);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('protects the home page from archival', async () => {
    const { client } = directSaveClient();
    await expect(savePageDirect(client, config, 'home', { data: { ...page, status: 'archived' }, expectedRevision: 'blob-old', changeId })).rejects.toMatchObject({ code: 'invalid_content' });
  });

  it('blocks archival while navigation still references the page', async () => {
    const about = { ...page, id: 'page-about', slug: 'about', title: 'About' };
    const request = vi.fn(async (path: string) => {
      if (path === '/contents/pages/about.json?ref=main') return { content: encoded(about), encoding: 'base64', sha: 'about-old' };
      if (path === '/contents/globals/navigation.json?ref=main') return { content: btoa(JSON.stringify({ primary: [{ label: 'About', href: '/about' }] })), encoding: 'base64', sha: 'nav' };
      throw new Error(`Unexpected request: ${path}`);
    });
    await expect(savePageDirect({ request } as GitHubClient, config, 'about', { data: { ...about, status: 'archived' }, expectedRevision: 'about-old', changeId })).rejects.toMatchObject({ code: 'change_conflict' });
  });

  it('creates a new page with an atomic page and validation commit', async () => {
    const about = { ...page, id: 'page-about', slug: 'about', title: 'About' };
    const calls: Array<{ path: string; init: RequestInit | undefined }> = []; let blobs = 0;
    const request = vi.fn(async (path: string, init?: RequestInit) => {
      calls.push({ path, init });
      if (path === '/git/ref/heads/main') return { object: { sha: 'commit-main' } };
      if (path === '/contents/pages/about.json?ref=main') throw new GitHubApiError(404, 'missing');
      if (path === '/git/commits/commit-main') return { tree: { sha: 'tree-main' } };
      if (path === '/git/blobs') return { sha: `blob-${++blobs}` };
      if (path === '/git/trees') return { sha: 'tree-new' };
      if (path === '/git/commits') return { sha: 'commit-new' };
      if (path === '/git/refs/heads/main') return {};
      throw new Error(`Unexpected request: ${path}`);
    });
    const result = await createPageDirect({ request } as GitHubClient, config, { data: about, expectedRevision: 'commit-main', changeId });
    expect(result.data.slug).toBe('about'); expect(result.collectionRevision).toBe('commit-new');
    const tree = JSON.parse(String(calls.find((call) => call.path === '/git/trees')?.init?.body)).tree;
    expect(tree.map((entry: { path: string }) => entry.path)).toEqual(['pages/about.json', '_validation/pages/about.json']);
  });

  it('lists page summaries and the collection head revision', async () => {
    const request = vi.fn(async (path: string) => {
      if (path === '/contents/pages?ref=main') return [{ name: 'home.json', type: 'file' }];
      if (path === '/git/ref/heads/main') return { object: { sha: 'commit-main' } };
      if (path === '/contents/pages/home.json?ref=main') return { content: encoded(), encoding: 'base64', sha: 'blob-home' };
      throw new Error(`Unexpected request: ${path}`);
    });
    const result = await listPages({ request } as GitHubClient, config);
    expect(result).toMatchObject({ revision: 'commit-main', data: [{ slug: 'home', status: 'published' }] });
  });

  it('permanently deletes an archived page and its validation artifact atomically', async () => {
    const archived = { ...page, id: 'page-about', slug: 'about', title: 'About', status: 'archived' as const };
    const calls: Array<{ path: string; init: RequestInit | undefined }> = [];
    const request = vi.fn(async (path: string, init?: RequestInit) => {
      calls.push({ path, init });
      if (path === '/contents/pages/about.json?ref=main') return { content: encoded(archived), encoding: 'base64', sha: 'about-old' };
      if (path === '/contents/globals/navigation.json?ref=main') return { content: btoa(JSON.stringify({ primary: [{ label: 'Home', href: '/' }] })), encoding: 'base64', sha: 'nav' };
      if (path === '/contents/reusables?ref=main') throw new GitHubApiError(404, 'missing');
      if (path === '/git/ref/heads/main') return { object: { sha: 'commit-main' } };
      if (path === '/git/commits/commit-main') return { tree: { sha: 'tree-main' } };
      if (path === '/git/trees') return { sha: 'tree-new' };
      if (path === '/git/commits') return { sha: 'commit-new' };
      if (path === '/git/refs/heads/main') return {};
      throw new Error(`Unexpected request: ${path}`);
    });
    const result = await deletePageDirect({ request } as GitHubClient, config, 'about', { expectedRevision: 'about-old', confirmation: 'about' });
    expect(result).toMatchObject({ deleted: true, slug: 'about', collectionRevision: 'commit-new' });
    const tree = JSON.parse(String(calls.find((call) => call.path === '/git/trees')?.init?.body)).tree;
    expect(tree).toEqual([
      { path: 'pages/about.json', mode: '100644', type: 'blob', sha: null },
      { path: '_validation/pages/about.json', mode: '100644', type: 'blob', sha: null },
    ]);
    expect(calls.filter((call) => call.path === '/git/blobs')).toHaveLength(0);
  });

  it('rejects permanent deletion until the page is archived and confirmed', async () => {
    const { client } = directSaveClient();
    await expect(deletePageDirect(client, config, 'home', { expectedRevision: 'blob-old', confirmation: 'home' })).rejects.toMatchObject({ code: 'invalid_content' });
    const published = { ...page, id: 'page-about', slug: 'about', title: 'About' };
    const request = vi.fn(async () => ({ content: encoded(published), encoding: 'base64', sha: 'about-old' }));
    await expect(deletePageDirect({ request } as GitHubClient, config, 'about', { expectedRevision: 'about-old', confirmation: 'about' })).rejects.toMatchObject({ code: 'invalid_content' });
  });
});
