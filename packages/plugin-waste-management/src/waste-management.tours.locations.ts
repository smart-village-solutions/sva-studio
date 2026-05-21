import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteHouseNumberRecord,
  WasteLocationTourLinkRecord,
  WasteManagementMasterDataOverview,
  WasteRegionRecord,
  WasteStreetRecord,
  WasteTourRecord,
} from '@sva/plugin-sdk';

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

export type TourAssignmentLocationOption = Readonly<{
  id: string;
  label: string;
  active: boolean;
  regionId: string;
  regionName: string;
  cityId: string;
  cityName: string;
  streetId: string;
  streetName: string;
  assignedLinkId?: string;
}>;

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

export const resolveTourAssignmentLocationOptions = (
  pt: (key: string) => string,
  data: WasteManagementMasterDataOverview | null,
  tourId?: string
): readonly TourAssignmentLocationOption[] => {
  if (!data) {
    return [];
  }

  const assignedLinkIdByLocationId = new Map<string, string>();
  if (tourId) {
    for (const link of data.locationTourLinks ?? []) {
      if (link.tourId === tourId) {
        assignedLinkIdByLocationId.set(link.locationId, link.id);
      }
    }
  }

  return data.collectionLocations.map((location) => ({
    id: location.id,
    label: formatCollectionLocationLabel(pt, data, location),
    active: location.active,
    regionId: location.regionId ?? '',
    regionName: findRegionName(data.regions, location.regionId) ?? '',
    cityId: location.cityId,
    cityName: findCityName(data.cities, location.cityId),
    streetId: location.streetId ?? '',
    streetName: findStreetName(data.streets, location.streetId) ?? pt('masterData.collectionLocations.meta.allStreets'),
    assignedLinkId: assignedLinkIdByLocationId.get(location.id),
  }));
};

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
