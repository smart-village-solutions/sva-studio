import { normalizeHost } from '@sva/core';

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
  return proto ? proto.toLowerCase() : null;
};

const parseHostHeader = (value: string | null): string | null => {
  const host = value?.split(',')[0]?.trim() ?? null;
  return host ? normalizeHost(host) : null;
};

const parseProtoHeader = (value: string | null): string | null => {
  const proto = value?.split(',')[0]?.trim() ?? null;
  return proto ? proto.toLowerCase() : null;
};

export const resolveEffectiveRequestHost = (request: Request): string => {
  const url = new URL(request.url);
  return (
    parseHostHeader(request.headers.get('x-forwarded-host')) ??
    parseHostHeader(request.headers.get('host')) ??
    parseForwardedHost(request.headers.get('forwarded')) ??
    normalizeHost(url.host)
  );
};

export const resolveEffectiveRequestProtocol = (request: Request): string => {
  const url = new URL(request.url);
  return (
    parseProtoHeader(request.headers.get('x-forwarded-proto')) ??
    parseForwardedProto(request.headers.get('forwarded')) ??
    url.protocol.replace(/:$/, '')
  );
};

export const buildRequestOriginFromHeaders = (request: Request): string =>
  `${resolveEffectiveRequestProtocol(request)}://${resolveEffectiveRequestHost(request)}`;
