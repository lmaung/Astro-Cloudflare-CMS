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
  it('supports a bounded multi-page primary navigation', () => {
    const primary = Array.from({ length: 20 }, (_, index) => ({ label: `Page ${index + 1}`, href: `/page-${index + 1}` }));
    expect(navigationSchema.parse({ primary }).primary).toHaveLength(20);
    expect(() => navigationSchema.parse({ primary: [...primary, { label: 'Too many', href: '/too-many' }] })).toThrow();
  });
  it('supports structured detailed footer content and rejects unsafe links', () => {
    const base = { siteName: 'Example', tagline: 'A useful site.', defaultSeo: { titleSuffix: 'Example', description: 'Description' } };
    const settings = siteSettingsSchema.parse({ ...base, footer: { copyright: '© Example', summary: 'About the organization.', columns: [{ id: 'resources', title: 'Resources', links: [{ label: 'About', href: '/about' }] }], socialLinks: [{ label: 'LinkedIn', href: 'https://www.linkedin.com/' }], appearance: { variant: 'dark', overlay: 'medium' } } });
    expect(settings.footer.columns[0]?.links[0]?.href).toBe('/about');
    expect(settings.footer.newsletter.enabled).toBe(false);
    expect(() => siteSettingsSchema.parse({ ...base, footer: { copyright: '© Example', legalLinks: [{ label: 'Unsafe', href: 'javascript:alert(1)' }] } })).toThrow();
  });
});
