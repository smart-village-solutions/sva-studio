import { sanitizeRichTextHtml } from '@sva/core/rich-text-html';

import type {
  SvaMainserverAccessibilityInformationInput,
  SvaMainserverAddressInput,
  SvaMainserverCategoryInput,
  SvaMainserverContactInput,
  SvaMainserverDateInput,
  SvaMainserverEventInput,
  SvaMainserverOperatingCompanyInput,
  SvaMainserverPriceInput,
  SvaMainserverWebUrlInput,
} from '../types.js';
import {
  errorJson,
  isRecord,
  isResponse,
  isTimeOfDay,
  parseJsonObjectBody,
  readBoolean,
  readString,
  type ParsedValue,
} from './content-route-core.js';
import {
  parseAccessibilityInformation,
  parseAddressList,
  parseCategories,
  parseContact,
  parseMediaContents,
  parseOperatingCompany,
  parsePrices,
  parseTags,
  parseWebUrls,
} from './content-route-parsers.js';

const parseEventDates = (
  value: unknown
): readonly SvaMainserverDateInput[] | Response | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const dates: SvaMainserverDateInput[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }
    const timeStart = readString(item.timeStart);
    const timeEnd = readString(item.timeEnd);
    if ((timeStart && !isTimeOfDay(timeStart)) || (timeEnd && !isTimeOfDay(timeEnd))) {
      return errorJson(
        400,
        'invalid_request',
        'Termine müssen Uhrzeiten im Format HH:MM enthalten.'
      );
    }
    dates.push({
      ...(readString(item.weekday) ? { weekday: readString(item.weekday) } : {}),
      ...(readString(item.dateStart) ? { dateStart: readString(item.dateStart) } : {}),
      ...(readString(item.dateEnd) ? { dateEnd: readString(item.dateEnd) } : {}),
      ...(timeStart ? { timeStart } : {}),
      ...(timeEnd ? { timeEnd } : {}),
      ...(readString(item.timeDescription)
        ? { timeDescription: readString(item.timeDescription) }
        : {}),
      ...(readBoolean(item.useOnlyTimeDescription) !== undefined
        ? { useOnlyTimeDescription: readBoolean(item.useOnlyTimeDescription) }
        : {}),
    });
  }
  return dates;
};

const parseEventRelations = (
  body: Record<string, unknown>
): ParsedValue<{
  readonly categories: readonly SvaMainserverCategoryInput[] | undefined;
  readonly addresses: readonly SvaMainserverAddressInput[] | undefined;
  readonly contacts: readonly SvaMainserverContactInput[] | undefined;
  readonly urls: readonly SvaMainserverWebUrlInput[] | undefined;
  readonly mediaContents: SvaMainserverEventInput['mediaContents'] | undefined;
  readonly tags: readonly string[] | undefined;
  readonly organizer: SvaMainserverOperatingCompanyInput | undefined;
  readonly priceInformations: readonly SvaMainserverPriceInput[] | undefined;
  readonly accessibilityInformation: SvaMainserverAccessibilityInformationInput | undefined;
}> => {
  const categories = parseCategories(body.categories);
  if (isResponse(categories)) {
    return categories;
  }

  const addresses = parseAddressList(body.addresses);
  if (isResponse(addresses)) {
    return addresses;
  }

  const contactsValue = body.contacts;
  const contactValue = body.contact;
  let contacts: readonly SvaMainserverContactInput[] | undefined;
  if (Array.isArray(contactsValue)) {
    const nextContacts: SvaMainserverContactInput[] = [];
    for (const item of contactsValue) {
      const parsedContact = parseContact(item);
      if (isResponse(parsedContact)) {
        return parsedContact;
      }
      if (parsedContact) {
        nextContacts.push(parsedContact);
      }
    }
    contacts = nextContacts;
  } else {
    const contact = parseContact(contactValue);
    if (isResponse(contact)) {
      return contact;
    }
    contacts = contact ? [contact] : undefined;
  }

  const urls = parseWebUrls(body.urls);
  if (isResponse(urls)) {
    return urls;
  }

  const mediaContents = parseMediaContents(body.mediaContents);
  if (isResponse(mediaContents)) {
    return mediaContents;
  }

  const tags = parseTags(body.tags);
  if (isResponse(tags)) {
    return tags;
  }

  const organizer = parseOperatingCompany(body.organizer, { requireNameForDetails: true });
  if (isResponse(organizer)) {
    return organizer;
  }

  const priceInformations = parsePrices(body.priceInformations);
  if (isResponse(priceInformations)) {
    return priceInformations;
  }

  const accessibilityInformation = parseAccessibilityInformation(body.accessibilityInformation);
  if (isResponse(accessibilityInformation)) {
    return accessibilityInformation;
  }

  return {
    categories,
    addresses,
    contacts,
    urls,
    mediaContents,
    tags,
    organizer,
    priceInformations,
    accessibilityInformation,
  };
};

type EventRelations = {
  readonly categories: readonly SvaMainserverCategoryInput[] | undefined;
  readonly addresses: readonly SvaMainserverAddressInput[] | undefined;
  readonly contacts: readonly SvaMainserverContactInput[] | undefined;
  readonly urls: readonly SvaMainserverWebUrlInput[] | undefined;
  readonly mediaContents: SvaMainserverEventInput['mediaContents'] | undefined;
  readonly tags: readonly string[] | undefined;
  readonly organizer: SvaMainserverOperatingCompanyInput | undefined;
  readonly priceInformations: readonly SvaMainserverPriceInput[] | undefined;
  readonly accessibilityInformation: SvaMainserverAccessibilityInformationInput | undefined;
};

const eventRelationFields = (relations: EventRelations) => ({
  ...(relations.categories ? { categories: relations.categories } : {}),
  ...(relations.addresses ? { addresses: relations.addresses } : {}),
  ...(relations.contacts ? { contacts: relations.contacts } : {}),
  ...(relations.urls ? { urls: relations.urls } : {}),
  ...(relations.mediaContents ? { mediaContents: relations.mediaContents } : {}),
  ...(relations.organizer ? { organizer: relations.organizer } : {}),
  ...(relations.priceInformations ? { priceInformations: relations.priceInformations } : {}),
  ...(relations.accessibilityInformation
    ? { accessibilityInformation: relations.accessibilityInformation }
    : {}),
  ...(relations.tags ? { tags: relations.tags } : {}),
});

const buildEventInput = (
  body: Record<string, unknown>,
  title: string,
  dates: readonly SvaMainserverDateInput[] | undefined,
  relations: EventRelations
): SvaMainserverEventInput => {
  const description = readString(body.description);
  const sanitizedDescription = description ? sanitizeRichTextHtml(description) : undefined;

  return {
    title,
    ...(sanitizedDescription ? { description: sanitizedDescription } : {}),
    ...(readString(body.externalId) ? { externalId: readString(body.externalId) } : {}),
    ...(readString(body.keywords) ? { keywords: readString(body.keywords) } : {}),
    ...(dates ? { dates } : {}),
    ...(readBoolean(body.repeat) !== undefined ? { repeat: readBoolean(body.repeat) } : {}),
    ...(readString(body.categoryName) ? { categoryName: readString(body.categoryName) } : {}),
    ...eventRelationFields(relations),
    ...(readString(body.recurring) ? { recurring: readString(body.recurring) } : {}),
    ...(readString(body.recurringType) ? { recurringType: readString(body.recurringType) } : {}),
    ...(readString(body.recurringInterval)
      ? { recurringInterval: readString(body.recurringInterval) }
      : {}),
    ...(Array.isArray(body.recurringWeekdays)
      ? {
          recurringWeekdays: body.recurringWeekdays
            .map(readString)
            .filter((value): value is string => Boolean(value)),
        }
      : {}),
    ...(readString(body.pointOfInterestId)
      ? { pointOfInterestId: readString(body.pointOfInterestId) }
      : {}),
  };
};

export const parseEventInput = async (
  request: Request
): Promise<Readonly<{ event: SvaMainserverEventInput; visible?: boolean }> | Response> => {
  const body = await parseJsonObjectBody(request, 'Event-Daten müssen als Objekt gesendet werden.');
  if (isResponse(body)) {
    return body;
  }

  const title = readString(body.title);
  if (!title) {
    return errorJson(400, 'invalid_request', 'Der Event-Titel ist erforderlich.');
  }

  const relations = parseEventRelations(body);
  if (isResponse(relations)) {
    return relations;
  }

  const dates = parseEventDates(body.dates);
  if (isResponse(dates)) {
    return dates;
  }

  const visible = readBoolean(body.visible);
  if (body.visible !== undefined && visible === undefined) {
    return errorJson(
      400,
      'invalid_request',
      'Das Feld "visible" muss als Boolean gesendet werden.'
    );
  }

  return {
    event: buildEventInput(body, title, dates, relations),
    ...(visible !== undefined ? { visible } : {}),
  };
};
