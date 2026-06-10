import { z } from 'zod';

import type {
  SvaMainserverAccessibilityInformation,
  SvaMainserverAddress,
  SvaMainserverCategory,
  SvaMainserverContact,
  SvaMainserverDate,
  SvaMainserverLocation,
  SvaMainserverMediaContent,
  SvaMainserverNewsPayload,
  SvaMainserverOpeningHour,
  SvaMainserverOperatingCompany,
  SvaMainserverPrice,
  SvaMainserverRepeatDuration,
  SvaMainserverWebUrl,
} from '../../types.js';

import { defined, optionalNumber, optionalString } from './shared.js';

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

type CategoryLike = {
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

export const parseCharactersToBeShown = (value: string | null | undefined): number | undefined => {
  if (!value || value.trim().length === 0) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const parseGeoCoordinate = (value: number | string | null | undefined): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export const mapWebUrl = (value: z.infer<typeof webUrlSchema> | null | undefined): SvaMainserverWebUrl | undefined => {
  if (!value?.url) {
    return undefined;
  }
  return {
    ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
    url: value.url,
    ...(optionalString(value.description) ? { description: optionalString(value.description) } : {}),
  };
};

export const mapAddress = (value: z.infer<typeof addressSchema> | null | undefined): SvaMainserverAddress | undefined => {
  if (!value) {
    return undefined;
  }
  const geoLocation = value.geoLocation
    ? {
        ...(defined(parseGeoCoordinate(value.geoLocation.latitude))
          ? { latitude: parseGeoCoordinate(value.geoLocation.latitude) }
          : {}),
        ...(defined(parseGeoCoordinate(value.geoLocation.longitude))
          ? { longitude: parseGeoCoordinate(value.geoLocation.longitude) }
          : {}),
      }
    : undefined;
  const address = {
    ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
    ...(optionalString(value.addition) ? { addition: optionalString(value.addition) } : {}),
    ...(optionalString(value.street) ? { street: optionalString(value.street) } : {}),
    ...(optionalString(value.zip) ? { zip: optionalString(value.zip) } : {}),
    ...(optionalString(value.city) ? { city: optionalString(value.city) } : {}),
    ...(optionalString(value.kind) ? { kind: optionalString(value.kind) } : {}),
    ...(geoLocation && (defined(geoLocation.latitude) || defined(geoLocation.longitude)) ? { geoLocation } : {}),
  };
  return Object.keys(address).length > 0 ? address : undefined;
};

export const mapCategory = (value: CategoryLike): SvaMainserverCategory | null => {
  if (!value.name) {
    return null;
  }
  return {
    ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
    name: value.name,
    ...(optionalString(value.iconName) ? { iconName: optionalString(value.iconName) } : {}),
    ...(optionalNumber(value.position) !== undefined ? { position: value.position as number } : {}),
    ...(optionalString(value.tagList) ? { tagList: optionalString(value.tagList) } : {}),
    ...(optionalString(value.createdAt) ? { createdAt: optionalString(value.createdAt) } : {}),
    ...(optionalString(value.updatedAt) ? { updatedAt: optionalString(value.updatedAt) } : {}),
    children: (value.children ?? []).map(mapCategory).filter(defined),
  };
};

const hasNonBlankString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const hasIncompleteCategoryTree = (value: CategoryLike): boolean => {
  if (!hasNonBlankString(value.name)) {
    return true;
  }

  return (value.children ?? []).some(hasIncompleteCategoryTree);
};

export const mapMediaContent = (value: z.infer<typeof mediaContentSchema>): SvaMainserverMediaContent => ({
  ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
  ...(optionalString(value.captionText) ? { captionText: optionalString(value.captionText) } : {}),
  ...(optionalString(value.copyright) ? { copyright: optionalString(value.copyright) } : {}),
  ...(optionalNumber(value.height) !== undefined ? { height: value.height as number } : {}),
  ...(optionalNumber(value.width) !== undefined ? { width: value.width as number } : {}),
  ...(optionalString(value.contentType) ? { contentType: optionalString(value.contentType) } : {}),
  ...(mapWebUrl(value.sourceUrl) ? { sourceUrl: mapWebUrl(value.sourceUrl) } : {}),
});

export const mapDate = (value: z.infer<typeof dateSchema>): SvaMainserverDate => ({
  ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
  ...(optionalString(value.weekday) ? { weekday: optionalString(value.weekday) } : {}),
  ...(optionalString(value.dateStart) ? { dateStart: optionalString(value.dateStart) } : {}),
  ...(optionalString(value.dateEnd) ? { dateEnd: optionalString(value.dateEnd) } : {}),
  ...(optionalString(value.timeStart) ? { timeStart: optionalString(value.timeStart) } : {}),
  ...(optionalString(value.timeEnd) ? { timeEnd: optionalString(value.timeEnd) } : {}),
  ...(optionalString(value.timeDescription) ? { timeDescription: optionalString(value.timeDescription) } : {}),
  ...(optionalString(value.useOnlyTimeDescription)
    ? { useOnlyTimeDescription: optionalString(value.useOnlyTimeDescription) }
    : {}),
});

export const mapContact = (value: z.infer<typeof contactSchema> | null | undefined): SvaMainserverContact | undefined => {
  if (!value) {
    return undefined;
  }
  const contact = {
    ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
    ...(optionalString(value.firstName) ? { firstName: optionalString(value.firstName) } : {}),
    ...(optionalString(value.lastName) ? { lastName: optionalString(value.lastName) } : {}),
    ...(optionalString(value.phone) ? { phone: optionalString(value.phone) } : {}),
    ...(optionalString(value.fax) ? { fax: optionalString(value.fax) } : {}),
    ...(optionalString(value.email) ? { email: optionalString(value.email) } : {}),
    webUrls: (value.webUrls ?? []).map(mapWebUrl).filter(defined),
  };
  return Object.keys(contact).length > 1 || contact.webUrls.length > 0 ? contact : undefined;
};

export const mapLocation = (value: z.infer<typeof locationSchema> | null | undefined): SvaMainserverLocation | undefined => {
  if (!value) {
    return undefined;
  }
  const geoLocation = value.geoLocation
    ? {
        ...(defined(parseGeoCoordinate(value.geoLocation.latitude))
          ? { latitude: parseGeoCoordinate(value.geoLocation.latitude) }
          : {}),
        ...(defined(parseGeoCoordinate(value.geoLocation.longitude))
          ? { longitude: parseGeoCoordinate(value.geoLocation.longitude) }
          : {}),
      }
    : undefined;
  const location = {
    ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
    ...(optionalString(value.name) ? { name: optionalString(value.name) } : {}),
    ...(optionalString(value.department) ? { department: optionalString(value.department) } : {}),
    ...(optionalString(value.district) ? { district: optionalString(value.district) } : {}),
    ...(optionalString(value.regionName) ? { regionName: optionalString(value.regionName) } : {}),
    ...(optionalString(value.state) ? { state: optionalString(value.state) } : {}),
    ...(geoLocation && (defined(geoLocation.latitude) || defined(geoLocation.longitude)) ? { geoLocation } : {}),
  };
  return Object.keys(location).length > 0 ? location : undefined;
};

export const mapOperatingCompany = (
  value: z.infer<typeof operatingCompanySchema> | null | undefined
): SvaMainserverOperatingCompany | undefined => {
  if (!value) {
    return undefined;
  }
  const company = {
    ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
    ...(optionalString(value.name) ? { name: optionalString(value.name) } : {}),
    ...(mapAddress(value.address) ? { address: mapAddress(value.address) } : {}),
    ...(mapContact(value.contact) ? { contact: mapContact(value.contact) } : {}),
  };
  return Object.keys(company).length > 0 ? company : undefined;
};

export const mapPrice = (value: z.infer<typeof priceSchema>): SvaMainserverPrice => ({
  ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
  ...(optionalString(value.name) ? { name: optionalString(value.name) } : {}),
  ...(optionalNumber(value.amount) !== undefined ? { amount: value.amount as number } : {}),
  ...(defined(value.groupPrice) ? { groupPrice: value.groupPrice } : {}),
  ...(optionalNumber(value.ageFrom) !== undefined ? { ageFrom: value.ageFrom as number } : {}),
  ...(optionalNumber(value.ageTo) !== undefined ? { ageTo: value.ageTo as number } : {}),
  ...(optionalNumber(value.minAdultCount) !== undefined ? { minAdultCount: value.minAdultCount as number } : {}),
  ...(optionalNumber(value.maxAdultCount) !== undefined ? { maxAdultCount: value.maxAdultCount as number } : {}),
  ...(optionalNumber(value.minChildrenCount) !== undefined ? { minChildrenCount: value.minChildrenCount as number } : {}),
  ...(optionalNumber(value.maxChildrenCount) !== undefined ? { maxChildrenCount: value.maxChildrenCount as number } : {}),
  ...(optionalString(value.description) ? { description: optionalString(value.description) } : {}),
  ...(optionalString(value.category) ? { category: optionalString(value.category) } : {}),
});

export const mapAccessibilityInformation = (
  value: z.infer<typeof accessibilityInformationSchema> | null | undefined
): SvaMainserverAccessibilityInformation | undefined => {
  if (!value) {
    return undefined;
  }
  const information = {
    ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
    ...(optionalString(value.description) ? { description: optionalString(value.description) } : {}),
    ...(optionalString(value.types) ? { types: optionalString(value.types) } : {}),
    urls: (value.urls ?? []).map(mapWebUrl).filter(defined),
  };
  return Object.keys(information).length > 1 || information.urls.length > 0 ? information : undefined;
};

export const mapRepeatDuration = (
  value: z.infer<typeof repeatDurationSchema> | null | undefined
): SvaMainserverRepeatDuration | undefined => {
  if (!value) {
    return undefined;
  }
  const repeatDuration = {
    ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
    ...(optionalString(value.startDate) ? { startDate: optionalString(value.startDate) } : {}),
    ...(optionalString(value.endDate) ? { endDate: optionalString(value.endDate) } : {}),
    ...(defined(value.everyYear) ? { everyYear: value.everyYear } : {}),
  };
  return Object.keys(repeatDuration).length > 0 ? repeatDuration : undefined;
};

export const mapOpeningHour = (value: z.infer<typeof openingHourSchema>): SvaMainserverOpeningHour => {
  const sortNumber = optionalNumber(value.sortNumber);

  return {
    ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
    ...(optionalString(value.weekday) ? { weekday: optionalString(value.weekday) } : {}),
    ...(optionalString(value.dateFrom) ? { dateFrom: optionalString(value.dateFrom) } : {}),
    ...(optionalString(value.dateTo) ? { dateTo: optionalString(value.dateTo) } : {}),
    ...(optionalString(value.timeFrom) ? { timeFrom: optionalString(value.timeFrom) } : {}),
    ...(optionalString(value.timeTo) ? { timeTo: optionalString(value.timeTo) } : {}),
    ...(sortNumber !== undefined ? { sortNumber } : {}),
    ...(defined(value.open) ? { open: value.open } : {}),
    ...(defined(value.useYear) ? { useYear: value.useYear } : {}),
    ...(optionalString(value.description) ? { description: optionalString(value.description) } : {}),
  };
};

export const buildLegacyContentBlock = (payload: SvaMainserverNewsPayload) => {
  if (!payload.body && !payload.teaser) {
    return null;
  }
  return {
    ...(payload.teaser ? { intro: payload.teaser } : {}),
    ...(payload.body ? { body: payload.body } : {}),
    mediaContents: payload.imageUrl
      ? [
          {
            contentType: 'image',
            sourceUrl: {
              url: payload.imageUrl,
            },
          },
        ]
      : [],
  };
};
