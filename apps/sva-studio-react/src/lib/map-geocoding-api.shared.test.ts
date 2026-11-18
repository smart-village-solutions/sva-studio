import { describe, expect, it } from 'vitest';
import {
  buildProviderUrl,
  normalizeProviderFeatures,
  type MapGeocodingRuntimeConfigWithSecrets,
} from './map-geocoding-api.shared.js';
const config: MapGeocodingRuntimeConfigWithSecrets = {
  provider: 'mapstick',
  styleUrl: '',
  autocompleteEnabled: true,
  geocodeEnabled: true,
  reverseGeocodeEnabled: true,
  killSwitchEnabled: false,
  suggestEndpoint: 'https://mapstick.smart-village.app/api/',
  geocodeEndpoint: 'https://mapstick.smart-village.app/api/',
  reverseGeocodeEndpoint: 'https://mapstick.smart-village.app/reverse',
  requestTimeoutMs: '3000',
  rateLimitPerMinute: '60',
  apiKey: 'never-forward',
};
describe('Mapstick Photon integration', () => {
  it('uses configured Photon endpoints and correct coordinate order without forwarding secrets', () => {
    const search = buildProviderUrl(config, 'suggest', { query: 'Straße & Platz' });
    expect(search.origin + search.pathname).toBe('https://mapstick.smart-village.app/api/');
    expect(search.searchParams.get('q')).toBe('Straße & Platz');
    expect(search.searchParams.has('apiKey')).toBe(false);
    const reverse = buildProviderUrl(config, 'reverse', {
      coordinates: { latitude: 52, longitude: 13 },
    });
    expect(reverse.pathname).toBe('/reverse');
    expect(reverse.searchParams.get('lon')).toBe('13');
    expect(reverse.searchParams.get('lat')).toBe('52');
  });
  it('maps optional Photon fields and rejects unusable features', () => {
    const feature = {
      geometry: { coordinates: [13, 52] as const },
      properties: {
        name: 'Rathaus',
        street: 'Markt',
        housenumber: '1',
        postcode: '12345',
        city: 'Stadt',
        countrycode: 'DE',
      },
    };
    expect(normalizeProviderFeatures({ features: [feature] }, 'mapstick')).toEqual([
      expect.objectContaining({
        label: 'Rathaus',
        source: 'mapstick',
        coordinates: { latitude: 52, longitude: 13 },
        postalCode: '12345',
        countryCode: 'de',
      }),
    ]);
    expect(
      normalizeProviderFeatures(
        {
          features: [
            {
              geometry: { coordinates: [13, 52] },
              properties: { street: 'Markt', housenumber: '2' },
            },
          ],
        },
        'mapstick'
      )[0]?.label
    ).toBe('Markt 2');
    expect(
      normalizeProviderFeatures(
        { features: [{}, { ...feature, geometry: { coordinates: [13, 91] } }] },
        'mapstick'
      )
    ).toEqual([]);
    expect(normalizeProviderFeatures({}, 'mapstick')).toEqual([]);
  });
});
