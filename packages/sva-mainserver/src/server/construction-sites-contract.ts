// Authoritative adapter input at the server trust boundary. Browser compatibility is tested independently.
import { z } from 'zod';

export const CONSTRUCTION_SITES_TYPE = 'construction-sites.construction-site' as const;
export const CONSTRUCTION_SITES_GENERIC_TYPE = 'ConstructionSite' as const;
const sourceIndex = z.number().int().nonnegative().max(10000).optional();
const text = z.string().max(100000);
const coordinate = (min: number, max: number) => z.number().finite().min(min).max(max).nullable();
export const constructionSiteDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });
const mediaSchema = z
  .object({
    sourceIndex,
    contentType: z.enum(['image', 'audio', 'video', 'logo', 'attachement']),
    hostMediaAssetId: z.string().uuid().optional(),
    sourceUrl: z
      .object({
        url: z
          .string()
          .url()
          .refine((value) => /^https?:\/\//i.test(value)),
        description: z.string().max(2000),
      })
      .strict(),
    captionText: z.string().max(10000),
    copyright: z.string().max(2000),
  })
  .strict();

export const constructionSiteInputSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    direction: z.string().max(2000),
    cause: z.string().max(10000),
    restrictions: z
      .array(z.object({ sourceIndex, description: z.string().max(10000) }).strict())
      .max(100),
    contentBlocks: z.array(z.object({ sourceIndex, body: text }).strict()).max(100),
    dates: z
      .array(z.object({ sourceIndex, dateStart: z.string(), dateEnd: z.string() }).strict())
      .min(1)
      .max(100),
    locations: z
      .array(
        z
          .object({
            sourceIndex,
            name: z.string().max(2000),
            latitude: coordinate(-90, 90),
            longitude: coordinate(-180, 180),
          })
          .strict()
      )
      .max(100),
    categories: z.array(z.object({ name: z.string().trim().min(1).max(1000) }).strict()).max(100),
    mediaContents: z.array(mediaSchema).max(100),
    visible: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    value.dates.forEach((date, index) => {
      for (const key of ['dateStart', 'dateEnd'] as const) {
        if ((index === 0 || date[key]) && !constructionSiteDateSchema.safeParse(date[key]).success)
          ctx.addIssue({ code: 'custom', path: ['dates', index, key], message: 'invalid_date' });
      }
      if (date.dateStart && date.dateEnd && date.dateEnd < date.dateStart)
        ctx.addIssue({
          code: 'custom',
          path: ['dates', index, 'dateEnd'],
          message: 'invalid_date_range',
        });
    });
    value.locations.forEach((location, index) => {
      if ((location.latitude === null) !== (location.longitude === null))
        ctx.addIssue({
          code: 'custom',
          path: ['locations', index, 'latitude'],
          message: 'incomplete_coordinates',
        });
    });
    for (const key of [
      'contentBlocks',
      'dates',
      'locations',
      'restrictions',
      'mediaContents',
    ] as const) {
      const indices = value[key].flatMap((item) =>
        item.sourceIndex === undefined ? [] : [item.sourceIndex]
      );
      if (new Set(indices).size !== indices.length)
        ctx.addIssue({ code: 'custom', path: [key], message: 'duplicate_source_index' });
    }
  });

export type ConstructionSiteInput = z.infer<typeof constructionSiteInputSchema>;
export type ConstructionSiteRecord = Readonly<{
  id: string;
  genericType: 'ConstructionSite';
  title: string;
  visible: boolean;
  updatedAt: string;
  input: ConstructionSiteInput;
  contentFingerprint: string;
  writeBlockedReason?: string;
  reconciliationRequired?: boolean;
  dataProvider?: Readonly<{ id: string; name?: string }>;
}>;
export type ConstructionSiteList = Readonly<{
  data: readonly ConstructionSiteRecord[];
  pagination: Readonly<{ page: number; pageSize: number; hasNextPage: boolean; total: number }>;
}>;
