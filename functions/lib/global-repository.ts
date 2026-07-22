import { navigationSchema, siteSettingsSchema } from '../../src/domain/globals';
import type { AdminConfig } from './config';
import { ContentRequestError } from './content-repository';
import { commitFilesToMain, GitHubApiError, type GitHubClient } from './github';

type GlobalKey = 'site-settings' | 'navigation';
type GitHubContent = { content: string; encoding: string; sha: string };
type GitReference = { object: { sha: string } };
type GitCommit = { sha: string; tree?: { sha: string } };
type PullRequest = { number: number; html_url: string };

function parse(key: GlobalKey, value: unknown) { return (key === 'site-settings' ? siteSettingsSchema : navigationSchema).parse(value); }
function decode(value: string) { return new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\s/g, '')), (item) => item.charCodeAt(0))); }
function encode(value: string) { const bytes = new TextEncoder().encode(value); let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(binary); }
async function digest(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), (byte) => byte.toString(16).padStart(2, '0')).join(''); }

async function readAt(client: GitHubClient, key: GlobalKey, ref: string) {
  try {
    const file = await client.request<GitHubContent>(`/contents/globals/${key}.json?ref=${encodeURIComponent(ref)}`);
    return { data: parse(key, JSON.parse(decode(file.content))), revision: file.sha, mode: 'remote' as const };
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) throw new ContentRequestError('not_found', `Global content not found: ${key}`);
    if (error instanceof ContentRequestError) throw error;
    throw new ContentRequestError('unavailable', 'The global content could not be read.');
  }
}

export function readGlobal(client: GitHubClient, config: AdminConfig, key: GlobalKey) { return readAt(client, key, config.contentBranch); }

export async function submitGlobalPullRequest(client: GitHubClient, config: AdminConfig, key: GlobalKey, input: { data: unknown; expectedRevision: string; changeId: string }) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(input.changeId)) throw new ContentRequestError('invalid_content', 'A valid change identifier is required.');
  const data = parse(key, input.data); const current = await readGlobal(client, config, key);
  if (current.revision !== input.expectedRevision) throw new ContentRequestError('stale_revision', 'Global content changed after this editor was loaded. Reload before submitting.');
  const branch = `cms/${input.changeId.toLowerCase()}`;
  const createPr = () => client.request<PullRequest>('/pulls', { method: 'POST', body: JSON.stringify({ title: `Update ${key}`, head: branch, base: config.contentBranch, body: 'Created by the Astro CMS editor. This content change does not trigger a frontend deployment.', draft: true }) });
  try {
    await client.request<GitReference>(`/git/ref/heads/${encodeURIComponent(branch)}`);
    const branchData = await readAt(client, key, branch);
    if (JSON.stringify(branchData.data) !== JSON.stringify(data)) throw new ContentRequestError('change_conflict', 'This change identifier already belongs to different content.');
    const pulls = await client.request<PullRequest[]>(`/pulls?state=open&head=${encodeURIComponent(`${config.contentOwner}:${branch}`)}&base=${encodeURIComponent(config.contentBranch)}`);
    const pull = pulls[0] ?? await createPr(); return response(data, current.revision, pull, branch);
  } catch (error) { if (!(error instanceof GitHubApiError && error.status === 404)) throw error; }
  try {
    const base = await client.request<GitReference>(`/git/ref/heads/${encodeURIComponent(config.contentBranch)}`);
    const commit = await client.request<GitCommit>(`/git/commits/${base.object.sha}`); if (!commit.tree?.sha) throw new Error('Missing tree');
    const serialized = `${JSON.stringify(data, null, 2)}\n`;
    const artifact = `${JSON.stringify({ schemaVersion: '1', global: key, contentDigest: await digest(serialized), changeId: input.changeId.toLowerCase() }, null, 2)}\n`;
    const blob = await client.request<{ sha: string }>('/git/blobs', { method: 'POST', body: JSON.stringify({ content: encode(serialized), encoding: 'base64' }) });
    const proof = await client.request<{ sha: string }>('/git/blobs', { method: 'POST', body: JSON.stringify({ content: encode(artifact), encoding: 'base64' }) });
    const tree = await client.request<{ sha: string }>('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: commit.tree.sha, tree: [{ path: `globals/${key}.json`, mode: '100644', type: 'blob', sha: blob.sha }, { path: `_validation/globals/${key}.json`, mode: '100644', type: 'blob', sha: proof.sha }] }) });
    const next = await client.request<GitCommit>('/git/commits', { method: 'POST', body: JSON.stringify({ message: `Update ${key}`, tree: tree.sha, parents: [base.object.sha] }) });
    await client.request('/git/refs', { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: next.sha }) });
    return response(data, current.revision, await createPr(), branch);
  } catch (error) { if (error instanceof ContentRequestError) throw error; throw new ContentRequestError('unavailable', 'GitHub could not create the global content pull request.'); }
}

function response(data: unknown, revision: string, pull: PullRequest, branch: string) { return { data, revision, mode: 'remote' as const, submission: { kind: 'pull_request' as const, number: pull.number, url: pull.html_url, branch } }; }

export async function saveGlobalDirect(client: GitHubClient, config: AdminConfig, key: GlobalKey, input: { data: unknown; expectedRevision: string; changeId: string }) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(input.changeId)) throw new ContentRequestError('invalid_content', 'A valid change identifier is required.');
  const data = parse(key, input.data); const current = await readGlobal(client, config, key);
  if (current.revision !== input.expectedRevision) throw new ContentRequestError('stale_revision', 'Global content changed after this editor was loaded. Reload before saving.');
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  const artifact = `${JSON.stringify({ schemaVersion: '1', global: key, contentDigest: await digest(serialized), changeId: input.changeId.toLowerCase() }, null, 2)}\n`;
  try {
    const saved = await commitFilesToMain(client, config.contentBranch, `Update ${key}`, [{ path: `globals/${key}.json`, content: serialized }, { path: `_validation/globals/${key}.json`, content: artifact }]);
    return { data, revision: saved.revisions[`globals/${key}.json`]!, mode: 'remote' as const, submission: { kind: 'direct_save' as const } };
  } catch { throw new ContentRequestError('unavailable', 'GitHub could not save the global content. No frontend deployment was triggered.'); }
}
