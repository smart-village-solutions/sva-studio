import { describe, expect, it } from 'vitest';

import { mapGenericItemsDetailFormValuesToInput } from '../src/generic-items.detail-form.js';

describe('generic items detail form mapping', () => {
  it('maps repeated links, contacts, addresses, media and dates into structured input arrays and drops empty rows', () => {
    const result = mapGenericItemsDetailFormValuesToInput({
      title: 'Freier Eintrag',
      genericType: 'faq',
      teaser: '',
      visible: true,
      author: '',
      keywords: '',
      externalId: '',
      publicationDate: '',
      publishedAt: '',
      categories: ['Rathaus', 'Service'],
      contacts: [
        { firstName: 'Max', lastName: '', email: 'max@example.org', phone: '' },
        { firstName: '', lastName: '', email: '', phone: '' },
      ],
      webUrls: [
        { url: 'https://example.org/faq', description: 'FAQ' },
        { url: '', description: '' },
      ],
      addresses: [
        {
          addition: 'Rathaus',
          street: 'Markt 1',
          zip: '12345',
          city: 'Musterstadt',
          kind: 'office',
          latitude: '51.5',
          longitude: '7.4',
        },
        {
          addition: '',
          street: '',
          zip: '',
          city: '',
          kind: '',
          latitude: '',
          longitude: '',
        },
      ],
      contentBlocks: [
        { title: 'Frage', intro: 'Kurzintro', body: '<p>Antwort</p>' },
        { title: '', intro: '', body: '' },
      ],
      openingHours: [
        {
          weekday: 'MO',
          dateFrom: '2026-07-01',
          dateTo: '',
          timeFrom: '08:00',
          timeTo: '12:00',
          description: 'Vormittags geöffnet',
          open: true,
        },
        {
          weekday: '',
          dateFrom: '',
          dateTo: '',
          timeFrom: '',
          timeTo: '',
          description: '',
          open: false,
        },
      ],
      mediaContents: [
        {
          captionText: 'Hero',
          copyright: 'Stadt',
          contentType: 'image',
          height: '1080',
          width: '1920',
          sourceUrl: {
            url: 'https://example.org/image.jpg',
            description: 'image.jpg',
          },
        },
        {
          captionText: '',
          copyright: '',
          contentType: '',
          height: '',
          width: '',
          sourceUrl: {
            url: '',
            description: '',
          },
        },
      ],
      locations: [
        {
          name: 'Bürgerbüro',
          department: 'Service',
          district: 'Innenstadt',
          regionName: 'Bochum',
          state: 'Deutschland',
          latitude: '51.482',
          longitude: '7.2166',
        },
        {
          name: '',
          department: '',
          district: '',
          regionName: '',
          state: '',
          latitude: '',
          longitude: '',
        },
      ],
      dates: [
        {
          weekday: 'Freitag',
          dateStart: '2026-07-10T09:00',
          dateEnd: '',
          timeStart: '',
          timeEnd: '',
          timeDescription: '',
          useOnlyTimeDescription: false,
        },
        {
          weekday: '',
          dateStart: '',
          dateEnd: '',
          timeStart: '',
          timeEnd: '',
          timeDescription: '',
          useOnlyTimeDescription: false,
        },
      ],
      accessibilityInformations: [
        {
          description: 'Stufenloser Zugang',
          types: 'wheelchair',
          urls: [
            { url: 'https://example.org/barrierefreiheit', description: 'Details' },
            { url: '', description: '' },
          ],
        },
        {
          description: '',
          types: '',
          urls: [{ url: '', description: '' }],
        },
      ],
      priceInformations: [
        {
          name: 'Regulär',
          amount: '12.5',
          groupPrice: true,
          ageFrom: '18',
          ageTo: '99',
          minAdultCount: '2',
          maxAdultCount: '10',
          minChildrenCount: '0',
          maxChildrenCount: '4',
          description: 'Abendkasse',
          category: 'Erwachsene',
        },
        {
          name: '',
          amount: '',
          groupPrice: false,
          ageFrom: '',
          ageTo: '',
          minAdultCount: '',
          maxAdultCount: '',
          minChildrenCount: '',
          maxChildrenCount: '',
          description: '',
          category: '',
        },
      ],
      payloadText: '{}',
    });

    expect(result.webUrls).toEqual([{ url: 'https://example.org/faq', description: 'FAQ' }]);
    expect(result.categoryName).toBe('Rathaus');
    expect(result.categories).toEqual([{ name: 'Rathaus' }, { name: 'Service' }]);
    expect(result.contacts).toEqual([{ firstName: 'Max', email: 'max@example.org' }]);
    expect(result.addresses).toEqual([
      {
        addition: 'Rathaus',
        street: 'Markt 1',
        zip: '12345',
        city: 'Musterstadt',
        kind: 'office',
        geoLocation: { latitude: 51.5, longitude: 7.4 },
      },
    ]);
    expect(result.openingHours).toEqual([
      {
        weekday: 'MO',
        dateFrom: '2026-07-01',
        timeFrom: '08:00',
        timeTo: '12:00',
        description: 'Vormittags geöffnet',
        open: true,
      },
    ]);
    expect(result.mediaContents).toEqual([
      {
        captionText: 'Hero',
        copyright: 'Stadt',
        contentType: 'image',
        height: 1080,
        width: 1920,
        sourceUrl: {
          url: 'https://example.org/image.jpg',
          description: 'image.jpg',
        },
      },
    ]);
    expect(result.locations).toEqual([
      {
        name: 'Bürgerbüro',
        department: 'Service',
        district: 'Innenstadt',
        regionName: 'Bochum',
        state: 'Deutschland',
        geoLocation: { latitude: 51.482, longitude: 7.2166 },
      },
    ]);
    expect(result.dates).toEqual([
      { weekday: 'Freitag', dateStart: '2026-07-10T09:00', useOnlyTimeDescription: false },
    ]);
    expect(result.contentBlocks).toEqual([{ title: 'Frage', intro: 'Kurzintro', body: '<p>Antwort</p>' }]);
    expect(result.accessibilityInformations).toEqual([
      {
        description: 'Stufenloser Zugang',
        types: 'wheelchair',
        urls: [{ url: 'https://example.org/barrierefreiheit', description: 'Details' }],
      },
    ]);
    expect(result.priceInformations).toEqual([
      {
        name: 'Regulär',
        amount: 12.5,
        groupPrice: true,
        ageFrom: 18,
        ageTo: 99,
        minAdultCount: 2,
        maxAdultCount: 10,
        minChildrenCount: 0,
        maxChildrenCount: 4,
        description: 'Abendkasse',
        category: 'Erwachsene',
      },
    ]);
  });

  it('preserves explicit false values and empty arrays so existing data can be cleared', () => {
    const result = mapGenericItemsDetailFormValuesToInput({
      title: 'Freier Eintrag',
      genericType: 'faq',
      teaser: '',
      visible: false,
      author: '',
      keywords: '',
      externalId: '',
      publicationDate: '',
      publishedAt: '',
      categories: [],
      contacts: [{ firstName: '', lastName: '', email: '', phone: '' }],
      webUrls: [{ url: '', description: '' }],
      addresses: [{ addition: '', street: '', zip: '', city: '', kind: '', latitude: '', longitude: '' }],
      contentBlocks: [{ title: '', intro: '', body: '' }],
      openingHours: [
        { weekday: '', dateFrom: '', dateTo: '', timeFrom: '', timeTo: '', description: '', open: false },
      ],
      mediaContents: [
        {
          captionText: '',
          copyright: '',
          contentType: '',
          height: '',
          width: '',
          sourceUrl: { url: '', description: '' },
        },
      ],
      locations: [{ name: '', department: '', district: '', regionName: '', state: '', latitude: '', longitude: '' }],
      dates: [
        {
          weekday: '',
          dateStart: '',
          dateEnd: '',
          timeStart: '',
          timeEnd: '',
          timeDescription: '',
          useOnlyTimeDescription: false,
        },
      ],
      accessibilityInformations: [{ description: '', types: '', urls: [{ url: '', description: '' }] }],
      priceInformations: [
        {
          name: '',
          amount: '',
          groupPrice: false,
          ageFrom: '',
          ageTo: '',
          minAdultCount: '',
          maxAdultCount: '',
          minChildrenCount: '',
          maxChildrenCount: '',
          description: '',
          category: '',
        },
      ],
      payloadText: '{}',
    });

    expect(result.visible).toBe(false);
    expect(result.categories).toEqual([]);
    expect(result.webUrls).toEqual([]);
    expect(result.contacts).toEqual([]);
    expect(result.addresses).toEqual([]);
    expect(result.contentBlocks).toEqual([]);
    expect(result.openingHours).toEqual([]);
    expect(result.mediaContents).toEqual([]);
    expect(result.locations).toEqual([]);
    expect(result.dates).toEqual([]);
    expect(result.accessibilityInformations).toEqual([]);
    expect(result.priceInformations).toEqual([]);
  });
});
