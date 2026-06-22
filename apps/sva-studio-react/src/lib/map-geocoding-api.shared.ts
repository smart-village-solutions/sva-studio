import type {
  MapGeocodingAddressInput,
  MapGeocodingCoordinates,
  MapGeocodingFeature,
  MapGeocodingRuntimeConfig,
} from '@sva/plugin-sdk';

export type MapGeocodingLogger = {
  info: (message: string, meta: Record<string, unknown>) => void;
  warn: (message: string, meta: Record<string, unknown>) => void;
  error: (message: string, meta: Record<string, unknown>) => void;
};

type MapGeocodingClientError = Error & {
  code?: string;
  statusCode?: number;
  endpoint?: string;
  provider?: string;
};

export type AuthenticatedMapGeocodingContext = Readonly<{
  sessionId: string;
  user: {
    id: string;
    instanceId?: string;
    roles: string[];
  };
}>;

export type MapGeocodingRuntimeConfigWithSecrets = MapGeocodingRuntimeConfig &
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

export type GeoapifyResponse = Readonly<{
  features?: readonly GeoapifyFeature[];
}>;

export const COMPONENT = 'map-geocoding-api';

export const jsonResponse = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const createClientError = (
  code: string,
  details: {
    statusCode?: number;
    endpoint?: string;
    provider?: string;
  } = {},
): Error => {
  const error = new Error(code) as MapGeocodingClientError;
  error.code = code;
  if (details.statusCode !== undefined) {
    error.statusCode = details.statusCode;
  }
  if (details.endpoint) {
    error.endpoint = details.endpoint;
  }
  if (details.provider) {
    error.provider = details.provider;
  }
  return error;
};

export const readMapGeocodingErrorDiagnostics = (error: unknown): Record<string, unknown> => {
  if (!(error instanceof Error)) {
    return {};
  }

  const diagnostics: Record<string, unknown> = {
    error_message: error.message,
  };

  const candidate = error as MapGeocodingClientError;
  if (typeof candidate.code === 'string' && candidate.code.length > 0) {
    diagnostics.error_code = candidate.code;
  }
  if (typeof candidate.statusCode === 'number') {
    diagnostics.provider_status = candidate.statusCode;
  }
  if (typeof candidate.endpoint === 'string' && candidate.endpoint.length > 0) {
    diagnostics.provider_endpoint = candidate.endpoint;
  }
  if (typeof candidate.provider === 'string' && candidate.provider.length > 0) {
    diagnostics.provider = candidate.provider;
  }

  return diagnostics;
};

export const createErrorResponse = (code: string): Response =>
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

export const readJsonBody = async <T>(request: Request): Promise<T> => {
  try {
    return (await request.json()) as T;
  } catch {
    throw createClientError('invalid_input');
  }
};

export const compactQuery = (input: MapGeocodingAddressInput): string => {
  const joined = [input.query, input.street, input.zip, input.city, input.country]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return joined.join(', ');
};

export const parsePositiveInteger = (value: string): number =>
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
  url.searchParams.set('format', 'geojson');
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

export const buildProviderUrl = (
  config: MapGeocodingRuntimeConfigWithSecrets,
  mode: 'suggest' | 'geocode' | 'reverse',
  input: {
    query?: string;
    coordinates?: MapGeocodingCoordinates;
  },
) =>
  config.provider === 'geoapify'
    ? buildGeoapifyUrl(mode === 'suggest' ? 'autocomplete' : mode === 'geocode' ? 'search' : 'reverse', {
        query: input.query,
        coordinates: input.coordinates,
        apiKey: config.apiKey,
      })
    : buildCustomUrl(
        mode === 'suggest'
          ? config.suggestEndpoint
          : mode === 'geocode'
            ? config.geocodeEndpoint
            : config.reverseGeocodeEndpoint,
        input,
      );

export const normalizeProviderFeatures = (
  payload: GeoapifyResponse,
  provider: 'geoapify' | 'custom',
): readonly MapGeocodingFeature[] =>
  (payload.features ?? [])
    .map((feature) => normalizeGeoapifyFeature(feature, provider))
    .filter((feature): feature is MapGeocodingFeature => feature !== null);
