import { describe, expect, it } from "vitest";
import { pageSchema } from "./content";

const page = {
  id: "home",
  slug: "home",
  status: "published",
  title: "Home",
  blocks: [],
};

describe("page SEO", () => {
  it("defaults indexing and accepts an accessible social image", () => {
    expect(pageSchema.parse(page).seo.noIndex).toBe(false);
    expect(
      pageSchema.parse({
        ...page,
        seo: {
          socialImage: "/media/card.jpg",
          socialImageAlt: "People collaborating",
        },
      }).seo.socialImage,
    ).toBe("/media/card.jpg");
  });

  it("requires alternative text when a social image is configured", () => {
    expect(() =>
      pageSchema.parse({ ...page, seo: { socialImage: "/media/card.jpg" } }),
    ).toThrow("Describe the social image");
  });
});
