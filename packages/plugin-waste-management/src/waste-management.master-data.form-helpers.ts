import type { WasteLocalizedTextRecord } from '@sva/plugin-sdk';

let localIdCounter = 0;

const formatUuidV4FromBytes = (bytes: Uint8Array): string => {
  const normalized = bytes.slice(0, 16);
  normalized[6] = ((normalized[6] ?? 0) & 0x0f) | 0x40;
  normalized[8] = ((normalized[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(normalized, (byte) => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
};

const createSecureRandomIdSegment = (): string | undefined => {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }
  if (!cryptoApi?.getRandomValues) {
    return undefined;
  }

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  return formatUuidV4FromBytes(bytes);
};

export const createId = (): string => {
  const secureId = createSecureRandomIdSegment();
  if (secureId) {
    return secureId;
  }

  localIdCounter += 1;
  const fallbackBytes = new Uint8Array(16);
  const timestamp = BigInt(Date.now());
  for (let index = 0; index < 8; index += 1) {
    const shift = BigInt((7 - index) * 8);
    fallbackBytes[index] = Number((timestamp >> shift) & 0xffn);
  }
  fallbackBytes[8] = (localIdCounter >>> 24) & 0xff;
  fallbackBytes[9] = (localIdCounter >>> 16) & 0xff;
  fallbackBytes[10] = (localIdCounter >>> 8) & 0xff;
  fallbackBytes[11] = localIdCounter & 0xff;
  fallbackBytes[12] = 0xaa;
  fallbackBytes[13] = 0xbb;
  fallbackBytes[14] = 0xcc;
  fallbackBytes[15] = 0xdd;
  return formatUuidV4FromBytes(fallbackBytes);
};

export const compactOptionalString = (value: string): string | undefined =>
  (value.trim() ? value.trim() : undefined);

export const normalizeLocalizedTextRecord = (
  value: WasteLocalizedTextRecord
): WasteLocalizedTextRecord | undefined => {
  const entries = Object.entries(value).flatMap(([locale, localizedValue]) => {
    const normalizedLocale = locale.trim();
    const normalizedValue = localizedValue.trim();
    return normalizedLocale && normalizedValue
      ? [[normalizedLocale, normalizedValue] as const]
      : [];
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};
