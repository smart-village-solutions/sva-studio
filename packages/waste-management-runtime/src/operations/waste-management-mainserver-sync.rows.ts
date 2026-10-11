import type { WasteMainserverSyncItem } from '@sva/waste-management-contracts';

export type WasteSyncRow = WasteMainserverSyncItem &
  Readonly<{
    key: string;
  }>;

const normalizeKeyPart = (value: string | undefined): string =>
  (value ?? '').trim().toLocaleLowerCase('de-DE');

type WasteSyncKeyInput = {
  pickupDate: string;
  wasteType: string;
  street: string;
  zip?: string;
  city?: string;
  note?: string;
};

export const buildWasteSyncKey = (item: WasteSyncKeyInput): string =>
  [
    item.pickupDate,
    normalizeKeyPart(item.wasteType),
    normalizeKeyPart(item.street),
    normalizeKeyPart(item.zip),
    normalizeKeyPart(item.city),
    normalizeKeyPart(item.note),
  ].join('::');

export const buildWasteSyncCompatibilityKey = (item: WasteSyncKeyInput): string =>
  [
    item.pickupDate,
    normalizeKeyPart(item.wasteType),
    normalizeKeyPart(item.street),
    normalizeKeyPart(item.city),
    normalizeKeyPart(item.note),
  ].join('::');

export const toWasteSyncRow = (item: WasteMainserverSyncItem): WasteSyncRow => ({
  ...item,
  key: buildWasteSyncKey(item),
});

export const chunkWasteSyncItems = <TItem>(
  items: readonly TItem[],
  batchSize: number
): readonly (readonly TItem[])[] => {
  if (items.length === 0) {
    return [];
  }

  const normalizedBatchSize = Math.max(1, batchSize);
  const batches: TItem[][] = [];
  for (let index = 0; index < items.length; index += normalizedBatchSize) {
    batches.push(items.slice(index, index + normalizedBatchSize));
  }
  return batches;
};
