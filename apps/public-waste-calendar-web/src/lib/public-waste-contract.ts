export type PublicWasteSelectionStep = 'region' | 'city' | 'street' | 'houseNumber' | 'complete';

export type PublicWasteSelectableEntry = {
  readonly id: string;
  readonly label: string;
};

export type PublicWasteRegionEntry = PublicWasteSelectableEntry;

export type PublicWasteCityEntry = PublicWasteSelectableEntry & {
  readonly regionId: string;
};

export type PublicWasteStreetEntry = PublicWasteSelectableEntry & {
  readonly cityId: string;
  readonly isCatchAll?: boolean;
};

export type PublicWasteHouseNumberEntry = PublicWasteSelectableEntry & {
  readonly streetId: string;
};

export type PublicWasteSelectionState = {
  readonly regionId?: string;
  readonly cityId?: string;
  readonly streetId?: string;
  readonly houseNumberId?: string;
};

export type PublicWasteResolvedSelection = {
  readonly cityId: string;
  readonly streetId: string;
  readonly regionId?: string;
  readonly houseNumberId?: string;
};

export type PublicWasteCalendarEntry = {
  readonly id: string;
  readonly date: string;
  readonly fractionId: string;
  readonly fractionLabel: string;
  readonly fractionShortLabel?: string;
  readonly fractionColor?: string;
  readonly note: string | null;
};

export type PublicWasteFractionOption = {
  readonly id: string;
  readonly label: string;
  readonly color?: string;
};

const PUBLIC_WASTE_LOCATION_KEY_EMPTY_SEGMENT = '~';
export const PUBLIC_WASTE_CATCH_ALL_STREET_ID = 'all';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isPublicWasteUuid = (value: string): boolean => UUID_PATTERN.test(value);
export const isPublicWasteStreetSelectionId = (value: string): boolean =>
  value === PUBLIC_WASTE_CATCH_ALL_STREET_ID || isPublicWasteUuid(value);

export const buildPublicWasteLocationKey = (state: PublicWasteResolvedSelection): string =>
  [
    state.regionId ?? PUBLIC_WASTE_LOCATION_KEY_EMPTY_SEGMENT,
    state.cityId,
    state.streetId,
    state.houseNumberId ?? PUBLIC_WASTE_LOCATION_KEY_EMPTY_SEGMENT,
  ].join(':');

export const parsePublicWasteLocationKey = (locationKey: string): PublicWasteResolvedSelection | null => {
  const [rawRegionId, cityId, streetId, rawHouseNumberId] = locationKey.split(':');
  if (!cityId || !streetId || !isPublicWasteUuid(cityId) || !isPublicWasteStreetSelectionId(streetId)) {
    return null;
  }

  const regionId = rawRegionId && rawRegionId !== PUBLIC_WASTE_LOCATION_KEY_EMPTY_SEGMENT ? rawRegionId : undefined;
  const houseNumberId =
    rawHouseNumberId && rawHouseNumberId !== PUBLIC_WASTE_LOCATION_KEY_EMPTY_SEGMENT ? rawHouseNumberId : undefined;
  if (regionId && !isPublicWasteUuid(regionId)) {
    return null;
  }
  if (houseNumberId && !isPublicWasteUuid(houseNumberId)) {
    return null;
  }

  return {
    cityId,
    streetId,
    ...(regionId ? { regionId } : {}),
    ...(houseNumberId ? { houseNumberId } : {}),
  };
};
