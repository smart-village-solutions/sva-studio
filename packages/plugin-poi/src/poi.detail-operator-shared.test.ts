import { describe, expect, it } from 'vitest';

import {
  createPoiOperatorGeocodingAddress,
  getPoiOperatorFieldValues,
  hasPoiOperatorGeocodingInput,
  mergePoiOperatorWebUrl,
} from './poi.detail-operator-shared.js';

describe('poi.detail-operator-shared', () => {
  it('flattens missing and populated operator values for the controlled fields', () => {
    expect(getPoiOperatorFieldValues()).toEqual({
      name: '',
      email: '',
      firstName: '',
      lastName: '',
      phone: '',
      fax: '',
      webUrl: '',
      webUrlDescription: '',
      locationName: '',
      street: '',
      zip: '',
      city: '',
      latitude: '',
      longitude: '',
    });
    expect(
      getPoiOperatorFieldValues({
        name: 'Stadtwerke',
        contact: {
          email: 'kontakt@example.test',
          firstName: 'Erika',
          lastName: 'Mustermann',
          phone: '123',
          fax: '456',
          webUrls: [{ url: 'https://example.test', description: 'Website' }],
        },
        address: {
          addition: 'Zentrale',
          street: 'Markt 1',
          zip: '12345',
          city: 'Musterstadt',
          geoLocation: { latitude: '48.2', longitude: '11.6' },
        },
      })
    ).toMatchObject({
      name: 'Stadtwerke',
      webUrl: 'https://example.test',
      webUrlDescription: 'Website',
      city: 'Musterstadt',
      latitude: '48.2',
      longitude: '11.6',
    });
  });

  it('preserves the untouched web url value when one field changes', () => {
    expect(
      mergePoiOperatorWebUrl(
        { url: 'https://example.test', description: 'Alt' },
        { description: 'Neu' }
      )
    ).toEqual({
      url: 'https://example.test',
      description: 'Neu',
    });
    expect(
      mergePoiOperatorWebUrl({ url: 'https://example.test', description: 'Alt' }, { url: '' })
    ).toEqual({
      url: '',
      description: 'Alt',
    });
  });

  it('trims address lookup values and detects blank-only input', () => {
    const values = {
      locationName: ' Rathaus ',
      street: ' Markt 1 ',
      zip: ' 12345 ',
      city: ' Musterstadt ',
    };
    expect(createPoiOperatorGeocodingAddress(values)).toEqual({
      query: 'Rathaus',
      street: 'Markt 1',
      zip: '12345',
      city: 'Musterstadt',
      country: 'Deutschland',
    });
    expect(hasPoiOperatorGeocodingInput(values)).toBe(true);
    expect(
      hasPoiOperatorGeocodingInput({ locationName: ' ', street: '', zip: '', city: '  ' })
    ).toBe(false);
  });
});
