export type AdminEnv = {
  CLOUDFLARE_ACCESS_TEAM_DOMAIN?: string;
  CLOUDFLARE_ACCESS_AUD?: string;
  GITHUB_APP_ID?: string;
  GITHUB_APP_INSTALLATION_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_CONTENT_OWNER?: string;
  GITHUB_CONTENT_REPO?: string;
  GITHUB_CONTENT_BRANCH?: string;
};

export type AdminConfig = {
  accessTeamDomain: string;
  accessAudience: string;
  githubAppId: string;
  githubInstallationId: string;
  githubPrivateKey: string;
  contentOwner: string;
  contentRepo: string;
  contentBranch: string;
};

export class ConfigurationError extends Error {}

function required(env: AdminEnv, key: keyof AdminEnv): string {
  const value = env[key]?.trim();
  if (!value) throw new ConfigurationError(`Missing required server configuration: ${key}`);
  return value;
}

export function readAdminConfig(env: AdminEnv): AdminConfig {
  const accessTeamDomain = required(env, 'CLOUDFLARE_ACCESS_TEAM_DOMAIN').replace(/\/$/, '');
  if (!accessTeamDomain.startsWith('https://') || !accessTeamDomain.endsWith('.cloudflareaccess.com')) {
    throw new ConfigurationError('CLOUDFLARE_ACCESS_TEAM_DOMAIN must be an HTTPS cloudflareaccess.com URL.');
  }

  return {
    accessTeamDomain,
    accessAudience: required(env, 'CLOUDFLARE_ACCESS_AUD'),
    githubAppId: required(env, 'GITHUB_APP_ID'),
    githubInstallationId: required(env, 'GITHUB_APP_INSTALLATION_ID'),
    githubPrivateKey: required(env, 'GITHUB_APP_PRIVATE_KEY').replace(/\\n/g, '\n'),
    contentOwner: required(env, 'GITHUB_CONTENT_OWNER'),
    contentRepo: required(env, 'GITHUB_CONTENT_REPO'),
    contentBranch: env.GITHUB_CONTENT_BRANCH?.trim() || 'main',
  };
}
