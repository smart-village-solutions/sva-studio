import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { z } from 'zod';

import { SvaMainserverError } from './errors';

const localhostHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

const upstreamUrlSchema = z.string().trim().url().transform((value) => new URL(value)).superRefine((value, context) => {
  if (value.username || value.password) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Credentials in Upstream-URLs sind nicht erlaubt.',
    });
  }

  if (value.hash) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'URL-Fragmente sind für Upstream-Endpunkte nicht erlaubt.',
    });
  }

  if (value.protocol !== 'https:') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Erlaubt sind ausschließlich https-URLs für Upstream-Endpunkte.',
    });
  }

  if (isPrivateOrLocalHost(value.hostname)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Lokale oder private Upstream-Hosts sind nicht erlaubt.',
    });
  }
});

const isPrivateOrLocalHost = (hostname: string): boolean => {
  const normalized = hostname.trim().toLowerCase();
  if (localhostHosts.has(normalized) || normalized.endsWith('.local')) {
    return true;
  }

  const unbracketed = normalized.startsWith('[') && normalized.endsWith(']')
    ? normalized.slice(1, -1)
    : normalized;

  if (unbracketed !== normalized) {
    return isPrivateOrLocalHost(unbracketed);
  }

  const ipVersion = isIP(normalized);
  if (ipVersion === 4) {
    const octets = normalized.split('.').map((segment) => Number.parseInt(segment, 10));
    if (octets.length !== 4 || octets.some((part) => Number.isNaN(part))) {
      return true;
    }

    const [a, b] = octets;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }

  if (ipVersion === 6) {
    if (normalized.startsWith('::ffff:')) {
      const mappedPart = normalized.slice('::ffff:'.length);
      if (isIP(mappedPart) === 4) {
        return isPrivateOrLocalHost(mappedPart);
      }

      const hexParts = mappedPart.split(':');
      if (hexParts.length === 2) {
        const high = Number.parseInt(hexParts[0], 16);
        const low = Number.parseInt(hexParts[1], 16);
        if (!Number.isNaN(high) && !Number.isNaN(low)) {
          const dotted = [
            (high >> 8) & 0xff,
            high & 0xff,
            (low >> 8) & 0xff,
            low & 0xff,
          ].join('.');
          return isPrivateOrLocalHost(dotted);
        }
      }

      return true;
    }

    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:')
    );
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

export const normalizeSvaMainserverUpstreamUrl = async (
  value: string,
  fieldName: 'graphql_base_url' | 'oauth_token_url',
  statusCode: number
): Promise<string> => {
  const parsed = upstreamUrlSchema.safeParse(value);
  if (!parsed.success || (await resolvesToPrivateOrLocalHost(parsed.data.hostname))) {
    throw new SvaMainserverError({
      code: 'invalid_config',
      message: `Die konfigurierte Upstream-URL ${fieldName} ist ungültig.`,
      statusCode,
    });
  }

  return parsed.data.toString();
};
