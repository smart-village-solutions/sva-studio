import type {
  MapGeocodingAddressInput,
  MapGeocodingCoordinates,
  MapGeocodingFeature,
  MapGeocodingRuntimeConfig,
} from '@sva/plugin-sdk';

import {
  COMPONENT,
  buildProviderUrl,
  compactQuery,
  createClientError,
  createErrorResponse,
  jsonResponse,
  normalizeProviderFeatures,
  parsePositiveInteger,
  readMapGeocodingErrorCode,
  readMapGeocodingErrorDiagnostics,
  type AuthenticatedMapGeocodingContext,
  type MapGeocodingLogger,
  type MapGeocodingRuntimeConfigWithSecrets,
  type GeoapifyResponse,
} from './map-geocoding-api.shared.js';

let loggerPromise: Promise<MapGeocodingLogger> | null = null;

const getLogger = async (): Promise<MapGeocodingLogger> => {
  loggerPromise ??= import('@sva/server-runtime').then(({ createSdkLogger }) =>
    createSdkLogger({ component: COMPONENT, level: 'info' }),
  );
  return loggerPromise;
};

const getRequest = async (): Promise<Request> => {
  const server = await import('@tanstack/react-start/server');
  return server.getRequest();
};

const fetchJsonWithTimeout = async (url: URL, timeoutMs: number): Promise<GeoapifyResponse> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      if (response.status === 429) {
        throw createClientError('rate_limited', {
          statusCode: response.status,
          endpoint: url.origin + url.pathname,
        });
      }
      throw createClientError('provider_error', {
        statusCode: response.status,
        endpoint: url.origin + url.pathname,
      });
    }
    return (await response.json()) as GeoapifyResponse;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw createClientError('timeout', {
        endpoint: url.origin + url.pathname,
      });
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

const withAuthenticatedMapUser = async <T>(
  request: Request,
  action: 'poi.read' | 'poi.create' | 'poi.update',
  run: (ctx: AuthenticatedMapGeocodingContext) => Promise<T>,
): Promise<T> => {
  const { authorizeInstancePermissionForUser, withAuthenticatedUser } = await import('@sva/auth-runtime/server');
  const response = await withAuthenticatedUser(request, async (ctx) => {
    if (!ctx.user.instanceId) {
      return jsonResponse(400, { error: 'invalid_config' });
    }
    const authorization =
      action === 'poi.update'
        ? await authorizeInstancePermissionForUser({ ctx, action: 'poi.update' }).then(async (result) =>
            result.ok ? result : authorizeInstancePermissionForUser({ ctx, action: 'poi.create' }),
          )
        : await authorizeInstancePermissionForUser({ ctx, action });
    if (!authorization.ok) {
      return jsonResponse(authorization.status, { error: authorization.error });
    }
    try {
      return jsonResponse(200, await run({ sessionId: ctx.sessionId, user: ctx.user }));
    } catch (error) {
      return createErrorResponse(readMapGeocodingErrorCode(error));
    }
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string | { code?: string } }
      | null;
    const errorCode =
      typeof payload?.error === 'string'
        ? payload.error
        : typeof payload?.error?.code === 'string'
          ? payload.error.code
          : response.status === 401
            ? 'unauthorized'
            : 'invalid_config';
    throw createClientError(errorCode);
  }

  const payload = (await response.json().catch(() => null)) as T | { error?: string } | null;
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    throw createClientError(payload.error);
  }
  return payload as T;
};

const withGeocodingOperation = async <T>(
  request: Request,
  operation: 'get_config' | 'suggest' | 'geocode' | 'reverse_geocode',
  run: (ctx: AuthenticatedMapGeocodingContext, config: MapGeocodingRuntimeConfigWithSecrets) => Promise<T>,
): Promise<T> =>
  withAuthenticatedMapUser(request, operation === 'get_config' ? 'poi.read' : 'poi.update', async (ctx) => {
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
      logger.warn('Map geocoding operation failed', {
        operation,
        workspace_id: ctx.user.instanceId,
        provider: config.provider,
        outcome: readMapGeocodingErrorCode(error),
        provider_configured: Boolean(config.apiKey),
        style_url_configured: config.styleUrl.length > 0,
        request_timeout_ms: config.requestTimeoutMs,
        rate_limit_per_minute: config.rateLimitPerMinute,
        autocomplete_enabled: config.autocompleteEnabled,
        geocode_enabled: config.geocodeEnabled,
        reverse_geocode_enabled: config.reverseGeocodeEnabled,
        kill_switch_enabled: config.killSwitchEnabled,
        ...readMapGeocodingErrorDiagnostics(error),
      });
      throw error;
    }
  });

export const withCurrentRequestGeocodingOperation = async <T>(
  operation: 'get_config' | 'suggest' | 'geocode' | 'reverse_geocode',
  run: (ctx: AuthenticatedMapGeocodingContext, config: MapGeocodingRuntimeConfigWithSecrets) => Promise<T>,
): Promise<T> => withGeocodingOperation(await getRequest(), operation, run);

export const executeProviderRequest = async (input: {
  config: MapGeocodingRuntimeConfigWithSecrets;
  mode: 'suggest' | 'geocode' | 'reverse';
  query?: string;
  coordinates?: MapGeocodingCoordinates;
}): Promise<readonly MapGeocodingFeature[]> => {
  const payload = await fetchJsonWithTimeout(
    buildProviderUrl(input.config, input.mode, { query: input.query, coordinates: input.coordinates }),
    parsePositiveInteger(input.config.requestTimeoutMs),
  );
  return normalizeProviderFeatures(payload, input.config.provider);
};

export const getPublicMapGeocodingConfig = (config: MapGeocodingRuntimeConfigWithSecrets): MapGeocodingRuntimeConfig => ({
  provider: config.provider,
  styleUrl: config.styleUrl,
  autocompleteEnabled: config.autocompleteEnabled,
  geocodeEnabled: config.geocodeEnabled,
  reverseGeocodeEnabled: config.reverseGeocodeEnabled,
  killSwitchEnabled: config.killSwitchEnabled,
});

export const executeSuggestOperation = async (
  config: MapGeocodingRuntimeConfigWithSecrets,
  query: string,
): Promise<readonly MapGeocodingFeature[]> => {
  if (!config.autocompleteEnabled) {
    throw createClientError('disabled');
  }
  const result = await executeProviderRequest({ config, mode: 'suggest', query });
  if (result.length === 0) {
    throw createClientError('no_result');
  }
  return result;
};

export const executeGeocodeOperation = async (
  config: MapGeocodingRuntimeConfigWithSecrets,
  input: MapGeocodingAddressInput,
): Promise<MapGeocodingFeature> => {
  if (!config.geocodeEnabled) {
    throw createClientError('disabled');
  }
  const query = compactQuery(input);
  if (!query) {
    throw createClientError('invalid_input');
  }
  const result = await executeProviderRequest({ config, mode: 'geocode', query });
  const first = result[0];
  if (!first) {
    throw createClientError('no_result');
  }
  return first;
};

export const executeReverseGeocodeOperation = async (
  config: MapGeocodingRuntimeConfigWithSecrets,
  coordinates: MapGeocodingCoordinates,
): Promise<MapGeocodingFeature> => {
  if (!config.reverseGeocodeEnabled) {
    throw createClientError('disabled');
  }
  if (!Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)) {
    throw createClientError('invalid_input');
  }
  const result = await executeProviderRequest({ config, mode: 'reverse', coordinates });
  const first = result[0];
  if (!first) {
    throw createClientError('no_result');
  }
  return first;
};

export const runGetConfigOperation = (request: Request): Promise<MapGeocodingRuntimeConfig> =>
  withGeocodingOperation(request, 'get_config', async (_ctx, config) => getPublicMapGeocodingConfig(config));

export const runSuggestOperation = (request: Request, query: string): Promise<readonly MapGeocodingFeature[]> =>
  withGeocodingOperation(request, 'suggest', async (_ctx, config) => executeSuggestOperation(config, query));

export const runGeocodeOperation = (request: Request, input: MapGeocodingAddressInput): Promise<MapGeocodingFeature> =>
  withGeocodingOperation(request, 'geocode', async (_ctx, config) => executeGeocodeOperation(config, input));

export const runReverseGeocodeOperation = (
  request: Request,
  coordinates: MapGeocodingCoordinates,
): Promise<MapGeocodingFeature> =>
  withGeocodingOperation(request, 'reverse_geocode', async (_ctx, config) =>
    executeReverseGeocodeOperation(config, coordinates),
  );
