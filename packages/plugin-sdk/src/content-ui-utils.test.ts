import { describe, expect, it } from 'vitest';

import {
  compactOptionalString,
  findHostMediaReferenceAssetId,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
  toHostMediaFieldOptions,
} from './index.js';

describe('content ui utils', () => {
  it('normalizes optional strings and datetime-local values', () => {
    const datetimeLocalValue = '2026-05-01T12:30';

    expect(compactOptionalString('  ')).toBeUndefined();
    expect(compactOptionalString('  value  ')).toBe('value');
    expect(toDatetimeLocalValue('2026-05-01T10:15:00.000Z')).toMatch(/^2026-05-01T/);
    expect(toDatetimeLocalValue(fromDatetimeLocalValue(datetimeLocalValue))).toBe(datetimeLocalValue);
  });

  it('maps host media responses to field options and resolves role-based selections', () => {
    expect(
      toHostMediaFieldOptions([
        { id: 'asset-1', metadata: { title: 'Hero Image' } },
        { id: 'asset-2' },
      ])
    ).toEqual([
      { assetId: 'asset-1', label: 'Hero Image' },
      { assetId: 'asset-2', label: 'asset-2' },
    ]);
    expect(
      findHostMediaReferenceAssetId(
        [
          { assetId: 'asset-1', role: 'header_image' },
          { assetId: 'asset-2', role: 'teaser_image' },
        ],
        'teaser_image'
      )
    ).toBe('asset-2');
    expect(findHostMediaReferenceAssetId([], 'missing')).toBeNull();
  });
});
