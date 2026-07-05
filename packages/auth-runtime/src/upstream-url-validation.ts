import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const localhostHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

type Ipv4Octets = readonly [number, number, number, number];
type Ipv4Range = readonly [number, number];

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

const parseIpv4Octets = (hostname: string): Ipv4Octets | null => {
  const octets = hostname.split('.').map((segment) => Number.parseInt(segment, 10));
  if (octets.length !== 4 || octets.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return null;
  }

  const [first, second, third, fourth] = octets;
  return [first, second, third, fourth];
};

const toIpv4Number = ([a, b, c, d]: Ipv4Octets): number => ((a * 256 + b) * 256 + c) * 256 + d;

const createIpv4Range = (start: Ipv4Octets, end: Ipv4Octets): Ipv4Range => [
  toIpv4Number(start),
  toIpv4Number(end),
];

const nonPublicIpv4Ranges: readonly Ipv4Range[] = [
  createIpv4Range([0, 0, 0, 0], [0, 255, 255, 255]),
  createIpv4Range([10, 0, 0, 0], [10, 255, 255, 255]),
  createIpv4Range([100, 64, 0, 0], [100, 127, 255, 255]),
  createIpv4Range([127, 0, 0, 0], [127, 255, 255, 255]),
  createIpv4Range([169, 254, 0, 0], [169, 254, 255, 255]),
  createIpv4Range([172, 16, 0, 0], [172, 31, 255, 255]),
  createIpv4Range([192, 0, 0, 0], [192, 0, 0, 255]),
  createIpv4Range([192, 0, 2, 0], [192, 0, 2, 255]),
  createIpv4Range([192, 88, 99, 0], [192, 88, 99, 255]),
  createIpv4Range([192, 168, 0, 0], [192, 168, 255, 255]),
  createIpv4Range([198, 18, 0, 0], [198, 19, 255, 255]),
  createIpv4Range([198, 51, 100, 0], [198, 51, 100, 255]),
  createIpv4Range([203, 0, 113, 0], [203, 0, 113, 255]),
  createIpv4Range([224, 0, 0, 0], [255, 255, 255, 255]),
];

const isNonPublicIpv4Host = (hostname: string): boolean => {
  const octets = parseIpv4Octets(hostname);
  if (!octets) {
    return true;
  }

  const address = toIpv4Number(octets);
  return nonPublicIpv4Ranges.some(([start, end]) => address >= start && address <= end);
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

const isNonPublicIpv6Host = (hostname: string): boolean => {
  const mappedIpv4Host = toMappedIpv4Host(hostname);
  if (mappedIpv4Host) {
    return isPrivateOrLocalHost(mappedIpv4Host);
  }

  if (hostname.startsWith('::ffff:')) {
    return true;
  }

  const firstHextet = Number.parseInt(hostname.split(':', 1)[0] ?? '', 16);
  return (
    hostname === '::1' ||
    hostname === '::' ||
    (!Number.isNaN(firstHextet) &&
      ((firstHextet >= 0xfc00 && firstHextet <= 0xfdff) ||
        (firstHextet >= 0xfe80 && firstHextet <= 0xfebf) ||
        (firstHextet >= 0xfec0 && firstHextet <= 0xfeff)))
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
    return isNonPublicIpv6Host(normalized);
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

export const normalizePublicUpstreamUrl = async (value: string): Promise<string | null> => {
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
    return null;
  }

  return parsed.toString();
};
