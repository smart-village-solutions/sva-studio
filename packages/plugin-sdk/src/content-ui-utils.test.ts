import { describe, expect, it } from 'vitest';

import {
  compactOptionalString,
  findHostMediaReferenceAssetId,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
  toHostMediaFieldOptions,
} from './content-ui-utils.js';

describe('content-ui-utils', () => {
  it('compacts optional strings and converts datetime-local values safely', () => {
    expect(compactOptionalString('  Titel  ')).toBe('Titel');
    expect(compactOptionalString('   ')).toBeUndefined();
    expect(compactOptionalString()).toBeUndefined();

    expect(toDatetimeLocalValue(undefined)).toBe('');
    expect(toDatetimeLocalValue('invalid-date')).toBe('');
    expect(toDatetimeLocalValue('2026-04-29T09:30:00.000Z')).toMatch(/^2026-04-29T\d{2}:\d{2}$/);

    expect(fromDatetimeLocalValue('')).toBe('');
    expect(fromDatetimeLocalValue('invalid-date')).toBe('');
    expect(fromDatetimeLocalValue('2026-04-29T11:45')).toContain('2026-04-29T');
  });

  it('maps host media options and resolves references by role with fallback behavior', () => {
    expect(
      toHostMediaFieldOptions([
        { id: 'asset-1', metadata: { title: 'Titelbild' } },
        { id: 'asset-2' },
      ])
    ).toEqual([
      { assetId: 'asset-1', label: 'Titelbild' },
      { assetId: 'asset-2', label: 'asset-2' },
    ]);

    expect(
      findHostMediaReferenceAssetId(
        [
          { assetId: 'asset-1', role: 'teaser_image' },
          { assetId: 'asset-2', role: 'gallery_item' },
        ],
        'gallery_item'
      )
    ).toBe('asset-2');
    expect(findHostMediaReferenceAssetId([{ assetId: 'asset-1', role: 'teaser_image' }], 'hero')).toBeNull();
  });
});
