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
});
