import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteHouseNumberRecord,
  WasteRegionRecord,
  WasteStreetRecord,
} from '@sva/plugin-sdk';

import type {
  WasteManagementOutputOverview,
  WasteManagementOutputPdfResult,
} from './waste-management.api.js';

export type OutputLocationData = Readonly<{
  collectionLocations: readonly WasteCollectionLocationRecord[];
  regions: readonly WasteRegionRecord[];
  cities: readonly WasteCityRecord[];
  streets: readonly WasteStreetRecord[];
  houseNumbers: readonly WasteHouseNumberRecord[];
}>;

type OutputLocationMaps = Readonly<{
  regionsById: ReadonlyMap<string, WasteRegionRecord>;
  citiesById: ReadonlyMap<string, WasteCityRecord>;
  streetsById: ReadonlyMap<string, WasteStreetRecord>;
  houseNumbersById: ReadonlyMap<string, WasteHouseNumberRecord>;
}>;

export type OutputLocationOption = Readonly<{
  id: string;
  label: string;
}>;

const createLocationMaps = (locationData: OutputLocationData): OutputLocationMaps => ({
  regionsById: new Map(locationData.regions.map((region) => [region.id, region] as const)),
  citiesById: new Map(locationData.cities.map((city) => [city.id, city] as const)),
  streetsById: new Map(locationData.streets.map((street) => [street.id, street] as const)),
  houseNumbersById: new Map(locationData.houseNumbers.map((houseNumber) => [houseNumber.id, houseNumber] as const)),
});

const buildCollectionLocationLabel = (
  location: WasteCollectionLocationRecord,
  maps: OutputLocationMaps
): string => {
  const region = location.regionId ? maps.regionsById.get(location.regionId)?.name : undefined;
  const city = maps.citiesById.get(location.cityId)?.name;
  const street = location.streetId ? maps.streetsById.get(location.streetId)?.name : undefined;
  const houseNumber = location.houseNumberId ? maps.houseNumbersById.get(location.houseNumberId)?.number : undefined;
  const address = [street, houseNumber].filter(Boolean).join(' ');
  return [region, city, address].filter(Boolean).join(', ') || location.id;
};

export const buildOutputLocationOptions = (locationData: OutputLocationData | null): readonly OutputLocationOption[] => {
  if (locationData === null) {
    return [];
  }

  const maps = createLocationMaps(locationData);
  return locationData.collectionLocations
    .map((location) => ({
      id: location.id,
      label: buildCollectionLocationLabel(location, maps),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'de', { numeric: true, sensitivity: 'base' }));
};

export const parseOutputYear = (value: string): number | null => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
};

export const isOutputYearValid = (year: number | null): year is number => year !== null && year >= 2000 && year <= 2100;

export const findOutputArtifacts = (
  outputOverview: WasteManagementOutputOverview | null,
  selectedLocationId: string
) => outputOverview?.collectionLocations.find((entry) => entry.collectionLocationId === selectedLocationId)?.pdfs ?? [];

export const upsertGeneratedPdf = (
  current: WasteManagementOutputOverview | null,
  result: WasteManagementOutputPdfResult
): WasteManagementOutputOverview => {
  const nextLocations = [...(current?.collectionLocations ?? [])];
  const locationIndex = nextLocations.findIndex((entry) => entry.collectionLocationId === result.collectionLocationId);
  const nextPdf = {
    year: result.year,
    deliveryUrl: result.deliveryUrl,
    expiresAt: result.expiresAt,
    storageKey: result.storageKey,
  };

  if (locationIndex === -1) {
    nextLocations.push({ collectionLocationId: result.collectionLocationId, pdfs: [nextPdf] });
  } else {
    const currentEntry = nextLocations[locationIndex];
    const remainingPdfs = currentEntry ? currentEntry.pdfs.filter((pdf) => pdf.year !== result.year) : [];
    nextLocations[locationIndex] = {
      collectionLocationId: result.collectionLocationId,
      pdfs: [...remainingPdfs, nextPdf].sort((left, right) => right.year - left.year),
    };
  }

  return { collectionLocations: nextLocations };
};
