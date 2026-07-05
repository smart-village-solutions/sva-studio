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
  payload: z.unknown().nullish(),
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

const mapGenericItemScalarFields = (value: z.infer<typeof genericItemSchema>, createdAt: string) => ({
  ...(optionalString(value.teaser) ? { teaser: optionalString(value.teaser) } : {}),
  ...(optionalString(value.description) ? { description: optionalString(value.description) } : {}),
  ...(optionalString(value.author) ? { author: optionalString(value.author) } : {}),
  ...(optionalString(value.keywords) ? { keywords: optionalString(value.keywords) } : {}),
  ...(optionalString(value.externalId) ? { externalId: optionalString(value.externalId) } : {}),
  ...(optionalString(value.publicationDate) ? { publicationDate: optionalString(value.publicationDate) } : {}),
  ...(optionalString(value.publishedAt) ? { publishedAt: optionalString(value.publishedAt) } : {}),
  ...(value.payload !== undefined && value.payload !== null ? { payload: value.payload } : {}),
  visible: value.visible !== false,
  createdAt,
  updatedAt: value.updatedAt ?? createdAt,
});

const mapGenericItemRelationFields = (value: z.infer<typeof genericItemSchema>) => ({
  categories: (value.categories ?? []).map(mapCategory).filter(defined),
  contacts: (value.contacts ?? []).map(mapContact).filter(defined),
  webUrls: (value.webUrls ?? []).map(mapWebUrl).filter(defined),
  addresses: (value.addresses ?? []).map(mapAddress).filter(defined),
  contentBlocks: (value.contentBlocks ?? []).map(mapContentBlock),
  openingHours: (value.openingHours ?? []).map(mapOpeningHour),
  mediaContents: (value.mediaContents ?? []).map(mapMediaContent),
  locations: (value.locations ?? []).map(mapLocation).filter(defined),
  dates: (value.dates ?? []).map(mapDate),
  accessibilityInformations: mapAccessibilityInformations(value.accessibilityInformations),
  priceInformations: (value.priceInformations ?? []).map(mapPrice),
});

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
    ...mapGenericItemScalarFields(parsed.data, createdAt),
    ...mapGenericItemRelationFields(parsed.data),
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
