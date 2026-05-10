import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteHouseNumberRecord,
  WasteLocationTourLinkRecord,
  WasteManagementMasterDataOverview,
  WasteRegionRecord,
  WasteStreetRecord,
  WasteTourRecord,
} from '@sva/core';

const findRegionName = (regions: readonly WasteRegionRecord[], regionId?: string): string | undefined =>
  regionId ? regions.find((region) => region.id === regionId)?.name : undefined;

const findCityName = (cities: readonly WasteCityRecord[], cityId: string): string =>
  cities.find((city) => city.id === cityId)?.name ?? cityId;

const findStreetName = (streets: readonly WasteStreetRecord[], streetId?: string): string | undefined =>
  streetId ? streets.find((street) => street.id === streetId)?.name : undefined;

const findHouseNumberValue = (
  houseNumbers: readonly WasteHouseNumberRecord[],
  houseNumberId?: string
): string | undefined => (houseNumberId ? houseNumbers.find((entry) => entry.id === houseNumberId)?.number : undefined);

export const formatCollectionLocationLabel = (
  pt: (key: string) => string,
  data: Pick<WasteManagementMasterDataOverview, 'regions' | 'cities' | 'streets' | 'houseNumbers'>,
  location: WasteCollectionLocationRecord
): string => {
  const parts = [
    findRegionName(data.regions, location.regionId),
    findCityName(data.cities, location.cityId),
    findStreetName(data.streets, location.streetId) ?? pt('masterData.collectionLocations.meta.allStreets'),
    findHouseNumberValue(data.houseNumbers, location.houseNumberId) ?? pt('masterData.collectionLocations.meta.allHouseNumbers'),
  ].filter((value): value is string => Boolean(value));

  return parts.join(' / ');
};

export const resolveTourLocationOptions = (
  pt: (key: string) => string,
  data: WasteManagementMasterDataOverview | null
): readonly { id: string; label: string }[] =>
  (data?.collectionLocations ?? []).map((location) => ({
    id: location.id,
    label: formatCollectionLocationLabel(
      pt,
      data ?? { regions: [], cities: [], streets: [], houseNumbers: [] },
      location
    ),
  }));

export const resolveTourAssignmentItems = (
  pt: (key: string) => string,
  data: WasteManagementMasterDataOverview | null,
  tour: WasteTourRecord
): readonly {
  id: string;
  label: string;
  startDate?: string;
  endDate?: string;
}[] =>
  !data
    ? []
    : (data.locationTourLinks ?? [])
        .filter((link: WasteLocationTourLinkRecord) => link.tourId === tour.id)
        .flatMap((link) => {
          const location = data.collectionLocations.find((entry) => entry.id === link.locationId);
          if (!location) {
            return [];
          }
          return [
            {
              id: link.id,
              label: formatCollectionLocationLabel(pt, data, location),
              startDate: link.startDate,
              endDate: link.endDate,
            },
          ];
        });
