import { describe, expect, it, vi } from 'vitest';
import { heroDefinition } from '../components/blocks/hero/hero.definition';
import { GitHubContentProvider, type GitHubTransport } from './github';

const page = {
  id: 'page-home',
  slug: 'home',
  status: 'published' as const,
  title: 'Fixture',
  seo: { title: '', description: '' },
  blocks: [{ id: 'hero', type: heroDefinition.type, status: 'active' as const, content: heroDefinition.defaults() }],
};

function transport(overrides: Partial<GitHubTransport> = {}): GitHubTransport {
  return {
    readFile: vi.fn(async () => ({ content: JSON.stringify(page), sha: 'blob-1' })),
    commitFile: vi.fn(async () => ({ blobSha: 'blob-2' })),
    ...overrides,
  };
}

describe('GitHubContentProvider contract', () => {
  it('writes validated content with optimistic concurrency', async () => {
    const adapter = transport();
    const result = await new GitHubContentProvider(adapter).writePage(page, 'blob-1');
    expect(result.revision).toBe('blob-2');
    expect(adapter.commitFile).toHaveBeenCalledWith(expect.objectContaining({
      path: 'pages/home.json',
      expectedBlobSha: 'blob-1',
    }));
  });

  it('rejects a stale revision before committing', async () => {
    const adapter = transport();
    await expect(new GitHubContentProvider(adapter).writePage(page, 'old')).rejects.toMatchObject({
      code: 'stale_revision',
    });
    expect(adapter.commitFile).not.toHaveBeenCalled();
  });

  it('normalizes transport failures', async () => {
    const adapter = transport({ commitFile: vi.fn(async () => { throw new Error('upstream unavailable'); }) });
    await expect(new GitHubContentProvider(adapter).writePage(page, 'blob-1')).rejects.toMatchObject({
      code: 'unavailable',
    });
  });
});
