import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { blockDefinitions } from '../src/components/blocks/registry';
import { navigationSchema, siteSettingsSchema } from '../src/domain/globals';
import { reusableLibrarySchema } from '../src/domain/reusables';
import { mediaLibrarySchema } from '../src/domain/media';

const outputDirectory = path.resolve('generated/schemas');
const outputPath = path.join(outputDirectory, 'component-catalog.json');

const catalog = {
  generated: true,
  blocks: blockDefinitions.map((definition) => ({
    type: definition.type,
    version: definition.version,
    editor: definition.editor,
    defaults: definition.defaults(),
    schema: z.toJSONSchema(definition.schema, { target: 'draft-7' }),
  })),
  globals: [
    { key: 'site-settings', title: 'Site settings', description: 'Global identity, SEO defaults, and structured footer content.', schema: z.toJSONSchema(siteSettingsSchema, { target: 'draft-7' }) },
    { key: 'navigation', title: 'Navigation', description: 'Primary site navigation links.', schema: z.toJSONSchema(navigationSchema, { target: 'draft-7' }) },
    { key: 'reusable-blocks', title: 'Reusable blocks', description: 'Shared registered blocks. Changes flow to linked page instances unless a field is refined.', schema: z.toJSONSchema(reusableLibrarySchema, { target: 'draft-7' }) },
    { key: 'media-library', title: 'Media', description: 'Reusable image metadata, accessible alternative text, dimensions, and focal points.', schema: z.toJSONSchema(mediaLibrarySchema, { target: 'draft-7' }) },
  ],
};

const serialized = `${JSON.stringify(catalog, null, 2)}\n`;
await mkdir(outputDirectory, { recursive: true });

let current = '';
try {
  current = await readFile(outputPath, 'utf8');
} catch {
  // The first generation creates the artifact.
}

if (current !== serialized) await writeFile(outputPath, serialized, 'utf8');
