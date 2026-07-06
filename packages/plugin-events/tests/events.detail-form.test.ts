import { describe, expect, it } from 'vitest';

import { mapEventItemToDetailFormValues, mapEventsDetailFormValuesToInput } from '../src/events.detail-form.js';
import type { EventContentItem } from '../src/events.types.js';

describe('events.detail-form', () => {
  it('maps an event item into the fixed tab form model without dropping structured sections', () => {
    expect(
      mapEventItemToDetailFormValues({
        id: 'event-1',
        contentType: 'events.event-record',
        status: 'published',
        createdAt: '2026-06-11T10:00:00.000Z',
        updatedAt: '2026-06-11T10:00:00.000Z',
        title: 'Stadtfest',
        description: 'Innenstadt',
        externalId: 'event-ext-1',
        keywords: 'stadt,fest',
        categoryName: 'Kultur',
        categories: [{ name: 'Kultur' }, { name: 'Open Air' }],
        dates: [{ dateStart: '2026-06-11T10:00:00.000Z', timeDescription: 'ab 10 Uhr', weekday: 'Mittwoch' }],
        addresses: [
          {
            addition: 'Rathausplatz',
            street: 'Marktplatz 1',
            city: 'Bochum',
            geoLocation: { latitude: 51.4818, longitude: 7.2162 },
          },
        ],
        contacts: [{ firstName: 'Erika', email: 'kontakt@example.test' }],
        organizer: {
          name: 'Stadt Bochum',
          address: { street: 'Rathausplatz 1', city: 'Bochum', geoLocation: { latitude: 51.4819, longitude: 7.2165 } },
        },
        priceInformations: [{ category: 'Erwachsene', amount: 12 }],
        accessibilityInformation: { description: 'Stufenlos zugänglich' },
        pointOfInterestId: 'poi-1',
        repeat: true,
        recurringType: 'weekday',
        recurringWeekdays: ['MO'],
        pushNotification: true,
        visible: false,
        tags: ['sommer', 'familie'],
      } satisfies EventContentItem)
    ).toMatchObject({
      title: 'Stadtfest',
      basis: {
        categories: ['Kultur', 'Open Air'],
        pointOfInterestId: 'poi-1',
        repeat: true,
        recurringType: 'weekday',
        recurringWeekdays: ['MO'],
      },
      content: {
        dates: [{ dateStart: '2026-06-11', timeDescription: 'ab 10 Uhr', weekday: 'Mittwoch' }],
        description: 'Innenstadt',
        addresses: [
          {
            addition: 'Rathausplatz',
            street: 'Marktplatz 1',
            city: 'Bochum',
            geoLocation: { latitude: '51.4818', longitude: '7.2162' },
          },
        ],
        contacts: [{ firstName: 'Erika', email: 'kontakt@example.test' }],
        organizer: {
          name: 'Stadt Bochum',
          address: { street: 'Rathausplatz 1', city: 'Bochum', geoLocation: { latitude: '51.4819', longitude: '7.2165' } },
        },
        priceInformations: [{ category: 'Erwachsene', amount: 12 }],
        accessibilityInformation: { description: 'Stufenlos zugänglich' },
      },
      settings: {
        externalId: 'event-ext-1',
        keywords: 'stadt,fest',
        pushNotification: true,
        visible: false,
        tags: 'sommer, familie',
      },
    });
  });

  it('serializes the expanded editor model back into the event input without placeholder rows', () => {
    expect(
      mapEventsDetailFormValuesToInput({
        title: '  Stadtfest  ',
        basis: {
          categories: [' Kultur ', ' Open Air ', 'Kultur'],
          pointOfInterestId: ' poi-7 ',
          repeat: true,
          recurring: ' weekly ',
          recurringType: ' weekday ',
          recurringInterval: ' 2 ',
          recurringWeekdays: [' mo ', '', 'di'],
        },
        content: {
          description: '  Innenstadt  ',
          dates: [
            {
              weekday: ' Montag ',
              dateStart: '2026-07-01',
              timeDescription: ' ganztägig ',
              useOnlyTimeDescription: true,
            },
            {
              weekday: '',
            },
          ],
          addresses: [
            {
              addition: ' Markt ',
              street: ' Hauptstraße 1 ',
              city: ' Bochum ',
              geoLocation: { latitude: '51.4818', longitude: '7.2162' },
            },
            { street: '' },
          ],
          urls: [{ url: 'https://example.test/event', description: ' Programm ' }, { url: '' }],
          contacts: [
            { firstName: ' Erika ', email: 'event@example.test', webUrls: [{ url: 'https://example.test/kontakt' }] },
            { firstName: '' },
          ],
          organizer: {
            name: ' Stadt Bochum ',
            address: {
              street: ' Rathausplatz 1 ',
              city: ' Bochum ',
              geoLocation: { latitude: '51.4820', longitude: '7.2166' },
            },
            contact: { phone: ' 0123 ' },
          },
          priceInformations: [{ category: 'Erwachsene', amount: 10, description: ' Abendkasse ' }, {}],
          accessibilityInformation: {
            description: ' Stufenlos ',
            types: ' rollstuhl ',
            urls: [{ url: 'https://example.test/barrierefreiheit', description: ' Details ' }, { url: '' }],
          },
        },
        settings: {
          headerImageAssetId: 'asset-1',
          pushNotification: true,
          visible: false,
          externalId: ' ext-7 ',
          keywords: ' sommer ',
          tags: ' familie, kultur , ',
        },
      })
    ).toEqual({
      title: 'Stadtfest',
      description: 'Innenstadt',
      categoryName: 'Kultur',
      categories: [{ name: 'Kultur' }, { name: 'Open Air' }],
      externalId: 'ext-7',
      keywords: 'sommer',
      dates: [{ weekday: 'Montag', dateStart: '2026-07-01', timeDescription: 'ganztägig', useOnlyTimeDescription: true }],
      addresses: [
        {
          addition: 'Markt',
          street: 'Hauptstraße 1',
          city: 'Bochum',
          geoLocation: { latitude: 51.4818, longitude: 7.2162 },
        },
      ],
      urls: [{ url: 'https://example.test/event', description: 'Programm' }],
      contacts: [{ firstName: 'Erika', email: 'event@example.test', webUrls: [{ url: 'https://example.test/kontakt' }] }],
      organizer: {
        name: 'Stadt Bochum',
        address: {
          street: 'Rathausplatz 1',
          city: 'Bochum',
          geoLocation: { latitude: 51.482, longitude: 7.2166 },
        },
        contact: { phone: '0123' },
      },
      priceInformations: [{ category: 'Erwachsene', amount: 10, description: 'Abendkasse' }],
      accessibilityInformation: {
        description: 'Stufenlos',
        types: 'rollstuhl',
        urls: [{ url: 'https://example.test/barrierefreiheit', description: 'Details' }],
      },
      pointOfInterestId: 'poi-7',
      repeat: true,
      recurring: 'weekly',
      recurringType: 'weekday',
      recurringInterval: '2',
      recurringWeekdays: ['mo', 'di'],
      tags: ['familie', 'kultur'],
      pushNotification: true,
      visible: false,
    });
  });

  it('serializes all optional nested event fields when they are present', () => {
    expect(
      mapEventsDetailFormValuesToInput({
        title: 'Workshop',
        basis: {
          categories: [],
          pointOfInterestId: '',
          repeat: false,
          recurring: '',
          recurringType: '',
          recurringInterval: '',
          recurringWeekdays: [],
        },
        content: {
          description: '',
          dates: [
            {
              weekday: ' Dienstag ',
              dateStart: '2026-08-01',
              dateEnd: '2026-08-02',
              timeStart: '10:00',
              timeEnd: '12:00',
              timeDescription: '',
              useOnlyTimeDescription: false,
            },
          ],
          addresses: [
            {
              addition: '',
              street: ' Nebenstraße 2 ',
              zip: ' 44787 ',
              city: ' Bochum ',
              kind: ' venue ',
              geoLocation: { latitude: 'not-a-number', longitude: '7.2162' },
            },
          ],
          urls: [],
          contacts: [
            {
              firstName: '',
              lastName: ' Mustermann ',
              phone: ' 0234 ',
              fax: ' 0235 ',
              email: '',
              webUrls: [],
            },
          ],
          organizer: {
            name: '',
            contact: {
              firstName: ' Max ',
              lastName: ' Muster ',
              phone: '',
              fax: '',
              email: ' max@example.test ',
              webUrls: [{ url: 'https://example.test/team', description: ' Team ' }],
            },
          },
          priceInformations: [
            {
              name: ' Regulär ',
              amount: Number.NaN,
              description: '',
              category: '',
            },
          ],
          accessibilityInformation: {
            description: '',
            types: '',
            urls: [],
          },
        },
        settings: {
          headerImageAssetId: '',
          pushNotification: false,
          visible: true,
          externalId: '',
          keywords: '',
          tags: '',
        },
      })
    ).toEqual({
      title: 'Workshop',
      dates: [
        {
          weekday: 'Dienstag',
          dateStart: '2026-08-01',
          dateEnd: '2026-08-02',
          timeStart: '10:00',
          timeEnd: '12:00',
        },
      ],
      addresses: [
        {
          street: 'Nebenstraße 2',
          zip: '44787',
          city: 'Bochum',
          kind: 'venue',
        },
      ],
      contacts: [
        {
          lastName: 'Mustermann',
          phone: '0234',
          fax: '0235',
        },
      ],
      organizer: {
        contact: {
          firstName: 'Max',
          lastName: 'Muster',
          email: 'max@example.test',
          webUrls: [{ url: 'https://example.test/team', description: 'Team' }],
        },
      },
      priceInformations: [{ name: 'Regulär' }],
      repeat: false,
      recurringWeekdays: [],
      pushNotification: false,
      visible: true,
    });
  });

  it('maps sparse event items to editor defaults without leaking invalid geo values', () => {
    expect(
      mapEventItemToDetailFormValues({
        id: 'event-2',
        contentType: 'events.event-record',
        status: 'draft',
        createdAt: '2026-06-11T10:00:00.000Z',
        updatedAt: '2026-06-11T10:00:00.000Z',
        title: 'Kurzmeldung',
        categoryName: 'Nachbarschaft',
        addresses: [{ geoLocation: { latitude: Number.NaN, longitude: Number.POSITIVE_INFINITY } }],
        organizer: {},
      } satisfies EventContentItem)
    ).toMatchObject({
      basis: {
        categories: ['Nachbarschaft'],
        repeat: false,
        recurringWeekdays: [],
      },
      content: {
        dates: [
          {
            dateStart: '',
            dateEnd: '',
            useOnlyTimeDescription: false,
          },
        ],
        addresses: [
          {
            addition: '',
            street: '',
            zip: '',
            city: '',
            kind: '',
            geoLocation: { latitude: '', longitude: '' },
          },
        ],
        urls: [{ url: '', description: '' }],
        contacts: [{ firstName: '', lastName: '', phone: '', fax: '', email: '', webUrls: [{ url: '', description: '' }] }],
        organizer: {
          address: {
            geoLocation: { latitude: '', longitude: '' },
          },
        },
        priceInformations: [{ category: '', description: '', amount: undefined }],
        accessibilityInformation: { description: '', types: '', urls: [{ url: '', description: '' }] },
      },
      settings: {
        pushNotification: false,
        visible: true,
        tags: '',
      },
    });
  });

  it('serializes defensively when optional collections are absent at runtime', () => {
    expect(
      mapEventsDetailFormValuesToInput({
        title: 'Defensiv',
        basis: {
          categories: undefined,
          pointOfInterestId: '',
          repeat: false,
          recurring: '',
          recurringType: '',
          recurringInterval: '',
          recurringWeekdays: undefined,
        },
        content: {
          description: '',
          dates: undefined,
          addresses: undefined,
          urls: undefined,
          contacts: undefined,
          organizer: {},
          priceInformations: undefined,
          accessibilityInformation: { description: '', types: '', urls: undefined },
        },
        settings: {
          headerImageAssetId: '',
          pushNotification: false,
          visible: true,
          externalId: '',
          keywords: '',
          tags: '',
        },
      } as never)
    ).toEqual({
      title: 'Defensiv',
      dates: [],
      addresses: [],
      repeat: false,
      recurringWeekdays: [],
      pushNotification: false,
      visible: true,
    });
  });
});
