import { z } from "zod";
import { reusableInstanceSchema } from "./reusables";

export const blockStatusSchema = z.enum(["active", "hidden"]).default("active");

export const pageStatusSchema = z
  .enum(["published", "archived"])
  .default("published");

export const pageSlugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens.",
  );

export const blockEnvelopeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  status: blockStatusSchema,
  content: z.unknown(),
  reusable: reusableInstanceSchema.optional(),
});

export const pageSchema = z.object({
  id: z.string().min(1),
  slug: pageSlugSchema,
  status: pageStatusSchema,
  title: z.string().min(1).max(120),
  seo: z
    .object({
      title: z.string().max(120).default(""),
      description: z.string().max(200).default(""),
      socialImage: z
        .string()
        .refine(
          (value) =>
            value === "" ||
            value.startsWith("/") ||
            value.startsWith("https://"),
          "Use a site-relative or HTTPS image URL.",
        )
        .optional(),
      socialImageAlt: z.string().max(180).default(""),
      noIndex: z.boolean().default(false),
    })
    .superRefine((seo, context) => {
      if (seo.socialImage && !seo.socialImageAlt.trim()) {
        context.addIssue({
          code: "custom",
          path: ["socialImageAlt"],
          message: "Describe the social image for accessibility.",
        });
      }
    })
    .default({
      title: "",
      description: "",
      socialImageAlt: "",
      noIndex: false,
    }),
  blocks: z.array(blockEnvelopeSchema),
});

export type BlockEnvelope = z.infer<typeof blockEnvelopeSchema>;
export type PageDocument = z.infer<typeof pageSchema>;
