import { describe, expect, it } from 'vitest';
import { ConfigurationError, readAdminConfig } from './config';

const complete = {
  CLOUDFLARE_ACCESS_TEAM_DOMAIN: 'https://example.cloudflareaccess.com',
  CLOUDFLARE_ACCESS_AUD: 'audience',
  GITHUB_TOKEN: 'github_pat_example',
  GITHUB_CONTENT_OWNER: 'owner',
  GITHUB_CONTENT_REPO: 'content',
};

describe('remote admin configuration', () => {
  it('defaults the content branch without accepting a frontend repository setting', () => {
    expect(readAdminConfig(complete)).toMatchObject({
      accessAudience: 'audience',
      memberAccessAudience: 'audience',
      contentOwner: 'owner',
      contentRepo: 'content',
      contentBranch: 'main',
    });
  });

  it('supports a separate Access audience for authenticated member routes', () => {
    expect(
      readAdminConfig({
        ...complete,
        CLOUDFLARE_MEMBER_ACCESS_AUD: 'member-audience',
      }),
    ).toMatchObject({
      accessAudience: 'audience',
      memberAccessAudience: 'member-audience',
    });
  });

  it('fails closed when Access configuration is missing', () => {
    expect(() => readAdminConfig({ ...complete, CLOUDFLARE_ACCESS_AUD: '' })).toThrow(ConfigurationError);
  });

  it('rejects a non-Cloudflare Access team domain', () => {
    expect(() =>
      readAdminConfig({
        ...complete,
        CLOUDFLARE_ACCESS_TEAM_DOMAIN: 'https://example.com',
      }),
    ).toThrow(ConfigurationError);
  });

  it('fails closed when the GitHub token is missing', () => {
    expect(() => readAdminConfig({ ...complete, GITHUB_TOKEN: '' })).toThrow(ConfigurationError);
  });
});
