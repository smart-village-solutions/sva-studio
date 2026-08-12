import { describe, expect, it } from 'vitest';

import {
  deduplicateWasteLocationKeys,
  mergeNewsWasteLocationKeys,
  requiresGlobalPushConfirmation,
} from '../src/news.waste-payload.js';

describe('News Waste payload', () => {
  it('normalizes and deduplicates location keys', () => {
    expect(
      deduplicateWasteLocationKeys([
        { street: ' Hauptstraße 1 ', zip: ' 12345 ', city: ' Musterstadt ' },
        { street: 'Hauptstraße 1', zip: '12345', city: 'Musterstadt' },
      ])
    ).toEqual([{ street: 'Hauptstraße 1', zip: '12345', city: 'Musterstadt' }]);
  });

  it('ignores malformed payload values and invalid array entries', () => {
    expect(deduplicateWasteLocationKeys('not-an-array')).toEqual([]);
    expect(
      deduplicateWasteLocationKeys([
        null,
        { street: 7, zip: '12345', city: 'Musterstadt' },
        { street: 'Hauptstraße 1', zip: '12345', city: 'Musterstadt' },
      ])
    ).toEqual([{ street: 'Hauptstraße 1', zip: '12345', city: 'Musterstadt' }]);
  });

  it('preserves unrelated payload fields when adding targets', () => {
    expect(
      mergeNewsWasteLocationKeys(
        { imageUrl: 'https://example.test/image.jpg', custom: { retained: true } },
        [{ street: 'Hauptstraße 1', zip: '12345', city: 'Musterstadt' }]
      )
    ).toEqual({
      imageUrl: 'https://example.test/image.jpg',
      custom: { retained: true },
      wasteLocationKeys: [{ street: 'Hauptstraße 1', zip: '12345', city: 'Musterstadt' }],
    });
  });

  it('preserves unrelated payload fields and explicitly clears targets for global delivery', () => {
    expect(
      mergeNewsWasteLocationKeys(
        { custom: 'retained', wasteLocationKeys: [{ street: 'Alt', zip: '1', city: 'Ort' }] },
        []
      )
    ).toEqual({ custom: 'retained', wasteLocationKeys: [] });
  });

  it('returns an explicit empty target list when removing the only existing target field', () => {
    expect(
      mergeNewsWasteLocationKeys(
        { wasteLocationKeys: [{ street: 'Alt', zip: '1', city: 'Ort' }] },
        []
      )
    ).toEqual({ wasteLocationKeys: [] });
    expect(mergeNewsWasteLocationKeys(undefined, [])).toBeUndefined();
  });

  it('confirms every newly triggered global push without targets', () => {
    expect(
      requiresGlobalPushConfirmation({
        pushNotificationEnabled: true,
        targetCount: 0,
      })
    ).toBe(true);
    expect(
      requiresGlobalPushConfirmation({
        pushNotificationEnabled: true,
        targetCount: 0,
        pushNotificationsSentAt: '2026-08-12T10:00:00.000Z',
      })
    ).toBe(false);
  });
});
