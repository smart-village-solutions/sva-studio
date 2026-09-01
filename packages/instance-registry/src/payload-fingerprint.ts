import { createHash } from 'node:crypto';

const normalizeForFingerprint = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(normalizeForFingerprint);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entryValue]) => [key, normalizeForFingerprint(entryValue)])
    );
  }
  return value;
};

export const buildPayloadFingerprint = (payload: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(normalizeForFingerprint(payload)))
    .digest('hex');
