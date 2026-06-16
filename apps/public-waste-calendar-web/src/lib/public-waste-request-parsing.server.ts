import type {
  PublicWasteResolvedSelection,
  PublicWasteSelectionState,
} from './public-waste-contract.js';
import { isPublicWasteStreetSelectionId, isPublicWasteUuid } from './public-waste-contract.js';
import { normalizeDateOnly } from './public-waste-date-utils.js';

const readRequiredParam = (url: URL, key: string): string => {
  const value = url.searchParams.get(key)?.trim();
  if (!value || !isPublicWasteUuid(value)) {
    throw new Error(`missing_query_param:${key}`);
  }
  return value;
};

const readOptionalParam = (url: URL, key: string): string | undefined => {
  const value = url.searchParams.get(key)?.trim();
  if (!value) {
    return undefined;
  }
  if (!isPublicWasteUuid(value)) {
    throw new Error(`invalid_query_param:${key}`);
  }
  return value;
};

const readRequiredStreetParam = (url: URL, key: string): string => {
  const value = url.searchParams.get(key)?.trim();
  if (!value || !isPublicWasteStreetSelectionId(value)) {
    throw new Error(`missing_query_param:${key}`);
  }
  return value;
};

const readOptionalStreetParam = (url: URL, key: string): string | undefined => {
  const value = url.searchParams.get(key)?.trim();
  if (!value) {
    return undefined;
  }
  if (!isPublicWasteStreetSelectionId(value)) {
    throw new Error(`invalid_query_param:${key}`);
  }
  return value;
};

export const readPublicWasteSelectionState = (url: URL): PublicWasteSelectionState => ({
  regionId: readOptionalParam(url, 'regionId'),
  cityId: readOptionalParam(url, 'cityId'),
  streetId: readOptionalStreetParam(url, 'streetId'),
  houseNumberId: readOptionalParam(url, 'houseNumberId'),
});

export const readPublicWasteResolvedSelection = (url: URL): PublicWasteResolvedSelection => ({
  regionId: readOptionalParam(url, 'regionId'),
  cityId: readRequiredParam(url, 'cityId'),
  streetId: readRequiredStreetParam(url, 'streetId'),
  houseNumberId: readOptionalParam(url, 'houseNumberId'),
});

export const readPublicWasteReferenceDate = (url: URL): string =>
  normalizeDateOnly(url.searchParams.get('referenceDate')) ?? new Date().toISOString().slice(0, 10);

export const readPublicWasteFractionIds = (url: URL): readonly string[] =>
  Array.from(new Set(url.searchParams.getAll('fractionId').map((value) => value.trim()).filter(Boolean)));

export const readPublicWasteCalendarName = (url: URL): string =>
  url.searchParams.get('calendarName')?.trim() || 'Abfallkalender';
