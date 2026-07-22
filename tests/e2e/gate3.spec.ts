import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const home = {
  id: "page-home",
  slug: "home",
  status: "published",
  title: "Home",
  seo: { title: "", description: "", socialImageAlt: "", noIndex: false },
  blocks: [
    {
      id: "hero",
      type: "core/hero",
      status: "active",
      content: {
        eyebrow: "Test",
        heading: "Welcome",
        body: "Test body",
        action: { label: "Learn more", href: "#content" },
      },
    },
    {
      id: "text",
      type: "core/rich-text",
      status: "active",
      content: { heading: "Details", paragraphs: ["Test paragraph"] },
    },
  ],
};

async function mockAdmin(page: Page) {
  let pages = [
    { id: home.id, slug: home.slug, status: home.status, title: home.title },
  ];
  await page.route("**/api/admin/pages", async (route) => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      pages = [
        ...pages,
        {
          id: input.data.id,
          slug: input.data.slug,
          status: input.data.status,
          title: input.data.title,
        },
      ];
      await route.fulfill({
        status: 201,
        json: {
          data: input.data,
          revision: "about-blob",
          collectionRevision: "head-2",
          mode: "remote",
          submission: { kind: "direct_save" },
        },
      });
      return;
    }
    await route.fulfill({
      json: {
        data: pages,
        revision: pages.length === 1 ? "head-1" : "head-2",
        mode: "remote",
      },
    });
  });
  await page.route("**/api/admin/content/*", async (route) => {
    const slug = new URL(route.request().url()).pathname.split("/").pop();
    const data =
      slug === "home"
        ? home
        : { ...home, id: "page-about", slug: "about", title: "About" };
    await route.fulfill({
      json: { data, revision: `${slug}-blob`, mode: "remote" },
    });
  });
  await page.route("**/api/admin/globals/*", async (route) => {
    const key = new URL(route.request().url()).pathname.split("/").pop();
    const data =
      key === "navigation"
        ? { primary: [{ label: "Home", href: "/" }] }
        : key === "reusable-blocks"
          ? {
              blocks: [
                {
                  id: "shared-hero",
                  name: "Shared hero",
                  description: "Reusable introduction",
                  type: "core/hero",
                  content: {
                    eyebrow: "Shared",
                    heading: "Shared heading",
                    body: "Shared body",
                  },
                  refinableFields: ["heading"],
                },
              ],
            }
          : key === "media-library"
            ? { assets: [] }
            : {
                siteName: "Example",
                tagline: "Example site",
                defaultSeo: {
                  titleSuffix: "Example",
                  description: "Example description",
                },
                footer: { copyright: "© Example" },
              };
    await route.fulfill({
      json: { data, revision: `${key}-blob`, mode: "remote" },
    });
  });
}

test("admin page lifecycle is keyboard-operable and axe-clean", async ({
  page,
}) => {
  await mockAdmin(page);
  await page.goto("/admin/");
  await expect(
    page.getByRole("heading", { name: "Pages", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save page" })).toBeDisabled();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole("button", { name: "New page" }).click();
  await page.getByLabel("Page title").fill("About");
  await page
    .getByRole("textbox", { name: "URL slug Public URL: /about", exact: true })
    .fill("about");
  await page.getByRole("button", { name: "Create and publish" }).click();
  await expect(
    page.getByText(
      "Page created and published. Add it to Navigation when it should appear in the menu.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /About.*\/about/ }),
  ).toBeVisible();
});

test("block order can be changed with explicit controls", async ({ page }) => {
  await mockAdmin(page);
  await page.goto("/admin/");
  await page.getByRole("button", { name: /2 Rich text/ }).click();
  await page.getByRole("button", { name: "Move up" }).click();
  const blockButtons = page.locator(".block-list__item");
  await expect(blockButtons).toHaveCount(2);
  await expect(blockButtons.nth(0)).toContainText("Rich text");
  await expect(page.getByRole("button", { name: "Save page" })).toBeEnabled();
});

test("navigation editor exposes accessible ordered controls", async ({
  page,
}) => {
  await mockAdmin(page);
  await page.goto("/admin/");
  await expect(
    page.getByText(
      "Published page loaded. Saves publish immediately without redeploying.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Navigation", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Navigation", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add menu item", exact: true })
    .click({ force: true });
  await expect(
    page.getByRole("group", { name: "Menu item 2", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save navigation", exact: true }),
  ).toBeEnabled();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("public fallback page has no automated accessibility violations", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("admin remains contained across required responsive widths", async ({
  page,
}) => {
  await mockAdmin(page);
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/admin/");
    await expect(
      page.getByRole("heading", { name: "Pages", exact: true }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  }
});

test("reusable blocks can be linked, refined, and detached", async ({
  page,
}) => {
  await mockAdmin(page);
  await page.goto("/admin/");
  await expect(
    page.getByText(
      "Published page loaded. Saves publish immediately without redeploying.",
    ),
  ).toBeVisible();
  await page.getByLabel("Use reusable block").selectOption("shared-hero");
  await expect(page.getByText("Linked to Shared hero")).toBeVisible();
  await expect(page.getByLabel("heading*")).toHaveValue("Shared heading");
  await page.getByLabel("heading*").fill("Refined page heading");
  await page.getByRole("button", { name: "Detach copy" }).click();
  await expect(page.getByLabel("Use reusable block")).toBeVisible();
  await expect(page.getByLabel("heading*")).toHaveValue("Refined page heading");
});

test("Gate 4 library editors expose usable, axe-clean controls", async ({
  page,
}) => {
  await mockAdmin(page);
  await page.goto("/admin/");
  await expect(
    page.getByText(
      "Published page loaded. Saves publish immediately without redeploying.",
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reusable blocks", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Reusable blocks", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#root_blocks__add")).toBeVisible();
  await page.getByRole("button", { name: "Media", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Media", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#root_assets__add")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("runtime refresh renders registered layouts and the detailed footer without deployment", async ({
  page,
}) => {
  await page.route("**/api/content/snapshot*", async (route) =>
    route.fulfill({
      json: {
        page: {
          ...home,
          blocks: [
            {
              id: "grid",
              type: "core/content-grid",
              status: "active",
              content: {
                heading: "Runtime services",
                layout: "three-column",
                alignment: "start",
                surface: "subtle",
                spacing: "default",
                items: [
                  { id: "one", heading: "One", body: "First" },
                  { id: "two", heading: "Two", body: "Second" },
                  { id: "three", heading: "Three", body: "Third" },
                ],
              },
            },
          ],
        },
        settings: {
          siteName: "Runtime site",
          tagline: "Current content",
          siteUrl: "https://example.com",
          locale: "en",
          organization: { name: "Runtime organization", sameAs: [] },
          defaultSeo: {
            titleSuffix: "Runtime",
            description: "Runtime content",
          },
          footer: {
            copyright: "© Runtime",
            summary: "Detailed footer summary",
            columns: [
              {
                id: "company",
                title: "Company",
                links: [{ label: "About us", href: "/about" }],
              },
            ],
            socialLinks: [
              { label: "LinkedIn", href: "https://www.linkedin.com/" },
            ],
            legalLinks: [],
            supportingImages: [],
            newsletter: {
              enabled: true,
              heading: "Updates",
              description: "News from us",
              actionLabel: "Subscribe",
              actionHref: "/subscribe",
              privacyNote: "No spam.",
            },
            appearance: { variant: "dark", overlay: "medium" },
          },
        },
        navigation: { primary: [{ label: "Home", href: "/" }] },
      },
    }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Runtime services" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Company" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Subscribe" })).toBeVisible();
  await expect(page.locator(".site-content-grid--three-column")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
