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
    expect(
      validateCockpitCardItemOrResponse({
        ...validItem,
        contentBlocks: [],
        payload: { sortWeight: 0 },
        mediaContents: [],
      })
    ).toBeNull();
  });

  it.each([
    [{ ...validItem, contentBlocks: [{ body: 'Text' }, { body: 'Mehr' }] }, 'Text'],
    [{ ...validItem, contentBlocks: [{ body: '' }] }, 'nicht leeren Text'],
    [{ ...validItem, contentBlocks: [{ title: 'Versteckt' }] }, 'nicht leeren Text'],
    [{ ...validItem, contentBlocks: [{ body: 'Text', title: 'Versteckt' }] }, 'nicht leeren Text'],
    [{ ...validItem, payload: { languageCode: 'invalid!', sortWeight: 0 } }, 'Sprachcode'],
    [{ ...validItem, payload: { languageCode: 'de', sortWeight: '0' } }, 'Sortiergewicht'],
    [{ ...validItem, payload: { languageCode: 'de', sortWeight: 1.5 } }, 'Sortiergewicht'],
    [{ ...validItem, payload: { languageCode: 'de', sortWeight: Number.POSITIVE_INFINITY } }, 'Sortiergewicht'],
    [{ ...validItem, categories: [] }, 'Kategorie'],
    [{ ...validItem, categories: [{ name: ' ' }] }, 'Kategorie'],
    [{ ...validItem, categories: [{ name: 'A' }, { name: 'B' }] }, 'Kategorie'],
    [{ ...validItem, mediaContents: [{ sourceUrl: { url: 'https://example.test/image.jpg' }, contentType: 'video' }] }, 'Bild'],
    [{ ...validItem, mediaContents: [{ sourceUrl: { url: 'http://example.test/image.jpg' }, contentType: 'image' }] }, 'Bild'],
    [{ ...validItem, webUrls: [{ url: 'https://one.test' }, { url: 'https://two.test' }] }, 'Link'],
    [{ ...validItem, webUrls: [{ url: 'http://example.test' }] }, 'Link'],
    [{ ...validItem, contentBlocks: [{ body: '<b>Text</b>' }] }, 'HTML'],
    [{ ...validItem, contacts: [{ email: 'person@example.test' }] }, 'Kontakte'],
    [{ ...validItem, addresses: [{}] }, 'Kontakte'],
    [{ ...validItem, locations: [{}] }, 'Kontakte'],
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
    expect(mergeCockpitCardPayload([], null)).toEqual({});
  });
});
