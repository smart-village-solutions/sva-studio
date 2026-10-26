import { createHash } from 'node:crypto';
import { z } from 'zod';
import { voucherPoiWriteFields } from '../generated/vouchers.js';
export type WriteShape = {
  readonly [key: string]: true | string | WriteShape;
};
export type RawRecord = Record<string, unknown>;
export const rawRecordSchema = z.record(z.string(), z.unknown());
export const raw = (value: unknown): RawRecord => rawRecordSchema.parse(value);
export const records = (value: unknown): RawRecord[] => z.array(rawRecordSchema).parse(value);
// Preserve exactly the fields selected for the existing nested write contract.
// Absent selections are a degraded read, not instructions to delete that data.
export const voucherWriteSnapshot = (
  value: unknown,
  shape: WriteShape = voucherPoiWriteFields,
  complete = true
): unknown => {
  if (value === null) return undefined;
  if (Array.isArray(value)) return value.map((item) => voucherWriteSnapshot(item, shape, complete));
  const source = raw(value);
  return Object.fromEntries(
    Object.entries(shape)
      .filter(([key]) => {
        if (complete && !Object.prototype.hasOwnProperty.call(source, key))
          throw new Error('voucher_snapshot_incomplete');
        // Mainserver's AnyPrimitive input persists an error string for explicit null dimensions.
        if (source[key] === null && (key === 'height' || key === 'width')) return false;
        return Object.prototype.hasOwnProperty.call(source, key);
      })
      .map(([key, field]) => {
        const current = source[key];
        return [
          key,
          field === true || typeof field === 'string'
            ? current
            : voucherWriteSnapshot(current, field, complete),
        ];
      })
  );
};
const sorted = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sorted(v)])
    );
  return value;
};
export const voucherSnapshotHash = (value: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(sorted(value)))
    .digest('hex');
export const assertVoucherPoiWritable = (
  poi: RawRecord,
  categories: readonly RawRecord[]
): void => {
  if (poi.payload != null && !rawRecordSchema.safeParse(poi.payload).success)
    throw new Error('voucher_snapshot_incomplete');
  const provider = raw(poi.dataProvider);
  // The corrected Mainserver preserves announcements for every provider type.
  // POI inverse category membership is itself active-filtered. Fail closed if
  // any inactive category could hide a relationship; never drop it silently.
  if (categories.some((category) => category.active !== true))
    throw new Error('voucher_inactive_categories');
  const ids = new Set<string>();
  for (const item of records(poi.vouchers)) {
    if (raw(item.dataProvider).id !== provider.id) throw new Error('voucher_ownership_conflict');
    if (item.genericType !== 'Voucher') throw new Error('voucher_snapshot_incomplete');
    for (const key of ['genericItems', 'genericItemMessages', 'pushNotifications']) {
      if (records(item[key]).length) throw new Error('voucher_dependents_unsupported');
    }
    if (item.likeCount !== 0) throw new Error('voucher_dependents_unsupported');
    const id = item.payload == null ? undefined : raw(item.payload).id;
    if (id != null && typeof id !== 'string') throw new Error('voucher_identity_conflict');
    if (typeof id === 'string' && id) {
      if (ids.has(id)) throw new Error('voucher_identity_conflict');
      ids.add(id);
    }
  }
  voucherWriteSnapshot(poi);
};
// GraphQL may add nullable/default fields, but every submitted value must survive.
export const voucherWriteMatches = (actual: unknown, expected: unknown): boolean => {
  if (expected === undefined) return true;
  if (Array.isArray(expected))
    return (
      Array.isArray(actual) &&
      expected.length === actual.length &&
      expected.every((item, index) => voucherWriteMatches(actual[index], item))
    );
  if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) return false;
    return Object.entries(expected).every(([key, value]) =>
      voucherWriteMatches((actual as RawRecord)[key], value)
    );
  }
  return actual === expected;
};

export const voucherContentFingerprint = (voucher: RawRecord): string =>
  voucherSnapshotHash({
    id: voucher.id,
    pointOfInterest: voucher.pointOfInterest,
    dataProvider: voucher.dataProvider,
    content: voucherWriteSnapshot(voucher, voucherPoiWriteFields.vouchers),
  });
