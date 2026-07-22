import { readAdminConfig, type AdminEnv } from './lib/config';
import { readGlobal } from './lib/global-repository';
import { createGitHubClient } from './lib/github';
import type { PagesHandler } from './lib/runtime';

export function renderRobots(siteUrl?: string): string {
  const base =
    'User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /api/admin/\nDisallow: /members/\nDisallow: /api/content/protected-snapshot\n';
  return siteUrl ? `${base}\nSitemap: ${new URL('/sitemap.xml', siteUrl).href}\n` : base;
}

export const onRequestGet: PagesHandler<AdminEnv> = async ({ env }) => {
  try {
    const config = readAdminConfig(env);
    const client = createGitHubClient(config);
    const settings = (await readGlobal(client, config, 'site-settings')) as {
      data: { siteUrl: string };
    };
    return new Response(renderRobots(settings.data.siteUrl), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response(renderRobots(), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  }
};
