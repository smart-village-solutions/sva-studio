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

const collectSyncKeys = (
  rows: readonly WasteSyncRow[],
  toKey: (row: WasteSyncRow) => string
): Set<string> => {
  const keys = new Set<string>();
  for (const row of rows) keys.add(toKey(row));
  return keys;
};

export const buildWasteSyncPlan = (
  studioRows: readonly WasteSyncRow[],
  mainserverRows: readonly WasteSyncRow[]
) => {
  const studioByKey = collectSyncKeys(studioRows, (row) => row.key);
  const mainserverByKey = collectSyncKeys(mainserverRows, (row) => row.key);
  const studioCompatibilityKeysWithoutZip = collectSyncKeys(
    studioRows.filter((row) => !row.zip?.trim()),
    buildWasteSyncCompatibilityKey
  );
  const mainserverCompatibilityKeys =
    studioCompatibilityKeysWithoutZip.size > 0
      ? collectSyncKeys(mainserverRows, buildWasteSyncCompatibilityKey)
      : undefined;

  const createItems = studioRows
    .filter(
      (row) =>
        !mainserverByKey.has(row.key) &&
        (Boolean(row.zip?.trim()) ||
          !mainserverCompatibilityKeys?.has(buildWasteSyncCompatibilityKey(row)))
    )
    .map(({ key: _key, ...row }) => row);
  const deleteItems = mainserverRows
    .filter(
      (row) =>
        !studioByKey.has(row.key) &&
        (studioCompatibilityKeysWithoutZip.size === 0 ||
          !studioCompatibilityKeysWithoutZip.has(buildWasteSyncCompatibilityKey(row)))
    )
    .map(({ key: _key, ...row }) => row);
  return {
    studioCount: studioRows.length,
    mainserverCount: mainserverRows.length,
    createItems,
    deleteItems,
  };
};
