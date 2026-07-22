import { describe, expect, it } from 'vitest';
import { navigationSchema, siteSettingsSchema } from './globals';

describe('global content schemas', () => {
  it('accepts bounded settings and safe navigation', () => {
    expect(siteSettingsSchema.parse({ siteName: 'Example', tagline: 'A useful site.', defaultSeo: { titleSuffix: 'Example', description: 'Description' }, footer: { copyright: '© Example' } }).siteName).toBe('Example');
    expect(navigationSchema.parse({ primary: [{ label: 'Home', href: '/' }] }).primary).toHaveLength(1);
  });
  it('rejects executable navigation URLs', () => {
    expect(() => navigationSchema.parse({ primary: [{ label: 'Bad', href: 'javascript:alert(1)' }] })).toThrow();
  });
});
