import { describe, expect, it } from 'vitest';

import {
  compareFaqRecords,
  faqFormSchema,
  isFaqGenericItem,
  mapFaqFormValuesToGenericItemInput,
  mapGenericItemToFaqFormValues,
  readFaqPayload,
} from '../src/faq.model.js';

describe('FAQ model', () => {
  it('defaults malformed historical payload fields', () => {
    expect(readFaqPayload({ languageCode: 'invalid locale', sortWeight: 1.5 })).toEqual({
      languageCode: 'und',
      sortWeight: 0,
    });
  });

  it('normalizes its owned payload fields and preserves legacy fields', () => {
    expect(
      mapFaqFormValuesToGenericItemInput(
        { question: 'Frage', answer: 'Antwort', languageCode: 'de-de', sortWeight: -1, visible: true },
        { legacy: true, sortWeight: 8 }
      )
    ).toEqual({
      title: 'Frage',
      genericType: 'FAQ',
      contentBlocks: [{ body: 'Antwort' }],
      payload: { legacy: true, languageCode: 'de-DE', sortWeight: -1 },
      visible: true,
    });
  });

  it('rejects markup in answers and invalid language codes', () => {
    expect(
      faqFormSchema.safeParse({ question: 'Frage', answer: '<p>Antwort</p>', languageCode: 'de', sortWeight: 0, visible: true })
        .success
    ).toBe(false);
    expect(
      faqFormSchema.safeParse({ question: 'Frage', answer: 'Antwort', languageCode: 'de_DE', sortWeight: 0, visible: true })
        .success
    ).toBe(false);
  });

  it('uses language, weight, localized question, and id as ordering keys', () => {
    const records = [
      { id: 'b', title: 'Ähre', genericType: 'FAQ', contentBlocks: [], payload: { languageCode: 'de', sortWeight: 0 }, visible: true, createdAt: '', updatedAt: '' },
      { id: 'a', title: 'Ähre', genericType: 'FAQ', contentBlocks: [], payload: { languageCode: 'de', sortWeight: 0 }, visible: true, createdAt: '', updatedAt: '' },
      { id: 'c', title: 'Question', genericType: 'FAQ', contentBlocks: [], payload: { languageCode: 'en', sortWeight: -1 }, visible: true, createdAt: '', updatedAt: '' },
    ];

    expect(records.toSorted(compareFaqRecords).map((record) => record.id)).toEqual(['a', 'b', 'c']);
  });

  it('maps publicationDate from an existing faq item into form values', () => {
    expect(
      mapGenericItemToFaqFormValues({
        id: 'faq-1',
        title: 'Frage',
        genericType: 'FAQ',
        contentBlocks: [{ body: 'Antwort' }],
        payload: { languageCode: 'de', sortWeight: 1 },
        visible: false,
        publicationDate: '2026-07-21T10:00:00.000Z',
        createdAt: '',
        updatedAt: '',
      })
    ).toEqual({
      question: 'Frage',
      answer: 'Antwort',
      languageCode: 'de',
      sortWeight: 1,
      visible: false,
      publicationDate: '2026-07-21T10:00:00.000Z',
    });
  });

  it('recognizes faq generic items by discriminator', () => {
    expect(isFaqGenericItem({ genericType: 'FAQ' })).toBe(true);
    expect(isFaqGenericItem({ genericType: 'INFO' })).toBe(false);
  });
});
