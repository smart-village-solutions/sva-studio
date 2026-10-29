import { z } from 'zod';
import { sanitizeRichTextHtml } from '@sva/core/rich-text-html';
import type { VoucherInput } from '../types-vouchers.js';
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  });
const amount = z.number().finite().nonnegative();
export const voucherInputSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    teaser: z.string().max(10000),
    body: z.string().max(100000),
    pointOfInterestIds: z.array(z.string().regex(/^\d+$/)).length(1),
    discountMode: z.enum(['percentage', 'amount', 'price']),
    discountValue: amount,
    originalPrice: amount.optional(),
    maxQuantity: z.number().int().positive().max(2147483647),
    maxPerPerson: z.number().int().positive().max(2147483647).optional(),
    frequency: z.enum(['once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
    dateStart: date.optional(),
    dateEnd: date.optional(),
    visible: z.boolean(),
    categories: z.array(z.object({ name: z.string().trim().min(1) }).strict()).max(50),
    mediaContents: z
      .array(
        z
          .object({
            contentType: z.literal('image'),
            hostMediaAssetId: z.string().uuid().optional(),
            captionText: z.string().optional(),
            copyright: z.string().optional(),
            sourceUrl: z
              .object({
                url: z
                  .string()
                  .url()
                  .refine((url) => /^https?:\/\//.test(url)),
                description: z.string().max(2000).optional(),
              })
              .strict(),
          })
          .strict()
      )
      .max(50),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (
      input.discountMode === 'percentage' &&
      (input.discountValue <= 0 || input.discountValue > 100)
    ) {
      ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'invalid_percentage' });
    }
    if (
      input.discountMode === 'price' &&
      (input.originalPrice === undefined || input.discountValue > input.originalPrice)
    ) {
      ctx.addIssue({ code: 'custom', path: ['discountValue'], message: 'invalid_price' });
    }
    if (input.dateStart && input.dateEnd && input.dateEnd < input.dateStart) {
      ctx.addIssue({ code: 'custom', path: ['dateEnd'], message: 'invalid_date_range' });
    }
  });
export const toVoucherFields = (input: VoucherInput) => ({
  genericType: 'Voucher',
  title: input.title,
  teaser: input.teaser,
  visible: input.visible,
  contentBlocks: [{ body: input.body }],
  categories: input.categories,
  mediaContents: input.mediaContents.map(({ hostMediaAssetId, ...item }) => ({
    ...item,
    payload: { studioMediaAssetId: hostMediaAssetId ?? null } as Record<string, unknown>,
  })),
  discountType: {
    originalPrice: null,
    discountedPrice: null,
    discountPercentage: null,
    discountAmount: null,
    ...(input.discountMode === 'percentage'
      ? { discountPercentage: input.discountValue }
      : input.discountMode === 'amount'
        ? { discountAmount: input.discountValue }
        : { originalPrice: input.originalPrice, discountedPrice: input.discountValue }),
  },
  quota: {
    maxQuantity: input.maxQuantity,
    maxPerPerson: input.maxPerPerson ?? null,
    frequency: input.frequency,
  },
  dates:
    input.dateStart || input.dateEnd
      ? [{ dateStart: input.dateStart ?? null, dateEnd: input.dateEnd ?? null }]
      : [],
});
export const voucherHasContentChanges = (
  stored: Readonly<Record<string, unknown>>,
  input: VoucherInput
): boolean => {
  const discount = object(stored.discountType);
  const expected = toVoucherFields(input);
  const quota = object(stored.quota);
  const date = list(stored.dates)[0] ?? {};
  const observed = {
    title: stored.title ?? '',
    teaser: stored.teaser ?? '',
    body: list(stored.contentBlocks)[0]?.body ?? '',
    visible: stored.visible,
    discount: ['discountPercentage', 'discountAmount', 'originalPrice', 'discountedPrice'].map(
      (key) => discount[key] ?? null
    ),
    quota: [quota.maxQuantity, quota.maxPerPerson ?? null, quota.frequency],
    date: [date.dateStart ?? null, date.dateEnd ?? null],
    categories: list(stored.categories).map((item) => item.name),
    media: media(list(stored.mediaContents)),
  };
  const intended = {
    title: input.title,
    teaser: input.teaser,
    body: sanitizeRichTextHtml(input.body),
    visible: input.visible,
    discount: ['discountPercentage', 'discountAmount', 'originalPrice', 'discountedPrice'].map(
      (key) => object(expected.discountType)[key] ?? null
    ),
    quota: [input.maxQuantity, input.maxPerPerson ?? null, input.frequency],
    date: [input.dateStart ?? null, input.dateEnd ?? null],
    categories: input.categories.map((item) => item.name),
    media: media(expected.mediaContents),
  };
  return JSON.stringify(observed) !== JSON.stringify(intended);
};
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.map(object) : [];
const media = (items: readonly Record<string, unknown>[]) =>
  items.map((item) => ({
    contentType: item.contentType ?? 'image',
    captionText: item.captionText ?? '',
    copyright: item.copyright ?? '',
    url: object(item.sourceUrl).url ?? '',
    description: object(item.sourceUrl).description ?? '',
    assetId: object(item.payload).studioMediaAssetId ?? null,
  }));
