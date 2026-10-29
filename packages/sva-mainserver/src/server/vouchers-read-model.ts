import { z } from 'zod';
export const voucherRecordSchema = z.object({
  id: z.string(),
  title: z
    .string()
    .nullish()
    .transform((v) => v ?? ''),
  teaser: z
    .string()
    .nullish()
    .transform((v) => v ?? ''),
  genericType: z.literal('Voucher'),
  visible: z.boolean(),
  payload: z
    .record(z.string(), z.unknown())
    .nullish()
    .transform((v) => v ?? {}),
  pointOfInterest: z.object({ id: z.string(), name: z.string() }).nullable(),
  dataProvider: z.object({ id: z.string() }).nullable(),
  quota: z
    .object({
      maxQuantity: z.number().nullable(),
      availableQuantity: z.number().nullable(),
      maxPerPerson: z.number().nullable(),
      frequency: z.string().nullable(),
    })
    .nullable(),
  discountType: z
    .object({
      originalPrice: z.number().nullable(),
      discountedPrice: z.number().nullable(),
      discountPercentage: z.number().nullable(),
      discountAmount: z.number().nullable(),
    })
    .nullable(),
  contentBlocks: z.array(z.object({ body: z.string().nullish() })),
  dates: z.array(z.object({ dateStart: z.string().nullish(), dateEnd: z.string().nullish() })),
  categories: z.array(z.object({ name: z.string() })),
  mediaContents: z.array(
    z
      .object({
        payload: z.record(z.string(), z.unknown()).nullish(),
        contentType: z.string(),
        captionText: z
          .string()
          .nullish()
          .transform((v) => v ?? undefined),
        copyright: z
          .string()
          .nullish()
          .transform((v) => v ?? undefined),
        sourceUrl: z.object({
          url: z.string(),
          description: z
            .string()
            .nullish()
            .transform((value) => value ?? undefined),
        }),
      })
      .transform(({ payload, ...item }) => ({
        ...item,
        ...(typeof payload?.studioMediaAssetId === 'string'
          ? { hostMediaAssetId: payload.studioMediaAssetId }
          : {}),
      }))
  ),
});
