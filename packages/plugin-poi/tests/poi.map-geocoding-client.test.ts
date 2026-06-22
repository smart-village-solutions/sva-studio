import {
  geocodeHostMapAddress,
  getHostMapGeocodingConfig,
  reverseGeocodeHostCoordinates,
} from '@sva/plugin-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  geocodeMapAddress,
  getMapGeocodingConfig,
  resetMapGeocodingConfigCache,
  reverseMapCoordinates,
} from '../src/poi.map-geocoding-client.js';

vi.mock('@sva/plugin-sdk', () => ({
  getHostMapGeocodingConfig: vi.fn(async () => ({
    provider: 'geoapify',
    styleUrl: 'https://tiles.example/styles/basic.json',
    autocompleteEnabled: false,
    geocodeEnabled: true,
    reverseGeocodeEnabled: true,
    killSwitchEnabled: false,
  })),
  geocodeHostMapAddress: vi.fn(async () => ({
    label: 'Marktplatz 1, 12345 Musterstadt',
    coordinates: { latitude: 51.5, longitude: 13.4 },
    street: 'Marktplatz',
    houseNumber: '1',
    postalCode: '12345',
    city: 'Musterstadt',
    source: 'geoapify',
  })),
  reverseGeocodeHostCoordinates: vi.fn(async () => ({
    label: 'Musterstraße 1',
    coordinates: { latitude: 51.5, longitude: 13.4 },
    source: 'geoapify',
  })),
}));

describe('poi map geocoding client', () => {
  beforeEach(() => {
    resetMapGeocodingConfigCache();
    vi.mocked(getHostMapGeocodingConfig).mockClear();
    vi.mocked(geocodeHostMapAddress).mockClear();
    vi.mocked(reverseGeocodeHostCoordinates).mockClear();
  });

  it('caches the host config so visible map setup does not refetch it repeatedly', async () => {
    const [first, second] = await Promise.all([getMapGeocodingConfig(), getMapGeocodingConfig()]);

    expect(first).toEqual(second);
    expect(vi.mocked(getHostMapGeocodingConfig)).toHaveBeenCalledTimes(1);
  });

  it('forwards address geocoding and reverse geocoding only when explicitly invoked', async () => {
    await geocodeMapAddress({
      address: { query: 'Rathaus', street: 'Marktplatz 1', zip: '12345', city: 'Musterstadt', country: 'Deutschland' },
    });
    await reverseMapCoordinates({ latitude: 51.5, longitude: 13.4 });

    expect(vi.mocked(geocodeHostMapAddress)).toHaveBeenCalledWith({
      address: { query: 'Rathaus', street: 'Marktplatz 1', zip: '12345', city: 'Musterstadt', country: 'Deutschland' },
    });
    expect(vi.mocked(reverseGeocodeHostCoordinates)).toHaveBeenCalledWith({
      coordinates: { latitude: 51.5, longitude: 13.4 },
    });
  });
});
