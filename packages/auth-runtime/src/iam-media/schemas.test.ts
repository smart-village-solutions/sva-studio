import { describe, expect, it } from 'vitest';
import { metadataUpdateSchema, uploadInitializationSchema } from './schemas.js';
import { createMediaEditingDocument } from '@sva/media';

describe('media metadata tag patch', () => {
  it('normalizes and validates the tag list while preserving omission versus removal', () => {
    expect(
      metadataUpdateSchema.parse({ metadata: { tags: ['  Grün  Raum ', 'GRÜN RAUM'] } }).metadata
        .tags
    ).toEqual(['Grün Raum']);
    expect(
      metadataUpdateSchema.parse({ metadata: { title: 'Title' } }).metadata
    ).not.toHaveProperty('tags');
    expect(metadataUpdateSchema.parse({ metadata: { tags: [] } }).metadata.tags).toEqual([]);
    for (const tags of [[' '], ['a'.repeat(65)], [null], Array(21).fill('a')]) {
      expect(metadataUpdateSchema.safeParse({ metadata: { tags } }).success).toBe(false);
    }
  });
});

describe('edited upload contract', () => {
  const base = { mimeType: 'image/png', byteSize: 100 };
  const document = createMediaEditingDocument({ annotations: {}, annotationIds: [] });
  const sourceAssetId = '123e4567-e89b-42d3-a456-426614174000';

  it('accepts metadata and exactly one bounded foundation with a portable state', () => {
    expect(
      uploadInitializationSchema.parse({
        ...base,
        metadata: { title: ' Stadt ', altText: null, tags: [' Park '] },
        editing: { document, sourceAssetId },
      })
    ).toMatchObject({
      metadata: { title: 'Stadt', altText: null, tags: ['Park'] },
      editing: { sourceAssetId, document },
    });
    expect(
      uploadInitializationSchema.safeParse({ ...base, editing: { document, source: base } }).success
    ).toBe(true);
  });

  it.each([
    { document },
    { document, sourceAssetId, source: base },
    { document: { ...document, version: 2 }, sourceAssetId },
    { document, source: { ...base, mimeType: 'image/svg+xml' } },
    { document, source: { ...base, byteSize: 64 * 1024 * 1024 + 1 } },
    { document, source: { ...base, sourceUrl: 'https://external.test/a.png' } },
    { document, sourceAssetId, remoteUrl: 'https://external.test/a.png' },
  ])('rejects an invalid or implicit remote foundation: %o', (editing) => {
    expect(uploadInitializationSchema.safeParse({ ...base, editing }).success).toBe(false);
  });
});
