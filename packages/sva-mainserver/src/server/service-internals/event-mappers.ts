import { z } from 'zod';

import type { SvaMainserverEventItem } from '../../types.js';
import type { SvaMainserverEventFragment } from '../../generated/events-poi.js';

import {
  accessibilityInformationSchema,
  addressSchema,
  categorySchema,
  contactSchema,
  dateSchema,
  locationSchema,
  mapAccessibilityInformation,
  mapAddress,
  mapCategory,
  mapContact,
  mapDate,
  mapLocation,
  mapMediaContent,
  mapOperatingCompany,
  mapPrice,
  mapRepeatDuration,
  mapWebUrl,
  mediaContentSchema,
  operatingCompanySchema,
  priceSchema,
  repeatDurationSchema,
} from './mappers-shared.js';
import { defined, optionalNumber, optionalString, toSvaMainserverError } from './shared.js';

const eventItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().nullish(),
  description: z.string().nullish(),
  externalId: z.string().nullish(),
  keywords: z.string().nullish(),
  parentId: z.number().nullish(),
  dates: z.array(dateSchema).nullish(),
  listDate: z.string().nullish(),
  sortDate: z.string().nullish(),
  repeat: z.boolean().nullish(),
  repeatDuration: repeatDurationSchema.nullish(),
  recurring: z.boolean().nullish(),
  recurringType: z.number().nullish(),
  recurringInterval: z.number().nullish(),
  recurringWeekdays: z.array(z.number()).nullish(),
  category: categorySchema.nullish(),
  categories: z.array(categorySchema).nullish(),
  addresses: z.array(addressSchema).nullish(),
  location: locationSchema.nullish(),
  contacts: z.array(contactSchema).nullish(),
  urls: z.array(z.object({ id: z.string().nullish(), url: z.string().nullish(), description: z.string().nullish() })).nullish(),
  mediaContents: z.array(mediaContentSchema).nullish(),
  organizer: operatingCompanySchema.nullish(),
  priceInformations: z.array(priceSchema).nullish(),
  accessibilityInformation: accessibilityInformationSchema.nullish(),
  tagList: z.array(z.string()).nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  visible: z.boolean().nullish(),
});

export const mapEventItem = (item: SvaMainserverEventFragment | null | undefined): SvaMainserverEventItem => {
  const parsed = eventItemSchema.safeParse(item);
  if (!parsed.success) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'Ungültige Event-Antwort des SVA-Mainservers.',
      statusCode: 502,
    });
  }

  const categories = (parsed.data.categories ?? []).map(mapCategory).filter(defined);
  const category = mapCategory(parsed.data.category ?? {});
  const createdAt = parsed.data.createdAt ?? parsed.data.listDate ?? new Date(0).toISOString();
  const parentId = optionalNumber(parsed.data.parentId);
  const recurringType = optionalNumber(parsed.data.recurringType);
  const recurringInterval = optionalNumber(parsed.data.recurringInterval);

  return {
    id: parsed.data.id,
    title: parsed.data.title ?? '',
    contentType: 'events.event-record',
    status: 'published',
    ...(optionalString(parsed.data.description) ? { description: optionalString(parsed.data.description) } : {}),
    ...(optionalString(parsed.data.externalId) ? { externalId: optionalString(parsed.data.externalId) } : {}),
    ...(optionalString(parsed.data.keywords) ? { keywords: optionalString(parsed.data.keywords) } : {}),
    ...(parentId !== undefined ? { parentId } : {}),
    dates: (parsed.data.dates ?? []).map(mapDate),
    ...(optionalString(parsed.data.listDate) ? { listDate: optionalString(parsed.data.listDate) } : {}),
    ...(optionalString(parsed.data.sortDate) ? { sortDate: optionalString(parsed.data.sortDate) } : {}),
    ...(defined(parsed.data.repeat) ? { repeat: parsed.data.repeat } : {}),
    ...(mapRepeatDuration(parsed.data.repeatDuration) ? { repeatDuration: mapRepeatDuration(parsed.data.repeatDuration) } : {}),
    ...(defined(parsed.data.recurring) ? { recurring: parsed.data.recurring } : {}),
    ...(recurringType !== undefined ? { recurringType } : {}),
    ...(recurringInterval !== undefined ? { recurringInterval } : {}),
    recurringWeekdays: parsed.data.recurringWeekdays ?? [],
    ...(category ? { categoryName: category.name } : {}),
    categories,
    addresses: (parsed.data.addresses ?? []).map(mapAddress).filter(defined),
    ...(mapLocation(parsed.data.location) ? { location: mapLocation(parsed.data.location) } : {}),
    contacts: (parsed.data.contacts ?? []).map(mapContact).filter(defined),
    urls: (parsed.data.urls ?? []).map(mapWebUrl).filter(defined),
    mediaContents: (parsed.data.mediaContents ?? []).map(mapMediaContent),
    ...(mapOperatingCompany(parsed.data.organizer) ? { organizer: mapOperatingCompany(parsed.data.organizer) } : {}),
    priceInformations: (parsed.data.priceInformations ?? []).map(mapPrice),
    ...(mapAccessibilityInformation(parsed.data.accessibilityInformation)
      ? { accessibilityInformation: mapAccessibilityInformation(parsed.data.accessibilityInformation) }
      : {}),
    tags: parsed.data.tagList ?? [],
    visible: parsed.data.visible !== false,
    createdAt,
    updatedAt: parsed.data.updatedAt ?? createdAt,
  };
};

export const mapOptionalEventItem = (item: SvaMainserverEventFragment | null | undefined): SvaMainserverEventItem => {
  if (!item) {
    throw toSvaMainserverError({ code: 'not_found', message: 'Event wurde nicht gefunden.', statusCode: 404 });
  }
  return mapEventItem(item);
};
