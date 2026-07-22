import { z } from "zod";
export { reusableLibrarySchema, type ReusableLibrary } from "./reusables";
export { safeHrefSchema } from "./url";
import { safeHrefSchema } from "./url";

const footerLinkSchema = z.object({
  label: z.string().min(1).max(60),
  href: safeHrefSchema,
});
const footerImageSchema = z.object({
  src: safeHrefSchema,
  alt: z.string().min(1).max(160),
  href: safeHrefSchema.optional(),
});

export const footerSchema = z.object({
  copyright: z.string().min(1).max(160),
  summary: z.string().max(500).optional(),
  columns: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(60),
        links: z.array(footerLinkSchema).max(12),
      }),
    )
    .max(6)
    .default([]),
  socialLinks: z.array(footerLinkSchema).max(8).default([]),
  legalLinks: z.array(footerLinkSchema).max(8).default([]),
  supportingImages: z.array(footerImageSchema).max(4).default([]),
  newsletter: z
    .object({
      enabled: z.boolean().default(false),
      heading: z.string().min(1).max(80).default("Stay informed"),
      description: z.string().max(240).default(""),
      actionLabel: z.string().min(1).max(40).default("Subscribe"),
      actionHref: safeHrefSchema.optional(),
      privacyNote: z.string().max(160).default(""),
    })
    .default({
      enabled: false,
      heading: "Stay informed",
      description: "",
      actionLabel: "Subscribe",
      privacyNote: "",
    }),
  appearance: z
    .object({
      variant: z.enum(["light", "dark", "centered", "image"]).default("light"),
      backgroundImage: safeHrefSchema.optional(),
      overlay: z.enum(["none", "light", "medium", "strong"]).default("medium"),
    })
    .default({ variant: "light", overlay: "medium" }),
});

export const siteSettingsSchema = z.object({
  siteName: z.string().min(1).max(80),
  tagline: z.string().min(1).max(160),
  siteUrl: z
    .url()
    .refine(
      (value) => value.startsWith("https://"),
      "Use the public HTTPS site origin.",
    )
    .default("https://example.com"),
  locale: z
    .string()
    .regex(/^[a-z]{2}(?:-[A-Z]{2})?$/, "Use a locale such as en or en-US.")
    .default("en"),
  organization: z
    .object({
      name: z.string().min(1).max(120).default("Organization"),
      logo: safeHrefSchema.optional(),
      sameAs: z
        .array(z.url().refine((value) => value.startsWith("https://")))
        .max(12)
        .default([]),
    })
    .default({ name: "Organization", sameAs: [] }),
  defaultSeo: z.object({
    titleSuffix: z.string().max(60),
    description: z.string().min(1).max(200),
  }),
  footer: footerSchema,
});

export const navigationSchema = z.object({
  primary: z
    .array(z.object({ label: z.string().min(1).max(40), href: safeHrefSchema }))
    .max(20),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;
export type Navigation = z.infer<typeof navigationSchema>;
