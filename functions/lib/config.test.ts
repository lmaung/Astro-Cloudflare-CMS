import { describe, expect, it } from 'vitest';
import { ConfigurationError, readAdminConfig } from './config';

const complete = {
  CLOUDFLARE_ACCESS_TEAM_DOMAIN: 'https://example.cloudflareaccess.com',
  CLOUDFLARE_ACCESS_AUD: 'audience',
  GITHUB_APP_ID: '123',
  GITHUB_APP_INSTALLATION_ID: '456',
  GITHUB_APP_PRIVATE_KEY: 'private-key',
  GITHUB_CONTENT_OWNER: 'owner',
  GITHUB_CONTENT_REPO: 'content',
};

describe('remote admin configuration', () => {
  it('defaults the content branch without accepting a frontend repository setting', () => {
    expect(readAdminConfig(complete)).toMatchObject({
      contentOwner: 'owner',
      contentRepo: 'content',
      contentBranch: 'main',
    });
  });

  it('fails closed when Access configuration is missing', () => {
    expect(() => readAdminConfig({ ...complete, CLOUDFLARE_ACCESS_AUD: '' })).toThrow(ConfigurationError);
  });

  it('rejects a non-Cloudflare Access team domain', () => {
    expect(() => readAdminConfig({ ...complete, CLOUDFLARE_ACCESS_TEAM_DOMAIN: 'https://example.com' })).toThrow(
      ConfigurationError,
    );
  });
});
