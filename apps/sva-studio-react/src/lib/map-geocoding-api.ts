import { createServerFn } from '@tanstack/react-start';

import type {
  MapGeocodingAddressInput,
  MapGeocodingCoordinates,
  MapGeocodingFeature,
  MapGeocodingRuntimeConfig,
} from '@sva/plugin-sdk';

import { readErrorMessage } from './error-message-utils';

type MapGeocodingLogger = {
  info: (message: string, meta: Record<string, unknown>) => void;
  warn: (message: string, meta: Record<string, unknown>) => void;
  error: (message: string, meta: Record<string, unknown>) => void;
};

type AuthenticatedMapGeocodingContext = Readonly<{
  sessionId: string;
  user: {
    id: string;
    instanceId?: string;
    roles: string[];
  };
}>;

type MapGeocodingRuntimeConfigWithSecrets = MapGeocodingRuntimeConfig &
  Readonly<{
    suggestEndpoint: string;
    geocodeEndpoint: string;
    reverseGeocodeEndpoint: string;
    requestTimeoutMs: string;
    rateLimitPerMinute: string;
    apiKey?: string;
  }>;

type GeoapifyFeature = Readonly<{
  properties?: Readonly<Record<string, unknown>>;
  geometry?: Readonly<{
    coordinates?: readonly [number, number];
  }>;
}>;

type GeoapifyResponse = Readonly<{
  features?: readonly GeoapifyFeature[];
}>;

const COMPONENT = 'map-geocoding-api';

let loggerPromise: Promise<MapGeocodingLogger> | null = null;

const getLogger = async (): Promise<MapGeocodingLogger> => {
  loggerPromise ??= import('@sva/server-runtime').then(({ createSdkLogger }) =>
    createSdkLogger({ component: COMPONENT, level: 'info' }),
  );
  return loggerPromise;
};

const jsonResponse = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const createClientError = (code: string): Error => new Error(code);

const createErrorResponse = (code: string): Response =>
  jsonResponse(
    code === 'unauthorized'
      ? 401
      : code === 'no_result'
        ? 404
        : code === 'disabled'
          ? 503
          : code === 'rate_limited'
            ? 429
            : code === 'timeout'
              ? 504
              : 400,
    {
      error: { code, message: code },
      message: code,
    },
  );

const getRequest = async (): Promise<Request> => {
  const server = await import('@tanstack/react-start/server');
  return server.getRequest();
};

const readJsonBody = async <T>(request: Request): Promise<T> => {
  try {
    return (await request.json()) as T;
  } catch {
    throw createClientError('invalid_input');
  }
};

const withAuthenticatedMapUser = async <T>(
  request: Request,
  run: (ctx: AuthenticatedMapGeocodingContext) => Promise<T>,
): Promise<T> => {
  const { withAuthenticatedUser } = await import('@sva/auth-runtime/server');

  const response = await withAuthenticatedUser(request, async (ctx) => {
    if (!ctx.user.instanceId) {
      return jsonResponse(400, { error: 'invalid_config' });
    }

    return jsonResponse(
      200,
      await run({
        sessionId: ctx.sessionId,
        user: ctx.user,
      }),
    );
  });

  if (!response.ok) {
    throw createClientError(response.status === 401 ? 'unauthorized' : 'invalid_config');
  }

  const payload = (await response.json().catch(() => null)) as T | { error?: string } | null;
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    throw createClientError(payload.error);
  }

  return payload as T;
};

const compactQuery = (input: MapGeocodingAddressInput): string => {
  const joined = [input.query, input.street, input.zip, input.city, input.country]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return joined.join(', ');
};

const parsePositiveInteger = (value: string): number =>
  /^\d+$/.test(value.trim()) ? Number(value.trim()) : 3000;

const toNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const toText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const normalizeGeoapifyFeature = (
  feature: GeoapifyFeature,
  source: 'geoapify' | 'custom',
): MapGeocodingFeature | null => {
  const properties = feature.properties ?? {};
  const lat = toNumber(properties.lat) ?? toNumber(feature.geometry?.coordinates?.[1]);
  const lng = toNumber(properties.lon) ?? toNumber(feature.geometry?.coordinates?.[0]);
  const label = toText(properties.formatted) ?? toText(properties.address_line1) ?? toText(properties.result_type);

  if (lat === null || lng === null || !label) {
    return null;
  }

  return {
    label,
    coordinates: {
      latitude: lat,
      longitude: lng,
    },
    street: toText(properties.street),
    houseNumber: toText(properties.housenumber),
    postalCode: toText(properties.postcode),
    city: toText(properties.city) ?? toText(properties.county),
    country: toText(properties.country),
    countryCode: toText(properties.country_code),
    source,
  };
};

const buildGeoapifyUrl = (
  endpoint: 'autocomplete' | 'search' | 'reverse',
  input: {
    query?: string;
    coordinates?: MapGeocodingCoordinates;
    apiKey?: string;
  },
): URL => {
  const url = new URL(`https://api.geoapify.com/v1/geocode/${endpoint}`);
  url.searchParams.set('format', 'json');
  if (input.query) {
    url.searchParams.set('text', input.query);
  }
  if (input.coordinates) {
    url.searchParams.set('lat', String(input.coordinates.latitude));
    url.searchParams.set('lon', String(input.coordinates.longitude));
  }
  if (input.apiKey) {
    url.searchParams.set('apiKey', input.apiKey);
  }
  return url;
};

const buildCustomUrl = (
  endpoint: string,
  input: {
    query?: string;
    coordinates?: MapGeocodingCoordinates;
  },
): URL => {
  const url = new URL(endpoint);
  if (input.query) {
    url.searchParams.set('query', input.query);
  }
  if (input.coordinates) {
    url.searchParams.set('lat', String(input.coordinates.latitude));
    url.searchParams.set('lng', String(input.coordinates.longitude));
  }
  return url;
};

const fetchJsonWithTimeout = async (
  url: URL,
  timeoutMs: number,
): Promise<GeoapifyResponse> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      if (response.status === 429) {
        throw createClientError('rate_limited');
      }
      throw createClientError('provider_error');
    }
    return (await response.json()) as GeoapifyResponse;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw createClientError('timeout');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const loadRuntimeConfig = async (instanceId: string): Promise<MapGeocodingRuntimeConfigWithSecrets> => {
  const { loadStoredMapGeocodingRuntimeConfig } = await import('./instance-interfaces-server.js');
  const config = await loadStoredMapGeocodingRuntimeConfig(instanceId);

  if (!config || !config.enabled || config.killSwitchEnabled) {
    throw createClientError('disabled');
  }

  return {
    provider: config.provider,
    styleUrl: config.styleUrl,
    autocompleteEnabled: config.autocompleteEnabled,
    geocodeEnabled: config.geocodeEnabled,
    reverseGeocodeEnabled: config.reverseGeocodeEnabled,
    killSwitchEnabled: config.killSwitchEnabled,
    suggestEndpoint: config.suggestEndpoint,
    geocodeEndpoint: config.geocodeEndpoint,
    reverseGeocodeEndpoint: config.reverseGeocodeEndpoint,
    requestTimeoutMs: config.requestTimeoutMs,
    rateLimitPerMinute: config.rateLimitPerMinute,
    ...(config.apiKey ? { apiKey: config.apiKey } : {}),
  };
};

const executeProviderRequest = async (input: {
  config: MapGeocodingRuntimeConfigWithSecrets;
  mode: 'suggest' | 'geocode' | 'reverse';
  query?: string;
  coordinates?: MapGeocodingCoordinates;
}): Promise<readonly MapGeocodingFeature[]> => {
  const timeoutMs = parsePositiveInteger(input.config.requestTimeoutMs);
  const url =
    input.config.provider === 'geoapify'
      ? buildGeoapifyUrl(
          input.mode === 'suggest' ? 'autocomplete' : input.mode === 'geocode' ? 'search' : 'reverse',
          {
            query: input.query,
            coordinates: input.coordinates,
            apiKey: input.config.apiKey,
          },
        )
      : buildCustomUrl(
          input.mode === 'suggest'
            ? input.config.suggestEndpoint
            : input.mode === 'geocode'
              ? input.config.geocodeEndpoint
              : input.config.reverseGeocodeEndpoint,
          {
            query: input.query,
            coordinates: input.coordinates,
          },
        );
  const payload = await fetchJsonWithTimeout(url, timeoutMs);
  return (payload.features ?? [])
    .map((feature) => normalizeGeoapifyFeature(feature, input.config.provider))
    .filter((feature): feature is MapGeocodingFeature => feature !== null);
};

const withGeocodingOperation = async <T>(
  request: Request,
  operation: 'get_config' | 'suggest' | 'geocode' | 'reverse_geocode',
  run: (ctx: AuthenticatedMapGeocodingContext, config: MapGeocodingRuntimeConfigWithSecrets) => Promise<T>,
): Promise<T> => {
  return withAuthenticatedMapUser(request, async (ctx) => {
    const logger = await getLogger();
    const config = await loadRuntimeConfig(ctx.user.instanceId as string);
    try {
      const result = await run(ctx, config);
      logger.info('Map geocoding operation succeeded', {
        operation,
        workspace_id: ctx.user.instanceId,
        provider: config.provider,
        outcome: 'success',
      });
      return result;
    } catch (error) {
      const code = readErrorMessage(error, 'provider_error');
      logger.warn('Map geocoding operation failed', {
        operation,
        workspace_id: ctx.user.instanceId,
        provider: config.provider,
        outcome: code,
      });
      throw error;
    }
  });
};

const withCurrentRequestGeocodingOperation = async <T>(
  operation: 'get_config' | 'suggest' | 'geocode' | 'reverse_geocode',
  run: (ctx: AuthenticatedMapGeocodingContext, config: MapGeocodingRuntimeConfigWithSecrets) => Promise<T>,
): Promise<T> => withGeocodingOperation(await getRequest(), operation, run);

const withGeocodingRouteResponse = async <T>(
  request: Request,
  operation: 'get_config' | 'suggest' | 'geocode' | 'reverse_geocode',
  run: (ctx: AuthenticatedMapGeocodingContext, config: MapGeocodingRuntimeConfigWithSecrets) => Promise<T>,
): Promise<Response> => {
  try {
    return jsonResponse(200, await withGeocodingOperation(request, operation, run));
  } catch (error) {
    return createErrorResponse(readErrorMessage(error, 'provider_error'));
  }
};

export const getMapGeocodingConfigHandler = async (request: Request): Promise<Response> =>
  withGeocodingRouteResponse(request, 'get_config', async (_ctx, config) => ({
    provider: config.provider,
    styleUrl: config.styleUrl,
    autocompleteEnabled: config.autocompleteEnabled,
    geocodeEnabled: config.geocodeEnabled,
    reverseGeocodeEnabled: config.reverseGeocodeEnabled,
    killSwitchEnabled: config.killSwitchEnabled,
  }));

export const suggestMapAddressesHandler = async (request: Request): Promise<Response> =>
  withGeocodingRouteResponse(request, 'suggest', async (_ctx, config) => {
    const data = await readJsonBody<{ query?: string }>(request);
    const query = data.query?.trim() ?? '';
    if (!query) {
      throw createClientError('invalid_input');
    }
    if (!config.autocompleteEnabled) {
      throw createClientError('disabled');
    }
    const result = await executeProviderRequest({
      config,
      mode: 'suggest',
      query,
    });
    if (result.length === 0) {
      throw createClientError('no_result');
    }
    return result;
  });

export const geocodeMapAddressHandler = async (request: Request): Promise<Response> =>
  withGeocodingRouteResponse(request, 'geocode', async (_ctx, config) => {
    if (!config.geocodeEnabled) {
      throw createClientError('disabled');
    }
    const data = await readJsonBody<MapGeocodingAddressInput>(request);
    const query = compactQuery(data);
    if (!query) {
      throw createClientError('invalid_input');
    }
    const result = await executeProviderRequest({
      config,
      mode: 'geocode',
      query,
    });
    const first = result[0];
    if (!first) {
      throw createClientError('no_result');
    }
    return first;
  });

export const reverseGeocodeMapCoordinatesHandler = async (request: Request): Promise<Response> =>
  withGeocodingRouteResponse(request, 'reverse_geocode', async (_ctx, config) => {
    if (!config.reverseGeocodeEnabled) {
      throw createClientError('disabled');
    }
    const data = await readJsonBody<MapGeocodingCoordinates>(request);
    if (!Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) {
      throw createClientError('invalid_input');
    }
    const result = await executeProviderRequest({
      config,
      mode: 'reverse',
      coordinates: data,
    });
    const first = result[0];
    if (!first) {
      throw createClientError('no_result');
    }
    return first;
  });

export const getMapGeocodingConfigServerFn = createServerFn().handler(
  async (): Promise<MapGeocodingRuntimeConfig> =>
    withCurrentRequestGeocodingOperation('get_config', async (_ctx, config) => ({
      provider: config.provider,
      styleUrl: config.styleUrl,
      autocompleteEnabled: config.autocompleteEnabled,
      geocodeEnabled: config.geocodeEnabled,
      reverseGeocodeEnabled: config.reverseGeocodeEnabled,
      killSwitchEnabled: config.killSwitchEnabled,
    })),
);

export const suggestMapAddressesServerFn = createServerFn({ method: 'POST' })
  .inputValidator((data: { query: string }) => data)
  .handler(async ({ data }): Promise<readonly MapGeocodingFeature[]> =>
    withCurrentRequestGeocodingOperation('suggest', async (_ctx, config) => {
      const query = data.query.trim();
      if (!query) {
        throw createClientError('invalid_input');
      }
      if (!config.autocompleteEnabled) {
        throw createClientError('disabled');
      }
      const result = await executeProviderRequest({
        config,
        mode: 'suggest',
        query,
      });
      if (result.length === 0) {
        throw createClientError('no_result');
      }
      return result;
    }),
  );

export const geocodeMapAddressServerFn = createServerFn({ method: 'POST' })
  .inputValidator((data: MapGeocodingAddressInput) => data)
  .handler(async ({ data }): Promise<MapGeocodingFeature> =>
    withCurrentRequestGeocodingOperation('geocode', async (_ctx, config) => {
      if (!config.geocodeEnabled) {
        throw createClientError('disabled');
      }
      const query = compactQuery(data);
      if (!query) {
        throw createClientError('invalid_input');
      }
      const result = await executeProviderRequest({
        config,
        mode: 'geocode',
        query,
      });
      const first = result[0];
      if (!first) {
        throw createClientError('no_result');
      }
      return first;
    }),
  );

export const reverseGeocodeMapCoordinatesServerFn = createServerFn({ method: 'POST' })
  .inputValidator((data: MapGeocodingCoordinates) => data)
  .handler(async ({ data }): Promise<MapGeocodingFeature> =>
    withCurrentRequestGeocodingOperation('reverse_geocode', async (_ctx, config) => {
      if (!config.reverseGeocodeEnabled) {
        throw createClientError('disabled');
      }
      if (!Number.isFinite(data.latitude) || !Number.isFinite(data.longitude)) {
        throw createClientError('invalid_input');
      }
      const result = await executeProviderRequest({
        config,
        mode: 'reverse',
        coordinates: data,
      });
      const first = result[0];
      if (!first) {
        throw createClientError('no_result');
      }
      return first;
    }),
  );
