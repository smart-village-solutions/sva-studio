import { describe, expect, it } from 'vitest';

import {
  mapAccessibilityInformation,
  mapAddress,
  mapCategory,
  mapContact,
  mapDataProvider,
  mapDate,
  mapLocation,
  mapMediaContent,
  mapOpeningHour,
  mapOperatingCompany,
  mapPrice,
  mapRepeatDuration,
  mapWebUrl,
  parseCharactersToBeShown,
  parseGeoCoordinate,
} from './mappers-shared.js';

describe('shared Mainserver mappers', () => {
  it('maps complete nested upstream values without dropping false or zero values', () => {
    const webUrl = { id: 'url-1', url: 'https://example.invalid', description: 'Webseite' };
    const address = {
      id: 'address-1',
      addition: 'Hof',
      street: 'Markt 1',
      zip: '03172',
      city: 'Guben',
      kind: 'main',
      geoLocation: { latitude: '51.9500', longitude: 14.7167 },
    };
    const contact = {
      id: 'contact-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '123',
      fax: '456',
      email: 'ada@example.invalid',
      webUrls: [webUrl],
    };

    expect(mapWebUrl(webUrl)).toEqual(webUrl);
    expect(mapAddress(address)).toEqual({
      ...address,
      geoLocation: { latitude: 51.95, longitude: 14.7167 },
    });
    expect(
      mapDataProvider({
        id: 'provider-1',
        name: 'Provider',
        dataType: 'generic_item',
        description: 'Beschreibung',
        notice: 'Hinweis',
        logo: webUrl,
        address,
      })
    ).toEqual(
      expect.objectContaining({
        id: 'provider-1',
        logo: webUrl,
        address: expect.objectContaining({ city: 'Guben' }),
      })
    );
    expect(mapContact(contact)).toEqual({ ...contact, webUrls: [webUrl] });
    expect(
      mapLocation({
        id: 'location-1',
        name: 'Rathaus',
        department: 'Bürgerservice',
        district: 'Mitte',
        regionName: 'Lausitz',
        state: 'Brandenburg',
        geoLocation: { latitude: 0, longitude: '14.7' },
      })
    ).toEqual(
      expect.objectContaining({
        id: 'location-1',
        geoLocation: { latitude: 0, longitude: 14.7 },
      })
    );
    expect(
      mapOperatingCompany({
        id: 'company-1',
        name: 'Betreiber',
        address,
        contact,
      })
    ).toEqual(
      expect.objectContaining({
        id: 'company-1',
        address: expect.objectContaining({ street: 'Markt 1' }),
        contact: expect.objectContaining({ email: 'ada@example.invalid' }),
      })
    );
    expect(
      mapCategory({
        id: 'category-1',
        name: 'Kultur',
        iconName: 'theater',
        position: 0,
        tagList: 'event',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-02',
        children: [{ id: 'category-2', name: 'Bühne' }],
      })
    ).toEqual(
      expect.objectContaining({
        position: 0,
        children: [expect.objectContaining({ id: 'category-2', name: 'Bühne' })],
      })
    );
    expect(
      mapMediaContent({
        id: 'media-1',
        captionText: 'Motiv',
        copyright: 'SVA',
        height: 0,
        width: 640,
        contentType: 'image/jpeg',
        sourceUrl: webUrl,
      })
    ).toEqual(expect.objectContaining({ height: 0, width: 640, sourceUrl: webUrl }));
    expect(
      mapDate({
        id: 'date-1',
        weekday: 'Montag',
        dateStart: '2026-08-10',
        dateEnd: '2026-08-10',
        timeStart: '09:00',
        timeEnd: '10:00',
        timeDescription: 'vormittags',
        useOnlyTimeDescription: 'false',
      })
    ).toEqual(expect.objectContaining({ id: 'date-1', timeStart: '09:00' }));
    expect(
      mapPrice({
        id: 'price-1',
        name: 'Eintritt',
        amount: 0,
        groupPrice: false,
        ageFrom: 0,
        ageTo: 99,
        minAdultCount: 0,
        maxAdultCount: 10,
        minChildrenCount: 0,
        maxChildrenCount: 10,
        description: 'Kostenfrei',
        category: 'standard',
      })
    ).toEqual(expect.objectContaining({ amount: 0, groupPrice: false, minChildrenCount: 0 }));
    expect(
      mapAccessibilityInformation({
        id: 'access-1',
        description: 'Barrierearm',
        types: 'wheelchair',
        urls: [webUrl],
      })
    ).toEqual(expect.objectContaining({ id: 'access-1', urls: [webUrl] }));
    expect(
      mapRepeatDuration({
        id: 'repeat-1',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        everyYear: false,
      })
    ).toEqual(expect.objectContaining({ everyYear: false }));
    expect(
      mapOpeningHour({
        id: 'hours-1',
        weekday: 'Montag',
        dateFrom: '2026-01-01',
        dateTo: '2026-12-31',
        timeFrom: '09:00',
        timeTo: '17:00',
        sortNumber: 0,
        open: false,
        useYear: false,
        description: 'geschlossen',
      })
    ).toEqual(expect.objectContaining({ sortNumber: 0, open: false, useYear: false }));
  });

  it('omits empty optional structures and rejects invalid scalar conversions', () => {
    expect(parseCharactersToBeShown(null)).toBeUndefined();
    expect(parseCharactersToBeShown('  ')).toBeUndefined();
    expect(parseCharactersToBeShown('invalid')).toBeUndefined();
    expect(parseCharactersToBeShown('12 entries')).toBe(12);
    expect(parseGeoCoordinate(null)).toBeUndefined();
    expect(parseGeoCoordinate(Number.NaN)).toBeUndefined();
    expect(parseGeoCoordinate('invalid')).toBeUndefined();
    expect(mapWebUrl({ url: null })).toBeUndefined();
    expect(mapAddress({ geoLocation: { latitude: 'invalid', longitude: null } })).toBeUndefined();
    expect(mapDataProvider({})).toBeUndefined();
    expect(mapContact({ webUrls: [{ url: null }] })).toBeUndefined();
    expect(mapLocation({ geoLocation: { latitude: null, longitude: 'invalid' } })).toBeUndefined();
    expect(mapOperatingCompany({})).toBeUndefined();
    expect(mapCategory({ name: null })).toBeNull();
    expect(mapAccessibilityInformation({ urls: [{ url: null }] })).toBeUndefined();
    expect(mapRepeatDuration({})).toBeUndefined();
  });
});
