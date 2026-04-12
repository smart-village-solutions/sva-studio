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

const normalizeAuthority = (value: string | null): string | null => {
  const authority = value?.trim().toLowerCase() ?? null;
  if (!authority) {
    return null;
  }

  try {
    const parsed = new URL(`http://${authority}`);
    return parsed.port ? `${normalizeHost(parsed.hostname)}:${parsed.port}` : normalizeHost(parsed.hostname);
  } catch {
    return null;
  }
};

const readPublicBaseUrlPort = (): { hostname: string; port: string; protocol: string } | null => {
  const raw = process.env.SVA_PUBLIC_BASE_URL?.trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    if (!parsed.port) {
      return null;
    }

    return {
      hostname: normalizeHost(parsed.hostname),
      port: parsed.port,
      protocol: parsed.protocol.replace(/:$/, ''),
    };
  } catch {
    return null;
  }
};

const withLocalDevPortFallback = (authority: string, protocol: string): string => {
  if (authority.includes(':')) {
    return authority;
  }

  const publicBase = readPublicBaseUrlPort();
  if (!publicBase || publicBase.protocol !== protocol) {
    return authority;
  }

  if (authority === publicBase.hostname || authority.endsWith(`.${publicBase.hostname}`)) {
    return `${authority}:${publicBase.port}`;
  }

  return authority;
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

export const parseForwardedAuthority = (value: string | null): string | null =>
  normalizeAuthority(readForwardedPair(value, 'host'));

export const parseForwardedProto = (value: string | null): string | null => {
  const proto = readForwardedPair(value, 'proto');
  return normalizeTrustedProto(proto);
};

const parseHostHeader = (value: string | null): string | null => {
  const host = value?.split(',')[0]?.trim() ?? null;
  return host ? normalizeHost(host) : null;
};

const parseHostAuthority = (value: string | null): string | null => normalizeAuthority(value?.split(',')[0]?.trim() ?? null);

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

export const resolveEffectiveRequestAuthority = (request: Request): string => {
  const url = new URL(request.url);
  if (!shouldTrustForwardedHeaders()) {
    const urlHost = normalizeHost(url.host);
    const hostHeaderHost = parseHostHeader(request.headers.get('host'));
    if (hostHeaderHost && hostHeaderHost === urlHost) {
      return parseHostAuthority(request.headers.get('host')) ?? normalizeAuthority(url.host) ?? url.host;
    }

    return normalizeAuthority(url.host) ?? url.host;
  }

  return (
    parseHostAuthority(request.headers.get('x-forwarded-host')) ??
    parseForwardedAuthority(request.headers.get('forwarded')) ??
    parseHostAuthority(request.headers.get('host')) ??
    normalizeAuthority(url.host) ??
    url.host
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
  `${resolveEffectiveRequestProtocol(request)}://${withLocalDevPortFallback(
    resolveEffectiveRequestAuthority(request),
    resolveEffectiveRequestProtocol(request)
  )}`;
