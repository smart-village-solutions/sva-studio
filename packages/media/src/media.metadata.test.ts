import { describe, expect, it } from 'vitest';
import { mediaMetadataLimits, normalizeMediaMetadataPatch } from './media.metadata.js';

describe('editorial media metadata', () => {
  it('distinguishes unchanged fields, clearing and trimmed content', () => {
    expect(
      normalizeMediaMetadataPatch({ title: ' Rathaus ', altText: ' ', license: null })
    ).toEqual({ title: 'Rathaus', altText: null, license: null });
    expect(normalizeMediaMetadataPatch({})).toEqual({});
  });

  it.each(Object.entries(mediaMetadataLimits))(
    'enforces the shared %s boundary',
    (field, limit) => {
      expect(normalizeMediaMetadataPatch({ [field]: 'x'.repeat(limit) })).toEqual({
        [field]: 'x'.repeat(limit),
      });
      expect(() => normalizeMediaMetadataPatch({ [field]: 'x'.repeat(limit + 1) })).toThrow(
        `invalid_media_metadata:${field}`
      );
    }
  );

  it('normalizes and clears tags without changing omitted fields', () => {
    expect(normalizeMediaMetadataPatch({ tags: [' Grün   Raum ', 'GRÜN RAUM'] })).toEqual({
      tags: ['Grün Raum'],
    });
    expect(normalizeMediaMetadataPatch({ tags: [] })).toEqual({ tags: [] });
    expect(() => normalizeMediaMetadataPatch({ tags: ['x'.repeat(65)] })).toThrow();
  });
});
