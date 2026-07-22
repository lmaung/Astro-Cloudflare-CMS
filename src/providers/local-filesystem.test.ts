import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { heroDefinition } from '../components/blocks/hero/hero.definition';
import { LocalFilesystemProvider } from './local-filesystem';

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'astro-cms-content-'));
  await mkdir(path.join(root, 'pages'));
  await writeFile(
    path.join(root, 'content-manifest.json'),
    JSON.stringify({ id: 'fixture-site', schemaVersion: '1' }),
  );
  const page = {
    id: 'page-home',
    slug: 'home',
    title: 'Fixture',
    blocks: [{ id: 'hero', type: heroDefinition.type, status: 'active' as const, content: heroDefinition.defaults() }],
  };
  await writeFile(path.join(root, 'pages/home.json'), `${JSON.stringify(page, null, 2)}\n`);
  return { root, page };
}

describe('LocalFilesystemProvider', () => {
  it('reads validated page content', async () => {
    const { root, page } = await fixture();
    const result = await new LocalFilesystemProvider(root).readPage('home');
    expect(result.data).toEqual(page);
    expect(result.revision).toHaveLength(64);
  });

  it('writes atomically when the expected revision matches', async () => {
    const { root } = await fixture();
    const provider = new LocalFilesystemProvider(root);
    const current = await provider.readPage('home');
    current.data.title = 'Updated';
    await provider.writePage(current.data, current.revision);
    expect(JSON.parse(await readFile(path.join(root, 'pages/home.json'), 'utf8')).title).toBe('Updated');
  });

  it('rejects stale writes', async () => {
    const { root } = await fixture();
    const provider = new LocalFilesystemProvider(root);
    const current = await provider.readPage('home');
    await expect(provider.writePage(current.data, 'stale')).rejects.toMatchObject({
      code: 'stale_revision',
    });
  });

  it('rejects unsafe slugs', async () => {
    const { root } = await fixture();
    await expect(new LocalFilesystemProvider(root).readPage('../secret')).rejects.toMatchObject({
      code: 'unsafe_path',
    });
  });
});
