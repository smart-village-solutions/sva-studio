import type { PoiCertificate } from './poi.content.types.js';

export const hasSubstantiveFields = <T extends Record<string, unknown>, K extends keyof T>(
  entry: T,
  ignoredKey: K
): boolean => Object.keys(entry).some((key) => key !== ignoredKey);

export const serializeCertificates = (values: readonly PoiCertificate[]) =>
  (values ?? [])
    .map(({ name }) => ({ name: name?.trim() }))
    .filter((entry): entry is PoiCertificate => Boolean(entry.name));

export const serializeTags = (value: string) =>
  value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

export const serializePayload = (payload: unknown): Partial<{ payload: unknown }> => {
  const isEmptyObject =
    payload !== null &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    Object.keys(payload).length === 0;
  return isEmptyObject ? {} : { payload };
};
