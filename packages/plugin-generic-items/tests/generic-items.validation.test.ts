import { describe, expect, it } from 'vitest';

import { genericItemsDetailFormSchema } from '../src/generic-items.validation.js';

describe('generic items validation', () => {
  it('requires title and genericType', () => {
    const result = genericItemsDetailFormSchema.safeParse({
      title: '',
      genericType: '',
      teaser: '',
      visible: true,
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
      mediaContents: [],
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

    expect(result.success).toBe(false);
  });

  it('rejects invalid category entries', () => {
    const result = genericItemsDetailFormSchema.safeParse({
      title: 'Titel',
      genericType: 'faq',
      teaser: '',
      visible: true,
      author: '',
      keywords: '',
      externalId: '',
      publicationDate: '',
      publishedAt: '',
      categories: [''],
      contacts: [{ firstName: '', lastName: '', email: '', phone: '' }],
      webUrls: [{ url: '', description: '' }],
      addresses: [{ addition: '', street: '', zip: '', city: '', kind: '', latitude: '', longitude: '' }],
      contentBlocks: [{ title: '', intro: '', body: '' }],
      openingHours: [
        { weekday: '', dateFrom: '', dateTo: '', timeFrom: '', timeTo: '', description: '', open: false },
      ],
      mediaContents: [],
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

    expect(result.success).toBe(false);
  });

  it('rejects invalid numeric strings in structured price rows', () => {
    const result = genericItemsDetailFormSchema.safeParse({
      title: 'Titel',
      genericType: 'faq',
      teaser: '',
      visible: true,
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
      mediaContents: [],
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
          name: 'Regulär',
          amount: 'abc',
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

    expect(result.success).toBe(false);
  });
});
