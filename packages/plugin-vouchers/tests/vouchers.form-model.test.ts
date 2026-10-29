import { describe, expect, it } from 'vitest';
import {
  emptyVoucherDraft,
  parseVoucherDraft,
  voucherDraftErrors,
  voucherToDraft,
} from '../src/vouchers.form-model.js';
describe('voucher form', () => {
  it('accepts decimal comma without changing typed drafts', () => {
    const draft = {
      ...emptyVoucherDraft(),
      title: 'Eintritt',
      pointOfInterestIds: ['1'],
      discountValue: '12,50',
      maxQuantity: '100',
    };
    expect(voucherDraftErrors(draft)).toEqual([]);
    expect(parseVoucherDraft(draft).discountValue).toBe(12.5);
    expect(draft.discountValue).toBe('12,50');
  });
  it('marks missing fields instead of silently inventing limits', () => {
    expect(voucherDraftErrors(emptyVoucherDraft())).toEqual([
      'title',
      'location',
      'discountValue',
      'maxQuantity',
    ]);
  });
  it('rejects contradictory prices and negative personal limits', () => {
    const draft = {
      ...emptyVoucherDraft(),
      discountMode: 'price' as const,
      discountValue: '20',
      originalPrice: '10',
      maxPerPerson: '-1',
    };
    expect(voucherDraftErrors(draft)).toEqual(
      expect.arrayContaining(['discountValue', 'maxPerPerson'])
    );
  });
});

it('rejects a reversed date range, an unknown period, overflowing quantities and an out-of-range percentage', () => {
  const draft = {
    ...emptyVoucherDraft(),
    title: 'a'.repeat(501),
    discountValue: '101',
    maxQuantity: '2147483648',
    frequency: 'future' as 'once',
    dateStart: '2026-11-30',
    dateEnd: '2026-11-01',
  };
  expect(voucherDraftErrors(draft)).toEqual(
    expect.arrayContaining(['title', 'discountValue', 'maxQuantity', 'frequency', 'dateEnd'])
  );
});

it('preserves unknown legacy quota and empty fields for explicit correction rather than inventing defaults', () => {
  const empty = {
    id: '1',
    title: 'Altbestand',
    teaser: '',
    visible: false,
    payload: {},
    pointOfInterest: null,
    dataProvider: null,
    quota: null,
    discountType: null,
    contentBlocks: [],
    dates: [],
    categories: [],
    mediaContents: [],
  };
  expect(voucherToDraft(empty)).toMatchObject({
    frequency: '',
    maxQuantity: '',
    maxPerPerson: '',
    discountValue: '',
    body: '',
    pointOfInterestIds: [],
  });
  expect(
    voucherToDraft({
      ...empty,
      discountType: {
        discountAmount: 5,
        discountPercentage: null,
        discountedPrice: null,
        originalPrice: null,
      },
      quota: { frequency: 'unknown', maxQuantity: 10, availableQuantity: 3, maxPerPerson: null },
    })
  ).toMatchObject({ discountMode: 'amount', discountValue: '5', frequency: '' });
});
