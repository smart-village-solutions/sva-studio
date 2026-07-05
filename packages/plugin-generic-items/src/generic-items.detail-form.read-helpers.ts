import type { GenericItemContentItem } from './generic-items.api-types.js';
import {
  createDefaultAccessibilityInformationFormValue,
  createDefaultAddressFormValue,
  createDefaultContactFormValue,
  createDefaultContentBlockFormValue,
  createDefaultDateFormValue,
  createDefaultLocationFormValue,
  createDefaultOpeningHourFormValue,
  createDefaultPriceInformationFormValue,
  createDefaultWebUrlFormValue,
} from './generic-items.detail-form.defaults.js';

const stringifyFiniteNumber = (value: number | null | undefined): string =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : '';

const parseBooleanish = (value: boolean | string | null | undefined): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  return value === 'true';
};

export const stringifyJson = (value: unknown, fallback: '{}' | '[]'): string => {
  if (value === undefined) {
    return fallback;
  }
  return JSON.stringify(value, null, 2);
};

export const mapGenericItemCategories = (item: GenericItemContentItem) =>
  item.categories?.map((category) => category.name.trim()).filter((name) => name.length > 0) ??
  (item.categoryName ? [item.categoryName] : []);

export const mapGenericItemContacts = (item: GenericItemContentItem) =>
  item.contacts && item.contacts.length > 0
    ? item.contacts.map((contact) => ({
        firstName: contact.firstName ?? '',
        lastName: contact.lastName ?? '',
        email: contact.email ?? '',
        phone: contact.phone ?? '',
      }))
    : [createDefaultContactFormValue()];

export const mapGenericItemWebUrls = (item: GenericItemContentItem) =>
  item.webUrls && item.webUrls.length > 0
    ? item.webUrls.map((webUrl) => ({
        url: webUrl.url,
        description: webUrl.description ?? '',
      }))
    : [createDefaultWebUrlFormValue()];

export const mapGenericItemAddresses = (item: GenericItemContentItem) =>
  item.addresses && item.addresses.length > 0
    ? item.addresses.map((address) => ({
        addition: address.addition ?? '',
        street: address.street ?? '',
        zip: address.zip ?? '',
        city: address.city ?? '',
        kind: address.kind ?? '',
        latitude: stringifyFiniteNumber(address.geoLocation?.latitude),
        longitude: stringifyFiniteNumber(address.geoLocation?.longitude),
      }))
    : [createDefaultAddressFormValue()];

export const mapGenericItemContentBlocks = (item: GenericItemContentItem) =>
  item.contentBlocks && item.contentBlocks.length > 0
    ? item.contentBlocks.map((contentBlock) => ({
        title: contentBlock.title ?? '',
        intro: contentBlock.intro ?? '',
        body: contentBlock.body ?? '',
      }))
    : [createDefaultContentBlockFormValue()];

export const mapGenericItemOpeningHours = (item: GenericItemContentItem) =>
  item.openingHours && item.openingHours.length > 0
    ? item.openingHours.map((openingHour) => ({
        weekday: openingHour.weekday ?? '',
        dateFrom: openingHour.dateFrom ?? '',
        dateTo: openingHour.dateTo ?? '',
        timeFrom: openingHour.timeFrom ?? '',
        timeTo: openingHour.timeTo ?? '',
        description: openingHour.description ?? '',
        open: openingHour.open ?? false,
      }))
    : [createDefaultOpeningHourFormValue()];

export const mapGenericItemMediaContents = (item: GenericItemContentItem) =>
  item.mediaContents && item.mediaContents.length > 0
    ? item.mediaContents.map((mediaContent) => ({
        captionText: mediaContent.captionText ?? '',
        copyright: mediaContent.copyright ?? '',
        contentType: mediaContent.contentType ?? '',
        height: stringifyFiniteNumber(mediaContent.height),
        width: stringifyFiniteNumber(mediaContent.width),
        sourceUrl: {
          url: mediaContent.sourceUrl?.url ?? '',
          description: mediaContent.sourceUrl?.description ?? '',
        },
      }))
    : [];

export const mapGenericItemLocations = (item: GenericItemContentItem) =>
  item.locations && item.locations.length > 0
    ? item.locations.map((location) => ({
        name: location.name ?? '',
        department: location.department ?? '',
        district: location.district ?? '',
        regionName: location.regionName ?? '',
        state: location.state ?? '',
        latitude: stringifyFiniteNumber(location.geoLocation?.latitude),
        longitude: stringifyFiniteNumber(location.geoLocation?.longitude),
      }))
    : [createDefaultLocationFormValue()];

export const mapGenericItemDates = (item: GenericItemContentItem) =>
  item.dates && item.dates.length > 0
    ? item.dates.map((date) => ({
        weekday: date.weekday ?? '',
        dateStart: date.dateStart ?? '',
        dateEnd: date.dateEnd ?? '',
        timeStart: date.timeStart ?? '',
        timeEnd: date.timeEnd ?? '',
        timeDescription: date.timeDescription ?? '',
        useOnlyTimeDescription: parseBooleanish(date.useOnlyTimeDescription),
      }))
    : [createDefaultDateFormValue()];

export const mapGenericItemAccessibilityInformations = (item: GenericItemContentItem) =>
  item.accessibilityInformations && item.accessibilityInformations.length > 0
    ? item.accessibilityInformations.map((accessibilityInformation) => ({
        description: accessibilityInformation.description ?? '',
        types: accessibilityInformation.types ?? '',
        urls:
          accessibilityInformation.urls && accessibilityInformation.urls.length > 0
            ? accessibilityInformation.urls.map((webUrl) => ({
                url: webUrl.url,
                description: webUrl.description ?? '',
              }))
            : [createDefaultWebUrlFormValue()],
      }))
    : [createDefaultAccessibilityInformationFormValue()];

export const mapGenericItemPriceInformations = (item: GenericItemContentItem) =>
  item.priceInformations && item.priceInformations.length > 0
    ? item.priceInformations.map((priceInformation) => ({
        name: priceInformation.name ?? '',
        amount: stringifyFiniteNumber(priceInformation.amount),
        groupPrice: priceInformation.groupPrice ?? false,
        ageFrom: stringifyFiniteNumber(priceInformation.ageFrom),
        ageTo: stringifyFiniteNumber(priceInformation.ageTo),
        minAdultCount: stringifyFiniteNumber(priceInformation.minAdultCount),
        maxAdultCount: stringifyFiniteNumber(priceInformation.maxAdultCount),
        minChildrenCount: stringifyFiniteNumber(priceInformation.minChildrenCount),
        maxChildrenCount: stringifyFiniteNumber(priceInformation.maxChildrenCount),
        description: priceInformation.description ?? '',
        category: priceInformation.category ?? '',
      }))
    : [createDefaultPriceInformationFormValue()];
