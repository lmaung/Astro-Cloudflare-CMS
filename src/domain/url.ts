import { z } from 'zod';

export const safeHrefSchema = z.string().min(1).refine((value) => value.startsWith('/') || value.startsWith('#') || /^https:\/\//.test(value), 'Use a site-relative, anchor, or HTTPS URL.');
