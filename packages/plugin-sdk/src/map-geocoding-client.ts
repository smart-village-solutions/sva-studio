import {
  requestMainserverJson,
  type MainserverErrorFactory,
} from './mainserver-client.js';
import type {
  MapGeocodingAddressInput,
  MapGeocodingCoordinates,
  MapGeocodingFeature,
  MapGeocodingRuntimeConfig,
} from './map-geocoding.js';

const MAP_GEOCODING_BASE_PATH = '/api/v1/iam/map-geocoding';

export class MapGeocodingClientError extends Error {
  public constructor(
    public readonly code: string,
    message = code,
  ) {
    super(message);
    this.name = 'MapGeocodingClientError';
  }
}

const errorFactory: MainserverErrorFactory<MapGeocodingClientError> = (
  code,
  message,
) => new MapGeocodingClientError(code, message);

export const getHostMapGeocodingConfig = async (input?: {
  readonly fetch?: typeof fetch;
}): Promise<MapGeocodingRuntimeConfig> =>
  requestMainserverJson<MapGeocodingRuntimeConfig, MapGeocodingClientError>({
    url: `${MAP_GEOCODING_BASE_PATH}/config`,
    fetch: input?.fetch,
    errorFactory,
  });

export const suggestHostMapAddresses = async (input: {
  readonly query: string;
  readonly fetch?: typeof fetch;
}): Promise<readonly MapGeocodingFeature[]> =>
  requestMainserverJson<readonly MapGeocodingFeature[], MapGeocodingClientError>({
    url: `${MAP_GEOCODING_BASE_PATH}/suggest`,
    fetch: input.fetch,
    errorFactory,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ query: input.query }),
    },
  });

export const geocodeHostMapAddress = async (input: {
  readonly address: MapGeocodingAddressInput;
  readonly fetch?: typeof fetch;
}): Promise<MapGeocodingFeature> =>
  requestMainserverJson<MapGeocodingFeature, MapGeocodingClientError>({
    url: `${MAP_GEOCODING_BASE_PATH}/geocode`,
    fetch: input.fetch,
    errorFactory,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(input.address),
    },
  });

export const reverseGeocodeHostCoordinates = async (input: {
  readonly coordinates: MapGeocodingCoordinates;
  readonly fetch?: typeof fetch;
}): Promise<MapGeocodingFeature> =>
  requestMainserverJson<MapGeocodingFeature, MapGeocodingClientError>({
    url: `${MAP_GEOCODING_BASE_PATH}/reverse`,
    fetch: input.fetch,
    errorFactory,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(input.coordinates),
    },
  });
