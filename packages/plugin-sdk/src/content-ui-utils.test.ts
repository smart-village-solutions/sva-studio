import { describe, expect, it } from 'vitest';

import {
  compactOptionalString,
  formatDateTimeInEditorTimeZone,
  formatTechnicalDateTimeInEditorTimeZone,
  findHostMediaReferenceAssetId,
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
  toHostMediaFieldOptions,
} from './content-ui-utils.js';

describe('content-ui-utils', () => {
  it('compacts optional strings and converts editor timestamps in Europe/Berlin safely', () => {
    expect(compactOptionalString('  Titel  ')).toBe('Titel');
    expect(compactOptionalString('   ')).toBeUndefined();
    expect(compactOptionalString()).toBeUndefined();

    expect(formatDateTimeInEditorTimeZone(undefined)).toBeUndefined();
    expect(formatDateTimeInEditorTimeZone('invalid-date')).toBe('invalid-date');
    expect(formatDateTimeInEditorTimeZone('2026-01-15T10:15:00.000Z')).toBe('15.01.2026, 11:15');
    expect(formatDateTimeInEditorTimeZone('2026-07-15T10:15:00.000Z')).toBe('15.07.2026, 12:15');
    expect(formatTechnicalDateTimeInEditorTimeZone('2026-01-15T10:15:23.456Z')).toBe('15.01.2026, 11:15:23,456');

    expect(toDatetimeLocalValue(undefined)).toBe('');
    expect(toDatetimeLocalValue('invalid-date')).toBe('');
    expect(toDatetimeLocalValue('2026-01-15T10:15:00.000Z')).toBe('2026-01-15T11:15');
    expect(toDatetimeLocalValue('2026-07-15T10:15:00.000Z')).toBe('2026-07-15T12:15');

    expect(fromDatetimeLocalValue('')).toBe('');
    expect(fromDatetimeLocalValue('invalid-date')).toBe('');
    expect(fromDatetimeLocalValue('2026-01-15T11:15')).toBe('2026-01-15T10:15:00.000Z');
    expect(fromDatetimeLocalValue('2026-07-15T12:15')).toBe('2026-07-15T10:15:00.000Z');
    expect(fromDatetimeLocalValue('2026-03-29T02:30')).toBe('');
    expect(fromDatetimeLocalValue('2026-10-25T02:30')).toBe('2026-10-25T00:30:00.000Z');
    expect(fromDatetimeLocalValue('2026-10-25T02:30', '2026-10-25T01:30:00.000Z')).toBe(
      '2026-10-25T01:30:00.000Z'
    );
    expect(fromDatetimeLocalValue('2026-10-25T02:30', '2026-10-25T00:30:00.000Z')).toBe(
      '2026-10-25T00:30:00.000Z'
    );
  });

  it('formats timestamps with an explicit locale without shared mutable state', () => {
    expect(formatDateTimeInEditorTimeZone('2026-01-15T10:15:00.000Z', 'en-GB')).toBe('15/01/2026, 11:15');
    expect(formatDateTimeInEditorTimeZone('2026-01-15T10:15:00.000Z')).toBe('15.01.2026, 11:15');
    expect(formatTechnicalDateTimeInEditorTimeZone('2026-01-15T10:15:23.456Z', 'en-GB')).toBe(
      '15/01/2026, 11:15:23.456'
    );
  });

  it('falls back to the default locale when an invalid locale tag is provided', () => {
    expect(() => formatDateTimeInEditorTimeZone('2026-01-15T10:15:00.000Z', 'invalid locale tag')).not.toThrow();
    expect(formatDateTimeInEditorTimeZone('2026-01-15T10:15:00.000Z', 'invalid locale tag')).toBe(
      '15.01.2026, 11:15'
    );
    expect(formatDateTimeInEditorTimeZone('2026-01-15T10:15:00.000Z', 'zz-ZZ')).toBe('15.01.2026, 11:15');
  });

  it('infers the editor locale from the document language when no explicit locale is provided', () => {
    const originalDocument = globalThis.document;
    const stubDocument = { documentElement: { lang: 'en' } } as Document;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: stubDocument,
    });

    expect(formatDateTimeInEditorTimeZone('2026-01-15T10:15:00.000Z')).toBe('15/01/2026, 11:15');

    stubDocument.documentElement.lang = 'fr-FR';
    expect(formatDateTimeInEditorTimeZone('2026-01-15T10:15:00.000Z')).toContain('2026');

    stubDocument.documentElement.lang = '   ';
    expect(formatDateTimeInEditorTimeZone('2026-01-15T10:15:00.000Z')).toBe('15.01.2026, 11:15');

    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: originalDocument,
    });
  });

  it('rejects out-of-range datetime-local values before timezone conversion', () => {
    expect(fromDatetimeLocalValue('2026-13-15T11:15')).toBe('');
    expect(fromDatetimeLocalValue('2026-01-32T11:15')).toBe('');
    expect(fromDatetimeLocalValue('2026-01-15T24:15')).toBe('');
    expect(fromDatetimeLocalValue('2026-01-15T11:60')).toBe('');
    expect(fromDatetimeLocalValue('2026-01-15T11:15', 'not-a-date')).toBe('2026-01-15T10:15:00.000Z');
  });

  it('maps host media options and resolves references by role with fallback behavior', () => {
    expect(
      toHostMediaFieldOptions([
        { id: 'asset-1', metadata: { title: 'Titelbild' } },
        { id: 'asset-1', metadata: { title: 'Titelbild Duplikat' } },
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
