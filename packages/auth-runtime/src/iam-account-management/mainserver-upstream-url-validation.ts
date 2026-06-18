import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { MainserverUserProvisioningError } from './mainserver-user-provisioning-error.js';

const localhostHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const parseUpstreamUrl = (value: string): URL | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
};

const unwrapBracketedHost = (hostname: string): string =>
  hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

const isLocalHostname = (hostname: string): boolean =>
  localhostHosts.has(hostname) || hostname.endsWith('.local');

const parseIpv4Octets = (hostname: string): readonly [number, number, number, number] | null => {
  const octets = hostname.split('.').map((segment) => Number.parseInt(segment, 10));
  if (octets.length !== 4 || octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null;
  }

  return [octets[0]!, octets[1]!, octets[2]!, octets[3]!];
};

const isNonPublicIpv4Host = (hostname: string): boolean => {
  const octets = parseIpv4Octets(hostname);
  if (!octets) {
    return true;
  }

  const [a, b, c] = octets;
  return (
    a === 0 ||
    a === 10 ||
    (a === 100 && b >= 64 && b <= 127) ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
};

const toMappedIpv4Host = (hostname: string): string | null => {
  if (!hostname.startsWith('::ffff:')) {
    return null;
  }

  const mappedPart = hostname.slice('::ffff:'.length);
  if (isIP(mappedPart) === 4) {
    return mappedPart;
  }

  const hexParts = mappedPart.split(':');
  if (hexParts.length !== 2) {
    return null;
  }

  const high = Number.parseInt(hexParts[0], 16);
  const low = Number.parseInt(hexParts[1], 16);
  if (Number.isNaN(high) || Number.isNaN(low)) {
    return null;
  }

  return [
    (high >> 8) & 0xff,
    high & 0xff,
    (low >> 8) & 0xff,
    low & 0xff,
  ].join('.');
};

const isPrivateIpv6Host = (hostname: string): boolean => {
  const mappedIpv4Host = toMappedIpv4Host(hostname);
  if (mappedIpv4Host) {
    return isPrivateOrLocalHost(mappedIpv4Host);
  }

  if (hostname.startsWith('::ffff:')) {
    return true;
  }

  return (
    hostname === '::1' ||
    hostname === '::' ||
    hostname.startsWith('fc') ||
    hostname.startsWith('fd') ||
    hostname.startsWith('fe80:')
  );
};

const isPrivateOrLocalHost = (hostname: string): boolean => {
  const normalized = hostname.trim().toLowerCase();
  if (isLocalHostname(normalized)) {
    return true;
  }

  const unbracketed = unwrapBracketedHost(normalized);
  if (unbracketed !== normalized) {
    return isPrivateOrLocalHost(unbracketed);
  }

  const ipVersion = isIP(normalized);
  if (ipVersion === 4) {
    return isNonPublicIpv4Host(normalized);
  }

  if (ipVersion === 6) {
    return isPrivateIpv6Host(normalized);
  }

  return false;
};

const resolvesToPrivateOrLocalHost = async (hostname: string): Promise<boolean> => {
  const normalized = hostname.trim().toLowerCase();
  if (isIP(normalized) !== 0) {
    return false;
  }

  try {
    const resolved = await dnsLookup(normalized, {
      all: true,
      verbatim: true,
    });
    if (resolved.length === 0) {
      return true;
    }

    return resolved.some((entry) => isPrivateOrLocalHost(entry.address));
  } catch {
    return true;
  }
};

export const normalizeProvisioningUpstreamUrl = async (
  value: string,
  fieldName: 'graphql_base_url' | 'oauth_token_url'
): Promise<string> => {
  const parsed = parseUpstreamUrl(value);

  if (
    !parsed ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    parsed.protocol !== 'https:' ||
    isPrivateOrLocalHost(parsed.hostname) ||
    (await resolvesToPrivateOrLocalHost(parsed.hostname))
  ) {
    throw new MainserverUserProvisioningError({
      code: 'invalid_config',
      message: `Die konfigurierte Upstream-URL ${fieldName} ist ungültig.`,
      statusCode: 409,
    });
  }

  return parsed.toString();
};
