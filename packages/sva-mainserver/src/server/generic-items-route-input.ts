import type {
  SvaMainserverAccessibilityInformationInput,
  SvaMainserverAddressInput,
  SvaMainserverCategoryInput,
  SvaMainserverContactInput,
  SvaMainserverContentBlockInput,
  SvaMainserverDateInput,
  SvaMainserverGenericItemInput,
  SvaMainserverLocationInput,
  SvaMainserverMediaContentInput,
  SvaMainserverOpeningHourInput,
  SvaMainserverPriceInput,
  SvaMainserverWebUrlInput,
} from '../types.js';
import {
  errorJson,
  isResponse,
  parseJsonObjectBody,
  readString,
} from './content-route-core.js';
import {
  parseAddressList,
  parseCategories,
  parseMediaContents,
  parseOpeningHours,
  parsePrices,
  parseWebUrls,
} from './content-route-parsers.js';
import { parseAccessibilityInformations } from './generic-items-route-input.accessibility.js';
import { buildGenericItemInput } from './generic-items-route-input.builder.js';
import { parseContentBlocks } from './generic-items-route-input.content-blocks.js';
import { parseContactList } from './generic-items-route-input.contacts.js';
import { parseDates } from './generic-items-route-input.dates.js';
import { parseLocations } from './generic-items-route-input.locations.js';

const parseGenericItemSections = (body: Record<string, unknown>) => ({
  categories: parseCategories(body.categories),
  contacts: parseContactList(body.contacts),
  webUrls: parseWebUrls(body.webUrls),
  addresses: parseAddressList(body.addresses),
  contentBlocks: parseContentBlocks(body.contentBlocks),
  openingHours: parseOpeningHours(body.openingHours),
  priceInformations: parsePrices(body.priceInformations),
  mediaContents: parseMediaContents(body.mediaContents),
  locations: parseLocations(body.locations),
  dates: parseDates(body.dates),
  accessibilityInformations: parseAccessibilityInformations(body.accessibilityInformations),
});

type ParsedGenericItemSections = ReturnType<typeof parseGenericItemSections>;

const hasSectionParseError = (
  sections: ParsedGenericItemSections
): sections is ParsedGenericItemSections & Record<string, Response> =>
  Object.values(sections).some((parsed) => parsed instanceof Response);

const findSectionParseError = (sections: ParsedGenericItemSections) =>
  Object.values(sections).find((parsed): parsed is Response => parsed instanceof Response);

export const parseGenericItemInput = async (request: Request): Promise<SvaMainserverGenericItemInput | Response> => {
  const body = await parseJsonObjectBody(request, 'Generic-Item-Daten müssen als Objekt gesendet werden.');
  if (isResponse(body)) {
    return body;
  }

  const title = readString(body.title);
  if (!title) {
    return errorJson(400, 'invalid_request', 'Der Titel ist erforderlich.');
  }

  const genericType = readString(body.genericType);
  if (!genericType) {
    return errorJson(400, 'invalid_request', 'Der Generic-Type ist erforderlich.');
  }

  const sections = parseGenericItemSections(body);
  if (hasSectionParseError(sections)) {
    return findSectionParseError(sections) ?? errorJson(400, 'invalid_request', 'Ungültige Generic-Item-Daten.');
  }

  const resolvedSections = sections as {
    categories: readonly SvaMainserverCategoryInput[] | undefined;
    contacts: readonly SvaMainserverContactInput[] | undefined;
    webUrls: readonly SvaMainserverWebUrlInput[] | undefined;
    addresses: readonly SvaMainserverAddressInput[] | undefined;
    contentBlocks: readonly SvaMainserverContentBlockInput[] | undefined;
    openingHours: readonly SvaMainserverOpeningHourInput[] | undefined;
    priceInformations: readonly SvaMainserverPriceInput[] | undefined;
    mediaContents: readonly SvaMainserverMediaContentInput[] | undefined;
    locations: readonly SvaMainserverLocationInput[] | undefined;
    dates: readonly SvaMainserverDateInput[] | undefined;
    accessibilityInformations: readonly SvaMainserverAccessibilityInformationInput[] | undefined;
  };

  return buildGenericItemInput({
    body,
    title,
    genericType,
    ...resolvedSections,
  });
};
