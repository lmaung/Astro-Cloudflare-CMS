import { pageSchema, type PageDocument } from '../../src/domain/content';
import { navigationSchema } from '../../src/domain/globals';
import { validateBlock } from '../../src/components/blocks/registry';
import { resolveReusableBlock, reusableLibrarySchema } from '../../src/domain/reusables';
import type { AdminConfig } from './config';
import { commitFilesToMain, GitHubApiError, type GitHubClient } from './github';

type GitHubContent = { content: string; encoding: string; sha: string; name?: string; type?: string };

export type PageSummary = Pick<PageDocument, 'id' | 'slug' | 'status' | 'title'>;

export class ContentRequestError extends Error {
  constructor(
    readonly code: 'change_conflict' | 'invalid_content' | 'not_found' | 'stale_revision' | 'unsafe_path' | 'unavailable',
    message: string,
  ) {
    super(message);
  }
}

function validationPath(slug: string): string { return `_validation/pages/${slug}.json`; }

function pagePath(slug: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new ContentRequestError('unsafe_path', 'Page slug contains unsupported characters.');
  return `pages/${slug}.json`;
}

function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function hrefForSlug(slug: string) { return slug === 'home' ? '/' : `/${slug}`; }

async function assertPageIsNotInNavigation(client: GitHubClient, config: AdminConfig, slug: string) {
  try {
    const file = await client.request<GitHubContent>(`/contents/globals/navigation.json?ref=${encodeURIComponent(config.contentBranch)}`);
    const navigation = navigationSchema.parse(JSON.parse(decodeBase64(file.content)));
    if (navigation.primary.some((item) => item.href === hrefForSlug(slug) || item.href === `${hrefForSlug(slug)}/`)) {
      throw new ContentRequestError('change_conflict', 'Remove this page from Navigation before archiving it.');
    }
  } catch (error) {
    if (error instanceof ContentRequestError) throw error;
    throw new ContentRequestError('unavailable', 'Navigation could not be checked. The page was not archived.');
  }
}

async function assertPageHasNoReusableDependencies(client: GitHubClient, config: AdminConfig, slug: string) {
  try {
    const files = await client.request<GitHubContent[]>(`/contents/reusables?ref=${encodeURIComponent(config.contentBranch)}`);
    for (const file of files.filter((item) => item.type === 'file' && item.name?.endsWith('.json'))) {
      const reusable = await client.request<GitHubContent>(`/contents/reusables/${encodeURIComponent(file.name!)}?ref=${encodeURIComponent(config.contentBranch)}`);
      const source = decodeBase64(reusable.content);
      if (source.includes(`\"/${slug}\"`) || source.includes(`\"/${slug}/\"`)) {
        throw new ContentRequestError('change_conflict', `Reusable content “${file.name}” still links to this page. Remove that dependency before deleting it.`);
      }
    }
  } catch (error) {
    if (error instanceof ContentRequestError) throw error;
    if (error instanceof GitHubApiError && error.status === 404) return;
    throw new ContentRequestError('unavailable', 'Reusable-content dependencies could not be checked. The page was not deleted.');
  }
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validatePage(value: unknown, expectedSlug: string): PageDocument {
  try {
    const page = pageSchema.parse(value);
    if (page.slug !== expectedSlug) throw new Error('The page slug cannot be changed after creation.');
    page.blocks.forEach((block) => validateBlock(block.type, block.content));
    return page;
  } catch (error) {
    throw new ContentRequestError('invalid_content', `Content validation failed: ${String(error)}`);
  }
}

async function validateReusableInstances(client: GitHubClient, config: AdminConfig, page: PageDocument) {
  const linked = page.blocks.filter((block) => block.reusable);
  if (!linked.length) return;
  let library;
  try { const file = await client.request<GitHubContent>(`/contents/globals/reusable-blocks.json?ref=${encodeURIComponent(config.contentBranch)}`); library = reusableLibrarySchema.parse(JSON.parse(decodeBase64(file.content))); }
  catch { throw new ContentRequestError('invalid_content', 'Reusable block references cannot be resolved. Save the reusable library first.'); }
  for (const block of linked) {
    const source = library.blocks.find((entry) => entry.id === block.reusable?.sourceId);
    if (!source || source.type !== block.type) throw new ContentRequestError('invalid_content', `Reusable source “${block.reusable?.sourceId}” is missing or has a different block type.`);
    const invalidField = Object.keys(block.reusable?.overrides ?? {}).find((field) => !source.refinableFields.includes(field as never));
    if (invalidField) throw new ContentRequestError('invalid_content', `Field “${invalidField}” is not refinable for reusable source “${source.name}”.`);
    try { validateBlock(block.type, resolveReusableBlock(block, library).content); }
    catch (error) { throw new ContentRequestError('invalid_content', `Reusable block validation failed: ${String(error)}`); }
  }
}

async function readPageAtRef(client: GitHubClient, slug: string, ref: string) {
  try {
    const file = await client.request<GitHubContent>(`/contents/${pagePath(slug)}?ref=${encodeURIComponent(ref)}`);
    if (file.encoding !== 'base64') throw new ContentRequestError('unavailable', 'GitHub returned unsupported content encoding.');
    return { data: validatePage(JSON.parse(decodeBase64(file.content)), slug), revision: file.sha, mode: 'remote' as const };
  } catch (error) {
    if (error instanceof ContentRequestError) throw error;
    if (error instanceof GitHubApiError && error.status === 404) throw new ContentRequestError('not_found', `Page not found: ${slug}`);
    throw new ContentRequestError('unavailable', 'The content repository could not be read.');
  }
}

export function readPage(client: GitHubClient, config: AdminConfig, slug: string) {
  return readPageAtRef(client, slug, config.contentBranch);
}

export async function listPages(client: GitHubClient, config: AdminConfig) {
  try {
    const [files, branch] = await Promise.all([
      client.request<GitHubContent[]>(`/contents/pages?ref=${encodeURIComponent(config.contentBranch)}`),
      client.request<{ object: { sha: string } }>(`/git/ref/heads/${encodeURIComponent(config.contentBranch)}`),
    ]);
    const slugs = files
      .filter((file) => file.type === 'file' && file.name?.endsWith('.json'))
      .map((file) => file.name!.slice(0, -5));
    const pages = await Promise.all(slugs.map((slug) => readPageAtRef(client, slug, config.contentBranch)));
    return {
      data: pages.map(({ data }) => ({ id: data.id, slug: data.slug, status: data.status, title: data.title } satisfies PageSummary))
        .sort((left, right) => left.title.localeCompare(right.title)),
      revision: branch.object.sha,
      mode: 'remote' as const,
    };
  } catch (error) {
    if (error instanceof ContentRequestError) throw error;
    throw new ContentRequestError('unavailable', 'The page list could not be read.');
  }
}

function serializePage(page: PageDocument, changeId: string) {
  const content = `${JSON.stringify(page, null, 2)}\n`;
  if (new TextEncoder().encode(content).byteLength > 256_000) throw new ContentRequestError('invalid_content', 'The page exceeds the 256 KB content limit.');
  return { content, artifact: sha256(content).then((contentDigest) => `${JSON.stringify({ schemaVersion: '1', page: page.slug, contentDigest, changeId }, null, 2)}\n`) };
}

function requireChangeId(changeId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(changeId)) throw new ContentRequestError('invalid_content', 'A valid change identifier is required.');
  return changeId.toLowerCase();
}

export async function createPageDirect(client: GitHubClient, config: AdminConfig, input: { data: unknown; expectedRevision: string; changeId: string }) {
  const changeId = requireChangeId(input.changeId);
  let candidate: PageDocument;
  try { candidate = pageSchema.parse(input.data); }
  catch (error) { throw new ContentRequestError('invalid_content', `Content validation failed: ${String(error)}`); }
  const page = validatePage(candidate, candidate.slug);
  await validateReusableInstances(client, config, page);
  if (page.slug === 'admin' || page.slug === 'api') throw new ContentRequestError('unsafe_path', 'This slug is reserved by the platform.');
  const branch = await client.request<{ object: { sha: string } }>(`/git/ref/heads/${encodeURIComponent(config.contentBranch)}`);
  if (branch.object.sha !== input.expectedRevision) throw new ContentRequestError('stale_revision', 'The page collection changed after it was loaded. Reload before creating a page.');
  try {
    await readPage(client, config, page.slug);
    throw new ContentRequestError('change_conflict', `A page already uses the slug “${page.slug}”.`);
  } catch (error) {
    if (!(error instanceof ContentRequestError && error.code === 'not_found')) throw error;
  }
  const serialized = serializePage(page, changeId);
  try {
    const saved = await commitFilesToMain(client, config.contentBranch, `Create ${page.title}`, [
      { path: pagePath(page.slug), content: serialized.content },
      { path: validationPath(page.slug), content: await serialized.artifact },
    ], input.expectedRevision);
    return { data: page, revision: saved.revisions[pagePath(page.slug)]!, collectionRevision: saved.commit, mode: 'remote' as const, submission: { kind: 'direct_save' as const } };
  } catch (error) {
    if (error instanceof ContentRequestError) throw error;
    throw new ContentRequestError('unavailable', 'GitHub could not create the page. No frontend deployment was triggered.');
  }
}

export async function savePageDirect(client: GitHubClient, config: AdminConfig, slug: string, input: { data: unknown; expectedRevision: string; changeId: string }) {
  const changeId = requireChangeId(input.changeId);
  const page = validatePage(input.data, slug);
  await validateReusableInstances(client, config, page);
  if (slug === 'home' && page.status === 'archived') throw new ContentRequestError('invalid_content', 'The home page cannot be archived.');
  const current = await readPage(client, config, slug);
  if (current.revision !== input.expectedRevision) throw new ContentRequestError('stale_revision', 'Published content changed after this editor was loaded. Reload before saving.');
  if (current.data.status !== 'archived' && page.status === 'archived') await assertPageIsNotInNavigation(client, config, slug);
  const serialized = serializePage(page, changeId);
  try {
    const saved = await commitFilesToMain(client, config.contentBranch, `${page.status === 'archived' ? 'Archive' : 'Update'} ${page.title}`, [
      { path: pagePath(slug), content: serialized.content },
      { path: validationPath(slug), content: await serialized.artifact },
    ]);
    return { data: page, revision: saved.revisions[pagePath(slug)]!, mode: 'remote' as const, submission: { kind: 'direct_save' as const } };
  } catch (error) {
    if (error instanceof ContentRequestError) throw error;
    throw new ContentRequestError('unavailable', 'GitHub could not save the content. No frontend deployment was triggered.');
  }
}

export async function deletePageDirect(client: GitHubClient, config: AdminConfig, slug: string, input: { expectedRevision: string; confirmation: string }) {
  if (slug === 'home') throw new ContentRequestError('invalid_content', 'The home page cannot be permanently deleted.');
  const current = await readPage(client, config, slug);
  if (current.revision !== input.expectedRevision) throw new ContentRequestError('stale_revision', 'The page changed after this editor was loaded. Reload before deleting it.');
  if (current.data.status !== 'archived') throw new ContentRequestError('invalid_content', 'Archive this page before permanently deleting it.');
  if (input.confirmation.trim() !== current.data.slug && input.confirmation.trim() !== current.data.title) {
    throw new ContentRequestError('invalid_content', `Type “${current.data.slug}” or the exact page title to confirm permanent deletion.`);
  }
  await assertPageIsNotInNavigation(client, config, slug);
  await assertPageHasNoReusableDependencies(client, config, slug);
  try {
    const saved = await commitFilesToMain(client, config.contentBranch, `Delete ${current.data.title}`, [
      { path: pagePath(slug), delete: true },
      { path: validationPath(slug), delete: true },
    ]);
    return { deleted: true as const, slug, collectionRevision: saved.commit, mode: 'remote' as const, submission: { kind: 'direct_save' as const } };
  } catch (error) {
    if (error instanceof ContentRequestError) throw error;
    throw new ContentRequestError('unavailable', 'GitHub could not delete the page. No content was changed.');
  }
}
