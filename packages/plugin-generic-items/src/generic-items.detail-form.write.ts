import type { GenericItemFormInput } from './generic-items.api-types.js';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';
import {
  mapAccessibilityInformationsToInput,
  mapAddressesToInput,
  mapContactsToInput,
  mapContentBlocksToInput,
  mapDatesToInput,
  mapLocationsToInput,
  mapMediaContentsToInput,
  mapOpeningHoursToInput,
  mapPriceInformationsToInput,
  mapWebUrlsToInput,
  parseOptionalJson,
} from './generic-items.detail-form.write-helpers.js';

export const mapGenericItemsDetailFormValuesToInput = (
  values: GenericItemsDetailFormValues
): GenericItemFormInput => ({
  title: values.title.trim(),
  genericType: values.genericType.trim(),
  teaser: values.teaser.trim() || undefined,
  visible: values.visible,
  author: values.author.trim() || undefined,
  keywords: values.keywords.trim() || undefined,
  externalId: values.externalId.trim() || undefined,
  publicationDate: values.publicationDate.trim() || undefined,
  publishedAt: values.publishedAt.trim() || undefined,
  ...((values.categories ?? []).length > 0
    ? {
        categoryName: values.categories[0]?.trim(),
        categories: Array.from(new Set((values.categories ?? []).map((entry) => entry.trim()).filter(Boolean))).map((name) => ({
          name,
        })),
      }
    : {}),
  contacts: mapContactsToInput(values.contacts),
  webUrls: mapWebUrlsToInput(values.webUrls),
  addresses: mapAddressesToInput(values.addresses),
  contentBlocks: mapContentBlocksToInput(values.contentBlocks),
  openingHours: mapOpeningHoursToInput(values.openingHours),
  mediaContents: mapMediaContentsToInput(values.mediaContents),
  locations: mapLocationsToInput(values.locations),
  dates: mapDatesToInput(values.dates),
  accessibilityInformations: mapAccessibilityInformationsToInput(values.accessibilityInformations),
  priceInformations: mapPriceInformationsToInput(values.priceInformations),
  payload: parseOptionalJson(values.payloadText) ?? {},
});
