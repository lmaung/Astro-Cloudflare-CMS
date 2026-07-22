export type AdminEnv = {
  CLOUDFLARE_ACCESS_TEAM_DOMAIN?: string;
  CLOUDFLARE_ACCESS_AUD?: string;
  CLOUDFLARE_MEMBER_ACCESS_AUD?: string;
  GITHUB_TOKEN?: string;
  GITHUB_CONTENT_OWNER?: string;
  GITHUB_CONTENT_REPO?: string;
  GITHUB_CONTENT_BRANCH?: string;
};

export type AdminConfig = {
  accessTeamDomain: string;
  accessAudience: string;
  memberAccessAudience: string;
  githubToken: string;
  contentOwner: string;
  contentRepo: string;
  contentBranch: string;
};

export class ConfigurationError extends Error {}

function required(env: AdminEnv, key: Exclude<keyof AdminEnv, 'CLOUDFLARE_MEMBER_ACCESS_AUD'>): string {
  const value = env[key]?.trim();
  if (!value) throw new ConfigurationError(`Missing required server configuration: ${key}`);
  return value;
}

export function readAdminConfig(env: AdminEnv): AdminConfig {
  const accessTeamDomain = required(env, 'CLOUDFLARE_ACCESS_TEAM_DOMAIN').replace(/\/$/, '');
  if (!accessTeamDomain.startsWith('https://') || !accessTeamDomain.endsWith('.cloudflareaccess.com')) {
    throw new ConfigurationError('CLOUDFLARE_ACCESS_TEAM_DOMAIN must be an HTTPS cloudflareaccess.com URL.');
  }

  const accessAudience = required(env, 'CLOUDFLARE_ACCESS_AUD');

  return {
    accessTeamDomain,
    accessAudience,
    memberAccessAudience: env.CLOUDFLARE_MEMBER_ACCESS_AUD?.trim() || accessAudience,
    githubToken: required(env, 'GITHUB_TOKEN'),
    contentOwner: required(env, 'GITHUB_CONTENT_OWNER'),
    contentRepo: required(env, 'GITHUB_CONTENT_REPO'),
    contentBranch: env.GITHUB_CONTENT_BRANCH?.trim() || 'main',
  };
}
