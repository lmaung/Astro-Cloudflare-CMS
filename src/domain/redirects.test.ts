import { describe, expect, it } from "vitest";
import { redirectsSchema } from "./redirects";

describe("redirects", () => {
  it("accepts bounded internal and HTTPS redirects", () => {
    const result = redirectsSchema.parse({
      redirects: [
        {
          id: "old-about",
          from: "/old-about",
          to: "/about",
          status: 301,
          preserveQuery: true,
        },
        {
          id: "external",
          from: "/partner",
          to: "https://example.org/",
          status: 302,
        },
      ],
    });
    expect(result.redirects).toHaveLength(2);
  });
  it("rejects protected sources, duplicates, self redirects, and loops", () => {
    expect(() =>
      redirectsSchema.parse({
        redirects: [{ id: "admin", from: "/admin/help", to: "/" }],
      }),
    ).toThrow();
    expect(() =>
      redirectsSchema.parse({
        redirects: [
          { id: "one", from: "/old", to: "/new" },
          { id: "two", from: "/old", to: "/" },
        ],
      }),
    ).toThrow("Redirect source paths must be unique");
    expect(() =>
      redirectsSchema.parse({
        redirects: [{ id: "self", from: "/same", to: "/same" }],
      }),
    ).toThrow();
    expect(() =>
      redirectsSchema.parse({
        redirects: [
          { id: "one", from: "/one", to: "/two" },
          { id: "two", from: "/two", to: "/one" },
        ],
      }),
    ).toThrow("Redirects cannot form a loop");
  });
});
