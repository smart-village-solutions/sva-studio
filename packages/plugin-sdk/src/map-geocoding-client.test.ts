import { describe, expect, it, vi } from 'vitest';

import {
  MapGeocodingClientError,
  geocodeHostMapAddress,
  getHostMapGeocodingConfig,
  reverseGeocodeHostCoordinates,
  suggestHostMapAddresses,
} from './map-geocoding-client.js';
import type { MapGeocodingFeature } from './map-geocoding.js';

const suggestFeature: MapGeocodingFeature = {
  label: 'Suggest',
  coordinates: { latitude: 52.51, longitude: 13.4 },
  source: 'geoapify',
};

const geocodeFeature: MapGeocodingFeature = {
  label: 'Geocode',
  coordinates: { latitude: 52.52, longitude: 13.41 },
  source: 'geoapify',
};

const reverseFeature: MapGeocodingFeature = {
  label: 'Reverse',
  coordinates: { latitude: 52.5, longitude: 13.4 },
  source: 'geoapify',
};

describe('map geocoding client', () => {
  it('logs request and response metadata in debug mode without exposing raw address data', async () => {
    const originalLocalStorage = globalThis.localStorage;
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => (key === 'sva:debug:map-geocoding' ? 'true' : null),
      },
    });

    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(geocodeFeature), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }),
    );

    try {
      await expect(
        geocodeHostMapAddress({
          fetch: fetchMock as never,
          address: { street: 'Musterstraße 1', city: 'Musterstadt' },
        }),
      ).resolves.toEqual(geocodeFeature);

      expect(infoSpy).toHaveBeenCalledWith(
        '[map-geocoding]',
        'client request started',
        expect.objectContaining({
          operation: 'geocode',
          has_street: true,
          has_city: true,
        }),
      );
      expect(infoSpy).toHaveBeenCalledWith(
        '[map-geocoding]',
        'client request completed',
        expect.objectContaining({
          operation: 'geocode',
          http_status: 200,
          content_type: 'application/json; charset=utf-8',
          source: 'geoapify',
          label_present: true,
        }),
      );
    } finally {
      infoSpy.mockRestore();
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });

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
        return new Response(JSON.stringify([suggestFeature]), {
          status: 200,
        });
      }
      if (url.endsWith('/geocode')) {
        expect(JSON.parse(String(init?.body))).toEqual({
          street: 'Musterstraße',
          city: 'Musterstadt',
        });
        return new Response(JSON.stringify(geocodeFeature), {
          status: 200,
        });
      }
      return new Response(JSON.stringify(reverseFeature), { status: 200 });
    });

    await expect(
      suggestHostMapAddresses({ fetch: fetchMock as never, query: 'Musterstraße' }),
    ).resolves.toEqual([suggestFeature]);
    await expect(
      geocodeHostMapAddress({
        fetch: fetchMock as never,
        address: { street: 'Musterstraße', city: 'Musterstadt' },
      }),
    ).resolves.toEqual(geocodeFeature);
    await expect(
      reverseGeocodeHostCoordinates({
        fetch: fetchMock as never,
        coordinates: { latitude: 52.5, longitude: 13.4 },
      }),
    ).resolves.toEqual(reverseFeature);
  });

  it('uses an extended client timeout for map geocoding requests', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response(JSON.stringify(geocodeFeature), {
        status: 200,
      });
    });

    try {
      await expect(
        geocodeHostMapAddress({
          fetch: fetchMock as never,
          address: { street: 'Musterstraße', city: 'Musterstadt' },
        }),
      ).resolves.toEqual(geocodeFeature);

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 30_000);
    } finally {
      setTimeoutSpy.mockRestore();
    }
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
