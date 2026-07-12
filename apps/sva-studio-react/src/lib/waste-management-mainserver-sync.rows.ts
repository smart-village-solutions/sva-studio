import type { SvaMainserverWasteSyncItem } from '@sva/sva-mainserver/server';

export type WasteSyncRow = SvaMainserverWasteSyncItem &
  Readonly<{
    key: string;
  }>;

const normalizeKeyPart = (value: string | undefined): string =>
  (value ?? '').trim().toLocaleLowerCase('de-DE');

export const buildWasteSyncKey = (item: {
  pickupDate: string;
  wasteType: string;
  street: string;
  city?: string;
}): string =>
  [
    item.pickupDate,
    normalizeKeyPart(item.wasteType),
    normalizeKeyPart(item.street),
    normalizeKeyPart(item.city),
  ].join('::');

export const toWasteSyncRow = (item: SvaMainserverWasteSyncItem): WasteSyncRow => ({
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
