import { pageSchema, type PageDocument } from '../../src/domain/content';
import { validateBlock } from '../../src/components/blocks/registry';
import type { AdminConfig } from './config';
import { commitFilesToMain, GitHubApiError, type GitHubClient } from './github';

type GitHubContent = { content: string; encoding: string; sha: string };
type GitReference = { object: { sha: string } };
type GitBlob = { sha: string };
type GitTree = { sha: string };
type GitCommit = { sha: string; tree?: { sha: string } };
type PullRequest = { number: number; html_url: string };

export class ContentRequestError extends Error {
  constructor(
    readonly code: 'change_conflict' | 'invalid_content' | 'not_found' | 'stale_revision' | 'unsafe_path' | 'unavailable',
    message: string,
  ) {
    super(message);
  }
}

function validationPath(slug: string): string {
  return `_validation/pages/${slug}.json`;
}

function pagePath(slug: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new ContentRequestError('unsafe_path', 'Page slug contains unsupported characters.');
  }
  return `pages/${slug}.json`;
}

function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(binary);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validatePage(value: unknown, expectedSlug: string): PageDocument {
  try {
    const page = pageSchema.parse(value);
    if (page.slug !== expectedSlug) throw new Error('The page slug cannot be changed by this endpoint.');
    page.blocks.forEach((block) => validateBlock(block.type, block.content));
    return page;
  } catch (error) {
    throw new ContentRequestError('invalid_content', `Content validation failed: ${String(error)}`);
  }
}

export async function readPage(client: GitHubClient, config: AdminConfig, slug: string) {
  return readPageAtRef(client, slug, config.contentBranch);
}

async function readPageAtRef(client: GitHubClient, slug: string, ref: string) {
  try {
    const file = await client.request<GitHubContent>(
      `/contents/${pagePath(slug)}?ref=${encodeURIComponent(ref)}`,
    );
    if (file.encoding !== 'base64') throw new ContentRequestError('unavailable', 'GitHub returned unsupported content encoding.');
    return { data: validatePage(JSON.parse(decodeBase64(file.content)), slug), revision: file.sha, mode: 'remote' as const };
  } catch (error) {
    if (error instanceof ContentRequestError) throw error;
    if (error instanceof GitHubApiError && error.status === 404) {
      throw new ContentRequestError('not_found', `Page not found: ${slug}`);
    }
    throw new ContentRequestError('unavailable', 'The content repository could not be read.');
  }
}

async function findPullRequest(client: GitHubClient, config: AdminConfig, branch: string) {
  const pulls = await client.request<PullRequest[]>(
    `/pulls?state=open&head=${encodeURIComponent(`${config.contentOwner}:${branch}`)}&base=${encodeURIComponent(config.contentBranch)}`,
  );
  return pulls[0];
}

async function createPullRequest(
  client: GitHubClient,
  config: AdminConfig,
  branch: string,
  page: PageDocument,
): Promise<PullRequest> {
  return client.request<PullRequest>('/pulls', {
    method: 'POST',
    body: JSON.stringify({
      title: `Update ${page.title}`,
      head: branch,
      base: config.contentBranch,
      body: 'Created by the Astro CMS editor. This content change does not trigger a frontend deployment.',
      draft: true,
    }),
  });
}

export async function submitPagePullRequest(
  client: GitHubClient,
  config: AdminConfig,
  slug: string,
  input: { data: unknown; expectedRevision: string; changeId: string },
) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(input.changeId)) {
    throw new ContentRequestError('invalid_content', 'A valid change identifier is required.');
  }
  const page = validatePage(input.data, slug);
  const current = await readPage(client, config, slug);
  if (current.revision !== input.expectedRevision) {
    throw new ContentRequestError('stale_revision', 'Published content changed after this editor was loaded. Reload before submitting.');
  }

  const branch = `cms/${input.changeId.toLowerCase()}`;
  try {
    await client.request<GitReference>(`/git/ref/heads/${encodeURIComponent(branch)}`);
    const branchPage = await readPageAtRef(client, slug, branch);
    if (JSON.stringify(branchPage.data) !== JSON.stringify(page)) {
      throw new ContentRequestError(
        'change_conflict',
        'This change identifier already belongs to different content. Reload before submitting again.',
      );
    }
    const existing = (await findPullRequest(client, config, branch)) ?? (await createPullRequest(client, config, branch, page));
    return {
      data: page,
      revision: current.revision,
      mode: 'remote' as const,
      submission: { kind: 'pull_request' as const, number: existing.number, url: existing.html_url, branch },
    };
  } catch (error) {
    if (!(error instanceof GitHubApiError && error.status === 404)) throw error;
  }

  try {
    const base = await client.request<GitReference>(`/git/ref/heads/${encodeURIComponent(config.contentBranch)}`);
    const baseCommit = await client.request<GitCommit>(`/git/commits/${encodeURIComponent(base.object.sha)}`);
    if (!baseCommit.tree?.sha) throw new ContentRequestError('unavailable', 'GitHub returned an incomplete base commit.');
    const serialized = `${JSON.stringify(page, null, 2)}\n`;
    if (new TextEncoder().encode(serialized).byteLength > 256_000) {
      throw new ContentRequestError('invalid_content', 'The page exceeds the 256 KB content limit.');
    }
    const blob = await client.request<GitBlob>('/git/blobs', {
      method: 'POST',
      body: JSON.stringify({ content: encodeBase64(serialized), encoding: 'base64' }),
    });
    const validation = `${JSON.stringify(
      {
        schemaVersion: '1',
        page: slug,
        contentDigest: await sha256(serialized),
        changeId: input.changeId.toLowerCase(),
      },
      null,
      2,
    )}\n`;
    const validationBlob = await client.request<GitBlob>('/git/blobs', {
      method: 'POST',
      body: JSON.stringify({ content: encodeBase64(validation), encoding: 'base64' }),
    });
    const tree = await client.request<GitTree>('/git/trees', {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseCommit.tree.sha,
        tree: [
          { path: pagePath(slug), mode: '100644', type: 'blob', sha: blob.sha },
          { path: validationPath(slug), mode: '100644', type: 'blob', sha: validationBlob.sha },
        ],
      }),
    });
    const commit = await client.request<GitCommit>('/git/commits', {
      method: 'POST',
      body: JSON.stringify({ message: `Update ${page.title}`, tree: tree.sha, parents: [base.object.sha] }),
    });
    await client.request<GitReference>('/git/refs', {
      method: 'POST',
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
    });
    const pull = await createPullRequest(client, config, branch, page);
    return {
      data: page,
      revision: current.revision,
      mode: 'remote' as const,
      submission: { kind: 'pull_request' as const, number: pull.number, url: pull.html_url, branch },
    };
  } catch (error) {
    if (error instanceof ContentRequestError) throw error;
    throw new ContentRequestError('unavailable', 'GitHub could not create the content pull request. No frontend change was made.');
  }
}

export async function savePageDirect(client: GitHubClient, config: AdminConfig, slug: string, input: { data: unknown; expectedRevision: string; changeId: string }) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(input.changeId)) throw new ContentRequestError('invalid_content', 'A valid change identifier is required.');
  const page = validatePage(input.data, slug);
  const current = await readPage(client, config, slug);
  if (current.revision !== input.expectedRevision) throw new ContentRequestError('stale_revision', 'Published content changed after this editor was loaded. Reload before saving.');
  const serialized = `${JSON.stringify(page, null, 2)}\n`;
  if (new TextEncoder().encode(serialized).byteLength > 256_000) throw new ContentRequestError('invalid_content', 'The page exceeds the 256 KB content limit.');
  const validation = `${JSON.stringify({ schemaVersion: '1', page: slug, contentDigest: await sha256(serialized), changeId: input.changeId.toLowerCase() }, null, 2)}\n`;
  try {
    const saved = await commitFilesToMain(client, config.contentBranch, `Update ${page.title}`, [{ path: pagePath(slug), content: serialized }, { path: validationPath(slug), content: validation }]);
    return { data: page, revision: saved.revisions[pagePath(slug)]!, mode: 'remote' as const, submission: { kind: 'direct_save' as const } };
  } catch (error) {
    if (error instanceof ContentRequestError) throw error;
    throw new ContentRequestError('unavailable', 'GitHub could not save the content. No frontend deployment was triggered.');
  }
}
