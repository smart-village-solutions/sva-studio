import { describe, expect, it } from 'vitest';

import {
  mapPoiDetailFormValuesToInput,
  mapPoiItemToDetailFormValues,
} from '../src/poi.detail-form.js';
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
            teaserImageAssetId: 'asset-1',
            attachments: [{ assetId: 'asset-2', label: 'Flyer' }],
          },
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
});
