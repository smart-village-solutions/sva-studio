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
      })
    ).toEqual(
      expect.objectContaining({
        contentBlocks: [],
        payload: { languageCode: '', sortWeight: 2 },
        mediaContents: [],
      })
    );
    expect(readCockpitCardPayload({ languageCode: '', sortWeight: 2 })).toEqual({ languageCode: '', sortWeight: 2 });
  });

  it('uses safe defaults for malformed payloads and missing optional GenericItem fields', () => {
    expect(readCockpitCardPayload(null)).toEqual({ languageCode: 'und', sortWeight: 0 });
    expect(readCockpitCardPayload([])).toEqual({ languageCode: 'und', sortWeight: 0 });
    expect(readCockpitCardPayload({ languageCode: 'invalid!', sortWeight: 1.5 })).toEqual({
      languageCode: 'und',
      sortWeight: 0,
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
    ).toMatchObject({ text: '', category: '', link: '', visible: false });
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
    expect(compareCockpitCardRecords(makeRecord('1', 'A', 'de', 0), makeRecord('2', 'A', 'en', 0))).toBeLessThan(0);
    expect(compareCockpitCardRecords(makeRecord('1', 'A', 'de', 1), makeRecord('2', 'A', 'de', 2))).toBeLessThan(0);
    expect(compareCockpitCardRecords(makeRecord('1', 'A2', 'de', 1), makeRecord('2', 'A10', 'de', 1))).toBeLessThan(0);
    expect(compareCockpitCardRecords(makeRecord('1', 'A', 'de', 1), makeRecord('2', 'A', 'de', 1))).toBeLessThan(0);
    expect(compareCockpitCardRecords(makeRecord('1', 'A', '', 1), makeRecord('2', 'B', '', 1))).toBeLessThan(0);
  });
});
