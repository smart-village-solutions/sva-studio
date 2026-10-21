import { describe, expect, it } from 'vitest';
import { metadataUpdateSchema } from './schemas.js';

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
