import { z } from 'zod';

import type {
  SvaMainserverAccessibilityInformation,
  SvaMainserverContentBlock,
  SvaMainserverGenericItem,
} from '../../types.js';
import type { SvaMainserverGenericItemFragment } from '../../generated/generic-items.js';
import {
  accessibilityInformationSchema,
  addressSchema,
  categorySchema,
  contactSchema,
  contentBlockSchema,
  dateSchema,
  locationSchema,
  mapAddress,
  mapCategory,
  mapContact,
  mapDate,
  mapLocation,
  mapMediaContent,
  mapOpeningHour,
  mapPrice,
  mapWebUrl,
  mediaContentSchema,
  openingHourSchema,
  priceSchema,
  mapAccessibilityInformation,
} from './mappers-shared.js';
import { defined, optionalString, toSvaMainserverError } from './shared.js';

const genericItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().nullish(),
  teaser: z.string().nullish(),
  description: z.string().nullish(),
  author: z.string().nullish(),
  keywords: z.string().nullish(),
  externalId: z.string().nullish(),
  publicationDate: z.string().nullish(),
  publishedAt: z.string().nullish(),
  genericType: z.string().nullish(),
  payload: z.unknown(),
  visible: z.boolean().nullish(),
  categories: z.array(categorySchema).nullish(),
  contacts: z.array(contactSchema).nullish(),
  webUrls: z.array(z.object({ id: z.string().nullish(), url: z.string().nullish(), description: z.string().nullish() })).nullish(),
  addresses: z.array(addressSchema).nullish(),
  contentBlocks: z.array(contentBlockSchema).nullish(),
  openingHours: z.array(openingHourSchema).nullish(),
  mediaContents: z.array(mediaContentSchema).nullish(),
  locations: z.array(locationSchema).nullish(),
  dates: z.array(dateSchema).nullish(),
  accessibilityInformations: z.array(accessibilityInformationSchema).nullish(),
  priceInformations: z.array(priceSchema).nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
});

const mapContentBlock = (value: z.infer<typeof contentBlockSchema>): SvaMainserverContentBlock => ({
  ...(optionalString(value.id) ? { id: optionalString(value.id) } : {}),
  ...(optionalString(value.title) ? { title: optionalString(value.title) } : {}),
  ...(optionalString(value.intro) ? { intro: optionalString(value.intro) } : {}),
  ...(optionalString(value.body) ? { body: optionalString(value.body) } : {}),
  mediaContents: (value.mediaContents ?? []).map(mapMediaContent),
  ...(optionalString(value.createdAt) ? { createdAt: optionalString(value.createdAt) } : {}),
  ...(optionalString(value.updatedAt) ? { updatedAt: optionalString(value.updatedAt) } : {}),
});

const mapAccessibilityInformations = (
  values: readonly z.infer<typeof accessibilityInformationSchema>[] | null | undefined
): readonly SvaMainserverAccessibilityInformation[] =>
  (values ?? []).map((value) => mapAccessibilityInformation(value)).filter(defined);

export const mapGenericItem = (item: SvaMainserverGenericItemFragment | null | undefined): SvaMainserverGenericItem => {
  const parsed = genericItemSchema.safeParse(item);
  if (!parsed.success) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'Ungültige GenericItem-Antwort des SVA-Mainservers.',
      statusCode: 502,
    });
  }

  const createdAt = parsed.data.createdAt ?? new Date(0).toISOString();

  return {
    id: parsed.data.id,
    title: parsed.data.title ?? '',
    contentType: 'generic-items.generic-item',
    status: 'published',
    genericType: parsed.data.genericType ?? '',
    ...(optionalString(parsed.data.teaser) ? { teaser: optionalString(parsed.data.teaser) } : {}),
    ...(optionalString(parsed.data.description) ? { description: optionalString(parsed.data.description) } : {}),
    ...(optionalString(parsed.data.author) ? { author: optionalString(parsed.data.author) } : {}),
    ...(optionalString(parsed.data.keywords) ? { keywords: optionalString(parsed.data.keywords) } : {}),
    ...(optionalString(parsed.data.externalId) ? { externalId: optionalString(parsed.data.externalId) } : {}),
    ...(optionalString(parsed.data.publicationDate) ? { publicationDate: optionalString(parsed.data.publicationDate) } : {}),
    ...(optionalString(parsed.data.publishedAt) ? { publishedAt: optionalString(parsed.data.publishedAt) } : {}),
    ...(parsed.data.payload !== undefined && parsed.data.payload !== null ? { payload: parsed.data.payload } : {}),
    categories: (parsed.data.categories ?? []).map(mapCategory).filter(defined),
    contacts: (parsed.data.contacts ?? []).map(mapContact).filter(defined),
    webUrls: (parsed.data.webUrls ?? []).map(mapWebUrl).filter(defined),
    addresses: (parsed.data.addresses ?? []).map(mapAddress).filter(defined),
    contentBlocks: (parsed.data.contentBlocks ?? []).map(mapContentBlock),
    openingHours: (parsed.data.openingHours ?? []).map(mapOpeningHour),
    mediaContents: (parsed.data.mediaContents ?? []).map(mapMediaContent),
    locations: (parsed.data.locations ?? []).map(mapLocation).filter(defined),
    dates: (parsed.data.dates ?? []).map(mapDate),
    accessibilityInformations: mapAccessibilityInformations(parsed.data.accessibilityInformations),
    priceInformations: (parsed.data.priceInformations ?? []).map(mapPrice),
    visible: parsed.data.visible !== false,
    createdAt,
    updatedAt: parsed.data.updatedAt ?? createdAt,
  };
};

export const mapOptionalGenericItem = (
  item: SvaMainserverGenericItemFragment | null | undefined
): SvaMainserverGenericItem => {
  if (!item) {
    throw toSvaMainserverError({
      code: 'not_found',
      message: 'Generic Item wurde nicht gefunden.',
      statusCode: 404,
    });
  }

  return mapGenericItem(item);
};
