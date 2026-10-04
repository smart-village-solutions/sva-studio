import { z } from 'zod';

export const webUrlSchema = z.object({
  id: z.string().nullish(),
  url: z.string().nullish(),
  description: z.string().nullish(),
});

export const geoLocationSchema = z.object({
  latitude: z.union([z.number(), z.string()]).nullish(),
  longitude: z.union([z.number(), z.string()]).nullish(),
});

export const addressSchema = z.object({
  id: z.string().nullish(),
  addition: z.string().nullish(),
  street: z.string().nullish(),
  zip: z.string().nullish(),
  city: z.string().nullish(),
  kind: z.string().nullish(),
  geoLocation: geoLocationSchema.nullish(),
});

export type CategoryLike = {
  readonly id?: string | null;
  readonly name?: string | null;
  readonly iconName?: string | null;
  readonly position?: number | null;
  readonly tagList?: string | null;
  readonly createdAt?: string | null;
  readonly updatedAt?: string | null;
  readonly children?: readonly CategoryLike[] | null;
};

export const categorySchema: z.ZodType<CategoryLike> = z.lazy(() =>
  z.object({
    id: z.string().nullish(),
    name: z.string().nullish(),
    iconName: z.string().nullish(),
    position: z.number().nullish(),
    tagList: z.string().nullish(),
    createdAt: z.string().nullish(),
    updatedAt: z.string().nullish(),
    children: z.array(categorySchema).nullish(),
  })
);

export const mediaContentSchema = z.object({
  id: z.string().nullish(),
  captionText: z.string().nullish(),
  copyright: z.string().nullish(),
  height: z.number().nullish(),
  width: z.number().nullish(),
  contentType: z.string().nullish(),
  sourceUrl: webUrlSchema.nullish(),
});

export const contentBlockSchema = z.object({
  id: z.string().nullish(),
  title: z.string().nullish(),
  intro: z.string().nullish(),
  body: z.string().nullish(),
  mediaContents: z.array(mediaContentSchema).nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
});

export const dataProviderSchema = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
  dataType: z.string().nullish(),
  description: z.string().nullish(),
  notice: z.string().nullish(),
  logo: webUrlSchema.nullish(),
  address: addressSchema.nullish(),
});

export const settingSchema = z.object({
  alwaysRecreateOnImport: z.string().nullish(),
  displayOnlySummary: z.string().nullish(),
  onlySummaryLinkText: z.string().nullish(),
});

export const dateSchema = z.object({
  id: z.string().nullish(),
  weekday: z.string().nullish(),
  dateStart: z.string().nullish(),
  dateEnd: z.string().nullish(),
  timeStart: z.string().nullish(),
  timeEnd: z.string().nullish(),
  timeDescription: z.string().nullish(),
  useOnlyTimeDescription: z.string().nullish(),
});

export const contactSchema = z.object({
  id: z.string().nullish(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  phone: z.string().nullish(),
  fax: z.string().nullish(),
  email: z.string().nullish(),
  webUrls: z.array(webUrlSchema).nullish(),
});

export const locationSchema = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
  department: z.string().nullish(),
  district: z.string().nullish(),
  regionName: z.string().nullish(),
  state: z.string().nullish(),
  geoLocation: geoLocationSchema.nullish(),
});

export const operatingCompanySchema = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
  address: addressSchema.nullish(),
  contact: contactSchema.nullish(),
});

export const priceSchema = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
  amount: z.number().nullish(),
  groupPrice: z.boolean().nullish(),
  ageFrom: z.number().nullish(),
  ageTo: z.number().nullish(),
  minAdultCount: z.number().nullish(),
  maxAdultCount: z.number().nullish(),
  minChildrenCount: z.number().nullish(),
  maxChildrenCount: z.number().nullish(),
  description: z.string().nullish(),
  category: z.string().nullish(),
});

export const accessibilityInformationSchema = z.object({
  id: z.string().nullish(),
  description: z.string().nullish(),
  types: z.string().nullish(),
  urls: z.array(webUrlSchema).nullish(),
});

export const repeatDurationSchema = z.object({
  id: z.string().nullish(),
  startDate: z.string().nullish(),
  endDate: z.string().nullish(),
  everyYear: z.boolean().nullish(),
});

export const openingHourSchema = z.object({
  id: z.string().nullish(),
  weekday: z.string().nullish(),
  dateFrom: z.string().nullish(),
  dateTo: z.string().nullish(),
  timeFrom: z.string().nullish(),
  timeTo: z.string().nullish(),
  sortNumber: z.number().nullish(),
  open: z.boolean().nullish(),
  useYear: z.boolean().nullish(),
  description: z.string().nullish(),
});
