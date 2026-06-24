import {
  requestMainserverJson,
  type MainserverErrorFactory,
  type MainserverResponseMeta,
} from './mainserver-client.js';
import type {
  MapGeocodingAddressInput,
  MapGeocodingCoordinates,
  MapGeocodingFeature,
  MapGeocodingRuntimeConfig,
} from './map-geocoding.js';

const MAP_GEOCODING_BASE_PATH = '/api/v1/iam/map-geocoding';
const MAP_GEOCODING_CLIENT_TIMEOUT_MS = 30_000;

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

const MAP_GEOCODING_DEBUG_FLAG = 'sva:debug:map-geocoding';

const isMapGeocodingDebugEnabled = (): boolean => {
  try {
    if (globalThis.localStorage?.getItem(MAP_GEOCODING_DEBUG_FLAG) === 'true') {
      return true;
    }
  } catch {
    // localStorage can be blocked in some browser contexts.
  }

  return typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
};

const logMapGeocodingDebug = (level: 'info' | 'warn', event: string, meta: Record<string, unknown>): void => {
  if (!isMapGeocodingDebugEnabled()) {
    return;
  }

  const logger = level === 'warn' ? console.warn : console.info;
  logger('[map-geocoding]', event, meta);
};

const summarizeAddressInput = (address: MapGeocodingAddressInput): Record<string, unknown> => ({
  has_query: Boolean(address.query?.trim()),
  has_street: Boolean(address.street?.trim()),
  has_zip: Boolean(address.zip?.trim()),
  has_city: Boolean(address.city?.trim()),
  has_country: Boolean(address.country?.trim()),
});

const summarizeCoordinatesInput = (coordinates: MapGeocodingCoordinates): Record<string, unknown> => ({
  has_coordinates: Number.isFinite(coordinates.latitude) && Number.isFinite(coordinates.longitude),
});

const summarizeFeature = (feature: MapGeocodingFeature): Record<string, unknown> => ({
  source: feature.source,
  label_present: feature.label.trim().length > 0,
  street_present: typeof feature.street === 'string' && feature.street.trim().length > 0,
  postal_code_present: typeof feature.postalCode === 'string' && feature.postalCode.trim().length > 0,
  city_present: typeof feature.city === 'string' && feature.city.trim().length > 0,
  country_code_present: typeof feature.countryCode === 'string' && feature.countryCode.trim().length > 0,
});

const logMapGeocodingStart = (operation: string, meta: Record<string, unknown>): void => {
  logMapGeocodingDebug('info', 'client request started', {
    operation,
    ...meta,
  });
};

const logMapGeocodingSuccess = (
  operation: string,
  responseMeta: MainserverResponseMeta | null,
  meta: Record<string, unknown>,
): void => {
  logMapGeocodingDebug('info', 'client request completed', {
    operation,
    ...(responseMeta
      ? {
          http_method: responseMeta.method,
          http_status: responseMeta.status,
          duration_ms: responseMeta.durationMs,
          content_type: responseMeta.contentType ?? undefined,
        }
      : {}),
    ...meta,
  });
};

const logMapGeocodingFailure = (
  operation: string,
  error: unknown,
  responseMeta: MainserverResponseMeta | null,
): void => {
  const candidate = error && typeof error === 'object' ? (error as { code?: unknown; message?: unknown }) : undefined;
  logMapGeocodingDebug('warn', 'client request failed', {
    operation,
    ...(responseMeta
      ? {
          http_method: responseMeta.method,
          http_status: responseMeta.status,
          duration_ms: responseMeta.durationMs,
          content_type: responseMeta.contentType ?? undefined,
        }
      : {}),
    error_code: typeof candidate?.code === 'string' ? candidate.code : undefined,
    error_message:
      typeof candidate?.message === 'string'
        ? candidate.message
        : error instanceof Error
          ? error.message
          : String(error),
  });
};

export const getHostMapGeocodingConfig = async (input?: {
  readonly fetch?: typeof fetch;
}): Promise<MapGeocodingRuntimeConfig> => {
  let responseMeta: MainserverResponseMeta | null = null;
  logMapGeocodingStart('get_config', {});
  try {
    const result = await requestMainserverJson<MapGeocodingRuntimeConfig, MapGeocodingClientError>({
      url: `${MAP_GEOCODING_BASE_PATH}/config`,
      fetch: input?.fetch,
      errorFactory,
      timeoutMs: MAP_GEOCODING_CLIENT_TIMEOUT_MS,
      onResponse: (meta) => {
        responseMeta = meta;
      },
    });
    logMapGeocodingSuccess('get_config', responseMeta, {
      provider: result.provider,
      style_url_present: result.styleUrl.length > 0,
      geocode_enabled: result.geocodeEnabled,
      reverse_geocode_enabled: result.reverseGeocodeEnabled,
      kill_switch_enabled: result.killSwitchEnabled,
    });
    return result;
  } catch (error) {
    logMapGeocodingFailure('get_config', error, responseMeta);
    throw error;
  }
};

export const suggestHostMapAddresses = async (input: {
  readonly query: string;
  readonly fetch?: typeof fetch;
}): Promise<readonly MapGeocodingFeature[]> => {
  let responseMeta: MainserverResponseMeta | null = null;
  logMapGeocodingStart('suggest', {
    query_present: input.query.trim().length > 0,
  });
  try {
    const result = await requestMainserverJson<readonly MapGeocodingFeature[], MapGeocodingClientError>({
      url: `${MAP_GEOCODING_BASE_PATH}/suggest`,
      fetch: input.fetch,
      errorFactory,
      timeoutMs: MAP_GEOCODING_CLIENT_TIMEOUT_MS,
      onResponse: (meta) => {
        responseMeta = meta;
      },
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ query: input.query }),
    },
  });
    logMapGeocodingSuccess('suggest', responseMeta, {
      result_count: result.length,
      first_result_source: result[0]?.source,
    });
    return result;
  } catch (error) {
    logMapGeocodingFailure('suggest', error, responseMeta);
    throw error;
  }
};

export const geocodeHostMapAddress = async (input: {
  readonly address: MapGeocodingAddressInput;
  readonly fetch?: typeof fetch;
}): Promise<MapGeocodingFeature> => {
  let responseMeta: MainserverResponseMeta | null = null;
  logMapGeocodingStart('geocode', summarizeAddressInput(input.address));
  try {
    const result = await requestMainserverJson<MapGeocodingFeature, MapGeocodingClientError>({
      url: `${MAP_GEOCODING_BASE_PATH}/geocode`,
      fetch: input.fetch,
      errorFactory,
      timeoutMs: MAP_GEOCODING_CLIENT_TIMEOUT_MS,
      onResponse: (meta) => {
        responseMeta = meta;
      },
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(input.address),
    },
  });
    logMapGeocodingSuccess('geocode', responseMeta, summarizeFeature(result));
    return result;
  } catch (error) {
    logMapGeocodingFailure('geocode', error, responseMeta);
    throw error;
  }
};

export const reverseGeocodeHostCoordinates = async (input: {
  readonly coordinates: MapGeocodingCoordinates;
  readonly fetch?: typeof fetch;
}): Promise<MapGeocodingFeature> => {
  let responseMeta: MainserverResponseMeta | null = null;
  logMapGeocodingStart('reverse_geocode', summarizeCoordinatesInput(input.coordinates));
  try {
    const result = await requestMainserverJson<MapGeocodingFeature, MapGeocodingClientError>({
      url: `${MAP_GEOCODING_BASE_PATH}/reverse`,
      fetch: input.fetch,
      errorFactory,
      timeoutMs: MAP_GEOCODING_CLIENT_TIMEOUT_MS,
      onResponse: (meta) => {
        responseMeta = meta;
      },
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify(input.coordinates),
    },
  });
    logMapGeocodingSuccess('reverse_geocode', responseMeta, summarizeFeature(result));
    return result;
  } catch (error) {
    logMapGeocodingFailure('reverse_geocode', error, responseMeta);
    throw error;
  }
};
