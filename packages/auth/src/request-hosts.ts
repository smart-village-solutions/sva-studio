import { normalizeHost } from '@sva/core';

const parseBooleanEnv = (value: string | undefined): boolean | null => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }

  return null;
};

const shouldTrustForwardedHeaders = (): boolean =>
  parseBooleanEnv(process.env.SVA_TRUST_FORWARDED_HEADERS) ?? process.env.NODE_ENV === 'production';

const normalizeTrustedProto = (value: string | null): string | null => {
  const normalized = value?.trim().toLowerCase() ?? null;
  if (normalized === 'http' || normalized === 'https') {
    return normalized;
  }

  return null;
};

const readForwardedPair = (forwarded: string | null, key: 'host' | 'proto'): string | null => {
  if (!forwarded) {
    return null;
  }

  const firstEntry = forwarded.split(',')[0]?.trim();
  if (!firstEntry) {
    return null;
  }

  const pairs = firstEntry.split(';');
  for (const pair of pairs) {
    const separator = pair.indexOf('=');
    if (separator <= 0) {
      continue;
    }

    const currentKey = pair.slice(0, separator).trim().toLowerCase();
    if (currentKey !== key) {
      continue;
    }

    const rawValue = pair.slice(separator + 1).trim();
    const unquotedValue =
      rawValue.startsWith('"') && rawValue.endsWith('"') && rawValue.length >= 2
        ? rawValue.slice(1, -1)
        : rawValue;
    return unquotedValue.length > 0 ? unquotedValue : null;
  }

  return null;
};

export const parseForwardedHost = (value: string | null): string | null => {
  const host = readForwardedPair(value, 'host');
  return host ? normalizeHost(host) : null;
};

export const parseForwardedProto = (value: string | null): string | null => {
  const proto = readForwardedPair(value, 'proto');
  return normalizeTrustedProto(proto);
};

const parseHostHeader = (value: string | null): string | null => {
  const host = value?.split(',')[0]?.trim() ?? null;
  return host ? normalizeHost(host) : null;
};

const parseProtoHeader = (value: string | null): string | null => {
  const proto = value?.split(',')[0]?.trim() ?? null;
  return normalizeTrustedProto(proto);
};

export const resolveEffectiveRequestHost = (request: Request): string => {
  const url = new URL(request.url);
  if (!shouldTrustForwardedHeaders()) {
    return normalizeHost(url.host);
  }

  return (
    parseHostHeader(request.headers.get('x-forwarded-host')) ??
    parseForwardedHost(request.headers.get('forwarded')) ??
    parseHostHeader(request.headers.get('host')) ??
    normalizeHost(url.host)
  );
};

export const resolveEffectiveRequestProtocol = (request: Request): string => {
  const url = new URL(request.url);
  if (!shouldTrustForwardedHeaders()) {
    return url.protocol.replace(/:$/, '');
  }

  return (
    parseProtoHeader(request.headers.get('x-forwarded-proto')) ??
    parseForwardedProto(request.headers.get('forwarded')) ??
    url.protocol.replace(/:$/, '')
  );
};

export const buildRequestOriginFromHeaders = (request: Request): string =>
  `${resolveEffectiveRequestProtocol(request)}://${resolveEffectiveRequestHost(request)}`;
