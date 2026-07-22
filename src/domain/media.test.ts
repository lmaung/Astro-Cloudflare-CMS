import { describe, expect, it } from 'vitest';
import { mediaLibrarySchema } from './media';

describe('media library', () => {
  it('accepts accessible image metadata and focal points', () => {
    const library = mediaLibrarySchema.parse({ assets: [{ id: 'team', name: 'Team', src: '/media/team.webp', alt: 'The team outside the office', focalPoint: { x: 40, y: 30 } }] });
    expect(library.assets[0]?.focalPoint).toEqual({ x: 40, y: 30 });
  });
  it('rejects executable URLs, missing alt text, and duplicate IDs', () => {
    expect(() => mediaLibrarySchema.parse({ assets: [{ id: 'bad', name: 'Bad', src: 'javascript:alert(1)', alt: '' }] })).toThrow();
    const asset = { id: 'same', name: 'Image', src: '/media/image.webp', alt: 'Description' };
    expect(() => mediaLibrarySchema.parse({ assets: [asset, asset] })).toThrow('Media IDs must be unique');
  });
});
