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

  it('covers shared helpers for error mapping, parsing and provider normalization', async () => {
    const {
      buildProviderUrl,
      compactQuery,
      createClientError,
      createErrorResponse,
      normalizeProviderFeatures,
      parsePositiveInteger,
      readJsonBody,
      readMapGeocodingErrorDiagnostics,
    } = await import('./map-geocoding-api.shared.js');

    expect(compactQuery({ query: ' Poi ', street: ' Hauptstraße 1 ', zip: ' 12345 ', city: ' Musterstadt ' })).toBe(
      'Poi, Hauptstraße 1, 12345, Musterstadt',
    );
    expect(parsePositiveInteger(' 4800 ')).toBe(4800);
    expect(parsePositiveInteger('abc')).toBe(3000);

    const error = createClientError('provider_error', {
      statusCode: 503,
      endpoint: 'https://provider.example/geocode',
      provider: 'custom',
    });
    expect(readMapGeocodingErrorDiagnostics(error)).toEqual({
      error_message: 'provider_error',
      error_code: 'provider_error',
      provider_status: 503,
      provider_endpoint: 'https://provider.example/geocode',
      provider: 'custom',
    });
    expect(readMapGeocodingErrorDiagnostics('unexpected')).toEqual({});

    expect(createErrorResponse('rate_limited').status).toBe(429);
    expect(createErrorResponse('timeout').status).toBe(504);
    expect(createErrorResponse('disabled').status).toBe(503);
    expect(createErrorResponse('unauthorized').status).toBe(401);
    expect(createErrorResponse('other').status).toBe(400);

    await expect(
      readJsonBody(
        new Request('http://localhost/api/v1/iam/map-geocoding/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{"query":',
        }),
      ),
    ).rejects.toThrow('invalid_input');

    const normalizedFeatures = normalizeProviderFeatures(
      {
        features: [
          {
            properties: {
              formatted: 'Musterstraße 1, 12345 Musterstadt',
              street: 'Musterstraße',
              housenumber: '1',
              postcode: '12345',
              city: 'Musterstadt',
              country: 'Deutschland',
              country_code: 'de',
            },
            geometry: {
              coordinates: [13.405, 52.52],
            },
          },
          {
            properties: {
              formatted: '',
            },
          },
        ],
      },
      'custom',
    );
    expect(normalizedFeatures).toEqual([
      {
        label: 'Musterstraße 1, 12345 Musterstadt',
        coordinates: { latitude: 52.52, longitude: 13.405 },
        street: 'Musterstraße',
        houseNumber: '1',
        postalCode: '12345',
        city: 'Musterstadt',
        country: 'Deutschland',
        countryCode: 'de',
        source: 'custom',
      },
    ]);

    const geoapifyUrl = buildProviderUrl(
      {
        provider: 'geoapify',
        styleUrl: 'https://tiles.example/style.json',
        autocompleteEnabled: true,
        geocodeEnabled: true,
        reverseGeocodeEnabled: true,
        killSwitchEnabled: false,
        suggestEndpoint: '',
        geocodeEndpoint: '',
        reverseGeocodeEndpoint: '',
        requestTimeoutMs: '3000',
        rateLimitPerMinute: '60',
        apiKey: 'geoapify-key',
      },
      'reverse',
      { coordinates: { latitude: 52.52, longitude: 13.405 } },
    );
    expect(geoapifyUrl.toString()).toContain('/reverse?');
    expect(geoapifyUrl.searchParams.get('apiKey')).toBe('geoapify-key');

    const customUrl = buildProviderUrl(
      {
        provider: 'custom',
        styleUrl: 'https://tiles.example/style.json',
        autocompleteEnabled: true,
        geocodeEnabled: true,
        reverseGeocodeEnabled: true,
        killSwitchEnabled: false,
        suggestEndpoint: 'https://custom.example/suggest',
        geocodeEndpoint: 'https://custom.example/geocode',
        reverseGeocodeEndpoint: 'https://custom.example/reverse',
        requestTimeoutMs: '3000',
        rateLimitPerMinute: '60',
      },
      'suggest',
      { query: 'Musterstraße 1' },
    );
    expect(customUrl.toString()).toBe('https://custom.example/suggest?query=Musterstra%C3%9Fe+1');
  });

  it('covers operation helpers for provider and validation edge cases', async () => {
    const {
      executeGeocodeOperation,
      executeProviderRequest,
      executeReverseGeocodeOperation,
      executeSuggestOperation,
      getPublicMapGeocodingConfig,
    } = await import('./map-geocoding-api.operations.js');

    const config = {
      provider: 'geoapify' as const,
      styleUrl: 'https://tiles.example/styles/poi',
      autocompleteEnabled: true,
      geocodeEnabled: true,
      reverseGeocodeEnabled: true,
      killSwitchEnabled: false,
      suggestEndpoint: '',
      geocodeEndpoint: '',
      reverseGeocodeEndpoint: '',
      requestTimeoutMs: '3000',
      rateLimitPerMinute: '60',
      apiKey: 'geoapify-key',
    };

    expect(getPublicMapGeocodingConfig(config)).toEqual({
      provider: 'geoapify',
      styleUrl: 'https://tiles.example/styles/poi',
      autocompleteEnabled: true,
      geocodeEnabled: true,
      reverseGeocodeEnabled: true,
      killSwitchEnabled: false,
    });

    state.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        features: [
          {
            properties: {
              formatted: 'Musterstraße 1, 12345 Musterstadt',
              lat: 52.52,
              lon: 13.405,
            },
          },
        ],
      }),
    });
    await expect(executeSuggestOperation(config, 'Musterstraße 1')).resolves.toHaveLength(1);

    await expect(executeSuggestOperation({ ...config, autocompleteEnabled: false }, 'Musterstraße 1')).rejects.toThrow(
      'disabled',
    );
    await expect(executeGeocodeOperation(config, { street: '   ' })).rejects.toThrow('invalid_input');
    await expect(
      executeReverseGeocodeOperation(config, { latitude: Number.NaN, longitude: 13.405 }),
    ).rejects.toThrow('invalid_input');

    state.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({}),
    });
    await expect(executeProviderRequest({ config, mode: 'suggest', query: 'Musterstraße' })).rejects.toThrow(
      'rate_limited',
    );

    state.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    await expect(executeProviderRequest({ config, mode: 'geocode', query: 'Musterstraße' })).rejects.toThrow(
      'provider_error',
    );

    state.fetch.mockImplementationOnce(async (_url: URL, init?: RequestInit) => {
      init?.signal?.throwIfAborted?.();
      throw new DOMException('Timed out', 'AbortError');
    });
    await expect(
      executeProviderRequest({
        config: { ...config, requestTimeoutMs: '1' },
        mode: 'reverse',
        coordinates: { latitude: 52.52, longitude: 13.405 },
      }),
    ).rejects.toThrow('timeout');
  });

  it('dispatches map geocoding requests only for supported routes and methods', async () => {
    const { dispatchMapGeocodingRequest } = await import('./map-geocoding-api.server.js');

    const configResponse = await dispatchMapGeocodingRequest(
      new Request('http://localhost/api/v1/iam/map-geocoding/config'),
    );
    expect(configResponse?.status).toBe(200);

    const methodNotAllowedResponse = await dispatchMapGeocodingRequest(
      new Request('http://localhost/api/v1/iam/map-geocoding/config', { method: 'POST' }),
    );
    expect(methodNotAllowedResponse?.status).toBe(405);

    await expect(
      dispatchMapGeocodingRequest(new Request('http://localhost/api/v1/iam/map-geocoding/unknown')),
    ).resolves.toBeNull();
  });
});
