import { describe, expect, it } from 'vitest';
import { normalizeMediaTags } from './media.tags.js';

describe('media tags', () => {
  it('normalizes Unicode and spaces and preserves the first spelling', () => {
    expect(normalizeMediaTags(['  Gru\u0308nes   Rathaus ', 'GRÜNES Rathaus', 'Park'])).toEqual([
      'Grünes Rathaus',
      'Park',
    ]);
  });
  it('accepts removal and rejects empty, oversized and excessive tags', () => {
    expect(normalizeMediaTags([])).toEqual([]);
    for (const values of [
      ['  '],
      ['x'.repeat(65)],
      Array.from({ length: 21 }, (_, i) => String(i)),
    ]) {
      expect(() => normalizeMediaTags(values)).toThrow('invalid_media_tags');
    }
  });
});
