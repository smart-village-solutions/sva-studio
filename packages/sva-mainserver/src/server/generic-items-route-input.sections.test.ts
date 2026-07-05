import { describe, expect, it } from 'vitest';

import { parseAccessibilityInformations } from './generic-items-route-input.accessibility.js';
import { buildGenericItemInput } from './generic-items-route-input.builder.js';
import { parseContentBlocks } from './generic-items-route-input.content-blocks.js';
import { parseContactList } from './generic-items-route-input.contacts.js';
import { parseLocations } from './generic-items-route-input.locations.js';
import { parseGenericItemInput } from './generic-items-route-input.js';

const expectInvalidRequest = async (response: Response, message?: string) => {
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    error: 'invalid_request',
    ...(message ? { message } : {}),
  });
};

describe('generic-items-route-input sections', () => {
  it('parses locations with trimmed values, partial coordinates and sparse entries', () => {
    expect(
      parseLocations([
        {
          name: ' Rathaus ',
          department: ' Service ',
          district: 'Mitte',
          regionName: 'Region',
          state: ' SH ',
          geoLocation: { latitude: '52.5', longitude: 13.4 },
        },
        {},
      ])
    ).toEqual([
      {
        name: 'Rathaus',
        department: 'Service',
        district: 'Mitte',
        regionName: 'Region',
        state: 'SH',
        geoLocation: { latitude: 52.5, longitude: 13.4 },
      },
    ]);
  });

  it('rejects malformed locations payloads', async () => {
    await expectInvalidRequest(parseLocations('invalid') as Response, 'Orte müssen als Liste gesendet werden.');
    await expectInvalidRequest(parseLocations([null]) as Response, 'Orte müssen Objekte sein.');
    await expectInvalidRequest(parseLocations([{ geoLocation: { latitude: '52.5' } }]) as Response, 'Geo-Koordinaten sind ungültig.');
  });

  it('parses content blocks with text-only and media-backed content', () => {
    expect(
      parseContentBlocks([
        { title: ' Abschnitt ', intro: ' Intro ', body: '<p>Body</p>', mediaContents: null },
        {
          mediaContents: [{ sourceUrl: { url: 'https://example.invalid/image.jpg' }, captionText: ' Bild ' }],
        },
      ])
    ).toEqual([
      { title: 'Abschnitt', intro: 'Intro', body: '<p>Body</p>' },
      {
        mediaContents: [{ sourceUrl: { url: 'https://example.invalid/image.jpg' }, captionText: 'Bild' }],
      },
    ]);
  });

  it('rejects malformed content block payloads', async () => {
    await expectInvalidRequest(parseContentBlocks('invalid') as Response, 'ContentBlocks müssen als Liste gesendet werden.');
    await expectInvalidRequest(parseContentBlocks([null]) as Response, 'ContentBlocks müssen Objekte sein.');
    await expectInvalidRequest(
      parseContentBlocks([{ mediaContents: 'invalid' }]) as Response,
      'MediaContent muss als Liste gesendet werden.'
    );
    await expectInvalidRequest(
      parseContentBlocks([{}]) as Response,
      'ContentBlocks benötigen mindestens ein Feld mit Inhalt.'
    );
  });

  it('parses contact and accessibility lists while keeping empty objects out of the payload', () => {
    expect(parseContactList([{ email: 'info@example.invalid' }, {}])).toEqual([{ email: 'info@example.invalid' }, {}]);
    expect(
      parseAccessibilityInformations([
        { description: ' Lesbar ', types: 'wheelchair', urls: [{ url: 'https://example.invalid/a11y' }] },
        {},
      ])
    ).toEqual([
      { description: 'Lesbar', types: 'wheelchair', urls: [{ url: 'https://example.invalid/a11y' }] },
      {},
    ]);
  });

  it('rejects malformed contact and accessibility list payloads', async () => {
    await expectInvalidRequest(parseContactList('invalid') as Response, 'Kontakte müssen als Liste gesendet werden.');
    await expectInvalidRequest(
      parseAccessibilityInformations('invalid') as Response,
      'Barrierefreiheitsinformationen müssen als Liste gesendet werden.'
    );
  });

  it('builds generic item input with only defined scalar and relation fields', () => {
    expect(
      buildGenericItemInput({
        body: {
          teaser: ' Kurz ',
          visible: false,
          author: ' Redaktion ',
          keywords: 'eins,zwei',
          externalId: ' ext-1 ',
          publicationDate: '2026-07-01',
          publishedAt: '2026-07-02T12:00:00.000Z',
          categoryName: ' Generic ',
          payload: null,
        },
        title: 'Titel',
        genericType: 'faq',
        categories: [{ name: 'Service' }],
        contacts: [],
        webUrls: undefined,
        addresses: undefined,
        contentBlocks: [{ body: '<p>Antwort</p>' }],
        openingHours: undefined,
        priceInformations: undefined,
        mediaContents: undefined,
        locations: [{ name: 'Rathaus' }],
        dates: [],
        accessibilityInformations: undefined,
      })
    ).toEqual({
      title: 'Titel',
      genericType: 'faq',
      teaser: 'Kurz',
      visible: false,
      author: 'Redaktion',
      keywords: 'eins,zwei',
      externalId: 'ext-1',
      publicationDate: '2026-07-01',
      publishedAt: '2026-07-02T12:00:00.000Z',
      categoryName: 'Generic',
      payload: null,
      categories: [{ name: 'Service' }],
      contacts: [],
      contentBlocks: [{ body: '<p>Antwort</p>' }],
      locations: [{ name: 'Rathaus' }],
      dates: [],
    });
  });

  it('parses generic item requests and surfaces section errors directly', async () => {
    const success = await parseGenericItemInput(
      new Request('https://studio.test/api/v1/mainserver/generic-items', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Freier Eintrag',
          genericType: 'job',
          teaser: ' Kurztext ',
          payload: { contract: 'full-time' },
          locations: [{ name: ' Rathaus ' }],
          contentBlocks: [{ body: '<p>Text</p>' }],
        }),
      })
    );

    expect(success).toEqual({
      title: 'Freier Eintrag',
      genericType: 'job',
      teaser: 'Kurztext',
      payload: { contract: 'full-time' },
      locations: [{ name: 'Rathaus' }],
      contentBlocks: [{ body: '<p>Text</p>' }],
    });

    await expectInvalidRequest(
      (await parseGenericItemInput(
        new Request('https://studio.test/api/v1/mainserver/generic-items', {
          method: 'POST',
          body: JSON.stringify([]),
        })
      )) as Response,
      'Generic-Item-Daten müssen als Objekt gesendet werden.'
    );

    await expectInvalidRequest(
      (await parseGenericItemInput(
        new Request('https://studio.test/api/v1/mainserver/generic-items', {
          method: 'POST',
          body: JSON.stringify({ title: 'Freier Eintrag' }),
        })
      )) as Response,
      'Der Generic-Type ist erforderlich.'
    );

    await expectInvalidRequest(
      (await parseGenericItemInput(
        new Request('https://studio.test/api/v1/mainserver/generic-items', {
          method: 'POST',
          body: JSON.stringify({
            title: 'Freier Eintrag',
            genericType: 'faq',
            accessibilityInformations: 'invalid',
          }),
        })
      )) as Response,
      'Barrierefreiheitsinformationen müssen als Liste gesendet werden.'
    );
  });
});
