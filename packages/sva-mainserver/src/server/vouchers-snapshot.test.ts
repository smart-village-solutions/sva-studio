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
