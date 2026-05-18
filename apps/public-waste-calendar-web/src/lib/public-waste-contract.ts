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

export type PublicWasteResolvedSelection = Required<
  Pick<PublicWasteSelectionState, 'regionId' | 'cityId' | 'streetId'>
> &
  Pick<PublicWasteSelectionState, 'houseNumberId'>;

export type PublicWasteCalendarEntry = {
  readonly id: string;
  readonly date: string;
  readonly fractionId: string;
  readonly fractionLabel: string;
  readonly note: string | null;
};

export type PublicWasteFractionOption = {
  readonly id: string;
  readonly label: string;
};

export const buildPublicWasteLocationKey = (state: Required<PublicWasteSelectionState>): string =>
  [state.regionId, state.cityId, state.streetId, state.houseNumberId].join(':');
