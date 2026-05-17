import { z } from 'zod';

import type { SvaMainserverPoiItem } from '../../types.js';
import type { SvaMainserverPoiFragment } from '../../generated/events-poi.js';

import {
  accessibilityInformationSchema,
  addressSchema,
  categorySchema,
  contactSchema,
  locationSchema,
  mapAccessibilityInformation,
  mapAddress,
  mapCategory,
  mapContact,
  mapLocation,
  mapMediaContent,
  mapOpeningHour,
  mapOperatingCompany,
  mapPrice,
  mapWebUrl,
  mediaContentSchema,
  openingHourSchema,
  operatingCompanySchema,
  priceSchema,
} from './mappers-shared.js';
import { defined, optionalString, toSvaMainserverError } from './shared.js';

const certificateSchema = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
});

const poiItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().nullish(),
  description: z.string().nullish(),
  mobileDescription: z.string().nullish(),
  externalId: z.string().nullish(),
  keywords: z.string().nullish(),
  active: z.boolean().nullish(),
  payload: z.unknown(),
  category: categorySchema.nullish(),
  categories: z.array(categorySchema).nullish(),
  addresses: z.array(addressSchema).nullish(),
  contact: contactSchema.nullish(),
  priceInformations: z.array(priceSchema).nullish(),
  openingHours: z.array(openingHourSchema).nullish(),
  operatingCompany: operatingCompanySchema.nullish(),
  webUrls: z.array(z.object({ id: z.string().nullish(), url: z.string().nullish(), description: z.string().nullish() })).nullish(),
  mediaContents: z.array(mediaContentSchema).nullish(),
  location: locationSchema.nullish(),
  certificates: z.array(certificateSchema).nullish(),
  accessibilityInformation: accessibilityInformationSchema.nullish(),
  tagList: z.array(z.string()).nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  visible: z.boolean().nullish(),
});

export const mapPoiItem = (item: SvaMainserverPoiFragment | null | undefined): SvaMainserverPoiItem => {
  const parsed = poiItemSchema.safeParse(item);
  if (!parsed.success) {
    throw toSvaMainserverError({
      code: 'invalid_response',
      message: 'Ungültige POI-Antwort des SVA-Mainservers.',
      statusCode: 502,
    });
  }

  const categories = (parsed.data.categories ?? []).map(mapCategory).filter(defined);
  const category = mapCategory(parsed.data.category ?? {});
  const createdAt = parsed.data.createdAt ?? new Date(0).toISOString();
  const certificates = (parsed.data.certificates ?? []).flatMap((certificate) => {
    const name = optionalString(certificate.name);
    if (!name) {
      return [];
    }

    return [
      {
        ...(optionalString(certificate.id) ? { id: optionalString(certificate.id) } : {}),
        name,
      },
    ];
  });

  return {
    id: parsed.data.id,
    name: parsed.data.name ?? '',
    contentType: 'poi.point-of-interest',
    status: 'published',
    ...(optionalString(parsed.data.description) ? { description: optionalString(parsed.data.description) } : {}),
    ...(optionalString(parsed.data.mobileDescription)
      ? { mobileDescription: optionalString(parsed.data.mobileDescription) }
      : {}),
    ...(optionalString(parsed.data.externalId) ? { externalId: optionalString(parsed.data.externalId) } : {}),
    ...(optionalString(parsed.data.keywords) ? { keywords: optionalString(parsed.data.keywords) } : {}),
    active: parsed.data.active !== false,
    ...(category ? { categoryName: category.name } : {}),
    ...(parsed.data.payload !== undefined && parsed.data.payload !== null ? { payload: parsed.data.payload } : {}),
    categories,
    addresses: (parsed.data.addresses ?? []).map(mapAddress).filter(defined),
    ...(mapContact(parsed.data.contact) ? { contact: mapContact(parsed.data.contact) } : {}),
    priceInformations: (parsed.data.priceInformations ?? []).map(mapPrice),
    openingHours: (parsed.data.openingHours ?? []).map(mapOpeningHour),
    ...(mapOperatingCompany(parsed.data.operatingCompany)
      ? { operatingCompany: mapOperatingCompany(parsed.data.operatingCompany) }
      : {}),
    webUrls: (parsed.data.webUrls ?? []).map(mapWebUrl).filter(defined),
    mediaContents: (parsed.data.mediaContents ?? []).map(mapMediaContent),
    ...(mapLocation(parsed.data.location) ? { location: mapLocation(parsed.data.location) } : {}),
    certificates,
    ...(mapAccessibilityInformation(parsed.data.accessibilityInformation)
      ? { accessibilityInformation: mapAccessibilityInformation(parsed.data.accessibilityInformation) }
      : {}),
    tags: parsed.data.tagList ?? [],
    visible: parsed.data.visible !== false,
    createdAt,
    updatedAt: parsed.data.updatedAt ?? createdAt,
  };
};

export const mapOptionalPoiItem = (item: SvaMainserverPoiFragment | null | undefined): SvaMainserverPoiItem => {
  if (!item) {
    throw toSvaMainserverError({ code: 'not_found', message: 'POI wurde nicht gefunden.', statusCode: 404 });
  }
  return mapPoiItem(item);
};
