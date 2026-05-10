import type {
  WasteCityRecord,
  WasteCollectionLocationRecord,
  WasteCustomTourDate,
  WasteFractionRecord,
  WasteHouseNumberRecord,
  WasteLocationTourLinkRecord,
  WasteManagementMasterDataOverview,
  WasteRegionRecord,
  WasteStreetRecord,
  WasteTourRecord,
} from '@sva/core';

import type {
  CreateWasteManagementLocationTourLinkInput,
  CreateWasteManagementTourInput,
  UpdateWasteManagementLocationTourLinkInput,
  UpdateWasteManagementTourInput,
} from './waste-management.api.js';
import { compactOptionalString } from './waste-management.page.support.js';
import type { WasteManagementSearchParams } from './search-params.js';

export type LocationTourLinkFormState = {
  readonly id: string;
  readonly locationId: string;
  readonly tourId: string;
  readonly startDate: string;
  readonly endDate: string;
};

export type TourFormState = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly wasteFractionIds: readonly string[];
  readonly recurrence: NonNullable<WasteTourRecord['recurrence']> | '';
  readonly firstDate: string;
  readonly endDate: string;
  readonly customDatesText: string;
  readonly active: boolean;
};

const createId = () => crypto.randomUUID();

export const createDefaultLocationTourLinkForm = (): LocationTourLinkFormState => ({
  id: createId(),
  locationId: '',
  tourId: '',
  startDate: '',
  endDate: '',
});

export const createDefaultTourForm = (): TourFormState => ({
  id: createId(),
  name: '',
  description: '',
  wasteFractionIds: [],
  recurrence: '',
  firstDate: '',
  endDate: '',
  customDatesText: '',
  active: true,
});

export const mapLocationTourLinkToForm = (link: WasteLocationTourLinkRecord): LocationTourLinkFormState => ({
  id: link.id,
  locationId: link.locationId,
  tourId: link.tourId,
  startDate: link.startDate ?? '',
  endDate: link.endDate ?? '',
});

export const mapTourToForm = (tour: WasteTourRecord): TourFormState => ({
  id: tour.id,
  name: tour.name,
  description: tour.description ?? '',
  wasteFractionIds: tour.wasteFractionIds,
  recurrence: tour.recurrence ?? '',
  firstDate: tour.firstDate ?? '',
  endDate: tour.endDate ?? '',
  customDatesText:
    tour.customDates
      ?.map((entry: WasteCustomTourDate) => (entry.description ? `${entry.date} | ${entry.description}` : entry.date))
      .join('\n') ?? '',
  active: tour.active,
});

export const toCreateLocationTourLinkInput = (form: LocationTourLinkFormState): CreateWasteManagementLocationTourLinkInput => ({
  id: form.id,
  locationId: form.locationId,
  tourId: form.tourId,
  startDate: compactOptionalString(form.startDate),
  endDate: compactOptionalString(form.endDate),
});

export const toUpdateLocationTourLinkInput = (form: LocationTourLinkFormState): UpdateWasteManagementLocationTourLinkInput => ({
  locationId: form.locationId,
  tourId: form.tourId,
  startDate: compactOptionalString(form.startDate),
  endDate: compactOptionalString(form.endDate),
});

const parseCustomTourDatesText = (value: string): CreateWasteManagementTourInput['customDates'] => {
  const entries = value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [datePart, ...descriptionParts] = line.split('|');
      return {
        date: datePart?.trim() ?? '',
        description: compactOptionalString(descriptionParts.join('|')),
      };
    });

  return entries.length > 0 ? entries : undefined;
};

export const toCreateTourInput = (form: TourFormState): CreateWasteManagementTourInput => ({
  id: form.id,
  name: form.name.trim(),
  description: compactOptionalString(form.description),
  wasteFractionIds: form.wasteFractionIds,
  recurrence: form.recurrence || undefined,
  firstDate: compactOptionalString(form.firstDate),
  endDate: compactOptionalString(form.endDate),
  customDates: parseCustomTourDatesText(form.customDatesText),
  active: form.active,
});

export const toUpdateTourInput = (form: TourFormState): UpdateWasteManagementTourInput => ({
  name: form.name.trim(),
  description: compactOptionalString(form.description),
  wasteFractionIds: form.wasteFractionIds,
  recurrence: form.recurrence || undefined,
  firstDate: compactOptionalString(form.firstDate),
  endDate: compactOptionalString(form.endDate),
  customDates: parseCustomTourDatesText(form.customDatesText),
  active: form.active,
});

const matchesSearch = (value: string, query: string) => value.toLocaleLowerCase().includes(query.toLocaleLowerCase());

const matchesStatusFilter = (status: WasteManagementSearchParams['status'], active: boolean | undefined): boolean => {
  if (status === 'all' || active === undefined) {
    return true;
  }
  return status === 'active' ? active : !active;
};

export const filterTours = (
  tours: readonly WasteTourRecord[],
  search: WasteManagementSearchParams
): readonly WasteTourRecord[] =>
  tours.filter((tour) => {
    if (search.tourId && tour.id !== search.tourId) {
      return false;
    }
    if (!matchesStatusFilter(search.status, tour.active)) {
      return false;
    }
    if (search.wasteFractionId && !tour.wasteFractionIds.includes(search.wasteFractionId)) {
      return false;
    }
    if (!search.q) {
      return true;
    }
    return [tour.name, tour.description]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .some((value) => matchesSearch(value, search.q));
  });

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
    .filter((link) => link.tourId === tour.id)
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

export const resolveActiveTourFractions = (
  fractions: readonly WasteFractionRecord[],
  ids: readonly string[]
): readonly WasteFractionRecord[] => fractions.filter((fraction) => ids.includes(fraction.id));
