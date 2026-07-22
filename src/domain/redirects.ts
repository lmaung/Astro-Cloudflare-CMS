import { z } from "zod";
import { safeHrefSchema } from "./url";

const redirectPathSchema = z
  .string()
  .regex(
    /^\/(?!admin(?:\/|$)|api(?:\/|$))[a-z0-9/_-]*$/,
    "Use a site path outside /admin and /api.",
  );
export const redirectsSchema = z
  .object({
    redirects: z
      .array(
        z.object({
          id: z.string().min(1),
          from: redirectPathSchema,
          to: safeHrefSchema,
          status: z
            .union([
              z.literal(301),
              z.literal(302),
              z.literal(307),
              z.literal(308),
            ])
            .default(301),
          preserveQuery: z.boolean().default(true),
        }),
      )
      .max(100)
      .default([]),
  })
  .superRefine((value, context) => {
    const sources = new Set<string>();
    value.redirects.forEach((redirect, index) => {
      if (sources.has(redirect.from))
        context.addIssue({
          code: "custom",
          path: ["redirects", index, "from"],
          message: "Redirect source paths must be unique.",
        });
      sources.add(redirect.from);
      if (redirect.to === redirect.from)
        context.addIssue({
          code: "custom",
          path: ["redirects", index, "to"],
          message: "A redirect cannot point to itself.",
        });
    });
    const internal = new Map(
      value.redirects
        .filter((redirect) => redirect.to.startsWith("/"))
        .map((redirect) => [redirect.from, redirect.to]),
    );
    value.redirects.forEach((redirect, index) => {
      const seen = new Set([redirect.from]);
      let target = redirect.to;
      while (internal.has(target)) {
        if (seen.has(target)) {
          context.addIssue({
            code: "custom",
            path: ["redirects", index, "to"],
            message: "Redirects cannot form a loop.",
          });
          break;
        }
        seen.add(target);
        target = internal.get(target)!;
      }
    });
  });

export type Redirects = z.infer<typeof redirectsSchema>;
