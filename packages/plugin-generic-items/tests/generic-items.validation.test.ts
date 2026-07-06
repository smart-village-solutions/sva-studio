import { describe, expect, it } from 'vitest';

import { genericItemsDetailFormSchema } from '../src/generic-items.validation.js';

const emptyContact = { firstName: '', lastName: '', email: '', phone: '', fax: '', webUrls: [] };

const createValidFormValues = () => ({
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
  contacts: [emptyContact],
  webUrls: [{ url: 'https://example.org', description: '' }],
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
      contacts: [emptyContact],
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
      contacts: [emptyContact],
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
      contacts: [emptyContact],
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
      contacts: [emptyContact],
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
      ...createValidFormValues(),
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
    });

    expect(result.success).toBe(true);
  });

  it('rejects addresses with only one coordinate', () => {
    const result = genericItemsDetailFormSchema.safeParse({
      ...createValidFormValues(),
      addresses: [{ addition: '', street: '', zip: '', city: '', kind: '', latitude: '52.1', longitude: '' }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects locations with only one coordinate', () => {
    const result = genericItemsDetailFormSchema.safeParse({
      ...createValidFormValues(),
      locations: [{ name: '', department: '', district: '', regionName: '', state: '', latitude: '', longitude: '13.4' }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects addresses with non-numeric coordinates', () => {
    const result = genericItemsDetailFormSchema.safeParse({
      ...createValidFormValues(),
      addresses: [{ addition: '', street: '', zip: '', city: '', kind: '', latitude: 'abc', longitude: '13.4' }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects locations with out-of-range coordinates', () => {
    const result = genericItemsDetailFormSchema.safeParse({
      ...createValidFormValues(),
      locations: [{ name: '', department: '', district: '', regionName: '', state: '', latitude: '91', longitude: '13.4' }],
    });

    expect(result.success).toBe(false);
  });
});
