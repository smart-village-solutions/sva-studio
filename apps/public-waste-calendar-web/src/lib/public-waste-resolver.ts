import type {
  PublicWasteCityEntry,
  PublicWasteHouseNumberEntry,
  PublicWasteRegionEntry,
  PublicWasteResolvedSelection,
  PublicWasteSelectionState,
  PublicWasteSelectionStep,
  PublicWasteStreetEntry,
} from './public-waste-contract.js';

export type ResolvePublicWasteSelectionInput = {
  readonly availableRegions: readonly PublicWasteRegionEntry[];
  readonly availableCities: readonly PublicWasteCityEntry[];
  readonly availableStreets: readonly PublicWasteStreetEntry[];
  readonly availableHouseNumbers: readonly PublicWasteHouseNumberEntry[];
  readonly selected: PublicWasteSelectionState;
};

export type ResolvePublicWasteSelectionResult =
  | {
      readonly status: 'incomplete';
      readonly nextStep: Exclude<PublicWasteSelectionStep, 'complete'>;
      readonly resolvedSelection?: undefined;
    }
  | {
      readonly status: 'complete';
      readonly nextStep: 'complete';
      readonly resolvedSelection: PublicWasteResolvedSelection;
    };

const hasMultipleRegions = (regions: readonly PublicWasteRegionEntry[]) => regions.length > 1;

export const resolvePublicWasteSelection = (
  input: ResolvePublicWasteSelectionInput
): ResolvePublicWasteSelectionResult => {
  const regionId = input.selected.regionId ?? (hasMultipleRegions(input.availableRegions) ? undefined : input.availableRegions[0]?.id);
  if (!regionId) {
    return { status: 'incomplete', nextStep: 'region' };
  }

  const cityId = input.selected.cityId;
  if (!cityId) {
    return { status: 'incomplete', nextStep: 'city' };
  }

  const catchAllStreet =
    input.availableStreets.length === 1 && input.availableStreets[0]?.isCatchAll ? input.availableStreets[0] : null;

  const streetId = input.selected.streetId ?? catchAllStreet?.id;
  if (!streetId) {
    return { status: 'incomplete', nextStep: 'street' };
  }

  const houseNumberRequired = input.availableHouseNumbers.length > 1;
  const houseNumberId = input.selected.houseNumberId;
  if (houseNumberRequired && !houseNumberId) {
    return { status: 'incomplete', nextStep: 'houseNumber' };
  }

  return {
    status: 'complete',
    nextStep: 'complete',
    resolvedSelection: {
      regionId,
      cityId,
      streetId,
      ...(houseNumberId ? { houseNumberId } : {}),
    },
  };
};
