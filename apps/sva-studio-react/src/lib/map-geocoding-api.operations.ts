import type {
  MapGeocodingAddressInput,
  MapGeocodingCoordinates,
  MapGeocodingFeature,
  MapGeocodingRuntimeConfig,
} from '@sva/plugin-sdk';

import {
  COMPONENT,
  compactQuery,
  createClientError,
  createErrorResponse,
  jsonResponse,
  readMapGeocodingErrorCode,
  readMapGeocodingErrorDiagnostics,
  type AuthenticatedMapGeocodingContext,
  type MapGeocodingLogger,
  type MapGeocodingRuntimeConfigWithSecrets,
} from './map-geocoding-api.shared.js';
import { executeProviderRequest, getPublicMapGeocodingConfig } from './map-geocoding-api.provider.js';

export { executeProviderRequest, getPublicMapGeocodingConfig } from './map-geocoding-api.provider.js';

let loggerPromise: Promise<MapGeocodingLogger> | null = null;

type MapGeocodingOperationDiagnostics = {
  authResolutionDurationMs: number;
  authorizationDurationMs: number;
  configLoadDurationMs?: number;
  operationDurationMs?: number;
  providerRequestDurationMs?: number;
};

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

const now = (): number => Date.now();

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

const authorizeFirstAllowedAction = async (
  ctx: Parameters<
    Awaited<typeof import('@sva/auth-runtime/server')>['authorizeInstancePermissionForUser']
  >[0]['ctx'],
  actions: readonly (
    | 'poi.read'
    | 'poi.create'
    | 'poi.update'
    | 'events.read'
    | 'events.create'
    | 'events.update'
    | 'generic-items.read'
    | 'generic-items.create'
    | 'generic-items.update'
  )[],
) => {
  const { authorizeInstancePermissionForUser } = await import('@sva/auth-runtime/server');
  let lastResult:
    | Awaited<ReturnType<typeof authorizeInstancePermissionForUser>>
    | null = null;

  for (const action of actions) {
    const result = await authorizeInstancePermissionForUser({ ctx, action });
    if (result.ok) {
      return result;
    }
    lastResult = result;
  }
  return lastResult ?? { ok: false as const, status: 403, error: 'forbidden', message: 'forbidden' };
};

const withAuthenticatedMapUser = async <T>(
  request: Request,
  actions: readonly (
    | 'poi.read'
    | 'poi.create'
    | 'poi.update'
    | 'events.read'
    | 'events.create'
    | 'events.update'
    | 'generic-items.read'
    | 'generic-items.create'
    | 'generic-items.update'
  )[],
  run: (ctx: AuthenticatedMapGeocodingContext, diagnostics: MapGeocodingOperationDiagnostics) => Promise<T>,
): Promise<T> => {
  const { withAuthenticatedUser } = await import('@sva/auth-runtime/server');
  const requestStartedAt = now();
  const response = await withAuthenticatedUser(request, async (ctx) => {
    const authResolvedAt = now();
    const diagnostics: MapGeocodingOperationDiagnostics = {
      authResolutionDurationMs: authResolvedAt - requestStartedAt,
      authorizationDurationMs: 0,
    };
    if (!ctx.user.instanceId) {
      return jsonResponse(400, { error: 'invalid_config' });
    }
    const authorizationStartedAt = now();
    const authorization = await authorizeFirstAllowedAction(ctx, actions);
    diagnostics.authorizationDurationMs = now() - authorizationStartedAt;
    if (!authorization.ok) {
      return jsonResponse(authorization.status, { error: authorization.error });
    }
    try {
      return jsonResponse(200, await run({ sessionId: ctx.sessionId, user: ctx.user }, diagnostics));
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
  run: (
    ctx: AuthenticatedMapGeocodingContext,
    config: MapGeocodingRuntimeConfigWithSecrets,
    diagnostics: MapGeocodingOperationDiagnostics,
  ) => Promise<T>,
): Promise<T> =>
  withAuthenticatedMapUser(
    request,
    operation === 'get_config'
      ? ['poi.read', 'events.read', 'generic-items.read']
      : ['poi.update', 'poi.create', 'events.update', 'events.create', 'generic-items.update', 'generic-items.create'],
    async (ctx, diagnostics) => {
      const operationStartedAt = now();
      const logger = await getLogger();
      const configStartedAt = now();
      const config = await loadRuntimeConfig(ctx.user.instanceId as string);
      diagnostics.configLoadDurationMs = now() - configStartedAt;
      try {
        const result = await run(ctx, config, diagnostics);
        diagnostics.operationDurationMs = now() - operationStartedAt;
        const configLoadDurationMs = diagnostics.configLoadDurationMs ?? 0;
        const operationDurationMs = diagnostics.operationDurationMs ?? 0;
        logger.info('Map geocoding operation succeeded', {
          operation,
          workspace_id: ctx.user.instanceId,
          provider: config.provider,
          outcome: 'success',
          auth_resolution_duration_ms: diagnostics.authResolutionDurationMs,
          authorization_duration_ms: diagnostics.authorizationDurationMs,
          config_load_duration_ms: configLoadDurationMs,
          operation_duration_ms: operationDurationMs,
          total_duration_ms:
            diagnostics.authResolutionDurationMs +
            diagnostics.authorizationDurationMs +
            configLoadDurationMs +
            operationDurationMs,
          ...(diagnostics.providerRequestDurationMs !== undefined
            ? { provider_request_duration_ms: diagnostics.providerRequestDurationMs }
            : {}),
        });
        return result;
      } catch (error) {
        diagnostics.operationDurationMs = now() - operationStartedAt;
        const configLoadDurationMs = diagnostics.configLoadDurationMs ?? 0;
        const operationDurationMs = diagnostics.operationDurationMs ?? 0;
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
          auth_resolution_duration_ms: diagnostics.authResolutionDurationMs,
          authorization_duration_ms: diagnostics.authorizationDurationMs,
          config_load_duration_ms: configLoadDurationMs,
          operation_duration_ms: operationDurationMs,
          total_duration_ms:
            diagnostics.authResolutionDurationMs +
            diagnostics.authorizationDurationMs +
            configLoadDurationMs +
            operationDurationMs,
          ...(diagnostics.providerRequestDurationMs !== undefined
            ? { provider_request_duration_ms: diagnostics.providerRequestDurationMs }
            : {}),
          ...readMapGeocodingErrorDiagnostics(error),
        });
        throw error;
      }
    },
  );
export const withCurrentRequestGeocodingOperation = async <T>(
  operation: 'get_config' | 'suggest' | 'geocode' | 'reverse_geocode',
  run: (
    ctx: AuthenticatedMapGeocodingContext,
    config: MapGeocodingRuntimeConfigWithSecrets,
    diagnostics: MapGeocodingOperationDiagnostics,
  ) => Promise<T>,
): Promise<T> => withGeocodingOperation(await getRequest(), operation, run);

export const executeSuggestOperation = async (
  config: MapGeocodingRuntimeConfigWithSecrets,
  query: string,
  diagnostics?: MapGeocodingOperationDiagnostics,
): Promise<readonly MapGeocodingFeature[]> => {
  if (!config.autocompleteEnabled) throw createClientError('disabled');
  const result = await executeProviderRequest({ config, mode: 'suggest', query, diagnostics });
  if (result.length === 0) throw createClientError('no_result');
  return result;
};

export const executeGeocodeOperation = async (
  config: MapGeocodingRuntimeConfigWithSecrets,
  input: MapGeocodingAddressInput,
  diagnostics?: MapGeocodingOperationDiagnostics,
): Promise<MapGeocodingFeature> => {
  if (!config.geocodeEnabled) throw createClientError('disabled');
  const query = compactQuery(input);
  if (!query) {
    throw createClientError('invalid_input');
  }
  const result = await executeProviderRequest({ config, mode: 'geocode', query, diagnostics });
  const first = result[0];
  if (!first) {
    throw createClientError('no_result');
  }
  return first;
};

export const executeReverseGeocodeOperation = async (
  config: MapGeocodingRuntimeConfigWithSecrets,
  coordinates: MapGeocodingCoordinates,
  diagnostics?: MapGeocodingOperationDiagnostics,
): Promise<MapGeocodingFeature> => {
  if (!config.reverseGeocodeEnabled) throw createClientError('disabled');
  if (!Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude)) {
    throw createClientError('invalid_input');
  }
  const result = await executeProviderRequest({ config, mode: 'reverse', coordinates, diagnostics });
  const first = result[0];
  if (!first) {
    throw createClientError('no_result');
  }
  return first;
};

export const runGetConfigOperation = (request: Request): Promise<MapGeocodingRuntimeConfig> =>
  withGeocodingOperation(request, 'get_config', async (_ctx, config) => getPublicMapGeocodingConfig(config));

export const runSuggestOperation = (request: Request, query: string): Promise<readonly MapGeocodingFeature[]> =>
  withGeocodingOperation(request, 'suggest', async (_ctx, config, diagnostics) => executeSuggestOperation(config, query, diagnostics));

export const runGeocodeOperation = (request: Request, input: MapGeocodingAddressInput): Promise<MapGeocodingFeature> =>
  withGeocodingOperation(request, 'geocode', async (_ctx, config, diagnostics) => executeGeocodeOperation(config, input, diagnostics));

export const runReverseGeocodeOperation = (
  request: Request,
  coordinates: MapGeocodingCoordinates,
): Promise<MapGeocodingFeature> =>
  withGeocodingOperation(request, 'reverse_geocode', async (_ctx, config, diagnostics) =>
    executeReverseGeocodeOperation(config, coordinates, diagnostics));
