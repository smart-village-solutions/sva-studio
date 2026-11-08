import { createServerFn } from '@tanstack/react-start';

import type {
  MapGeocodingAddressInput,
  MapGeocodingCoordinates,
  MapGeocodingFeature,
  MapGeocodingRuntimeConfig,
} from '@sva/plugin-sdk';

import {
  createClientError,
  createErrorResponse,
  readJsonBody,
  jsonResponse,
  readMapGeocodingErrorCode,
  type AuthenticatedMapGeocodingContext,
  type MapGeocodingRuntimeConfigWithSecrets,
} from './map-geocoding-api.shared.js';
import {
  executeGeocodeOperation,
  executeReverseGeocodeOperation,
  executeSuggestOperation,
  getPublicMapGeocodingConfig,
  runGeocodeOperation,
  runGetConfigOperation,
  runReverseGeocodeOperation,
  runSuggestOperation,
  withGeocodingOperation,
  type MapGeocodingOperationDiagnostics,
} from './map-geocoding-api.operations.js';

const withCurrentRequestGeocodingOperation = async <T>(
  operation: 'get_config' | 'suggest' | 'geocode' | 'reverse_geocode',
  run: (
    ctx: AuthenticatedMapGeocodingContext,
    config: MapGeocodingRuntimeConfigWithSecrets,
    diagnostics: MapGeocodingOperationDiagnostics
  ) => Promise<T>
): Promise<T> => {
  try {
    const { getRequest } = await import('@tanstack/react-start/server');
    return await withGeocodingOperation(getRequest(), operation, run);
  } catch (error) {
    const code = readMapGeocodingErrorCode(error);
    if (code !== 'rate_limited' && code !== 'budget_unavailable') throw error;
    // TanStack's shallow Error serializer drops custom fields. This bounded record survives the wire.
    const response = createErrorResponse(error);
    throw {
      code,
      message: code,
      statusCode: response.status,
      ...(response.headers.has('retry-after')
        ? { retryAfterSeconds: Number(response.headers.get('retry-after')) }
        : {}),
    };
  }
};

const withRouteResponse = async <T>(run: () => Promise<T>): Promise<Response> => {
  try {
    return jsonResponse(200, await run());
  } catch (error) {
    return createErrorResponse(error);
  }
};

export const getMapGeocodingConfigHandler = async (request: Request): Promise<Response> =>
  withRouteResponse(() => runGetConfigOperation(request));

export const suggestMapAddressesHandler = async (request: Request): Promise<Response> =>
  withRouteResponse(async () => {
    const data = await readJsonBody<{ query?: string }>(request);
    const query = data.query?.trim() ?? '';
    if (!query) {
      throw createClientError('invalid_input');
    }
    return runSuggestOperation(request, query);
  });

export const geocodeMapAddressHandler = async (request: Request): Promise<Response> =>
  withRouteResponse(async () => runGeocodeOperation(request, await readJsonBody<MapGeocodingAddressInput>(request)));

export const reverseGeocodeMapCoordinatesHandler = async (request: Request): Promise<Response> =>
  withRouteResponse(async () =>
    runReverseGeocodeOperation(request, await readJsonBody<MapGeocodingCoordinates>(request)),
  );

export const getMapGeocodingConfigServerFn = createServerFn().handler(async (): Promise<MapGeocodingRuntimeConfig> =>
  withCurrentRequestGeocodingOperation('get_config', async (_ctx, config) => getPublicMapGeocodingConfig(config)),
);

export const suggestMapAddressesServerFn = createServerFn({ method: 'POST' })
  .validator((data: { query: string }) => data)
  .handler(async ({ data }): Promise<readonly MapGeocodingFeature[]> => {
    const query = data.query.trim();
    if (!query) {
      throw createClientError('invalid_input');
    }
    return withCurrentRequestGeocodingOperation('suggest', async (ctx, config, diagnostics) =>
      executeSuggestOperation(ctx.user.instanceId, config, query, diagnostics)
    );
  });

export const geocodeMapAddressServerFn = createServerFn({ method: 'POST' })
  .validator((data: MapGeocodingAddressInput) => data)
  .handler(async ({ data }): Promise<MapGeocodingFeature> =>
    withCurrentRequestGeocodingOperation('geocode', async (ctx, config, diagnostics) =>
      executeGeocodeOperation(ctx.user.instanceId, config, data, diagnostics)
    )
  );

export const reverseGeocodeMapCoordinatesServerFn = createServerFn({ method: 'POST' })
  .validator((data: MapGeocodingCoordinates) => data)
  .handler(async ({ data }): Promise<MapGeocodingFeature> =>
    withCurrentRequestGeocodingOperation('reverse_geocode', async (ctx, config, diagnostics) =>
      executeReverseGeocodeOperation(ctx.user.instanceId, config, data, diagnostics)
    )
  );
