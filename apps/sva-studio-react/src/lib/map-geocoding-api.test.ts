import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  request: new Request('http://localhost/map-geocoding'),
  withAuthenticatedUser: vi.fn(),
  getStoredMapGeocodingRuntimeConfig: vi.fn(),
  fetch: vi.fn(),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.stubGlobal('fetch', state.fetch);

vi.mock('@tanstack/react-start', () => ({
  createServerFn: (_options?: unknown) => ({
    inputValidator: () => ({
      handler: (handler: (input: { data: unknown }) => Promise<unknown>) => handler,
    }),
    handler: (handler: () => Promise<unknown>) => handler,
  }),
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => state.request,
}));

vi.mock('@sva/auth-runtime/server', () => ({
  withAuthenticatedUser: state.withAuthenticatedUser,
}));

vi.mock('@sva/server-runtime', () => ({
  createSdkLogger: () => state.logger,
}));

vi.mock('./instance-interfaces-server.js', () => ({
  loadStoredMapGeocodingRuntimeConfig: state.getStoredMapGeocodingRuntimeConfig,
}));

describe('map-geocoding-api', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', state.fetch);
    state.withAuthenticatedUser.mockReset();
    state.getStoredMapGeocodingRuntimeConfig.mockReset();
    state.fetch.mockReset();
    state.logger.info.mockReset();
    state.logger.warn.mockReset();
    state.logger.error.mockReset();

    state.withAuthenticatedUser.mockImplementation(async (_request, handler) =>
      handler({
        sessionId: 'session-1',
        user: {
          id: 'subject-1',
          instanceId: 'de-musterhausen',
          roles: ['editor'],
        },
      }),
    );
    state.getStoredMapGeocodingRuntimeConfig.mockResolvedValue({
      id: 'map-1',
      instanceId: 'de-musterhausen',
      enabled: true,
      provider: 'geoapify',
      styleUrl: 'https://tiles.example/styles/poi',
      autocompleteEnabled: true,
      geocodeEnabled: true,
      reverseGeocodeEnabled: true,
      suggestEndpoint: '',
      geocodeEndpoint: '',
      reverseGeocodeEndpoint: '',
      requestTimeoutMs: '3000',
      rateLimitPerMinute: '60',
      killSwitchEnabled: false,
      apiKey: 'geoapify-key',
    });
  });

  it('returns the public runtime config without exposing secrets', async () => {
    const { getMapGeocodingConfigServerFn } = await import('./map-geocoding-api');

    await expect(getMapGeocodingConfigServerFn()).resolves.toEqual({
      provider: 'geoapify',
      styleUrl: 'https://tiles.example/styles/poi',
      autocompleteEnabled: true,
      geocodeEnabled: true,
      reverseGeocodeEnabled: true,
      killSwitchEnabled: false,
    });
  });

  it('normalizes Geoapify suggestions into provider-neutral features', async () => {
    state.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              formatted: 'Musterstraße 1, 12345 Musterstadt',
              lat: 52.52,
              lon: 13.405,
              street: 'Musterstraße',
              housenumber: '1',
              postcode: '12345',
              city: 'Musterstadt',
              country: 'Deutschland',
              country_code: 'de',
            },
          },
        ],
      }),
    });

    const { suggestMapAddressesServerFn } = await import('./map-geocoding-api');

    await expect(suggestMapAddressesServerFn({ data: { query: 'Musterstraße 1' } })).resolves.toEqual([
      {
        label: 'Musterstraße 1, 12345 Musterstadt',
        coordinates: { latitude: 52.52, longitude: 13.405 },
        street: 'Musterstraße',
        houseNumber: '1',
        postalCode: '12345',
        city: 'Musterstadt',
        country: 'Deutschland',
        countryCode: 'de',
        source: 'geoapify',
      },
    ]);
  });

  it('requests Geoapify geocoding in geojson format so feature payloads are normalized correctly', async () => {
    state.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              formatted: 'Klein Glien 25, 14806 Bad Belzig, Germany',
              lat: 52.1319617,
              lon: 12.5171171,
              street: 'Klein Glien',
              housenumber: '25',
              postcode: '14806',
              city: 'Bad Belzig',
              country: 'Germany',
              country_code: 'de',
            },
          },
        ],
      }),
    });

    const { geocodeMapAddressServerFn } = await import('./map-geocoding-api');

    await expect(
      geocodeMapAddressServerFn({
        data: {
          street: 'Klein Glien 25',
          zip: '14806',
          city: 'Bad Belzig',
          country: 'Deutschland',
        },
      }),
    ).resolves.toMatchObject({
      label: 'Klein Glien 25, 14806 Bad Belzig, Germany',
      coordinates: { latitude: 52.1319617, longitude: 12.5171171 },
    });

    expect(state.fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        searchParams: expect.objectContaining({
          get: expect.any(Function),
        }),
      }),
      expect.any(Object),
    );
    const [url] = state.fetch.mock.calls[0] ?? [];
    expect(url).toBeInstanceOf(URL);
    expect((url as URL).searchParams.get('format')).toBe('geojson');
  });

  it('fails with no_result when the provider returns no normalized features', async () => {
    state.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ features: [] }),
    });

    const { suggestMapAddressesServerFn } = await import('./map-geocoding-api');

    await expect(suggestMapAddressesServerFn({ data: { query: 'leer' } })).rejects.toThrow('no_result');
  });

  it('fails closed when the tenant interface is disabled or kill-switched', async () => {
    state.getStoredMapGeocodingRuntimeConfig.mockResolvedValue({
      id: 'map-1',
      instanceId: 'de-musterhausen',
      enabled: false,
      provider: 'geoapify',
      styleUrl: 'https://tiles.example/styles/poi',
      autocompleteEnabled: true,
      geocodeEnabled: true,
      reverseGeocodeEnabled: true,
      suggestEndpoint: '',
      geocodeEndpoint: '',
      reverseGeocodeEndpoint: '',
      requestTimeoutMs: '3000',
      rateLimitPerMinute: '60',
      killSwitchEnabled: true,
      apiKey: 'geoapify-key',
    });

    const { getMapGeocodingConfigServerFn } = await import('./map-geocoding-api');

    await expect(getMapGeocodingConfigServerFn()).rejects.toThrow('disabled');
  });

  it('maps aborted provider calls to timeout errors', async () => {
    state.fetch.mockImplementation(async (_url: URL, init?: RequestInit) => {
      init?.signal?.throwIfAborted?.();
      throw new DOMException('Timed out', 'AbortError');
    });

    const { reverseGeocodeMapCoordinatesServerFn } = await import('./map-geocoding-api');

    await expect(
      reverseGeocodeMapCoordinatesServerFn({
        data: {
          latitude: 52.52,
          longitude: 13.405,
        },
      }),
    ).rejects.toThrow('timeout');
    expect(state.logger.warn).toHaveBeenCalledWith(
      'Map geocoding operation failed',
      expect.objectContaining({
        operation: 'reverse_geocode',
        workspace_id: 'de-musterhausen',
        provider: 'geoapify',
        outcome: 'timeout',
        provider_endpoint: 'https://api.geoapify.com/v1/geocode/reverse',
        error_code: 'timeout',
      }),
    );
  });

  it('serves the public runtime config over the rest handler without exposing secrets', async () => {
    const { getMapGeocodingConfigHandler } = await import('./map-geocoding-api');

    const response = await getMapGeocodingConfigHandler(
      new Request('http://localhost/api/v1/iam/map-geocoding/config'),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      provider: 'geoapify',
      styleUrl: 'https://tiles.example/styles/poi',
      autocompleteEnabled: true,
      geocodeEnabled: true,
      reverseGeocodeEnabled: true,
      killSwitchEnabled: false,
    });
  });

  it('maps rest handler domain errors to deterministic http responses', async () => {
    state.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ features: [] }),
    });

    const { suggestMapAddressesHandler } = await import('./map-geocoding-api');

    const response = await suggestMapAddressesHandler(
      new Request('http://localhost/api/v1/iam/map-geocoding/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'leer' }),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'no_result', message: 'no_result' },
      message: 'no_result',
    });
  });
});
