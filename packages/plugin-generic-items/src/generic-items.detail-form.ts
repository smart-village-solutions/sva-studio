import type { GenericItemContentItem, GenericItemFormInput } from './generic-items.types.js';
import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

const stringifyJson = (value: unknown, fallback: '{}' | '[]'): string => {
  if (value === undefined) {
    return fallback;
  }
  return JSON.stringify(value, null, 2);
};

const parseOptionalJson = <T>(value: string): T | undefined => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return JSON.parse(trimmed) as T;
};

const createDefaultWebUrlFormValue = () => ({
  url: '',
  description: '',
});

const createDefaultAccessibilityInformationFormValue = () => ({
  description: '',
  types: '',
  urls: [createDefaultWebUrlFormValue()],
});

const createDefaultContactFormValue = () => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
});

const createDefaultAddressFormValue = () => ({
  addition: '',
  street: '',
  zip: '',
  city: '',
  kind: '',
  latitude: '',
  longitude: '',
});

const createDefaultDateFormValue = () => ({
  weekday: '',
  dateStart: '',
  dateEnd: '',
  timeStart: '',
  timeEnd: '',
  timeDescription: '',
  useOnlyTimeDescription: false,
});

const createDefaultPriceInformationFormValue = () => ({
  name: '',
  amount: '',
  groupPrice: false,
  ageFrom: '',
  ageTo: '',
  minAdultCount: '',
  maxAdultCount: '',
  minChildrenCount: '',
  maxChildrenCount: '',
  description: '',
  category: '',
});

const createDefaultContentBlockFormValue = () => ({
  title: '',
  intro: '',
  body: '',
});

const createDefaultOpeningHourFormValue = () => ({
  weekday: '',
  dateFrom: '',
  dateTo: '',
  timeFrom: '',
  timeTo: '',
  description: '',
  open: false,
});

const createDefaultMediaContentFormValue = () => ({
  captionText: '',
  copyright: '',
  contentType: '',
  height: '',
  width: '',
  sourceUrl: {
    url: '',
    description: '',
  },
});

const createDefaultLocationFormValue = () => ({
  name: '',
  department: '',
  district: '',
  regionName: '',
  state: '',
  latitude: '',
  longitude: '',
});

const sanitizeOptionalString = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const mapWebUrlsToInput = (webUrls: GenericItemsDetailFormValues['webUrls']) => {
  const mapped = webUrls
    .map((webUrl) => ({
      url: sanitizeOptionalString(webUrl.url),
      description: sanitizeOptionalString(webUrl.description),
    }))
    .filter((webUrl) => typeof webUrl.url === 'string')
    .map((webUrl) => ({
      url: webUrl.url as string,
      ...(webUrl.description !== undefined ? { description: webUrl.description } : {}),
    }));

  return mapped.length > 0 ? mapped : undefined;
};

const mapContactsToInput = (contacts: GenericItemsDetailFormValues['contacts']) => {
  const mapped = contacts
    .map((contact) => ({
      firstName: sanitizeOptionalString(contact.firstName),
      lastName: sanitizeOptionalString(contact.lastName),
      email: sanitizeOptionalString(contact.email),
      phone: sanitizeOptionalString(contact.phone),
    }))
    .filter((contact) =>
      [contact.firstName, contact.lastName, contact.email, contact.phone].some((value) => typeof value === 'string')
    );

  return mapped.length > 0 ? mapped : undefined;
};

const parseOptionalNumber = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const mapAddressesToInput = (addresses: GenericItemsDetailFormValues['addresses']) => {
  const mapped = addresses
    .map((address) => {
      const latitude = parseOptionalNumber(address.latitude);
      const longitude = parseOptionalNumber(address.longitude);

      return {
        addition: sanitizeOptionalString(address.addition),
        street: sanitizeOptionalString(address.street),
        zip: sanitizeOptionalString(address.zip),
        city: sanitizeOptionalString(address.city),
        kind: sanitizeOptionalString(address.kind),
        geoLocation: latitude !== undefined || longitude !== undefined ? { latitude, longitude } : undefined,
      };
    })
    .filter((address) =>
      [address.addition, address.street, address.zip, address.city, address.kind, address.geoLocation].some(
        (value) => value !== undefined
      )
    );

  return mapped.length > 0 ? mapped : undefined;
};

const mapDatesToInput = (dates: GenericItemsDetailFormValues['dates']) => {
  const mapped = dates
    .map((date) => ({
      weekday: sanitizeOptionalString(date.weekday),
      dateStart: sanitizeOptionalString(date.dateStart),
      dateEnd: sanitizeOptionalString(date.dateEnd),
      timeStart: sanitizeOptionalString(date.timeStart),
      timeEnd: sanitizeOptionalString(date.timeEnd),
      timeDescription: sanitizeOptionalString(date.timeDescription),
      useOnlyTimeDescription: date.useOnlyTimeDescription || undefined,
    }))
    .filter((date) =>
      [
        date.weekday,
        date.dateStart,
        date.dateEnd,
        date.timeStart,
        date.timeEnd,
        date.timeDescription,
        date.useOnlyTimeDescription,
      ].some((value) => value !== undefined)
    );

  return mapped.length > 0 ? mapped : undefined;
};

const mapContentBlocksToInput = (contentBlocks: GenericItemsDetailFormValues['contentBlocks']) => {
  const mapped = contentBlocks
    .map((contentBlock) => ({
      title: sanitizeOptionalString(contentBlock.title),
      intro: sanitizeOptionalString(contentBlock.intro),
      body: sanitizeOptionalString(contentBlock.body),
    }))
    .filter((contentBlock) => [contentBlock.title, contentBlock.intro, contentBlock.body].some((value) => value !== undefined));

  return mapped.length > 0 ? mapped : undefined;
};

const mapOpeningHoursToInput = (openingHours: GenericItemsDetailFormValues['openingHours']) => {
  const mapped = openingHours
    .map((openingHour) => ({
      weekday: sanitizeOptionalString(openingHour.weekday),
      dateFrom: sanitizeOptionalString(openingHour.dateFrom),
      dateTo: sanitizeOptionalString(openingHour.dateTo),
      timeFrom: sanitizeOptionalString(openingHour.timeFrom),
      timeTo: sanitizeOptionalString(openingHour.timeTo),
      description: sanitizeOptionalString(openingHour.description),
      open: openingHour.open || undefined,
    }))
    .filter((openingHour) =>
      [
        openingHour.weekday,
        openingHour.dateFrom,
        openingHour.dateTo,
        openingHour.timeFrom,
        openingHour.timeTo,
        openingHour.description,
        openingHour.open,
      ].some((value) => value !== undefined)
    );

  return mapped.length > 0 ? mapped : undefined;
};

const mapMediaContentsToInput = (mediaContents: GenericItemsDetailFormValues['mediaContents']) => {
  const mapped = mediaContents
    .map((mediaContent) => {
      const width = parseOptionalNumber(mediaContent.width);
      const height = parseOptionalNumber(mediaContent.height);
      const url = sanitizeOptionalString(mediaContent.sourceUrl.url);

      return {
        captionText: sanitizeOptionalString(mediaContent.captionText),
        copyright: sanitizeOptionalString(mediaContent.copyright),
        contentType: sanitizeOptionalString(mediaContent.contentType),
        width,
        height,
        sourceUrl:
          url !== undefined
            ? {
                url,
                description: sanitizeOptionalString(mediaContent.sourceUrl.description),
              }
            : undefined,
      };
    })
    .filter((mediaContent) =>
      [mediaContent.captionText, mediaContent.copyright, mediaContent.contentType, mediaContent.width, mediaContent.height, mediaContent.sourceUrl]
        .some((value) => value !== undefined)
    );

  return mapped.length > 0 ? mapped : undefined;
};

const mapLocationsToInput = (locations: GenericItemsDetailFormValues['locations']) => {
  const mapped = locations
    .map((location) => {
      const latitude = parseOptionalNumber(location.latitude);
      const longitude = parseOptionalNumber(location.longitude);

      return {
        name: sanitizeOptionalString(location.name),
        department: sanitizeOptionalString(location.department),
        district: sanitizeOptionalString(location.district),
        regionName: sanitizeOptionalString(location.regionName),
        state: sanitizeOptionalString(location.state),
        geoLocation: latitude !== undefined || longitude !== undefined ? { latitude, longitude } : undefined,
      };
    })
    .filter((location) =>
      [location.name, location.department, location.district, location.regionName, location.state, location.geoLocation].some(
        (value) => value !== undefined
      )
    );

  return mapped.length > 0 ? mapped : undefined;
};

const mapAccessibilityInformationsToInput = (
  accessibilityInformations: GenericItemsDetailFormValues['accessibilityInformations']
) => {
  const mapped = accessibilityInformations
    .map((accessibilityInformation) => ({
      description: sanitizeOptionalString(accessibilityInformation.description),
      types: sanitizeOptionalString(accessibilityInformation.types),
      urls: mapWebUrlsToInput(accessibilityInformation.urls),
    }))
    .filter((accessibilityInformation) =>
      [accessibilityInformation.description, accessibilityInformation.types, accessibilityInformation.urls].some(
        (value) => value !== undefined
      )
    );

  return mapped.length > 0 ? mapped : undefined;
};

const mapPriceInformationsToInput = (priceInformations: GenericItemsDetailFormValues['priceInformations']) => {
  const mapped = priceInformations
    .map((priceInformation) => ({
      name: sanitizeOptionalString(priceInformation.name),
      amount: parseOptionalNumber(priceInformation.amount),
      groupPrice: priceInformation.groupPrice || undefined,
      ageFrom: parseOptionalNumber(priceInformation.ageFrom),
      ageTo: parseOptionalNumber(priceInformation.ageTo),
      minAdultCount: parseOptionalNumber(priceInformation.minAdultCount),
      maxAdultCount: parseOptionalNumber(priceInformation.maxAdultCount),
      minChildrenCount: parseOptionalNumber(priceInformation.minChildrenCount),
      maxChildrenCount: parseOptionalNumber(priceInformation.maxChildrenCount),
      description: sanitizeOptionalString(priceInformation.description),
      category: sanitizeOptionalString(priceInformation.category),
    }))
    .filter((priceInformation) =>
      [
        priceInformation.name,
        priceInformation.amount,
        priceInformation.groupPrice,
        priceInformation.ageFrom,
        priceInformation.ageTo,
        priceInformation.minAdultCount,
        priceInformation.maxAdultCount,
        priceInformation.minChildrenCount,
        priceInformation.maxChildrenCount,
        priceInformation.description,
        priceInformation.category,
      ].some((value) => value !== undefined)
    );

  return mapped.length > 0 ? mapped : undefined;
};

export const createDefaultGenericItemsDetailFormValues = (): GenericItemsDetailFormValues => ({
  title: '',
  genericType: '',
  teaser: '',
  visible: true,
  author: '',
  keywords: '',
  externalId: '',
  publicationDate: '',
  publishedAt: '',
  categories: [],
  contacts: [createDefaultContactFormValue()],
  webUrls: [createDefaultWebUrlFormValue()],
  addresses: [createDefaultAddressFormValue()],
  contentBlocks: [createDefaultContentBlockFormValue()],
  openingHours: [createDefaultOpeningHourFormValue()],
  mediaContents: [],
  locations: [createDefaultLocationFormValue()],
  dates: [createDefaultDateFormValue()],
  accessibilityInformations: [createDefaultAccessibilityInformationFormValue()],
  priceInformations: [createDefaultPriceInformationFormValue()],
  payloadText: '{}',
});

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
  categories:
    item.categories?.map((category) => category.name.trim()).filter((name) => name.length > 0) ??
    (item.categoryName ? [item.categoryName] : []),
  contacts:
    item.contacts && item.contacts.length > 0
      ? item.contacts.map((contact) => ({
          firstName: contact.firstName ?? '',
          lastName: contact.lastName ?? '',
          email: contact.email ?? '',
          phone: contact.phone ?? '',
        }))
      : [createDefaultContactFormValue()],
  webUrls:
    item.webUrls && item.webUrls.length > 0
      ? item.webUrls.map((webUrl) => ({
          url: webUrl.url,
          description: webUrl.description ?? '',
        }))
      : [createDefaultWebUrlFormValue()],
  addresses:
    item.addresses && item.addresses.length > 0
      ? item.addresses.map((address) => ({
          addition: address.addition ?? '',
          street: address.street ?? '',
          zip: address.zip ?? '',
          city: address.city ?? '',
          kind: address.kind ?? '',
          latitude:
            typeof address.geoLocation?.latitude === 'number' && Number.isFinite(address.geoLocation.latitude)
              ? String(address.geoLocation.latitude)
              : '',
          longitude:
            typeof address.geoLocation?.longitude === 'number' && Number.isFinite(address.geoLocation.longitude)
              ? String(address.geoLocation.longitude)
              : '',
        }))
      : [createDefaultAddressFormValue()],
  contentBlocks:
    item.contentBlocks && item.contentBlocks.length > 0
      ? item.contentBlocks.map((contentBlock) => ({
          title: contentBlock.title ?? '',
          intro: contentBlock.intro ?? '',
          body: contentBlock.body ?? '',
        }))
      : [createDefaultContentBlockFormValue()],
  openingHours:
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
      : [createDefaultOpeningHourFormValue()],
  mediaContents:
    item.mediaContents && item.mediaContents.length > 0
      ? item.mediaContents.map((mediaContent) => ({
          captionText: mediaContent.captionText ?? '',
          copyright: mediaContent.copyright ?? '',
          contentType: mediaContent.contentType ?? '',
          height:
            typeof mediaContent.height === 'number' && Number.isFinite(mediaContent.height) ? String(mediaContent.height) : '',
          width:
            typeof mediaContent.width === 'number' && Number.isFinite(mediaContent.width) ? String(mediaContent.width) : '',
          sourceUrl: {
            url: mediaContent.sourceUrl?.url ?? '',
            description: mediaContent.sourceUrl?.description ?? '',
          },
        }))
      : [],
  locations:
    item.locations && item.locations.length > 0
      ? item.locations.map((location) => ({
          name: location.name ?? '',
          department: location.department ?? '',
          district: location.district ?? '',
          regionName: location.regionName ?? '',
          state: location.state ?? '',
          latitude:
            typeof location.geoLocation?.latitude === 'number' && Number.isFinite(location.geoLocation.latitude)
              ? String(location.geoLocation.latitude)
              : '',
          longitude:
            typeof location.geoLocation?.longitude === 'number' && Number.isFinite(location.geoLocation.longitude)
              ? String(location.geoLocation.longitude)
              : '',
        }))
      : [createDefaultLocationFormValue()],
  dates:
    item.dates && item.dates.length > 0
      ? item.dates.map((date) => ({
          weekday: date.weekday ?? '',
          dateStart: date.dateStart ?? '',
          dateEnd: date.dateEnd ?? '',
          timeStart: date.timeStart ?? '',
          timeEnd: date.timeEnd ?? '',
          timeDescription: date.timeDescription ?? '',
          useOnlyTimeDescription: date.useOnlyTimeDescription ?? false,
        }))
      : [createDefaultDateFormValue()],
  accessibilityInformations:
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
      : [createDefaultAccessibilityInformationFormValue()],
  priceInformations:
    item.priceInformations && item.priceInformations.length > 0
      ? item.priceInformations.map((priceInformation) => ({
          name: priceInformation.name ?? '',
          amount:
            typeof priceInformation.amount === 'number' && Number.isFinite(priceInformation.amount)
              ? String(priceInformation.amount)
              : '',
          groupPrice: priceInformation.groupPrice ?? false,
          ageFrom:
            typeof priceInformation.ageFrom === 'number' && Number.isFinite(priceInformation.ageFrom)
              ? String(priceInformation.ageFrom)
              : '',
          ageTo:
            typeof priceInformation.ageTo === 'number' && Number.isFinite(priceInformation.ageTo)
              ? String(priceInformation.ageTo)
              : '',
          minAdultCount:
            typeof priceInformation.minAdultCount === 'number' && Number.isFinite(priceInformation.minAdultCount)
              ? String(priceInformation.minAdultCount)
              : '',
          maxAdultCount:
            typeof priceInformation.maxAdultCount === 'number' && Number.isFinite(priceInformation.maxAdultCount)
              ? String(priceInformation.maxAdultCount)
              : '',
          minChildrenCount:
            typeof priceInformation.minChildrenCount === 'number' && Number.isFinite(priceInformation.minChildrenCount)
              ? String(priceInformation.minChildrenCount)
              : '',
          maxChildrenCount:
            typeof priceInformation.maxChildrenCount === 'number' && Number.isFinite(priceInformation.maxChildrenCount)
              ? String(priceInformation.maxChildrenCount)
              : '',
          description: priceInformation.description ?? '',
          category: priceInformation.category ?? '',
        }))
      : [createDefaultPriceInformationFormValue()],
  payloadText: stringifyJson(item.payload, '{}'),
});

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
