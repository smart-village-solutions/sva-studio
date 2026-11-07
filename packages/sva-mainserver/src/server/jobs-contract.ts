// Independent server boundary; browser compatibility is checked with shared fixtures.
import { z } from 'zod';

export const JOBS_TYPE = 'jobs.job' as const;
export const JOBS_GENERIC_TYPE = 'Job' as const;
const sourceIndex = z.number().int().nonnegative().max(10000).optional();
const text = z.string().max(100000);
const short = z.string().max(2000);
export const jobDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  });
const url = short.refine(
  (value) => !value || (/^https?:\/\//i.test(value) && z.url().safeParse(value).success)
);
export const jobContactSchema = z
  .object({
    sourceIndex,
    firstName: short,
    lastName: short,
    email: short.refine((value) => !value || z.email().safeParse(value).success),
    phone: short,
    fax: short,
    webUrls: z.array(z.object({ url, description: short }).strict()).max(100),
  })
  .strict();
const address = z
  .object({
    addition: short,
    street: short,
    zip: short,
    city: short,
    latitude: z.number().finite().min(-90).max(90).nullable(),
    longitude: z.number().finite().min(-180).max(180).nullable(),
  })
  .strict()
  .refine((value) => (value.latitude === null) === (value.longitude === null), {
    path: ['longitude'],
  });
const company = z
  .object({ sourceIndex, name: short, contact: jobContactSchema, address })
  .strict()
  .refine(
    (value) =>
      Boolean(value.name.trim()) ||
      ![
        value.contact.firstName,
        value.contact.lastName,
        value.contact.email,
        value.contact.phone,
        value.contact.fax,
        ...value.contact.webUrls.flatMap((item) => [item.url, item.description]),
        value.address.addition,
        value.address.street,
        value.address.zip,
        value.address.city,
        value.address.latitude,
        value.address.longitude,
      ].some((field) => field !== null && field !== ''),
    { path: ['name'] }
  );
export const jobInputSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    externalId: short,
    employmentType: z.string().trim().min(1).max(1000),
    publicationDate: jobDateSchema,
    dates: z
      .array(z.object({ sourceIndex, dateEnd: z.string() }).strict())
      .min(1)
      .max(100),
    contentBlocks: z.array(z.object({ sourceIndex, body: text }).strict()).max(100),
    contacts: z.array(jobContactSchema).max(100),
    companies: z.array(company).max(100),
    mediaContents: z
      .array(
        z
          .object({
            sourceIndex,
            contentType: z.enum(['image', 'audio', 'video', 'logo', 'attachement']),
            hostMediaAssetId: z.string().uuid().optional(),
            sourceUrl: z
              .object({ url: url.refine((value) => Boolean(value)), description: short })
              .strict(),
            captionText: z.string().max(10000),
            copyright: short,
          })
          .strict()
      )
      .max(100),
    visible: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    value.dates.forEach((date, index) => {
      if ((index === 0 || date.dateEnd) && !jobDateSchema.safeParse(date.dateEnd).success)
        ctx.addIssue({
          code: 'custom',
          path: ['dates', index, 'dateEnd'],
          message: 'invalid_date',
        });
    });
    if (value.dates[0]?.dateEnd && value.dates[0].dateEnd < value.publicationDate)
      ctx.addIssue({
        code: 'custom',
        path: ['dates', 0, 'dateEnd'],
        message: 'invalid_date_range',
      });
    for (const key of [
      'dates',
      'contentBlocks',
      'contacts',
      'companies',
      'mediaContents',
    ] as const) {
      const indices = value[key].flatMap((item) =>
        item.sourceIndex === undefined ? [] : [item.sourceIndex]
      );
      if (new Set(indices).size !== indices.length)
        ctx.addIssue({ code: 'custom', path: [key], message: 'duplicate_source_index' });
    }
  });
export type JobInput = z.infer<typeof jobInputSchema>;
export type JobRecord = Readonly<{
  id: string;
  genericType: 'Job';
  title: string;
  visible: boolean;
  updatedAt: string;
  input: JobInput;
  contentFingerprint: string;
  writeBlockedReason?: string;
  reconciliationRequired?: boolean;
  dataProvider: Readonly<{ id: string; name?: string }>;
}>;
export type JobList = Readonly<{
  data: readonly JobRecord[];
  pagination: Readonly<{ page: number; pageSize: number; hasNextPage: boolean; total: number }>;
}>;
export const emptyJobContact = (): JobInput['contacts'][number] => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  fax: '',
  webUrls: [],
});
export const emptyJobCompany = (): JobInput['companies'][number] => ({
  name: '',
  contact: emptyJobContact(),
  address: { addition: '', street: '', zip: '', city: '', latitude: null, longitude: null },
});
export function createJobDefaults(today: string): JobInput {
  const end = new Date(`${today}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 28);
  return {
    title: '',
    externalId: '',
    employmentType: '',
    publicationDate: today,
    dates: [{ dateEnd: end.toISOString().slice(0, 10) }],
    contentBlocks: [{ body: '' }],
    contacts: [emptyJobContact()],
    companies: [emptyJobCompany()],
    mediaContents: [],
    visible: false,
  };
}
export function jobTemporalState(
  value: Pick<JobInput, 'publicationDate' | 'dates'>,
  today: string
) {
  const end = value.dates[0]?.dateEnd;
  if (
    !jobDateSchema.safeParse(value.publicationDate).success ||
    !jobDateSchema.safeParse(end).success ||
    end! < value.publicationDate
  )
    return 'incomplete';
  return value.publicationDate > today ? 'planned' : end! < today ? 'ended' : 'ongoing';
}
