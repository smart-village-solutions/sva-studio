import { describe, expect, it } from 'vitest';

import {
  deduplicateWasteLocationKeys,
  mergeNewsWasteLocationKeys,
  requiresGlobalPushConfirmation,
} from '../src/news.editor-model.js';

describe('News Waste payload', () => {
  it('normalizes and deduplicates location keys', () => {
    expect(
      deduplicateWasteLocationKeys([
        { street: ' Hauptstraße 1 ', zip: ' 12345 ', city: ' Musterstadt ' },
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

  it('removes only wasteLocationKeys for global delivery', () => {
    expect(
      mergeNewsWasteLocationKeys(
        { custom: 'retained', wasteLocationKeys: [{ street: 'Alt', zip: '1', city: 'Ort' }] },
        []
      )
    ).toEqual({ custom: 'retained' });
  });

  it('returns an explicit empty payload when removing the only existing target field', () => {
    expect(
      mergeNewsWasteLocationKeys(
        { wasteLocationKeys: [{ street: 'Alt', zip: '1', city: 'Ort' }] },
        []
      )
    ).toEqual({});
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
