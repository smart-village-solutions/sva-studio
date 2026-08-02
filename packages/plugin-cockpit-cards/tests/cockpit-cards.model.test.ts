import { describe, expect, it } from 'vitest';

import {
  mapCockpitCardFormValuesToGenericItemInput,
  mapGenericItemToCockpitCardFormValues,
} from '../src/cockpit-cards.model.js';

const values = {
  heading: 'Willkommen',
  text: 'Mehr erfahren',
  languageCode: 'de-de',
  sortWeight: 2,
  category: 'Startseite',
  images: [{ sourceUrl: { url: 'https://example.test/image.jpg' }, contentType: 'image' as const }],
  link: 'https://example.test/details',
  visible: true,
};

describe('cockpit card model', () => {
  it('maps the constrained form to GenericItem fields and preserves payload', () => {
    expect(mapCockpitCardFormValuesToGenericItemInput(values, { legacy: true })).toEqual(
      expect.objectContaining({
        title: 'Willkommen',
        genericType: 'COCKPIT_CARD',
        contentBlocks: [{ body: 'Mehr erfahren' }],
        payload: { legacy: true, languageCode: 'de-DE', sortWeight: 2 },
        categories: [{ name: 'Startseite' }],
        categoryName: 'Startseite',
        mediaContents: values.images,
        webUrls: [{ url: 'https://example.test/details' }],
      })
    );
  });

  it('reads canonical GenericItem fields', () => {
    expect(
      mapGenericItemToCockpitCardFormValues({
        id: 'card-1',
        title: 'Willkommen',
        genericType: 'COCKPIT_CARD',
        contentBlocks: [{ body: 'Text' }],
        payload: { languageCode: 'en', sortWeight: 1 },
        categories: [{ name: 'Home' }],
        mediaContents: values.images,
        webUrls: [{ url: 'https://example.test' }],
        visible: true,
        createdAt: '',
        updatedAt: '',
      })
    ).toEqual(
      expect.objectContaining({
        heading: 'Willkommen',
        text: 'Text',
        category: 'Home',
        images: values.images,
        link: 'https://example.test',
      })
    );
  });

  it.each([
    [{ ...values, category: '' }, 'category'],
    [{ ...values, images: [] }, 'images'],
    [{ ...values, text: '<p>Markup</p>' }, 'text'],
    [{ ...values, link: 'http://example.test' }, 'link'],
  ])('rejects invalid constrained values', (invalid, path) => {
    expect(() => mapCockpitCardFormValuesToGenericItemInput(invalid)).toThrow();
    try {
      mapCockpitCardFormValuesToGenericItemInput(invalid);
    } catch (error) {
      expect(JSON.stringify(error)).toContain(path);
    }
  });
});
