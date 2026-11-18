import { describe, expect, it } from 'vitest';
import { mediaMetadataLimits, normalizeMediaMetadataPatch } from './media.metadata.js';

describe('editorial media metadata', () => {
  it('preserves focus, explicit removal and omission independently of text fields', () => {
    expect(normalizeMediaMetadataPatch({ focusPoint: { x: 0, y: 1 }, title: ' Bild ' })).toEqual({
      focusPoint: { x: 0, y: 1 },
      title: 'Bild',
    });
    expect(normalizeMediaMetadataPatch({ focusPoint: null })).toEqual({ focusPoint: null });
    expect(normalizeMediaMetadataPatch({ title: 'Bild' })).not.toHaveProperty('focusPoint');
  });

  it.each([NaN, Infinity, -Infinity, -0.01, 1.01])(
    'rejects invalid focus coordinate %s',
    (value) => {
      for (const point of [
        { x: value, y: 0.5 },
        { x: 0.5, y: value },
      ]) {
        expect(() => normalizeMediaMetadataPatch({ focusPoint: point })).toThrow(
          'invalid_media_metadata:focusPoint'
        );
      }
    }
  );
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
