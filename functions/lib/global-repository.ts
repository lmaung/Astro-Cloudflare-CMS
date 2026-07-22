import { navigationSchema, siteSettingsSchema } from '../../src/domain/globals';
import { reusableLibrarySchema } from '../../src/domain/reusables';
import { mediaLibrarySchema } from '../../src/domain/media';
import { redirectsSchema } from '../../src/domain/redirects';
import type { AdminConfig } from './config';
import { ContentRequestError, listPages } from './content-repository';
import { commitFilesToMain, GitHubApiError, type GitHubClient } from './github';

export type GlobalKey = 'site-settings' | 'navigation' | 'reusable-blocks' | 'media-library' | 'redirects';
type GitHubContent = { content: string; encoding: string; sha: string };

function schemaFor(key: GlobalKey) { return key === 'site-settings' ? siteSettingsSchema : key === 'navigation' ? navigationSchema : key === 'reusable-blocks' ? reusableLibrarySchema : key === 'media-library' ? mediaLibrarySchema : redirectsSchema; }
function parse(key: GlobalKey, value: unknown) { return schemaFor(key).parse(value); }
function decode(value: string) { return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\s/g, '')), (item) => item.charCodeAt(0))); }
async function digest(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), (byte) => byte.toString(16).padStart(2, '0')).join(''); }

async function readAt(client: GitHubClient, key: GlobalKey, ref: string) {
  try {
    const file = await client.request<GitHubContent>(`/contents/globals/${key}.json?ref=${encodeURIComponent(ref)}`);
    return { data: parse(key, JSON.parse(decode(file.content))), revision: file.sha, mode: 'remote' as const };
  } catch (error) {
    if ((key === 'reusable-blocks' || key === 'media-library' || key === 'redirects') && error instanceof GitHubApiError && error.status === 404) {
      const branch = await client.request<{ object: { sha: string } }>(`/git/ref/heads/${encodeURIComponent(ref)}`);
      return { data: key === 'reusable-blocks' ? reusableLibrarySchema.parse({ blocks: [] }) : key === 'media-library' ? mediaLibrarySchema.parse({ assets: [] }) : redirectsSchema.parse({ redirects: [] }), revision: branch.object.sha, mode: 'remote' as const, missing: true as const };
    }
    if (error instanceof GitHubApiError && error.status === 404) throw new ContentRequestError('not_found', `Global content not found: ${key}`);
    if (error instanceof ContentRequestError) throw error;
    throw new ContentRequestError('unavailable', 'The global content could not be read.');
  }
}

export function readGlobal(client: GitHubClient, config: AdminConfig, key: GlobalKey) { return readAt(client, key, config.contentBranch); }

export async function saveGlobalDirect(client: GitHubClient, config: AdminConfig, key: GlobalKey, input: { data: unknown; expectedRevision: string; changeId: string }) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(input.changeId)) throw new ContentRequestError('invalid_content', 'A valid change identifier is required.');
  const data = parse(key, input.data); const current = await readGlobal(client, config, key);
  if (current.revision !== input.expectedRevision) throw new ContentRequestError('stale_revision', 'Global content changed after this editor was loaded. Reload before saving.');
  if (key === 'navigation') {
    const publishedRoutes = new Set((await listPages(client, config)).data.filter((page) => page.status === 'published').map((page) => page.slug === 'home' ? '/' : `/${page.slug}`));
    const navigation = navigationSchema.parse(data);
    const missing = navigation.primary.find((item) => item.href.startsWith('/') && !publishedRoutes.has(item.href.replace(/\/$/, '') || '/'));
    if (missing) throw new ContentRequestError('invalid_content', `Navigation link “${missing.label}” does not point to a published page.`);
  }
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  const artifact = `${JSON.stringify({ schemaVersion: '1', global: key, contentDigest: await digest(serialized), changeId: input.changeId.toLowerCase() }, null, 2)}\n`;
  try {
    const saved = await commitFilesToMain(client, config.contentBranch, `Update ${key}`, [{ path: `globals/${key}.json`, content: serialized }, { path: `_validation/globals/${key}.json`, content: artifact }], 'missing' in current ? current.revision : undefined);
    return { data, revision: saved.revisions[`globals/${key}.json`]!, mode: 'remote' as const, submission: { kind: 'direct_save' as const } };
  } catch { throw new ContentRequestError('unavailable', 'GitHub could not save the global content. No frontend deployment was triggered.'); }
}
