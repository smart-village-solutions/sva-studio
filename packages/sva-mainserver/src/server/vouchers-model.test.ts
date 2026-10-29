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
  it('accepts exactly one location and clears unselected discounts on the retained discount record', () => {
    const input = voucherInputSchema.parse(valid);
    expect(toVoucherFields(input).discountType).toEqual({
      originalPrice: null,
      discountedPrice: null,
      discountPercentage: 20,
      discountAmount: null,
    });
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

describe('voucher discount, date and media roundtrips', () => {
  it.each([
    { patch: { discountMode: 'amount', discountValue: 5 }, expected: { discountAmount: 5 } },
    {
      patch: { discountMode: 'price', originalPrice: 12, discountValue: 0 },
      expected: { originalPrice: 12, discountedPrice: 0 },
    },
  ])('emits exactly the chosen discount fields: $patch.discountMode', ({ patch, expected }) => {
    const input = voucherInputSchema.parse({ ...valid, ...patch });
    expect(toVoucherFields(input).discountType).toEqual({
      originalPrice: null,
      discountedPrice: null,
      discountPercentage: null,
      discountAmount: null,
      ...expected,
    });
  });
  it.each([
    { dateStart: '2026-01-01', dateEnd: undefined },
    { dateStart: undefined, dateEnd: '2026-12-31' },
    { dateStart: '2026-01-01', dateEnd: '2026-12-31' },
  ])('roundtrips optional date boundaries %j', (dates) => {
    const input = voucherInputSchema.parse({ ...valid, ...dates });
    const fields = toVoucherFields(input);
    expect(fields.dates).toEqual([
      { dateStart: dates.dateStart ?? null, dateEnd: dates.dateEnd ?? null },
    ]);
    expect(voucherHasContentChanges(fields, input)).toBe(false);
  });
  it.each([false, true])(
    'preserves media metadata without a destructive no-op when optional fields are present: %s',
    (withMetadata) => {
      const input = voucherInputSchema.parse({
        ...valid,
        maxPerPerson: 2,
        categories: [{ name: 'Kultur' }],
        mediaContents: [
          {
            contentType: 'image',
            ...(withMetadata
              ? {
                  hostMediaAssetId: '40000000-0000-4000-8000-000000000001',
                  captionText: 'Caption',
                  copyright: 'Credit',
                }
              : {}),
            sourceUrl: {
              url: 'https://example.test/image.jpg',
              ...(withMetadata ? { description: 'Alt text' } : {}),
            },
          },
        ],
      });
      const fields = toVoucherFields(input);
      expect(fields.mediaContents[0]?.payload).toEqual({
        studioMediaAssetId: withMetadata ? '40000000-0000-4000-8000-000000000001' : null,
      });
      expect(fields.mediaContents[0]?.captionText).toBe(withMetadata ? 'Caption' : undefined);
      expect(fields.mediaContents[0]?.copyright).toBe(withMetadata ? 'Credit' : undefined);
      expect(fields.mediaContents[0]?.sourceUrl).toEqual({
        url: 'https://example.test/image.jpg',
        ...(withMetadata ? { description: 'Alt text' } : {}),
      });
      expect(voucherHasContentChanges(fields, input)).toBe(false);
      expect(voucherHasContentChanges({ ...fields, mediaContents: [] }, input)).toBe(true);
    }
  );
  it.each([
    { discountMode: 'percentage', discountValue: 0 },
    { discountMode: 'price', originalPrice: undefined },
    { dateStart: '9999-99-99' },
    {
      mediaContents: [{ contentType: 'image', sourceUrl: { url: 'ftp://example.test/image.jpg' } }],
    },
  ])('rejects unusable discounts, dates and media protocols: %j', (patch) => {
    expect(voucherInputSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});
