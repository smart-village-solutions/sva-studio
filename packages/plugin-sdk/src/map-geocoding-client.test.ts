import { describe, expect, it, vi } from 'vitest';

import {
  MapGeocodingClientError,
  geocodeHostMapAddress,
  getHostMapGeocodingConfig,
  reverseGeocodeHostCoordinates,
  suggestHostMapAddresses,
} from './map-geocoding-client.js';

describe('map geocoding client', () => {
  it('loads the public host config over the stable iam route', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          provider: 'geoapify',
          styleUrl: 'https://tiles.example/styles/basic',
          autocompleteEnabled: true,
          geocodeEnabled: true,
          reverseGeocodeEnabled: false,
          killSwitchEnabled: false,
        }),
        { status: 200 },
      ),
    );

    await expect(
      getHostMapGeocodingConfig({ fetch: fetchMock as never }),
    ).resolves.toEqual({
      provider: 'geoapify',
      styleUrl: 'https://tiles.example/styles/basic',
      autocompleteEnabled: true,
      geocodeEnabled: true,
      reverseGeocodeEnabled: false,
      killSwitchEnabled: false,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/iam/map-geocoding/config',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('posts suggest, geocode, and reverse requests through deterministic host endpoints', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/suggest')) {
        return new Response(JSON.stringify([{ label: 'Suggest' }]), {
          status: 200,
        });
      }
      if (url.endsWith('/geocode')) {
        expect(JSON.parse(String(init?.body))).toEqual({
          street: 'Musterstraße',
          city: 'Musterstadt',
        });
        return new Response(JSON.stringify({ label: 'Geocode' }), {
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({
          label: 'Reverse',
          coordinates: { latitude: 52.5, longitude: 13.4 },
        }),
        { status: 200 },
      );
    });

    await expect(
      suggestHostMapAddresses({ fetch: fetchMock as never, query: 'Musterstraße' }),
    ).resolves.toEqual([{ label: 'Suggest' }]);
    await expect(
      geocodeHostMapAddress({
        fetch: fetchMock as never,
        address: { street: 'Musterstraße', city: 'Musterstadt' },
      }),
    ).resolves.toEqual({ label: 'Geocode' });
    await expect(
      reverseGeocodeHostCoordinates({
        fetch: fetchMock as never,
        coordinates: { latitude: 52.5, longitude: 13.4 },
      }),
    ).resolves.toEqual({
      label: 'Reverse',
      coordinates: { latitude: 52.5, longitude: 13.4 },
    });
  });

  it('surfaces deterministic route errors as typed map geocoding client errors', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          error: { code: 'disabled', message: 'disabled' },
          message: 'disabled',
        }),
        { status: 503 },
      ),
    );

    await expect(
      suggestHostMapAddresses({ fetch: fetchMock as never, query: 'leer' }),
    ).rejects.toEqual(new MapGeocodingClientError('disabled', 'disabled'));
  });
});
