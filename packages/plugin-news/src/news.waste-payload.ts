import type { NewsContentItem, WasteLocationKey } from './news.types.js';

const isWasteLocationKey = (value: unknown): value is WasteLocationKey => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.street === 'string' &&
    typeof candidate.zip === 'string' &&
    typeof candidate.city === 'string'
  );
};

const normalizeWasteLocationKey = (key: WasteLocationKey): WasteLocationKey => ({
  street: key.street.trim(),
  zip: key.zip.trim(),
  city: key.city.trim(),
});

const wasteLocationKeyIdentity = (key: WasteLocationKey): string =>
  JSON.stringify([key.street, key.zip, key.city]);

export const deduplicateWasteLocationKeys = (keys: unknown): WasteLocationKey[] => {
  if (!Array.isArray(keys)) {
    return [];
  }

  const result = new Map<string, WasteLocationKey>();
  for (const value of keys) {
    if (!isWasteLocationKey(value)) continue;
    const key = normalizeWasteLocationKey(value);
    if (!key.street || !key.zip || !key.city) continue;
    result.set(wasteLocationKeyIdentity(key), key);
  }
  return [...result.values()];
};

export const mergeNewsWasteLocationKeys = (
  existingPayload: NewsContentItem['payload'] | undefined,
  keys: readonly WasteLocationKey[]
): NewsContentItem['payload'] | undefined => {
  const nextPayload = { ...(existingPayload ?? {}) };
  const normalizedKeys = deduplicateWasteLocationKeys(keys);
  const removesExistingWasteLocationKeys =
    existingPayload !== undefined &&
    'wasteLocationKeys' in existingPayload &&
    normalizedKeys.length === 0;
  if (normalizedKeys.length === 0) {
    delete nextPayload.wasteLocationKeys;
  } else {
    nextPayload.wasteLocationKeys = normalizedKeys;
  }
  return Object.keys(nextPayload).length > 0 || removesExistingWasteLocationKeys
    ? nextPayload
    : undefined;
};

export const requiresGlobalPushConfirmation = (input: {
  readonly pushNotificationEnabled: boolean;
  readonly targetCount: number;
  readonly pushNotificationsSentAt?: string;
}): boolean =>
  input.pushNotificationEnabled &&
  input.targetCount === 0 &&
  !input.pushNotificationsSentAt;

export type WasteTargetingAvailability = 'available' | 'forbidden' | 'load-error' | 'loading';

export const resolveGlobalPushConfirmationKey = (
  availability: WasteTargetingAvailability
):
  | 'targeting.globalConfirm.noTargets'
  | 'targeting.globalConfirm.forbidden'
  | 'targeting.globalConfirm.loadError' => {
  if (availability === 'available') return 'targeting.globalConfirm.noTargets';
  if (availability === 'forbidden') return 'targeting.globalConfirm.forbidden';
  return 'targeting.globalConfirm.loadError';
};
