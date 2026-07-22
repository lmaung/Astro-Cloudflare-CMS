import { readAdminConfig, type AdminEnv } from "./lib/config";
import { listPages, readPage } from "./lib/content-repository";
import { readGlobal } from "./lib/global-repository";
import { createGitHubClient } from "./lib/github";
import type { PagesHandler } from "./lib/runtime";

function xml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderSitemap(urls: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${xml(url)}</loc></url>`).join("\n")}\n</urlset>\n`;
}

export const onRequestGet: PagesHandler<AdminEnv> = async ({ env }) => {
  try {
    const config = readAdminConfig(env);
    const client = createGitHubClient(config);
    const [summaries, settings] = await Promise.all([
      listPages(client, config),
      readGlobal(client, config, "site-settings") as Promise<{
        data: { siteUrl: string };
      }>,
    ]);
    const published = summaries.data.filter(
      (page) => page.status === "published",
    );
    const pages = await Promise.all(
      published.map((page) => readPage(client, config, page.slug)),
    );
    const urls = pages
      .filter((page) => !page.data.seo.noIndex)
      .map(
        (page) =>
          new URL(
            page.data.slug === "home" ? "/" : `/${page.data.slug}`,
            settings.data.siteUrl,
          ).href,
      );
    const body = renderSitemap(urls);
    return new Response(body, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Sitemap temporarily unavailable.", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
};
