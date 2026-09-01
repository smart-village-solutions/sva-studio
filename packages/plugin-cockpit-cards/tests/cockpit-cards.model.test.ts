import { describe, expect, it } from 'vitest';

import {
  compareCockpitCardRecords,
  isCockpitCardGenericItem,
  mapCockpitCardFormValuesToGenericItemInput,
  mapGenericItemToCockpitCardFormValues,
  readCockpitCardPayload,
} from '../src/cockpit-cards.model.js';

const values = {
  heading: 'Willkommen',
  text: 'Mehr erfahren',
  languageCode: 'de-de',
  sortWeight: 2,
  category: 'Startseite',
  images: [{ sourceUrl: { url: 'https://example.test/image.jpg' }, contentType: 'image' as const }],
  link: 'https://example.test/details',
  linkText: 'Mehr erfahren',
  openInNewTab: true,
  visible: true,
};

describe('cockpit card model', () => {
  it('maps the constrained form to GenericItem fields and preserves payload', () => {
    expect(
      mapCockpitCardFormValuesToGenericItemInput(values, {
        externalId: 'source-1',
        payload: { legacy: true },
      })
    ).toEqual(
      expect.objectContaining({
        title: 'Willkommen',
        genericType: 'COCKPIT_CARD',
        externalId: 'source-1',
        contentBlocks: [{ body: 'Mehr erfahren' }],
        payload: {
          legacy: true,
          languageCode: 'de-DE',
          sortWeight: 2,
          openInNewTab: true,
        },
        categories: [{ name: 'Startseite' }],
        categoryName: 'Startseite',
        mediaContents: values.images,
        webUrls: [
          {
            url: 'https://example.test/details',
            description: 'Mehr erfahren',
          },
        ],
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
        payload: { languageCode: 'en', sortWeight: 1, openInNewTab: true },
        categories: [{ name: 'Home' }],
        mediaContents: values.images,
        webUrls: [{ url: 'https://example.test', description: 'Details' }],
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
        linkText: 'Details',
        openInNewTab: true,
      })
    );
  });

  it.each([
    [{ ...values, category: '' }, 'category'],
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

  it('maps optional text, language and images without placeholder content', () => {
    expect(
      mapCockpitCardFormValuesToGenericItemInput({
        ...values,
        text: '',
        languageCode: '',
        images: [],
        link: '',
        linkText: 'Wird entfernt',
        openInNewTab: true,
      })
    ).toEqual(
      expect.objectContaining({
        contentBlocks: [],
        payload: { languageCode: '', sortWeight: 2, openInNewTab: false },
        mediaContents: [],
        webUrls: [],
      })
    );
    expect(readCockpitCardPayload({ languageCode: '', sortWeight: 2 })).toEqual({
      languageCode: '',
      sortWeight: 2,
      openInNewTab: false,
    });
  });

  it('accepts an explicit http image while keeping the optional destination link https-only', () => {
    expect(
      mapCockpitCardFormValuesToGenericItemInput({
        ...values,
        images: [
          { sourceUrl: { url: 'http://example.test/image.jpg' }, contentType: 'image' as const },
        ],
      }).mediaContents
    ).toEqual([{ sourceUrl: { url: 'http://example.test/image.jpg' }, contentType: 'image' }]);
  });

  it('uses safe defaults for malformed payloads and missing optional GenericItem fields', () => {
    expect(readCockpitCardPayload(null)).toEqual({
      languageCode: 'und',
      sortWeight: 0,
      openInNewTab: false,
    });
    expect(readCockpitCardPayload([])).toEqual({
      languageCode: 'und',
      sortWeight: 0,
      openInNewTab: false,
    });
    expect(readCockpitCardPayload({ languageCode: 'invalid!', sortWeight: 1.5 })).toEqual({
      languageCode: 'und',
      sortWeight: 0,
      openInNewTab: false,
    });
    expect(
      mapGenericItemToCockpitCardFormValues({
        id: 'empty',
        title: 'Leer',
        genericType: 'COCKPIT_CARD',
        contentBlocks: [],
        payload: undefined,
        categories: [],
        mediaContents: [],
        webUrls: [],
        visible: false,
        createdAt: '',
        updatedAt: '',
      })
    ).toMatchObject({
      text: '',
      category: '',
      link: '',
      linkText: '',
      openInNewTab: false,
      visible: false,
    });
  });

  it('identifies and deterministically orders cockpit card records', () => {
    const makeRecord = (id: string, title: string, languageCode: string, sortWeight: number) => ({
      id,
      title,
      genericType: 'COCKPIT_CARD' as const,
      contentBlocks: [{ body: 'Text' }],
      payload: { languageCode, sortWeight },
      categories: [{ name: 'Startseite' }],
      mediaContents: values.images,
      webUrls: [],
      visible: true,
      createdAt: '',
      updatedAt: '',
    });
    expect(isCockpitCardGenericItem(makeRecord('1', 'A', 'de', 0))).toBe(true);
    expect(isCockpitCardGenericItem({ genericType: 'FAQ' } as never)).toBe(false);
    expect(
      compareCockpitCardRecords(makeRecord('1', 'A', 'de', 0), makeRecord('2', 'A', 'en', 0))
    ).toBeLessThan(0);
    expect(
      compareCockpitCardRecords(makeRecord('1', 'A', 'de', 1), makeRecord('2', 'A', 'de', 2))
    ).toBeLessThan(0);
    expect(
      compareCockpitCardRecords(makeRecord('1', 'A2', 'de', 1), makeRecord('2', 'A10', 'de', 1))
    ).toBeLessThan(0);
    expect(
      compareCockpitCardRecords(makeRecord('1', 'A', 'de', 1), makeRecord('2', 'A', 'de', 1))
    ).toBeLessThan(0);
    expect(
      compareCockpitCardRecords(makeRecord('1', 'A', '', 1), makeRecord('2', 'B', '', 1))
    ).toBeLessThan(0);
  });
});
