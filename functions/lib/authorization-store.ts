import {
  authorizationDirectorySchema,
  reservedRoleKeys,
  type RoleDefinition,
} from '../../src/domain/authorization';
import type { AdminConfig } from './config';
import { commitFilesToMain, GitHubApiError, type GitHubClient } from './github';

export class AuthorizationStoreError extends Error {}

const authorizationPath = 'globals/authorization.json';
type GitHubContent = { content: string; encoding: string; sha: string };

const roleCopy: Record<(typeof reservedRoleKeys)[number], { name: string; description: string }> = {
  public: { name: 'Public', description: 'Implicit role held by every visitor.' },
  authenticated: { name: 'Authenticated', description: 'Implicit role held by every signed-in visitor.' },
  member: { name: 'Member', description: 'May read content intended for members.' },
  editor: { name: 'Editor', description: 'May read editorial content.' },
  'page-editor': { name: 'Page editor', description: 'May edit pages that explicitly allow this role.' },
  admin: { name: 'Administrator', description: 'Full administrative access.' },
};

export const defaultRoles: RoleDefinition[] = reservedRoleKeys.map((key) => ({
  key,
  ...roleCopy[key],
  system: true,
}));

function decode(value: string) {
  return new TextDecoder().decode(
    Uint8Array.from(atob(value.replace(/\s/g, '')), (item) => item.charCodeAt(0)),
  );
}

async function digest(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

export async function readAuthorizationDirectory(client: GitHubClient, config: AdminConfig) {
  try {
    const file = await client.request<GitHubContent>(
      `/contents/${authorizationPath}?ref=${encodeURIComponent(config.contentBranch)}`,
    );
    const parsed = authorizationDirectorySchema.parse(JSON.parse(decode(file.content)));
    const byKey = new Map([...defaultRoles, ...parsed.roles].map((role) => [role.key, role]));
    return {
      data: authorizationDirectorySchema.parse({ ...parsed, roles: [...byKey.values()] }),
      revision: file.sha,
    };
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) {
      const branch = await client.request<{ object: { sha: string } }>(
        `/git/ref/heads/${encodeURIComponent(config.contentBranch)}`,
      );
      return {
        data: authorizationDirectorySchema.parse({ roles: defaultRoles, users: [] }),
        revision: branch.object.sha,
        missing: true as const,
      };
    }
    throw new AuthorizationStoreError('The Git-backed authorization directory could not be read.');
  }
}

export async function rolesForEmail(client: GitHubClient, config: AdminConfig, email: string): Promise<string[]> {
  const normalized = email.trim().toLowerCase();
  return (await readAuthorizationDirectory(client, config)).data.users.find((user) => user.email === normalized)?.roles ?? [];
}

export async function knownRoleKeys(client: GitHubClient, config: AdminConfig): Promise<string[]> {
  return (await readAuthorizationDirectory(client, config)).data.roles.map((role) => role.key);
}

export async function replaceAuthorizationDirectory(
  client: GitHubClient,
  config: AdminConfig,
  value: unknown,
  expectedRevision: string,
) {
  const directory = authorizationDirectorySchema.parse(value);
  if (reservedRoleKeys.some((role) => !directory.roles.some((entry) => entry.key === role))) {
    throw new AuthorizationStoreError('Reserved platform roles cannot be removed.');
  }
  const current = await readAuthorizationDirectory(client, config);
  if (current.revision !== expectedRevision) {
    throw new AuthorizationStoreError('Authorization data changed after it was loaded. Reload before saving.');
  }
  const serialized = `${JSON.stringify(directory, null, 2)}\n`;
  const artifact = `${JSON.stringify({ schemaVersion: '1', global: 'authorization', contentDigest: await digest(serialized) }, null, 2)}\n`;
  try {
    const saved = await commitFilesToMain(
      client,
      config.contentBranch,
      'Update authorization roles',
      [
        { path: authorizationPath, content: serialized },
        { path: '_validation/globals/authorization.json', content: artifact },
      ],
      'missing' in current ? current.revision : undefined,
    );
    return { data: directory, revision: saved.revisions[authorizationPath]! };
  } catch {
    throw new AuthorizationStoreError('GitHub could not save the authorization directory.');
  }
}
