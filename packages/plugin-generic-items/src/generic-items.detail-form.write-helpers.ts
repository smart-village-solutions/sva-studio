import type { GenericItemsDetailFormValues } from './generic-items.validation.js';

const sanitizeOptionalString = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseOptionalNumber = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const parseOptionalJson = <T>(value: string): T | undefined => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return JSON.parse(trimmed) as T;
};

export const mapWebUrlsToInput = (webUrls: GenericItemsDetailFormValues['webUrls']) => {
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

  return mapped;
};

export const mapContactsToInput = (contacts: GenericItemsDetailFormValues['contacts']) => {
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

  return mapped;
};

export const mapAddressesToInput = (addresses: GenericItemsDetailFormValues['addresses']) => {
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

  return mapped;
};

export const mapDatesToInput = (dates: GenericItemsDetailFormValues['dates']) => {
  const mapped = dates
    .map((date) => {
      const weekday = sanitizeOptionalString(date.weekday);
      const dateStart = sanitizeOptionalString(date.dateStart);
      const dateEnd = sanitizeOptionalString(date.dateEnd);
      const timeStart = sanitizeOptionalString(date.timeStart);
      const timeEnd = sanitizeOptionalString(date.timeEnd);
      const timeDescription = sanitizeOptionalString(date.timeDescription);
      const hasContent = [weekday, dateStart, dateEnd, timeStart, timeEnd, timeDescription].some(
        (value) => value !== undefined
      );
      return hasContent
        ? {
            ...(weekday !== undefined ? { weekday } : {}),
            ...(dateStart !== undefined ? { dateStart } : {}),
            ...(dateEnd !== undefined ? { dateEnd } : {}),
            ...(timeStart !== undefined ? { timeStart } : {}),
            ...(timeEnd !== undefined ? { timeEnd } : {}),
            ...(timeDescription !== undefined ? { timeDescription } : {}),
            useOnlyTimeDescription: date.useOnlyTimeDescription,
          }
        : undefined;
    })
    .filter((date): date is NonNullable<typeof date> => date !== undefined);

  return mapped;
};

export const mapContentBlocksToInput = (contentBlocks: GenericItemsDetailFormValues['contentBlocks']) => {
  const mapped = contentBlocks
    .map((contentBlock) => ({
      title: sanitizeOptionalString(contentBlock.title),
      intro: sanitizeOptionalString(contentBlock.intro),
      body: sanitizeOptionalString(contentBlock.body),
    }))
    .filter((contentBlock) => [contentBlock.title, contentBlock.intro, contentBlock.body].some((value) => value !== undefined));

  return mapped;
};

export const mapOpeningHoursToInput = (openingHours: GenericItemsDetailFormValues['openingHours']) => {
  const mapped = openingHours
    .map((openingHour) => {
      const mappedOpeningHour = {
        weekday: sanitizeOptionalString(openingHour.weekday),
        dateFrom: sanitizeOptionalString(openingHour.dateFrom),
        dateTo: sanitizeOptionalString(openingHour.dateTo),
        timeFrom: sanitizeOptionalString(openingHour.timeFrom),
        timeTo: sanitizeOptionalString(openingHour.timeTo),
        description: sanitizeOptionalString(openingHour.description),
      };
      const hasContent = Object.values(mappedOpeningHour).some((value) => value !== undefined);
      return hasContent
        ? {
            ...mappedOpeningHour,
            open: openingHour.open,
          }
        : undefined;
    })
    .filter((openingHour): openingHour is NonNullable<typeof openingHour> => openingHour !== undefined);

  return mapped;
};

export const mapMediaContentsToInput = (mediaContents: GenericItemsDetailFormValues['mediaContents']) => {
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

  return mapped;
};

export const mapLocationsToInput = (locations: GenericItemsDetailFormValues['locations']) => {
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

  return mapped;
};

export const mapAccessibilityInformationsToInput = (
  accessibilityInformations: GenericItemsDetailFormValues['accessibilityInformations']
) => {
  const mapped = accessibilityInformations
    .map((accessibilityInformation) => {
      const description = sanitizeOptionalString(accessibilityInformation.description);
      const types = sanitizeOptionalString(accessibilityInformation.types);
      const urls = mapWebUrlsToInput(accessibilityInformation.urls);
      const hasContent = description !== undefined || types !== undefined || urls.length > 0;

      return hasContent
        ? {
            ...(description !== undefined ? { description } : {}),
            ...(types !== undefined ? { types } : {}),
            urls,
          }
        : undefined;
    })
    .filter((accessibilityInformation): accessibilityInformation is NonNullable<typeof accessibilityInformation> =>
      accessibilityInformation !== undefined
    );

  return mapped;
};

export const mapPriceInformationsToInput = (priceInformations: GenericItemsDetailFormValues['priceInformations']) => {
  const mapped = priceInformations
    .map((priceInformation) => {
      const mappedPriceInformation = {
        name: sanitizeOptionalString(priceInformation.name),
        amount: parseOptionalNumber(priceInformation.amount),
        ageFrom: parseOptionalNumber(priceInformation.ageFrom),
        ageTo: parseOptionalNumber(priceInformation.ageTo),
        minAdultCount: parseOptionalNumber(priceInformation.minAdultCount),
        maxAdultCount: parseOptionalNumber(priceInformation.maxAdultCount),
        minChildrenCount: parseOptionalNumber(priceInformation.minChildrenCount),
        maxChildrenCount: parseOptionalNumber(priceInformation.maxChildrenCount),
        description: sanitizeOptionalString(priceInformation.description),
        category: sanitizeOptionalString(priceInformation.category),
      };
      const hasContent = Object.values(mappedPriceInformation).some((value) => value !== undefined);
      return hasContent
        ? {
            ...mappedPriceInformation,
            groupPrice: priceInformation.groupPrice,
          }
        : undefined;
    })
    .filter((priceInformation): priceInformation is NonNullable<typeof priceInformation> => priceInformation !== undefined);

  return mapped;
};
