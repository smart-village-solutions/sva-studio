import type { VoucherInput, VoucherRecord } from './vouchers.types.js';
type Numbers = 'discountValue' | 'originalPrice' | 'maxQuantity' | 'maxPerPerson';
export type VoucherDraft = Omit<VoucherInput, Numbers> & Record<Numbers, string>;
export const emptyVoucherDraft = (): VoucherDraft => ({
  title: '',
  teaser: '',
  body: '',
  pointOfInterestIds: [],
  discountMode: 'percentage',
  discountValue: '',
  originalPrice: '',
  maxQuantity: '',
  maxPerPerson: '',
  frequency: 'once',
  dateStart: '',
  dateEnd: '',
  visible: false,
  categories: [],
  mediaContents: [],
});
export const parseVoucherDraft = (draft: VoucherDraft): VoucherInput => ({
  ...draft,
  title: draft.title.trim(),
  discountValue: Number(draft.discountValue.replace(',', '.')),
  originalPrice:
    draft.originalPrice === '' ? undefined : Number(draft.originalPrice.replace(',', '.')),
  maxQuantity: Number(draft.maxQuantity),
  maxPerPerson: draft.maxPerPerson === '' ? undefined : Number(draft.maxPerPerson),
  dateStart: draft.dateStart || undefined,
  dateEnd: draft.dateEnd || undefined,
});
export const voucherDraftErrors = (draft: VoucherDraft): readonly string[] => {
  const result: string[] = [];
  const parsed = parseVoucherDraft(draft);
  if (!parsed.title.trim() || parsed.title.length > 500) result.push('title');
  if (parsed.pointOfInterestIds.length !== 1) result.push('location');
  if (invalidDiscount(draft, parsed)) result.push('discountValue');
  if (invalidQuantity(parsed.maxQuantity)) result.push('maxQuantity');
  if (parsed.maxPerPerson !== undefined && invalidQuantity(parsed.maxPerPerson))
    result.push('maxPerPerson');
  if (!['once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(parsed.frequency))
    result.push('frequency');
  if (parsed.dateStart && parsed.dateEnd && parsed.dateEnd < parsed.dateStart)
    result.push('dateEnd');
  return result;
};
export const voucherToDraft = (item: VoucherRecord): VoucherDraft => {
  const d = item.discountType;
  const percentage = d?.discountPercentage != null;
  const amount = d?.discountAmount != null;
  return {
    ...emptyVoucherDraft(),
    title: item.title,
    teaser: item.teaser,
    body: item.contentBlocks[0]?.body ?? '',
    pointOfInterestIds: item.pointOfInterest ? [item.pointOfInterest.id] : [],
    discountMode: percentage ? 'percentage' : amount ? 'amount' : 'price',
    discountValue: String(
      (percentage ? d?.discountPercentage : amount ? d?.discountAmount : d?.discountedPrice) ?? ''
    ),
    originalPrice: d?.originalPrice == null ? '' : String(d.originalPrice),
    maxQuantity: item.quota?.maxQuantity == null ? '' : String(item.quota.maxQuantity),
    maxPerPerson: item.quota?.maxPerPerson == null ? '' : String(item.quota.maxPerPerson),
    frequency: (['once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(
      item.quota?.frequency ?? ''
    )
      ? item.quota?.frequency
      : '') as VoucherDraft['frequency'],
    dateStart: item.dates[0]?.dateStart ?? '',
    dateEnd: item.dates[0]?.dateEnd ?? '',
    visible: item.visible,
    categories: item.categories,
    mediaContents: item.mediaContents,
  };
};
const invalidQuantity = (value: number) =>
  !Number.isSafeInteger(value) || value <= 0 || value > 2147483647;
function invalidDiscount(draft: VoucherDraft, parsed: VoucherInput): boolean {
  return (
    !/^\d+([,.]\d{1,2})?$/.test(draft.discountValue) ||
    (parsed.discountMode === 'percentage' &&
      (parsed.discountValue <= 0 || parsed.discountValue > 100)) ||
    (parsed.discountMode === 'price' &&
      (parsed.originalPrice === undefined ||
        !/^\d+([,.]\d{1,2})?$/.test(draft.originalPrice) ||
        parsed.discountValue > parsed.originalPrice))
  );
}
