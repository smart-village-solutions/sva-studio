import { describe, expect, it } from 'vitest';
import { toVoucherFields, voucherHasContentChanges, voucherInputSchema } from './vouchers-model.js';
const valid = {
  title: 'Eintritt',
  teaser: '',
  body: '',
  pointOfInterestIds: ['1'],
  discountMode: 'percentage',
  discountValue: 20,
  maxQuantity: 100,
  frequency: 'monthly',
  visible: false,
  categories: [],
  mediaContents: [],
};
describe('voucher write contract', () => {
  it('accepts exactly one location and emits only the selected discount', () => {
    const input = voucherInputSchema.parse(valid);
    expect(toVoucherFields(input).discountType).toEqual({ discountPercentage: 20 });
    expect(voucherInputSchema.safeParse({ ...valid, pointOfInterestIds: ['1', '2'] }).success).toBe(
      false
    );
  });
  it.each([
    { discountValue: 101 },
    { maxQuantity: 0 },
    { maxPerPerson: -1 },
    { dateStart: '2026-02-30' },
    { dateStart: '2026-10-24', dateEnd: '2026-10-23' },
    { discountMode: 'price', originalPrice: 10, discountValue: 15 },
    { payload: { id: 'forged' } },
  ])('rejects unsafe input %j', (patch) => {
    expect(voucherInputSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});
it('does not reset unchanged authored content because usage or unedited metadata changed', () => {
  const input = voucherInputSchema.parse(valid);
  const stored = {
    ...toVoucherFields(input),
    quota: { ...toVoucherFields(input).quota, availableQuantity: 63 },
    payload: { id: 'uuid', opaque: 'keep' },
    contentBlocks: [{ body: '', title: 'Keep title' }],
  };
  expect(voucherHasContentChanges(stored, input)).toBe(false);
  expect(voucherHasContentChanges(stored, { ...input, title: 'Changed' })).toBe(true);
});
