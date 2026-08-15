import { describe, expect, it } from 'vitest';

import {
  createDefaultPoiDetailFormValues,
  mapPoiDetailFormValuesToInput,
  mapPoiItemToDetailFormValues,
  parsePoiPayloadText,
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
        categories: [{ name: 'Verwaltung' }, { name: 'Service' }],
        addresses: [{ street: 'Rathausplatz 1', city: 'Essen' }],
        openingHours: [{ weekday: 'Mo', timeFrom: '08:00', open: true }],
        webUrls: [{ url: 'https://example.test' }],
        payload: { floor: '1' },
      } satisfies PoiContentItem)
    ).toMatchObject({
      name: 'Rathaus',
      basis: {
        categories: ['Verwaltung', 'Service'],
      },
      content: {
        description: 'Zentrale',
        mobileDescription: 'Kurz',
        openingHours: [{ weekday: 'MO', timeFrom: '08:00', open: true }],
      },
    });
  });

  it('preserves externalId and keywords through poi form mapping', () => {
    const values = mapPoiItemToDetailFormValues({
      id: 'poi-meta-1',
      contentType: 'poi.point-of-interest',
      status: 'published',
      createdAt: '2026-06-11T10:00:00.000Z',
      updatedAt: '2026-06-11T10:00:00.000Z',
      name: 'Buergerhaus',
      externalId: 'poi-ext-7',
      keywords: 'service,amt',
    } satisfies PoiContentItem);

    expect(values.settings).toMatchObject({
      externalId: 'poi-ext-7',
      keywords: 'service,amt',
    });
    expect(mapPoiDetailFormValuesToInput(values, {})).toMatchObject({
      name: 'Buergerhaus',
      externalId: 'poi-ext-7',
      keywords: 'service,amt',
    });
  });

  it('serializes explicit clears for externalId and keywords', () => {
    expect(
      mapPoiDetailFormValuesToInput(
        {
          name: 'Buergerhaus',
          basis: {
            categories: [],
            active: true,
          },
          content: {
            description: '',
            mobileDescription: '',
            addresses: [],
            location: { name: '', department: '', district: '', regionName: '', state: '', geoLocation: { latitude: '', longitude: '' } },
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
          settings: {
            externalId: '   ',
            keywords: '',
          },
        },
        {}
      )
    ).toMatchObject({
      name: 'Buergerhaus',
      externalId: '',
      keywords: '',
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
      { name: 'Erwachsene', amount: '12.5', category: 'adult' },
      { name: 'Kinder', amount: '7.5', category: 'child' },
    ]);
    expect(values.content.mediaContents).toMatchObject([
      { captionText: 'Parkplan', contentType: 'image', sourceUrl: { url: 'https://example.test/park.jpg' } },
    ]);
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
            categories: ['Freizeit', 'Kultur', 'Freizeit'],
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
          settings: {},
        },
        { source: 'sync' }
      )
    ).toMatchObject({
      name: 'Stadtpark',
      description: 'Ein schöner Ort',
      mobileDescription: 'Kurz',
      categoryName: 'Freizeit',
      categories: [{ name: 'Freizeit' }, { name: 'Kultur' }],
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
      mediaContents: [
        { captionText: 'Parkplan', contentType: 'image', sourceUrl: { url: 'https://example.test/park.jpg' } },
      ],
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
            categories: [],
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
            categories: [],
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
          settings: {},
        },
        {}
      )
    ).toEqual({
      name: 'Test POI',
      mobileDescription: '',
      active: false,
      externalId: '',
      keywords: '',
      addresses: [{ geoLocation: { latitude: 52.5, longitude: undefined } }],
      openingHours: [{ weekday: 'MO', sortNumber: 0, open: false, useYear: false }],
      webUrls: [{ url: 'https://example.test', description: 'Start' }],
      priceInformations: [{ amount: 0, groupPrice: false, ageFrom: 0, minChildrenCount: 0 }],
      mediaContents: [],
      certificates: [],
      accessibilityInformation: {},
      tags: [],
    });
  });

  it('serializes explicit clearing objects for operator and accessibility sections', () => {
    expect(
      mapPoiDetailFormValuesToInput(
        {
          name: 'Test POI',
          basis: { categories: [], active: true },
          content: {
            description: '',
            mobileDescription: '',
            addresses: [],
            location: { name: '', department: '', district: '', regionName: '', state: '', geoLocation: { latitude: '', longitude: '' } },
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
          settings: {},
        },
        {}
      )
    ).toMatchObject({
      accessibilityInformation: {},
    });
    expect(
      mapPoiDetailFormValuesToInput(
        {
          name: 'Test POI',
          basis: { categories: [], active: true },
          content: {
            description: '',
            mobileDescription: '',
            addresses: [],
            location: { name: '', department: '', district: '', regionName: '', state: '', geoLocation: { latitude: '', longitude: '' } },
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
          settings: {},
        },
        {}
      ),
    ).not.toHaveProperty('operatingCompany');
  });

  it('omits an empty operating company from the serialized payload', () => {
    const mutation = mapPoiDetailFormValuesToInput(
      {
        name: 'Test POI',
        basis: { categories: [], active: true },
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
        settings: {},
      },
      {}
    );

    expect(mutation).not.toHaveProperty('operatingCompany');
  });

  it('serializes an explicit mobile description clearing value', () => {
    expect(
      mapPoiDetailFormValuesToInput(
        {
          name: 'Test POI',
          basis: {
            categories: [],
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
            categories: ['Freizeit'],
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
            categories: [],
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
          basis: { categories: [], active: true },
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
          basis: { categories: [], active: true },
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
          categories: [],
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
        settings: {},
      },
      {}
    );

    expect(validatePoiForm(mutation)).toEqual(['addresses', 'priceInformations']);
  });

  it('normalizes media MIME types to the Mainserver media content type values', () => {
    const input = mapPoiDetailFormValuesToInput(
      {
        name: 'Medien POI',
        basis: {
          categories: [],
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
          contact: {
            firstName: '',
            lastName: '',
            phone: '',
            fax: '',
            email: '',
            webUrls: [],
          },
          openingHours: [],
          webUrls: [],
          operator: {
            name: '',
            address: undefined,
            contact: undefined,
          },
          prices: [],
          mediaContents: [
            { contentType: 'image/jpeg', sourceUrl: { url: 'https://example.test/image.jpg' } },
            { contentType: 'audio/mpeg', sourceUrl: { url: 'https://example.test/audio.mp3' } },
            { contentType: 'video/mp4', sourceUrl: { url: 'https://example.test/video.mp4' } },
            { contentType: 'application/pdf', sourceUrl: { url: 'https://example.test/file.pdf' } },
            { contentType: 'logo', sourceUrl: { url: 'https://example.test/logo.svg' } },
          ],
          certificates: [],
          accessibilityInformation: {
            description: '',
            types: '',
            urls: [],
          },
          tagsText: '',
          payloadText: '{}',
        },
        settings: {},
      },
      {}
    );

    expect(input.mediaContents).toMatchObject([
      { contentType: 'image' },
      { contentType: 'audio' },
      { contentType: 'video' },
      { contentType: 'attachment' },
      { contentType: 'logo' },
    ]);
  });

  describe('plan 022 serialization characterization', () => {
    it('preserves ordered category deduplication and explicit scalar clears', () => {
      const defaults = createDefaultPoiDetailFormValues();
      const input = mapPoiDetailFormValuesToInput(
        {
          ...defaults,
          name: '  Bibliothek  ',
          basis: {
            active: false,
            categories: [' Kultur ', '', 'Service', 'Kultur', ' Service '],
          },
          content: {
            ...defaults.content,
            description: '   ',
            mobileDescription: '   ',
            tagsText: ' wissen, , digital, wissen ',
          },
          settings: {
            externalId: '   ',
            keywords: '',
          },
        },
        undefined
      );

      expect(input).toMatchObject({
        name: 'Bibliothek',
        active: false,
        categoryName: 'Kultur',
        categories: [{ name: 'Kultur' }, { name: 'Service' }],
        mobileDescription: '',
        externalId: '',
        keywords: '',
        tags: ['wissen', 'digital', 'wissen'],
        payload: undefined,
      });
      expect(input).not.toHaveProperty('description');
    });

    it('keeps partial structures, invalid validation sentinels, and row filtering semantics', () => {
      const defaults = createDefaultPoiDetailFormValues();
      const input = mapPoiDetailFormValuesToInput(
        {
          ...defaults,
          content: {
            ...defaults.content,
            addresses: [
              {
                street: ' Hauptstraße 1 ',
                geoLocation: { latitude: '52.5', longitude: '' },
              },
              {
                geoLocation: {
                  latitude: Number.POSITIVE_INFINITY as unknown as string,
                  longitude: '13.4',
                },
              },
            ],
            location: {
              district: ' Mitte ',
              geoLocation: { latitude: Number.NaN as unknown as string, longitude: '13.41' },
            },
            contact: {
              email: ' info@example.test ',
              webUrls: [
                { url: ' ', description: 'entfernt' },
                { url: ' https://example.test ', description: ' Kontakt ' },
              ],
            },
            openingHours: [
              { open: false },
              { weekday: 'Freitag', open: false, useYear: false, sortNumber: '0' },
            ],
            operator: {
              name: ' Betreiber ',
              address: { city: ' Essen ' },
              contact: { phone: ' 0201 123 ' },
            },
            prices: [
              { groupPrice: false },
              { name: ' Frei ', amount: '0', groupPrice: false, ageFrom: '0' },
            ],
            mediaContents: [
              { captionText: ' Ohne Quelle ', contentType: 'image/jpeg' },
              { sourceUrl: { url: ' ' }, contentType: 'application/pdf' },
            ],
          },
        },
        {}
      );

      expect(input.addresses).toEqual([
        { street: 'Hauptstraße 1', geoLocation: { latitude: 52.5, longitude: undefined } },
        { geoLocation: { latitude: Number.NaN, longitude: 13.4 } },
      ]);
      expect(input.location).toEqual({
        district: 'Mitte',
        geoLocation: { latitude: Number.NaN, longitude: 13.41 },
      });
      expect(input.contact).toEqual({
        email: 'info@example.test',
        webUrls: [{ url: 'https://example.test', description: 'Kontakt' }],
      });
      expect(input.openingHours).toEqual([
        { weekday: 'FR', sortNumber: 0, open: false, useYear: false },
      ]);
      expect(input.operatingCompany).toEqual({
        name: 'Betreiber',
        address: { city: 'Essen' },
        contact: { phone: '0201 123' },
      });
      expect(input.priceInformations).toEqual([
        { name: 'Frei', amount: 0, groupPrice: false, ageFrom: 0 },
      ]);
      expect(input.mediaContents).toEqual([
        { captionText: 'Ohne Quelle', contentType: 'image' },
        { contentType: 'attachment' },
      ]);
    });

    it.each([
      ['undefined', undefined, { payload: undefined }],
      ['null', null, { payload: null }],
      ['array', ['legacy'], { payload: ['legacy'] }],
      ['scalar', 'legacy', { payload: 'legacy' }],
      ['empty object', {}, {}],
      ['object', { source: 'legacy' }, { payload: { source: 'legacy' } }],
    ] as const)('keeps the %s payload serialization contract', (_label, payload, expected) => {
      const input = mapPoiDetailFormValuesToInput(createDefaultPoiDetailFormValues(), payload);

      if ('payload' in expected) {
        expect(input).toHaveProperty('payload', expected.payload);
      } else {
        expect(input).not.toHaveProperty('payload');
      }
    });
  });

  describe('plan 023 inbound mapping characterization', () => {
    const item = (overrides: Partial<PoiContentItem> = {}): PoiContentItem => ({
      id: 'poi-characterization',
      contentType: 'poi.point-of-interest',
      status: 'published',
      createdAt: '2026-06-11T10:00:00.000Z',
      updatedAt: '2026-06-11T10:00:00.000Z',
      name: 'Characterization',
      ...overrides,
    });

    it('keeps category precedence, active defaults, and empty-list defaults', () => {
      const explicit = mapPoiItemToDetailFormValues(
        item({
          active: false,
          categoryName: 'Legacy',
          categories: [{ name: 'Primär' }, { name: 'Sekundär' }],
          addresses: [],
          openingHours: [],
          webUrls: [],
          priceInformations: [],
          certificates: [],
        })
      );
      const legacy = mapPoiItemToDetailFormValues(item({ categoryName: 'Legacy' }));
      const empty = mapPoiItemToDetailFormValues(item({ categories: [], categoryName: '' }));

      expect(explicit.basis).toEqual({ categories: ['Primär', 'Sekundär'], active: false });
      expect(legacy.basis).toEqual({ categories: ['Legacy'], active: true });
      expect(empty.basis).toEqual({ categories: [], active: true });
      expect(explicit.content).toMatchObject({
        addresses: [{ street: '', city: '' }],
        openingHours: [{ weekday: '', open: true }],
        webUrls: [{ url: '' }],
        prices: [{ amount: '', groupPrice: false }],
        certificates: [{ name: '' }],
      });
    });

    it('maps partial legacy structures, finite numbers, and payload runtime shapes exactly', () => {
      const mapped = mapPoiItemToDetailFormValues(
        item({
          addresses: [
            { city: 'Essen', geoLocation: { latitude: 0, longitude: Number.POSITIVE_INFINITY } },
          ],
          location: { district: 'Mitte', geoLocation: { latitude: -1, longitude: Number.NaN } },
          contact: { phone: '0201 123' },
          operatingCompany: { name: 'Betreiber', contact: { email: 'info@example.test' } },
          priceInformations: [{ amount: 0, ageFrom: -1, ageTo: Number.POSITIVE_INFINITY }],
          openingHours: [{ weekday: 'Donnerstag', open: false }],
          payload: null,
        })
      );

      expect(mapped.content.addresses).toEqual([
        {
          addition: '',
          street: '',
          zip: '',
          city: 'Essen',
          kind: '',
          geoLocation: { latitude: '0', longitude: '' },
        },
      ]);
      expect(mapped.content.location).toMatchObject({
        district: 'Mitte',
        geoLocation: { latitude: '-1', longitude: '' },
      });
      expect(mapped.content.contact).toMatchObject({ phone: '0201 123', webUrls: [] });
      expect(mapped.content.operator).toMatchObject({
        name: 'Betreiber',
        contact: { email: 'info@example.test', webUrls: [] },
      });
      expect(mapped.content.prices[0]).toMatchObject({ amount: '0', ageFrom: '-1', ageTo: '' });
      expect(mapped.content.openingHours).toEqual([{ weekday: 'TH', open: false }]);
      expect(mapped.content.payloadText).toBe('null');
      expect(mapPoiItemToDetailFormValues(item({ payload: undefined })).content.payloadText).toBe(
        '{}'
      );
      expect(mapPoiItemToDetailFormValues(item({ payload: ['legacy'] })).content.payloadText).toBe(
        '[\n  "legacy"\n]'
      );
      expect(
        mapPoiItemToDetailFormValues(item({ payload: { source: 'legacy' } })).content.payloadText
      ).toBe('{\n  "source": "legacy"\n}');
      expect(parsePoiPayloadText('{not-json')).toBeUndefined();
    });

    it('preserves list order and the legacy clone-versus-reference behavior', () => {
      const addresses = [{ city: 'Erste' }, { city: 'Zweite' }];
      const openingHours = [
        { weekday: 'Mittwoch', timeFrom: '09:00' },
        { weekday: 'Montag', timeFrom: '08:00' },
      ];
      const webUrls = [
        { url: 'https://second.example.test' },
        { url: 'https://first.example.test' },
      ];
      const mediaContents = [{ captionText: 'Zwei' }, { captionText: 'Eins' }];
      const certificates = [{ name: 'B' }, { name: 'A' }];
      const mapped = mapPoiItemToDetailFormValues(
        item({ addresses, openingHours, webUrls, mediaContents, certificates })
      );

      expect(mapped.content.addresses.map((address) => address.city)).toEqual(['Erste', 'Zweite']);
      expect(mapped.content.openingHours.map((hour) => hour.weekday)).toEqual(['WE', 'MO']);
      expect(mapped.content.webUrls).toBe(webUrls);
      expect(mapped.content.mediaContents).toBe(mediaContents);
      expect(mapped.content.certificates).toBe(certificates);
      expect(mapped.content.addresses).not.toBe(addresses);
      expect(mapped.content.openingHours).not.toBe(openingHours);
    });

    it('roundtrips stable inbound values without changing list order or legacy payload', () => {
      const source = item({
        categories: [{ name: 'Kultur' }, { name: 'Service' }],
        addresses: [{ city: 'Essen', geoLocation: { latitude: 51.45, longitude: 7.01 } }],
        openingHours: [{ weekday: 'Montag', timeFrom: '08:00', open: true }],
        webUrls: [{ url: 'https://example.test', description: 'Website' }],
        priceInformations: [{ name: 'Frei', amount: 0, groupPrice: false }],
        payload: { source: 'legacy' },
      });
      const mapped = mapPoiItemToDetailFormValues(source);
      const serialized = mapPoiDetailFormValuesToInput(
        mapped,
        parsePoiPayloadText(mapped.content.payloadText)
      );

      expect(serialized).toMatchObject({
        categories: [{ name: 'Kultur' }, { name: 'Service' }],
        addresses: [{ city: 'Essen', geoLocation: { latitude: 51.45, longitude: 7.01 } }],
        openingHours: [{ weekday: 'MO', timeFrom: '08:00', open: true }],
        webUrls: [{ url: 'https://example.test', description: 'Website' }],
        priceInformations: [{ name: 'Frei', amount: 0, groupPrice: false }],
        payload: { source: 'legacy' },
      });
    });
  });
});
