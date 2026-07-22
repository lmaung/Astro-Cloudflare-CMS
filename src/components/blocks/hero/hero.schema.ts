import { z } from 'zod';

export const heroContentSchema = z.object({
  eyebrow: z.string().max(80).optional(),
  heading: z.string().min(1, 'Heading is required').max(120),
  body: z.string().min(1, 'Body is required').max(320),
  action: z
    .object({
      label: z.string().min(1).max(40),
      href: z
        .string()
        .regex(/^(?:\/|#)/, 'Use a site-relative path or page anchor.'),
    })
    .optional(),
});

export type HeroContent = z.infer<typeof heroContentSchema>;
