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
  withCurrentRequestGeocodingOperation,
} from './map-geocoding-api.operations.js';

const withRouteResponse = async <T>(run: () => Promise<T>): Promise<Response> => {
  try {
    return jsonResponse(200, await run());
  } catch (error) {
    return createErrorResponse(readMapGeocodingErrorCode(error));
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
  .inputValidator((data: { query: string }) => data)
  .handler(async ({ data }): Promise<readonly MapGeocodingFeature[]> => {
    const query = data.query.trim();
    if (!query) {
      throw createClientError('invalid_input');
    }
    return withCurrentRequestGeocodingOperation('suggest', async (_ctx, config, diagnostics) =>
      executeSuggestOperation(config, query, diagnostics),
    );
  });

export const geocodeMapAddressServerFn = createServerFn({ method: 'POST' })
  .inputValidator((data: MapGeocodingAddressInput) => data)
  .handler(async ({ data }): Promise<MapGeocodingFeature> =>
    withCurrentRequestGeocodingOperation('geocode', async (_ctx, config, diagnostics) =>
      executeGeocodeOperation(config, data, diagnostics),
    ),
  );

export const reverseGeocodeMapCoordinatesServerFn = createServerFn({ method: 'POST' })
  .inputValidator((data: MapGeocodingCoordinates) => data)
  .handler(async ({ data }): Promise<MapGeocodingFeature> =>
    withCurrentRequestGeocodingOperation('reverse_geocode', async (_ctx, config, diagnostics) =>
      executeReverseGeocodeOperation(config, data, diagnostics),
    ),
  );
