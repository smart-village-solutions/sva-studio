import { describe, expect, it } from 'vitest';

import type { MapGeocodingFeature, MapGeocodingRuntimeConfig } from './map-geocoding.js';

describe('map geocoding sdk contracts', () => {
  it('keeps runtime config provider-neutral and browser-safe', () => {
    const config: MapGeocodingRuntimeConfig = {
      provider: 'geoapify',
      styleUrl: 'https://tiles.example/styles/poi',
      autocompleteEnabled: true,
      geocodeEnabled: true,
      reverseGeocodeEnabled: false,
      killSwitchEnabled: false,
    };

    expect(config).toEqual({
      provider: 'geoapify',
      styleUrl: 'https://tiles.example/styles/poi',
      autocompleteEnabled: true,
      geocodeEnabled: true,
      reverseGeocodeEnabled: false,
      killSwitchEnabled: false,
    });
  });

  it('models normalized map features independently of provider payloads', () => {
    const feature: MapGeocodingFeature = {
      label: 'Musterstraße 1, 12345 Musterstadt',
      coordinates: {
        latitude: 52.52,
        longitude: 13.405,
      },
      street: 'Musterstraße',
      houseNumber: '1',
      postalCode: '12345',
      city: 'Musterstadt',
      country: 'Deutschland',
      countryCode: 'de',
      source: 'geoapify',
    };

    expect(feature.coordinates.latitude).toBe(52.52);
    expect(feature.source).toBe('geoapify');
  });
});
