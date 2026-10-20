import { z } from 'zod';
import type {
  SvaMainserverAccessibilityInformation,
  SvaMainserverAddress,
  SvaMainserverCategory,
  SvaMainserverContact,
  SvaMainserverDate,
  SvaMainserverDataProvider,
  SvaMainserverLocation,
  SvaMainserverMediaContent,
  SvaMainserverOpeningHour,
  SvaMainserverOperatingCompany,
  SvaMainserverPrice,
  SvaMainserverRepeatDuration,
  SvaMainserverWebUrl,
} from '../../types.js';
import { defined, optionalNumber, optionalString } from './shared.js';
import {
  accessibilityInformationSchema,
  addressSchema,
  contactSchema,
  dataProviderSchema,
  dateSchema,
  locationSchema,
  mediaContentSchema,
  openingHourSchema,
  operatingCompanySchema,
  priceSchema,
  repeatDurationSchema,
  webUrlSchema,
  type CategoryLike,
} from './mappers-shared-schemas.js';

// Keep absent optional properties absent, including when callers inspect own keys.
const omitUndefined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as T;

const mapGeoLocation = (value: z.infer<typeof addressSchema>['geoLocation']) => {
  if (!value) return undefined;
  const coordinates = omitUndefined({
    latitude: parseGeoCoordinate(value.latitude),
    longitude: parseGeoCoordinate(value.longitude),
  });
  return Object.keys(coordinates).length > 0 ? coordinates : undefined;
};

export const mapDataProvider = (
  value: z.infer<typeof dataProviderSchema> | null | undefined
): SvaMainserverDataProvider | undefined => {
  if (!value) return undefined;
  const dataProvider = omitUndefined({
    id: optionalString(value.id),
    name: optionalString(value.name),
    dataType: optionalString(value.dataType),
    description: optionalString(value.description),
    notice: optionalString(value.notice),
    logo: mapWebUrl(value.logo),
    address: mapAddress(value.address),
  });
  return Object.keys(dataProvider).length > 0 ? dataProvider : undefined;
};

export const parseCharactersToBeShown = (value: string | null | undefined): number | undefined => {
  if (!value || value.trim().length === 0) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const parseGeoCoordinate = (
  value: number | string | null | undefined
): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export const mapWebUrl = (
  value: z.infer<typeof webUrlSchema> | null | undefined
): SvaMainserverWebUrl | undefined => {
  if (!value?.url) {
    return undefined;
  }
  return omitUndefined({
    id: optionalString(value.id),
    url: value.url,
    description: optionalString(value.description),
  });
};

export const mapAddress = (
  value: z.infer<typeof addressSchema> | null | undefined
): SvaMainserverAddress | undefined => {
  if (!value) {
    return undefined;
  }
  const geoLocation = mapGeoLocation(value.geoLocation);
  const address = omitUndefined({
    id: optionalString(value.id),
    addition: optionalString(value.addition),
    street: optionalString(value.street),
    zip: optionalString(value.zip),
    city: optionalString(value.city),
    kind: optionalString(value.kind),
    geoLocation,
  });
  return Object.keys(address).length > 0 ? address : undefined;
};

export const mapCategory = (value: CategoryLike): SvaMainserverCategory | null => {
  if (!value.name) {
    return null;
  }
  return omitUndefined({
    id: optionalString(value.id),
    name: value.name,
    iconName: optionalString(value.iconName),
    position: optionalNumber(value.position),
    tagList: optionalString(value.tagList),
    createdAt: optionalString(value.createdAt),
    updatedAt: optionalString(value.updatedAt),
    children: (value.children ?? []).map(mapCategory).filter(defined),
  });
};

const hasNonBlankString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const hasIncompleteCategoryTree = (value: CategoryLike): boolean => {
  if (!hasNonBlankString(value.name)) {
    return true;
  }

  return (value.children ?? []).some(hasIncompleteCategoryTree);
};

export const mapMediaContent = (
  value: z.infer<typeof mediaContentSchema>
): SvaMainserverMediaContent =>
  omitUndefined({
    id: optionalString(value.id),
    captionText: optionalString(value.captionText),
    copyright: optionalString(value.copyright),
    height: optionalNumber(value.height),
    width: optionalNumber(value.width),
    contentType: optionalString(value.contentType),
    sourceUrl: mapWebUrl(value.sourceUrl),
  });

export const mapDate = (value: z.infer<typeof dateSchema>): SvaMainserverDate =>
  omitUndefined({
    id: optionalString(value.id),
    weekday: optionalString(value.weekday),
    dateStart: optionalString(value.dateStart),
    dateEnd: optionalString(value.dateEnd),
    timeStart: optionalString(value.timeStart),
    timeEnd: optionalString(value.timeEnd),
    timeDescription: optionalString(value.timeDescription),
    useOnlyTimeDescription: optionalString(value.useOnlyTimeDescription),
  });

export const mapContact = (
  value: z.infer<typeof contactSchema> | null | undefined
): SvaMainserverContact | undefined => {
  if (!value) {
    return undefined;
  }
  const contact = omitUndefined({
    id: optionalString(value.id),
    firstName: optionalString(value.firstName),
    lastName: optionalString(value.lastName),
    phone: optionalString(value.phone),
    fax: optionalString(value.fax),
    email: optionalString(value.email),
    webUrls: (value.webUrls ?? []).map(mapWebUrl).filter(defined),
  });
  return Object.keys(contact).length > 1 || contact.webUrls.length > 0 ? contact : undefined;
};

export const mapLocation = (
  value: z.infer<typeof locationSchema> | null | undefined
): SvaMainserverLocation | undefined => {
  if (!value) {
    return undefined;
  }
  const geoLocation = mapGeoLocation(value.geoLocation);
  const location = omitUndefined({
    id: optionalString(value.id),
    name: optionalString(value.name),
    department: optionalString(value.department),
    district: optionalString(value.district),
    regionName: optionalString(value.regionName),
    state: optionalString(value.state),
    geoLocation,
  });
  return Object.keys(location).length > 0 ? location : undefined;
};

export const mapOperatingCompany = (
  value: z.infer<typeof operatingCompanySchema> | null | undefined
): SvaMainserverOperatingCompany | undefined => {
  if (!value) {
    return undefined;
  }
  const company = omitUndefined({
    id: optionalString(value.id),
    name: optionalString(value.name),
    address: mapAddress(value.address),
    contact: mapContact(value.contact),
  });
  return Object.keys(company).length > 0 ? company : undefined;
};

export const mapPrice = (value: z.infer<typeof priceSchema>): SvaMainserverPrice =>
  omitUndefined({
    id: optionalString(value.id),
    name: optionalString(value.name),
    amount: optionalNumber(value.amount),
    groupPrice: value.groupPrice ?? undefined,
    ageFrom: optionalNumber(value.ageFrom),
    ageTo: optionalNumber(value.ageTo),
    minAdultCount: optionalNumber(value.minAdultCount),
    maxAdultCount: optionalNumber(value.maxAdultCount),
    minChildrenCount: optionalNumber(value.minChildrenCount),
    maxChildrenCount: optionalNumber(value.maxChildrenCount),
    description: optionalString(value.description),
    category: optionalString(value.category),
  });

export const mapAccessibilityInformation = (
  value: z.infer<typeof accessibilityInformationSchema> | null | undefined
): SvaMainserverAccessibilityInformation | undefined => {
  if (!value) {
    return undefined;
  }
  const information = omitUndefined({
    id: optionalString(value.id),
    description: optionalString(value.description),
    types: optionalString(value.types),
    urls: (value.urls ?? []).map(mapWebUrl).filter(defined),
  });
  return Object.keys(information).length > 1 || information.urls.length > 0
    ? information
    : undefined;
};

export const mapRepeatDuration = (
  value: z.infer<typeof repeatDurationSchema> | null | undefined
): SvaMainserverRepeatDuration | undefined => {
  if (!value) {
    return undefined;
  }
  const repeatDuration = omitUndefined({
    id: optionalString(value.id),
    startDate: optionalString(value.startDate),
    endDate: optionalString(value.endDate),
    everyYear: value.everyYear ?? undefined,
  });
  return Object.keys(repeatDuration).length > 0 ? repeatDuration : undefined;
};

export const mapOpeningHour = (
  value: z.infer<typeof openingHourSchema>
): SvaMainserverOpeningHour => {
  const sortNumber = optionalNumber(value.sortNumber);

  return omitUndefined({
    id: optionalString(value.id),
    weekday: optionalString(value.weekday),
    dateFrom: optionalString(value.dateFrom),
    dateTo: optionalString(value.dateTo),
    timeFrom: optionalString(value.timeFrom),
    timeTo: optionalString(value.timeTo),
    sortNumber,
    open: value.open ?? undefined,
    useYear: value.useYear ?? undefined,
    description: optionalString(value.description),
  });
};
