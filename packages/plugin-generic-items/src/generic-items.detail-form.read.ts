import type { GenericItemContentItem } from './generic-items.api-types.js';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';
import {
  mapGenericItemAccessibilityInformations,
  mapGenericItemAddresses,
  mapGenericItemCategories,
  mapGenericItemContacts,
  mapGenericItemContentBlocks,
  mapGenericItemDates,
  mapGenericItemLocations,
  mapGenericItemMediaContents,
  mapGenericItemOpeningHours,
  mapGenericItemPriceInformations,
  mapGenericItemWebUrls,
  stringifyJson,
} from './generic-items.detail-form.read-helpers.js';

export const mapGenericItemToDetailFormValues = (
  item: GenericItemContentItem
): GenericItemsDetailFormValues => ({
  title: item.title,
  genericType: item.genericType,
  teaser: item.teaser ?? '',
  visible: item.visible !== false,
  author: item.author ?? '',
  keywords: item.keywords ?? '',
  externalId: item.externalId ?? '',
  publicationDate: item.publicationDate ?? '',
  publishedAt: item.publishedAt ?? '',
  categories: mapGenericItemCategories(item),
  contacts: mapGenericItemContacts(item),
  webUrls: mapGenericItemWebUrls(item),
  addresses: mapGenericItemAddresses(item),
  contentBlocks: mapGenericItemContentBlocks(item),
  openingHours: mapGenericItemOpeningHours(item),
  mediaContents: mapGenericItemMediaContents(item),
  locations: mapGenericItemLocations(item),
  dates: mapGenericItemDates(item),
  accessibilityInformations: mapGenericItemAccessibilityInformations(item),
  priceInformations: mapGenericItemPriceInformations(item),
  payloadText: stringifyJson(item.payload, '{}'),
});
