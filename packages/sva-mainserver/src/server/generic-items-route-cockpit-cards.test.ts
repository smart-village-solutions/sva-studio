import { describe, expect, it } from 'vitest';

import type { SvaMainserverGenericItemInput } from '../types.js';
import {
  mergeCockpitCardPayload,
  validateCockpitCardItemOrResponse,
} from './generic-items-route-cockpit-cards.js';

const validItem: SvaMainserverGenericItemInput = {
  title: 'Überschrift',
  genericType: 'COCKPIT_CARD',
  contentBlocks: [{ body: 'Text' }],
  payload: { languageCode: 'de', sortWeight: 0 },
  categoryName: 'Startseite',
  categories: [{ name: 'Startseite' }],
  mediaContents: [{ sourceUrl: { url: 'https://example.test/image.jpg' }, contentType: 'image' }],
  webUrls: [{ url: 'https://example.test/details' }],
  visible: true,
};

describe('cockpit card route validation', () => {
  it('accepts the constrained GenericItem representation', () => {
    expect(validateCockpitCardItemOrResponse(validItem)).toBeNull();
  });

  it.each([
    [{ ...validItem, categories: [] }, 'Kategorie'],
    [{ ...validItem, mediaContents: [] }, 'Bild'],
    [{ ...validItem, webUrls: [{ url: 'https://one.test' }, { url: 'https://two.test' }] }, 'Link'],
    [{ ...validItem, contentBlocks: [{ body: '<b>Text</b>' }] }, 'HTML'],
    [{ ...validItem, contacts: [{ email: 'person@example.test' }] }, 'Kontakte'],
  ])('rejects a contract violation', async (item, message) => {
    const response = validateCockpitCardItemOrResponse(item);
    expect(response?.status).toBe(400);
    await expect(response?.json()).resolves.toEqual(
      expect.objectContaining({ message: expect.stringContaining(message) })
    );
  });

  it('preserves unknown payload keys', () => {
    expect(
      mergeCockpitCardPayload(
        { legacy: true, sortWeight: 1 },
        { languageCode: 'de', sortWeight: 2 }
      )
    ).toEqual({ legacy: true, languageCode: 'de', sortWeight: 2 });
  });
});
