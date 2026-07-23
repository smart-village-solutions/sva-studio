import { describe, expect, it } from 'vitest';

import {
  parseAccessibilityInformation,
  parseCertificates,
  parseMediaContents,
  parseOpeningHours,
  parseOperatingCompany,
  parsePrices,
} from './content-route-parsers-poi.js';

const expectInvalidRequest = async (response: Response, status = 400) => {
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toMatchObject({
    error: 'invalid_request',
    message: expect.any(String),
  });
};

describe('content-route-parsers-poi', () => {
  it('parses opening hours and prices with optional scalar fields', () => {
    expect(
      parseOpeningHours([
        {
          weekday: ' MO ',
          dateFrom: '2026-06-01',
          dateTo: '2026-06-30',
          timeFrom: '08:00',
          timeTo: '18:00',
          sortNumber: '0',
          open: false,
          useYear: true,
          description: ' Sommer ',
        },
      ])
    ).toEqual([
      {
        weekday: 'MO',
        dateFrom: '2026-06-01',
        dateTo: '2026-06-30',
        timeFrom: '08:00',
        timeTo: '18:00',
        sortNumber: 0,
        open: false,
        useYear: true,
        description: 'Sommer',
      },
    ]);

    expect(
      parsePrices([
        {
          name: ' Familie ',
          amount: '12.5',
          groupPrice: false,
          ageFrom: '0',
          ageTo: 17,
          minAdultCount: '1',
          maxAdultCount: '2',
          minChildrenCount: '0',
          maxChildrenCount: 3,
          description: ' Rabatt ',
          category: ' family ',
        },
      ])
    ).toEqual([
      {
        name: 'Familie',
        amount: 12.5,
        groupPrice: false,
        ageFrom: 0,
        ageTo: 17,
        minAdultCount: 1,
        maxAdultCount: 2,
        minChildrenCount: 0,
        maxChildrenCount: 3,
        description: 'Rabatt',
        category: 'family',
      },
    ]);
  });

  it('returns validation errors for malformed opening hours and prices', async () => {
    await expectInvalidRequest(parseOpeningHours('no-array') as Response);
    await expectInvalidRequest(parseOpeningHours([null]) as Response);
    await expectInvalidRequest(parseOpeningHours([{ timeFrom: '19 Uhr' }]) as Response);
    await expectInvalidRequest(parseOpeningHours([{ timeTo: '24:00' }]) as Response);
    await expectInvalidRequest(parsePrices('no-array') as Response);
    await expectInvalidRequest(parsePrices([null]) as Response);
  });

  it('parses operating company with nested address and contact data', () => {
    expect(
      parseOperatingCompany({
        name: ' Betreiber GmbH ',
        address: {
          street: 'Hauptstr. 1',
          city: 'Essen',
          geoLocation: { latitude: '51.45', longitude: '7.01' },
        },
        contact: {
          email: 'info@example.test',
          webUrls: [{ url: 'https://example.test/kontakt', description: ' Kontakt ' }],
        },
      })
    ).toEqual({
      name: 'Betreiber GmbH',
      address: {
        street: 'Hauptstr. 1',
        city: 'Essen',
        geoLocation: { latitude: 51.45, longitude: 7.01 },
      },
      contact: {
        email: 'info@example.test',
        webUrls: [{ url: 'https://example.test/kontakt', description: 'Kontakt' }],
      },
    });
  });

  it('keeps sparse parser payloads without manufacturing optional fields', () => {
    expect(parseOpeningHours([{}])).toEqual([{}]);
    expect(parsePrices([{}])).toEqual([{}]);
    expect(parseOperatingCompany({ name: ' Betreiber ' })).toEqual({ name: 'Betreiber' });
    expect(parseMediaContents([{}])).toEqual([{}]);
    expect(parseAccessibilityInformation({})).toEqual({});
  });

  it('returns nested validation errors for malformed operating company data', async () => {
    await expectInvalidRequest(parseOperatingCompany('no-object') as Response);
    await expectInvalidRequest(
      parseOperatingCompany({
        address: { geoLocation: { latitude: '300', longitude: '7.01' } },
      }) as Response
    );
    await expectInvalidRequest(
      parseOperatingCompany({
        contact: { webUrls: [{ url: 'http://example.test' }] },
      }) as Response
    );
  });

  it('parses media contents, certificates and accessibility information', () => {
    expect(
      parseMediaContents([
        {
          captionText: ' Plan ',
          copyright: ' Stadt ',
          contentType: 'image',
          height: '480',
          width: 640,
          sourceUrl: { url: 'https://example.test/plan.jpg', description: ' Vorschau ' },
        },
      ])
    ).toEqual([
      {
        captionText: 'Plan',
        copyright: 'Stadt',
        contentType: 'image',
        height: 480,
        width: 640,
        sourceUrl: { url: 'https://example.test/plan.jpg', description: 'Vorschau' },
      },
    ]);

    expect(parseCertificates([{ name: ' Familienfreundlich ' }])).toEqual([{ name: 'Familienfreundlich' }]);

    expect(
      parseAccessibilityInformation({
        description: ' Stufenlos ',
        types: 'wheelchair',
        urls: [{ url: 'https://example.test/barrierefrei', description: ' Details ' }],
      })
    ).toEqual({
      description: 'Stufenlos',
      types: 'wheelchair',
      urls: [{ url: 'https://example.test/barrierefrei', description: 'Details' }],
    });
  });

  it('returns validation errors for malformed media, certificate and accessibility payloads', async () => {
    await expectInvalidRequest(parseMediaContents('no-array') as Response);
    await expectInvalidRequest(parseMediaContents([null]) as Response);
    await expectInvalidRequest(
      parseMediaContents([{ sourceUrl: { url: 'http://example.test/plan.jpg' } }]) as Response
    );

    await expectInvalidRequest(parseCertificates('no-array') as Response);
    await expectInvalidRequest(parseCertificates([null]) as Response);
    await expectInvalidRequest(parseCertificates([{ name: '   ' }]) as Response);

    await expectInvalidRequest(parseAccessibilityInformation('no-object') as Response);
    await expectInvalidRequest(
      parseAccessibilityInformation({
        urls: [{ url: 'mailto:test@example.test' }],
      }) as Response
    );
  });
});
