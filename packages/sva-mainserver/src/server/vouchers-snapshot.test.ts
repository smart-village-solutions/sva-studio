import {
  buildClientSchema,
  coerceInputValue,
  isInputObjectType,
  parse,
  validate,
  type IntrospectionQuery,
} from 'graphql';
import { describe, expect, it } from 'vitest';
import snapshot from '../generated/schema.snapshot.json';
import {
  voucherDetailDocument,
  voucherListDocument,
  voucherPoiDocument,
  voucherWriteDocument,
} from '../generated/vouchers.js';
import {
  assertVoucherPoiWritable,
  voucherSnapshotHash,
  voucherWriteMatches,
  voucherWriteSnapshot,
} from './vouchers-snapshot.js';
describe('voucher aggregate snapshot', () => {
  it.each([voucherDetailDocument, voucherListDocument, voucherPoiDocument, voucherWriteDocument])(
    'uses the existing GraphQL schema',
    (document) => {
      const schema = buildClientSchema(snapshot.data as unknown as IntrospectionQuery);
      expect(validate(schema, parse(document)).map((error) => error.message)).toEqual([]);
    }
  );
  it('accepts the optional nested database ID in the corrected Mainserver input', () => {
    const schema = buildClientSchema(snapshot.data as unknown as IntrospectionQuery);
    const input = schema.getType('GenericItemInput');
    if (!isInputObjectType(input)) throw new Error('Missing GenericItemInput');
    expect(coerceInputValue({ id: '2', genericType: 'Voucher' }, input)).toEqual({
      id: '2',
      genericType: 'Voucher',
    });
  });
  it('rejects missing field groups instead of silently deleting them', () => {
    expect(() => voucherWriteSnapshot({ name: 'Ort' })).toThrow('voucher_snapshot_incomplete');
    expect(
      voucherWriteSnapshot(
        { payload: { opaque: 1 }, contact: null },
        { payload: true, contact: { email: true } }
      )
    ).toEqual({ payload: { opaque: 1 }, contact: undefined });
    expect(
      JSON.stringify(voucherWriteSnapshot({ contact: null }, { contact: { email: true } }))
    ).toBe('{}');
  });
  it('keeps arbitrary payload keys and ignores key order in fingerprints', () => {
    expect(voucherSnapshotHash({ a: 1, payload: { b: 2, a: 1 } })).toBe(
      voucherSnapshotHash({ payload: { a: 1, b: 2 }, a: 1 })
    );
  });
  it('omits empty media dimensions without clearing other nullable fields', () => {
    const shape = {
      mediaContents: { contentType: true, height: true, width: true },
      discountType: { discountPercentage: true, discountAmount: true },
    } as const;
    const value = {
      mediaContents: [{ contentType: 'image', height: null, width: null }],
      discountType: { discountPercentage: 20, discountAmount: null },
    };
    const write = voucherWriteSnapshot(value, shape);
    expect(JSON.parse(JSON.stringify(write))).toEqual({
      mediaContents: [{ contentType: 'image' }],
      discountType: { discountPercentage: 20, discountAmount: null },
    });
    expect(voucherWriteMatches(value, write)).toBe(true);
  });
  it('preserves real image dimensions and rejects changed readback values', () => {
    const value = { height: 0, width: 640 };
    const write = voucherWriteSnapshot(value, { height: true, width: true });
    expect(write).toEqual(value);
    expect(voucherWriteMatches({ height: 0, width: 320 }, write)).toBe(false);
  });
  it('reprojects nullable groups without accepting incomplete provider reads', () => {
    const shape = {
      contact: { email: true },
      mediaContents: { sourceUrl: { url: true }, height: true, width: true },
    } as const;
    const first = voucherWriteSnapshot(
      { contact: null, mediaContents: [{ sourceUrl: null, height: null, width: null }] },
      shape
    );
    const second = voucherWriteSnapshot(first, shape, false);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(() => voucherWriteSnapshot(first, shape)).toThrow();
    expect(() => voucherWriteSnapshot({}, shape)).toThrow('voucher_snapshot_incomplete');
    expect(() => voucherWriteSnapshot([undefined], shape, false)).toThrow();
  });
  it('still blocks filtered inactive categories for regular providers', () => {
    expect(() =>
      assertVoucherPoiWritable({ dataProvider: { id: '1', dataType: 'cms' } }, [{ active: false }])
    ).toThrow('voucher_inactive_categories');
  });
  it('blocks foreign ownership and user-generated dependents before writing', () => {
    const poi = {
      dataProvider: { id: '1', dataType: 'business_account' },
      vouchers: [{ dataProvider: { id: '2' } }],
    };
    expect(() => assertVoucherPoiWritable(poi, [])).toThrow('voucher_ownership_conflict');
  });
});
