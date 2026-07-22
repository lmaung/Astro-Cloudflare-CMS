import { describe, expect, it } from "vitest";
import { resolveRedirect } from "./_middleware";
import { renderRobots } from "./robots.txt";
import { renderSitemap } from "./sitemap.xml";

describe("discoverability endpoints", () => {
  it("advertises the sitemap while protecting administration routes", () => {
    const robots = renderRobots("https://example.com");
    expect(robots).toContain("Disallow: /admin/");
    expect(robots).toContain("Disallow: /api/admin/");
    expect(robots).toContain("Sitemap: https://example.com/sitemap.xml");
  });

  it("escapes sitemap locations", () => {
    const sitemap = renderSitemap([
      "https://example.com/search?q=one&sort=two",
    ]);
    expect(sitemap).toContain("q=one&amp;sort=two");
  });

  it("resolves an exact redirect and preserves non-conflicting query values", () => {
    const redirect = resolveRedirect(
      new URL("https://example.com/old/?campaign=summer"),
      {
        redirects: [
          {
            id: "old",
            from: "/old",
            to: "/new?source=cms",
            status: 301,
            preserveQuery: true,
          },
        ],
      },
    );
    expect(redirect).toEqual({
      location: "https://example.com/new?source=cms&campaign=summer",
      status: 301,
    });
  });
});
