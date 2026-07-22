import { expect, test } from "@playwright/test";

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "Pixel baselines are intentionally limited to deterministic Chromium targets.",
);

test("public reference surface matches its visual baseline", async ({
  page,
}) => {
  await page.route("**/api/content/snapshot*", (route) => route.abort());
  await page.goto("/");
  await expect(page).toHaveScreenshot("public-reference.png", {
    fullPage: true,
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });
});

test("admin shell matches its visual baseline", async ({ page }) => {
  await page.route("**/api/admin/pages", (route) =>
    route.fulfill({ json: { data: [], revision: "visual", mode: "remote" } }),
  );
  await page.route("**/api/admin/globals/reusable-blocks", (route) =>
    route.fulfill({
      json: { data: { blocks: [] }, revision: "visual", mode: "remote" },
    }),
  );
  await page.goto("/admin/");
  await expect(
    page.getByRole("heading", { name: "Pages", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("admin-shell.png", {
    fullPage: true,
    animations: "disabled",
    maxDiffPixelRatio: 0.01,
  });
});
