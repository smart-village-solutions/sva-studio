export const stableWasteAnnualSerialize = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableWasteAnnualSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableWasteAnnualSerialize(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const sha256 = async (value: string): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const buildWasteAnnualTourTransferFingerprint = async (value: unknown): Promise<string> =>
  `sha256:${await sha256(stableWasteAnnualSerialize(value))}`;

const toStableUuid = (hash: string): string => {
  const chars = hash.slice(0, 32).split('');
  chars[12] = '5';
  chars[16] = ((Number.parseInt(chars[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  const compact = chars.join('');
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20, 32)}`;
};

export const deriveWasteAnnualTourTransferId = async (
  ...parts: readonly string[]
): Promise<string> => toStableUuid(await sha256(parts.join('\u001f')));
