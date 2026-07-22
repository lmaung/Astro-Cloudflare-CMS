import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { blockDefinitions } from '../src/components/blocks/registry';
import { navigationSchema, siteSettingsSchema } from '../src/domain/globals';

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
    { key: 'site-settings', title: 'Site settings', description: 'Global identity, SEO defaults, and footer copy.', schema: z.toJSONSchema(siteSettingsSchema, { target: 'draft-7' }) },
    { key: 'navigation', title: 'Navigation', description: 'Primary site navigation links.', schema: z.toJSONSchema(navigationSchema, { target: 'draft-7' }) },
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
