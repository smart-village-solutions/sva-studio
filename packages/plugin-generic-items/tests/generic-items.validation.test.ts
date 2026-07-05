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
      contentBlocks: [{ title: '', intro: '', body: '', mediaContents: [] }],
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
      contentBlocks: [{ title: '', intro: '', body: '', mediaContents: [] }],
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
      contentBlocks: [{ title: '', intro: '', body: '', mediaContents: [] }],
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

  it('rejects non-https urls in structured url fields', () => {
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
      webUrls: [{ url: 'http://example.org', description: '' }],
      addresses: [{ addition: '', street: '', zip: '', city: '', kind: '', latitude: '', longitude: '' }],
      contentBlocks: [{ title: '', intro: '', body: '', mediaContents: [] }],
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
      accessibilityInformations: [
        { description: '', types: '', urls: [{ url: 'http://example.org/accessibility', description: '' }] },
      ],
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

  it('allows non-https media asset urls because they are host-provided', () => {
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
      webUrls: [{ url: 'https://example.org', description: '' }],
      addresses: [{ addition: '', street: '', zip: '', city: '', kind: '', latitude: '', longitude: '' }],
      contentBlocks: [{ title: '', intro: '', body: '', mediaContents: [] }],
      openingHours: [
        { weekday: '', dateFrom: '', dateTo: '', timeFrom: '', timeTo: '', description: '', open: false },
      ],
      mediaContents: [
        {
          captionText: 'Asset',
          copyright: '',
          contentType: 'image',
          height: '',
          width: '',
          sourceUrl: { url: 'http://localhost:3000/uploads/image.jpg', description: '' },
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
      accessibilityInformations: [{ description: '', types: '', urls: [{ url: 'https://example.org/a11y', description: '' }] }],
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

    expect(result.success).toBe(true);
  });
});
