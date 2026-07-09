import type { MapGeocodingCoordinates, MapGeocodingFeature, MapGeocodingRuntimeConfig } from '@sva/plugin-sdk';

import {
  buildProviderUrl,
  createClientError,
  normalizeProviderFeatures,
  parsePositiveInteger,
  type GeoapifyResponse,
  type MapGeocodingRuntimeConfigWithSecrets,
} from './map-geocoding-api.shared.js';

type ProviderRequestDiagnostics = {
  providerRequestDurationMs?: number;
};

const MAX_CUSTOM_PROVIDER_REDIRECTS = 5;

const shouldAllowPrivateMapGeocodingTargets = (): boolean =>
  process.env.SVA_ALLOW_PRIVATE_MAP_GEOCODING_TARGETS === 'true';

const normalizeProviderRequestUrl = async (
  config: MapGeocodingRuntimeConfigWithSecrets,
  url: URL,
): Promise<URL> => {
  if (config.provider !== 'custom') {
    return url;
  }

  const { normalizeOutboundHttpUrl } = await import('@sva/auth-runtime/server');
  const normalized = await normalizeOutboundHttpUrl(url.toString(), {
    allowHttp: true,
    allowPrivateHosts: shouldAllowPrivateMapGeocodingTargets(),
  });
  if (!normalized) {
    throw createClientError('invalid_input', {
      endpoint: url.origin + url.pathname,
      provider: config.provider,
    });
  }

  return new URL(normalized);
};

const fetchJsonWithTimeout = async (
  config: MapGeocodingRuntimeConfigWithSecrets,
  url: URL,
  timeoutMs: number,
  redirectCount = 0,
): Promise<GeoapifyResponse> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // fallow-ignore-next-line security-sink -- custom provider URLs are normalized before fetch and before manual redirect follow-up.
    const response = await fetch(url, {
      signal: controller.signal,
      ...(config.provider === 'custom' ? { redirect: 'manual' as const } : {}),
    });
    if (config.provider === 'custom' && response.status >= 300 && response.status < 400) {
      if (redirectCount >= MAX_CUSTOM_PROVIDER_REDIRECTS) {
        throw createClientError('provider_error', {
          statusCode: response.status,
          endpoint: url.origin + url.pathname,
        });
      }

      const location = response.headers.get('location');
      if (!location) {
        throw createClientError('provider_error', {
          statusCode: response.status,
          endpoint: url.origin + url.pathname,
        });
      }

      return fetchJsonWithTimeout(
        config,
        await normalizeProviderRequestUrl(config, new URL(location, url)),
        timeoutMs,
        redirectCount + 1,
      );
    }

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
      throw createClientError('timeout', { endpoint: url.origin + url.pathname });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const executeProviderRequest = async (input: {
  config: MapGeocodingRuntimeConfigWithSecrets;
  mode: 'suggest' | 'geocode' | 'reverse';
  query?: string;
  coordinates?: MapGeocodingCoordinates;
  diagnostics?: ProviderRequestDiagnostics;
}): Promise<readonly MapGeocodingFeature[]> => {
  const startedAt = Date.now();

  try {
    const providerUrl = buildProviderUrl(input.config, input.mode, {
      query: input.query,
      coordinates: input.coordinates,
    });
    const payload = await fetchJsonWithTimeout(
      input.config,
      await normalizeProviderRequestUrl(input.config, providerUrl),
      parsePositiveInteger(input.config.requestTimeoutMs),
    );
    return normalizeProviderFeatures(payload, input.config.provider);
  } finally {
    if (input.diagnostics) {
      input.diagnostics.providerRequestDurationMs = Date.now() - startedAt;
    }
  }
};

export const getPublicMapGeocodingConfig = (
  config: MapGeocodingRuntimeConfigWithSecrets,
): MapGeocodingRuntimeConfig => ({
  provider: config.provider,
  styleUrl: config.styleUrl,
  autocompleteEnabled: config.autocompleteEnabled,
  geocodeEnabled: config.geocodeEnabled,
  reverseGeocodeEnabled: config.reverseGeocodeEnabled,
  killSwitchEnabled: config.killSwitchEnabled,
});
