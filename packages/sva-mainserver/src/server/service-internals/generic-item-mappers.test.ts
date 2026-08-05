import { describe, expect, it } from 'vitest';

import {
  mapGenericItem,
  mapGenericItemDetail,
  mapOptionalGenericItem,
} from './generic-item-mappers.js';

const expectMappedError = (
  callback: () => unknown,
  expectedCode: 'invalid_response' | 'not_found',
  expectedStatusCode: 404 | 502
) => {
  try {
    callback();
    throw new Error('Expected callback to throw.');
  } catch (error) {
    expect(error).toMatchObject({
      code: expectedCode,
      statusCode: expectedStatusCode,
    });
  }
};

describe('generic-item-mappers', () => {
  it('maps sparse generic items with stable fallbacks', () => {
    expect(
      mapGenericItem({
        id: 'generic-1',
        title: null,
        description: null,
        author: null,
        keywords: null,
        externalId: null,
        publicationDate: null,
        publishedAt: null,
        genericType: 'generic',
        payload: null,
        visible: null,
        categories: null,
        contacts: null,
        webUrls: null,
        addresses: null,
        contentBlocks: null,
        openingHours: null,
        mediaContents: null,
        locations: null,
        dates: null,
        accessibilityInformations: null,
        priceInformations: null,
        createdAt: null,
        updatedAt: null,
      } as never)
    ).toEqual({
      id: 'generic-1',
      title: '',
      contentType: 'generic-items.generic-item',
      status: 'published',
      genericType: 'generic',
      visible: true,
      createdAt: '1970-01-01T00:00:00.000Z',
      updatedAt: '1970-01-01T00:00:00.000Z',
      categories: [],
      contacts: [],
      webUrls: [],
      addresses: [],
      contentBlocks: [],
      openingHours: [],
      mediaContents: [],
      locations: [],
      dates: [],
      accessibilityInformations: [],
      priceInformations: [],
    });
  });

  it('rejects a missing hard generic type discriminator', () => {
    expectMappedError(
      () => mapGenericItem({ id: 'generic-without-type', genericType: null } as never),
      'invalid_response',
      502
    );
  });

  it('maps populated generic items and normalizes nested relations', () => {
    expect(
      mapGenericItem({
        id: 'generic-2',
        title: 'FAQ',
        teaser: ' Kurz ',
        description: '<p>Antwort</p>',
        author: ' Redaktion ',
        keywords: 'eins,zwei',
        externalId: ' ext-2 ',
        publicationDate: '2026-07-01',
        publishedAt: '2026-07-02T12:00:00.000Z',
        genericType: 'faq',
        payload: { answer: '42' },
        visible: false,
        categories: [{ name: 'Service', children: [{ name: null }, { name: 'Unterkategorie' }] }],
        contacts: [
          { email: 'faq@example.invalid', webUrls: [{ url: 'https://example.invalid/contact' }] },
        ],
        webUrls: [{ url: 'https://example.invalid/faq', description: 'Mehr' }, { url: null }],
        addresses: [
          { city: 'Musterhausen', geoLocation: { latitude: '52.52', longitude: '13.4' } },
        ],
        contentBlocks: [
          {
            title: 'Antwort',
            body: '<p>42</p>',
            mediaContents: [
              { sourceUrl: { url: 'https://example.invalid/image.jpg' }, captionText: 'Bild' },
            ],
          },
        ],
        openingHours: [{ weekday: 'Mo', open: true }],
        mediaContents: [{ sourceUrl: { url: 'https://example.invalid/image-2.jpg' } }],
        locations: [
          { name: 'Rathaus', geoLocation: { latitude: '52.1', longitude: '13.2' } },
          { name: null },
        ],
        dates: [{ dateStart: '2026-08-01', useOnlyTimeDescription: 'true' }],
        accessibilityInformations: [
          {
            description: 'Stufenlos',
            urls: [{ url: 'https://example.invalid/a11y' }, { url: null }],
          },
        ],
        priceInformations: [{ name: 'Eintritt', amount: 12.5, groupPrice: true }],
        createdAt: '2026-07-03T08:00:00.000Z',
        updatedAt: null,
      } as never)
    ).toMatchObject({
      id: 'generic-2',
      title: 'FAQ',
      genericType: 'faq',
      description: '<p>Antwort</p>',
      author: ' Redaktion ',
      keywords: 'eins,zwei',
      externalId: ' ext-2 ',
      publicationDate: '2026-07-01',
      publishedAt: '2026-07-02T12:00:00.000Z',
      payload: { answer: '42' },
      visible: false,
      createdAt: '2026-07-03T08:00:00.000Z',
      updatedAt: '2026-07-03T08:00:00.000Z',
      categories: [{ name: 'Service', children: [{ name: 'Unterkategorie' }] }],
      contacts: [
        { email: 'faq@example.invalid', webUrls: [{ url: 'https://example.invalid/contact' }] },
      ],
      webUrls: [{ url: 'https://example.invalid/faq', description: 'Mehr' }],
      addresses: [{ city: 'Musterhausen', geoLocation: { latitude: 52.52, longitude: 13.4 } }],
      contentBlocks: [
        {
          title: 'Antwort',
          body: '<p>42</p>',
          mediaContents: [
            { sourceUrl: { url: 'https://example.invalid/image.jpg' }, captionText: 'Bild' },
          ],
        },
      ],
      openingHours: [{ weekday: 'Mo', open: true }],
      mediaContents: [{ sourceUrl: { url: 'https://example.invalid/image-2.jpg' } }],
      locations: [{ name: 'Rathaus', geoLocation: { latitude: 52.1, longitude: 13.2 } }],
      dates: [{ dateStart: '2026-08-01', useOnlyTimeDescription: 'true' }],
      accessibilityInformations: [
        { description: 'Stufenlos', urls: [{ url: 'https://example.invalid/a11y' }] },
      ],
      priceInformations: [{ name: 'Eintritt', amount: 12.5, groupPrice: true }],
    });
  });

  it('throws typed errors for missing or invalid upstream responses', () => {
    expectMappedError(() => mapOptionalGenericItem(null), 'not_found', 404);
    expectMappedError(() => mapGenericItem({ id: '' } as never), 'invalid_response', 502);
  });

  it('keeps valid list entries and reports malformed optional fields', () => {
    const result = mapGenericItemDetail({
      id: 'generic-resilient',
      title: 42,
      genericType: 'faq',
      payload: { preserved: true },
      webUrls: [{ url: 'https://example.invalid' }, { url: 42 }],
    } as never);

    expect(result.data).toMatchObject({
      id: 'generic-resilient',
      title: '',
      genericType: 'faq',
      payload: { preserved: true },
      webUrls: [{ url: 'https://example.invalid' }],
    });
    expect(result.deviations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fieldPath: 'title', fieldGroup: 'title' }),
        expect.objectContaining({ fieldPath: 'webUrls[]', fieldGroup: 'webUrls' }),
      ])
    );
  });
});
