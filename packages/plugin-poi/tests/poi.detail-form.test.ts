import { describe, expect, it } from 'vitest';

import {
  mapPoiDetailFormValuesToInput,
  mapPoiItemToDetailFormValues,
} from '../src/poi.detail-form.js';
import { validatePoiForm } from '../src/poi.validation.js';
import type { PoiContentItem } from '../src/poi.types.js';

describe('poi.detail-form', () => {
  it('maps a poi item into the fixed tab form model', () => {
    expect(
      mapPoiItemToDetailFormValues({
        id: 'poi-1',
        contentType: 'poi.point-of-interest',
        status: 'published',
        createdAt: '2026-06-11T10:00:00.000Z',
        updatedAt: '2026-06-11T10:00:00.000Z',
        name: 'Rathaus',
        description: 'Zentrale',
        mobileDescription: 'Kurz',
        active: true,
        categoryName: 'Verwaltung',
        addresses: [{ street: 'Rathausplatz 1', city: 'Essen' }],
        openingHours: [{ weekday: 'Mo', timeFrom: '08:00', open: true }],
        webUrls: [{ url: 'https://example.test' }],
        payload: { floor: '1' },
      } satisfies PoiContentItem)
    ).toMatchObject({
      name: 'Rathaus',
      content: {
        description: 'Zentrale',
        mobileDescription: 'Kurz',
        openingHours: [{ weekday: 'MO', timeFrom: '08:00', open: true }],
      },
    });
  });

  it('maps extended structured poi fields into form values without collapsing lists', () => {
    const values = mapPoiItemToDetailFormValues({
        id: 'poi-2',
        contentType: 'poi.point-of-interest',
        status: 'published',
        createdAt: '2026-06-11T10:00:00.000Z',
        updatedAt: '2026-06-11T10:00:00.000Z',
        name: 'Stadtpark',
        active: true,
        addresses: [
          {
            addition: 'Nordtor',
            street: 'Parkallee 1',
            zip: '12345',
            city: 'Musterhausen',
            kind: 'visit',
            geoLocation: { latitude: '52.5', longitude: '13.4' },
          },
        ],
        contact: {
          firstName: 'Anna',
          lastName: 'Muster',
          phone: '+49 30 1234',
          fax: '+49 30 5555',
          email: 'park@example.test',
          webUrls: [{ url: 'https://example.test/contact', description: 'Kontakt' }],
        },
        openingHours: [
          { weekday: 'MO', timeFrom: '08:00', timeTo: '18:00', open: true, description: 'Sommer' },
          { weekday: 'TU', timeFrom: '09:00', timeTo: '17:00', open: false, description: 'Winter' },
        ],
        webUrls: [
          { url: 'https://example.test/poi', description: 'Website' },
          { url: 'https://example.test/tickets', description: 'Tickets' },
        ],
        operatingCompany: {
          name: 'Stadtwerke',
          contact: { email: 'betrieb@example.test' },
        },
        priceInformations: [
          { name: 'Erwachsene', amount: 12.5, category: 'adult' },
          { name: 'Kinder', amount: 7.5, category: 'child' },
        ],
        mediaContents: [
          { captionText: 'Parkplan', contentType: 'image', sourceUrl: { url: 'https://example.test/park.jpg' } },
        ],
        location: {
          name: 'Stadtpark',
          district: 'Mitte',
          geoLocation: { latitude: 52.5, longitude: 13.4 },
        },
        certificates: [{ name: 'Familienfreundlich' }],
        accessibilityInformation: {
          description: 'Stufenlos',
          types: 'wheelchair',
          urls: [{ url: 'https://example.test/accessibility', description: 'Details' }],
        },
        tags: ['park', 'familie'],
        payload: { source: 'sync', rating: 5 },
    });

    expect(values.content.addresses[0]).toMatchObject({
      addition: 'Nordtor',
      street: 'Parkallee 1',
      zip: '12345',
      city: 'Musterhausen',
      kind: 'visit',
    });
    expect(values.content.contact).toMatchObject({
      fax: '+49 30 5555',
      webUrls: [{ url: 'https://example.test/contact', description: 'Kontakt' }],
    });
    expect(values.content.openingHours).toMatchObject([
      { weekday: 'MO', timeFrom: '08:00', timeTo: '18:00' },
      { weekday: 'TU', timeFrom: '09:00', timeTo: '17:00' },
    ]);
    expect(values.content.webUrls).toMatchObject([
      { url: 'https://example.test/poi', description: 'Website' },
      { url: 'https://example.test/tickets', description: 'Tickets' },
    ]);
    expect(values.content.operator).toMatchObject({ name: 'Stadtwerke' });
    expect(values.content.prices).toMatchObject([
      { name: 'Erwachsene', amount: '12.5' },
      { name: 'Kinder', amount: '7.5' },
    ]);
    expect(values.content.mediaContents).toMatchObject([{ captionText: 'Parkplan' }]);
    expect(values.content.location).toMatchObject({ name: 'Stadtpark', district: 'Mitte' });
    expect(values.content.certificates).toMatchObject([{ name: 'Familienfreundlich' }]);
    expect(values.content.accessibilityInformation).toMatchObject({
      description: 'Stufenlos',
      types: 'wheelchair',
    });
    expect(values.content.tagsText).toBe('park, familie');
    expect(values.content.payloadText).toBe('{\n  "source": "sync",\n  "rating": 5\n}');
  });

  it('maps extended form values back into the poi input without dropping structured fields', () => {
    expect(
      mapPoiDetailFormValuesToInput(
        {
          name: ' Stadtpark ',
          basis: {
            categoryName: 'Freizeit',
            active: true,
          },
          content: {
            description: ' Ein schöner Ort ',
            mobileDescription: ' Kurz ',
            addresses: [
              {
                addition: 'Nordtor',
                street: 'Parkallee 1',
                zip: '12345',
                city: 'Musterhausen',
                kind: 'visit',
                geoLocation: { latitude: '52.5', longitude: '13.4' },
              },
            ],
            location: {
              name: 'Stadtpark',
              district: 'Mitte',
              geoLocation: { latitude: '52.51', longitude: '13.41' },
            },
            contact: {
              firstName: 'Anna',
              lastName: 'Muster',
              phone: '+49 30 1234',
              fax: '+49 30 5555',
              email: 'park@example.test',
              webUrls: [{ url: 'https://example.test/contact', description: 'Kontakt' }],
            },
            openingHours: [
              { weekday: 'MO', timeFrom: '08:00', timeTo: '18:00', open: true, description: 'Sommer' },
              { weekday: 'TU', timeFrom: '09:00', timeTo: '17:00', open: false, description: 'Winter' },
            ],
            webUrls: [
              { url: 'https://example.test/poi', description: 'Website' },
              { url: 'https://example.test/tickets', description: 'Tickets' },
            ],
            operator: {
              name: 'Stadtwerke',
              contact: { email: 'betrieb@example.test' },
            },
            prices: [
              { name: 'Erwachsene', amount: '12.5', category: 'adult' },
              { name: 'Kinder', amount: '7.5', category: 'child' },
            ],
            mediaContents: [
              { captionText: 'Parkplan', contentType: 'image', sourceUrl: { url: 'https://example.test/park.jpg' } },
            ],
            certificates: [{ name: 'Familienfreundlich' }],
            accessibilityInformation: {
              description: 'Stufenlos',
              types: 'wheelchair',
              urls: [{ url: 'https://example.test/accessibility', description: 'Details' }],
            },
            tagsText: 'park, familie ,',
            payloadText: '{"source":"sync"}',
          },
          media: {
            images: [{ assetId: 'asset-2', label: 'Flyer' }],
          },
          settings: {},
        },
        { source: 'sync' }
      )
    ).toMatchObject({
      name: 'Stadtpark',
      description: 'Ein schöner Ort',
      mobileDescription: 'Kurz',
      categoryName: 'Freizeit',
      addresses: [
        {
          addition: 'Nordtor',
          street: 'Parkallee 1',
          zip: '12345',
          city: 'Musterhausen',
          kind: 'visit',
          geoLocation: { latitude: 52.5, longitude: 13.4 },
        },
      ],
      location: {
        name: 'Stadtpark',
        district: 'Mitte',
        geoLocation: { latitude: 52.51, longitude: 13.41 },
      },
      contact: {
        fax: '+49 30 5555',
        webUrls: [{ url: 'https://example.test/contact', description: 'Kontakt' }],
      },
      openingHours: [
        { weekday: 'MO', timeFrom: '08:00', timeTo: '18:00', open: true, description: 'Sommer' },
        { weekday: 'TU', timeFrom: '09:00', timeTo: '17:00', open: false, description: 'Winter' },
      ],
      webUrls: [
        { url: 'https://example.test/poi', description: 'Website' },
        { url: 'https://example.test/tickets', description: 'Tickets' },
      ],
      operatingCompany: {
        name: 'Stadtwerke',
        contact: { email: 'betrieb@example.test' },
      },
      priceInformations: [
        { name: 'Erwachsene', amount: 12.5, category: 'adult' },
        { name: 'Kinder', amount: 7.5, category: 'child' },
      ],
      mediaContents: [{ captionText: 'Parkplan' }],
      certificates: [{ name: 'Familienfreundlich' }],
      accessibilityInformation: {
        description: 'Stufenlos',
        types: 'wheelchair',
      },
      tags: ['park', 'familie'],
      payload: { source: 'sync' },
    });
  });

  it('normalizes weekday aliases to the canonical GraphQL values', () => {
    expect(
      mapPoiItemToDetailFormValues({
        id: 'poi-3',
        contentType: 'poi.point-of-interest',
        status: 'published',
        createdAt: '2026-06-11T10:00:00.000Z',
        updatedAt: '2026-06-11T10:00:00.000Z',
        name: 'Museum',
        active: true,
        openingHours: [{ weekday: 'Montag', timeFrom: '10:00', open: true }],
      } satisfies PoiContentItem).content.openingHours[0]?.weekday
    ).toBe('MO');

    expect(
      mapPoiDetailFormValuesToInput(
        {
          name: 'Museum',
          basis: {
            categoryName: '',
            active: true,
          },
          content: {
            description: '',
            mobileDescription: '',
            addresses: [],
            location: { name: '', department: '', district: '', regionName: '', state: '', geoLocation: { latitude: '', longitude: '' } },
            contact: { firstName: '', lastName: '', phone: '', fax: '', email: '', webUrls: [] },
            openingHours: [{ weekday: 'Montag', timeFrom: '10:00', open: true }],
            webUrls: [],
            operator: { name: '', address: { addition: '', street: '', zip: '', city: '', kind: '', geoLocation: { latitude: '', longitude: '' } }, contact: { firstName: '', lastName: '', phone: '', fax: '', email: '', webUrls: [] } },
            prices: [],
            mediaContents: [],
            certificates: [],
            accessibilityInformation: { description: '', types: '', urls: [] },
            tagsText: '',
            payloadText: '{}',
          },
          media: {
            images: [],
          },
          settings: {},
        },
        {}
      ).openingHours
    ).toMatchObject([{ weekday: 'MO', timeFrom: '10:00', open: true }]);
  });

  it('drops empty structured fragments and preserves falsy scalar branches during serialization', () => {
    expect(
      mapPoiDetailFormValuesToInput(
        {
          name: 'Test POI',
          basis: {
            categoryName: '',
            active: false,
          },
          content: {
            description: ' ',
            mobileDescription: '',
            addresses: [
              {
                addition: ' ',
                street: '',
                zip: '',
                city: '',
                kind: '',
                geoLocation: { latitude: '52.5', longitude: '' },
              },
            ],
            location: {
              name: '',
              department: '',
              district: '',
              regionName: '',
              state: '',
              geoLocation: { latitude: '', longitude: '' },
            },
            contact: {
              firstName: '',
              lastName: '',
              phone: '',
              fax: '',
              email: '',
              webUrls: [{ url: ' ', description: 'leer' }],
            },
            openingHours: [
              {
                weekday: 'Montag',
                sortNumber: '0',
                open: false,
                useYear: false,
              },
            ],
            webUrls: [{ url: 'https://example.test', description: ' Start ' }],
            operator: {
              name: '',
              address: {
                addition: '',
                street: '',
                zip: '',
                city: '',
                kind: '',
                geoLocation: { latitude: '', longitude: '' },
              },
              contact: { firstName: '', lastName: '', phone: '', fax: '', email: '', webUrls: [] },
            },
            prices: [
              {
                amount: '0',
                groupPrice: false,
                ageFrom: '0',
                minChildrenCount: '0',
              },
            ],
            mediaContents: [
              {
                captionText: '',
                contentType: '',
                sourceUrl: { url: ' ', description: 'ignore' },
              },
            ],
            certificates: [{ name: ' ' }],
            accessibilityInformation: {
              description: '',
              types: '',
              urls: [{ url: ' ', description: 'leer' }],
            },
            tagsText: ' , ,, ',
            payloadText: '{}',
          },
          media: {
            images: [],
          },
          settings: {},
        },
        {}
      )
    ).toEqual({
      name: 'Test POI',
      mobileDescription: '',
      active: false,
      addresses: [{ geoLocation: { latitude: 52.5, longitude: undefined } }],
      openingHours: [{ weekday: 'MO', sortNumber: 0, open: false, useYear: false }],
      webUrls: [{ url: 'https://example.test', description: 'Start' }],
      priceInformations: [{ amount: 0, groupPrice: false, ageFrom: 0, minChildrenCount: 0 }],
      mediaContents: [],
      certificates: [],
      tags: [],
    });
  });

  it('serializes an explicit mobile description clearing value', () => {
    expect(
      mapPoiDetailFormValuesToInput(
        {
          name: 'Test POI',
          basis: {
            categoryName: '',
            active: true,
          },
          content: {
            description: '',
            mobileDescription: '',
            addresses: [],
            location: {
              name: '',
              department: '',
              district: '',
              regionName: '',
              state: '',
              geoLocation: { latitude: '', longitude: '' },
            },
            contact: { firstName: '', lastName: '', phone: '', fax: '', email: '', webUrls: [] },
            openingHours: [],
            webUrls: [],
            operator: {
              name: '',
              address: { addition: '', street: '', zip: '', city: '', kind: '', geoLocation: { latitude: '', longitude: '' } },
              contact: { firstName: '', lastName: '', phone: '', fax: '', email: '', webUrls: [] },
            },
            prices: [],
            mediaContents: [],
            certificates: [],
            accessibilityInformation: { description: '', types: '', urls: [] },
            tagsText: '',
            payloadText: '{}',
          },
          media: { images: [] },
          settings: {},
        },
        {}
      )
    ).toMatchObject({
      mobileDescription: '',
    });
  });

  it('serializes secondary optional fields and keeps finite numeric branches stable', () => {
    expect(
      mapPoiDetailFormValuesToInput(
        {
          name: 'Test POI',
          basis: {
            categoryName: 'Freizeit',
            active: true,
          },
          content: {
            description: '',
            mobileDescription: '',
            addresses: [],
            location: {
              name: 'Park',
              department: 'Nord',
              district: '',
              regionName: 'Ruhrgebiet',
              state: 'NRW',
              geoLocation: { latitude: '52.1', longitude: '13.2' },
            },
            contact: {
              firstName: '',
              lastName: '',
              phone: '',
              fax: '',
              email: '',
              webUrls: [],
            },
            openingHours: [
              {
                weekday: 'Dienstag',
                dateFrom: '2026-07-01',
                dateTo: '2026-07-31',
                timeFrom: '09:00',
                timeTo: '17:00',
                description: 'Sommer',
              },
            ],
            webUrls: [],
            operator: {
              name: 'Tourismus',
              address: {
                addition: '',
                street: '',
                zip: '',
                city: '',
                kind: '',
                geoLocation: { latitude: '', longitude: '' },
              },
              contact: {
                firstName: '',
                lastName: '',
                phone: '',
                fax: '',
                email: 'tourismus@example.test',
                webUrls: [],
              },
            },
            prices: [
              {
                name: 'Tarif',
                amount: 15,
                ageTo: '17',
                minAdultCount: '1',
                maxAdultCount: '2',
                maxChildrenCount: '4',
                description: 'Familie',
                category: 'family',
              },
            ],
            mediaContents: [
              {
                captionText: 'Plan',
                copyright: 'Stadt',
                height: 480,
                width: '640',
                contentType: 'image',
                sourceUrl: { url: 'https://example.test/plan.jpg', description: 'Plan' },
              },
              {
                captionText: '',
                contentType: '',
                height: Number.POSITIVE_INFINITY,
                width: 'abc',
                sourceUrl: undefined,
              },
            ],
            certificates: [{ name: 'Familienfreundlich' }],
            accessibilityInformation: {
              description: 'Stufenlos',
              types: 'wheelchair',
              urls: [],
            },
            tagsText: 'park, familie',
            payloadText: '',
          },
          media: {
            images: [],
          },
          settings: {},
        },
        { source: 'manual' }
      )
    ).toMatchObject({
      categoryName: 'Freizeit',
      location: {
        name: 'Park',
        department: 'Nord',
        regionName: 'Ruhrgebiet',
        state: 'NRW',
        geoLocation: { latitude: 52.1, longitude: 13.2 },
      },
      openingHours: [
        {
          weekday: 'TU',
          dateFrom: '2026-07-01',
          dateTo: '2026-07-31',
          timeFrom: '09:00',
          timeTo: '17:00',
          description: 'Sommer',
        },
      ],
      operatingCompany: {
        name: 'Tourismus',
        contact: { email: 'tourismus@example.test' },
      },
      priceInformations: [
        {
          name: 'Tarif',
          amount: 15,
          ageTo: 17,
          minAdultCount: 1,
          maxAdultCount: 2,
          maxChildrenCount: 4,
          description: 'Familie',
          category: 'family',
        },
      ],
      mediaContents: [
        {
          captionText: 'Plan',
          copyright: 'Stadt',
          height: 480,
          width: 640,
          contentType: 'image',
          sourceUrl: { url: 'https://example.test/plan.jpg', description: 'Plan' },
        },
      ],
      certificates: [{ name: 'Familienfreundlich' }],
      accessibilityInformation: {
        description: 'Stufenlos',
        types: 'wheelchair',
      },
      tags: ['park', 'familie'],
      payload: { source: 'manual' },
    });
  });

  it('skips blank placeholder rows for opening hours and prices', () => {
    expect(
      mapPoiDetailFormValuesToInput(
        {
          name: 'Test POI',
          basis: {
            categoryName: '',
            active: true,
          },
          content: {
            description: '',
            mobileDescription: '',
            addresses: [],
            location: {
              name: '',
              department: '',
              district: '',
              regionName: '',
              state: '',
              geoLocation: { latitude: '', longitude: '' },
            },
            contact: { firstName: '', lastName: '', phone: '', fax: '', email: '', webUrls: [] },
            openingHours: [{ open: true }],
            webUrls: [],
            operator: {
              name: '',
              address: { addition: '', street: '', zip: '', city: '', kind: '', geoLocation: { latitude: '', longitude: '' } },
              contact: { firstName: '', lastName: '', phone: '', fax: '', email: '', webUrls: [] },
            },
            prices: [{ groupPrice: false }],
            mediaContents: [],
            certificates: [],
            accessibilityInformation: { description: '', types: '', urls: [] },
            tagsText: '',
            payloadText: '{}',
          },
          media: { images: [] },
          settings: {},
        },
        {}
      )
    ).toMatchObject({
      openingHours: [],
      priceInformations: [],
    });
  });

  it('drops opening-hours and price rows that only toggle the boolean flag', () => {
    expect(
      mapPoiDetailFormValuesToInput(
        {
          name: 'Test POI',
          basis: { categoryName: '', active: true },
          content: {
            description: '',
            mobileDescription: '',
            addresses: [],
            location: {
              name: '',
              department: '',
              district: '',
              regionName: '',
              state: '',
              geoLocation: { latitude: '', longitude: '' },
            },
            contact: { firstName: '', lastName: '', phone: '', fax: '', email: '', webUrls: [] },
            openingHours: [{ open: false }],
            webUrls: [],
            operator: {
              name: '',
              address: { addition: '', street: '', zip: '', city: '', kind: '', geoLocation: { latitude: '', longitude: '' } },
              contact: { firstName: '', lastName: '', phone: '', fax: '', email: '', webUrls: [] },
            },
            prices: [{ groupPrice: true }],
            mediaContents: [],
            certificates: [],
            accessibilityInformation: { description: '', types: '', urls: [] },
            tagsText: '',
            payloadText: '{}',
          },
          media: { images: [] },
          settings: {},
        },
        {}
      )
    ).toMatchObject({
      openingHours: [],
      priceInformations: [],
      tags: [],
    });
  });

  it('serializes an empty tag list when the tags field is cleared', () => {
    expect(
      mapPoiDetailFormValuesToInput(
        {
          name: 'Test POI',
          basis: { categoryName: '', active: true },
          content: {
            description: '',
            mobileDescription: '',
            addresses: [],
            location: {
              name: '',
              department: '',
              district: '',
              regionName: '',
              state: '',
              geoLocation: { latitude: '', longitude: '' },
            },
            contact: { firstName: '', lastName: '', phone: '', fax: '', email: '', webUrls: [] },
            openingHours: [],
            webUrls: [],
            operator: {
              name: '',
              address: { addition: '', street: '', zip: '', city: '', kind: '', geoLocation: { latitude: '', longitude: '' } },
              contact: { firstName: '', lastName: '', phone: '', fax: '', email: '', webUrls: [] },
            },
            prices: [],
            mediaContents: [],
            certificates: [],
            accessibilityInformation: { description: '', types: '', urls: [] },
            tagsText: ' , , ',
            payloadText: '{}',
          },
          media: { images: [] },
          settings: {},
        },
        {}
      )
    ).toMatchObject({
      tags: [],
    });
  });

  it('preserves non-empty invalid numeric input so validation can reject it explicitly', () => {
    const mutation = mapPoiDetailFormValuesToInput(
      {
        name: 'Test POI',
        basis: {
          categoryName: '',
          active: true,
        },
        content: {
          description: '',
          mobileDescription: '',
          addresses: [{ street: '', zip: '', city: '', kind: '', addition: '', geoLocation: { latitude: 'abc', longitude: '' } }],
          location: {
            name: '',
            department: '',
            district: '',
            regionName: '',
            state: '',
            geoLocation: { latitude: '', longitude: '' },
          },
          contact: { firstName: '', lastName: '', phone: '', fax: '', email: '', webUrls: [] },
          openingHours: [],
          webUrls: [],
          operator: {
            name: '',
            address: { addition: '', street: '', zip: '', city: '', kind: '', geoLocation: { latitude: '', longitude: '' } },
            contact: { firstName: '', lastName: '', phone: '', fax: '', email: '', webUrls: [] },
          },
          prices: [{ amount: 'abc' }],
          mediaContents: [],
          certificates: [],
          accessibilityInformation: { description: '', types: '', urls: [] },
          tagsText: '',
          payloadText: '{}',
        },
        media: { images: [] },
        settings: {},
      },
      {}
    );

    expect(validatePoiForm(mutation)).toEqual(['addresses', 'priceInformations']);
  });
});
