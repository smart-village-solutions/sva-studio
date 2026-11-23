import { usePluginTranslation } from '@sva/plugin-sdk';
import { useMemo, useState } from 'react';
import type { WasteManagementSearchParams } from './search-params.js';
import { matchesLocationTourFilters } from './waste-management.master-data-locations-table.helpers.js';
import type { WasteMasterDataLocationsTableProps } from './waste-management.master-data-locations-table.types.js';

const filterDefaults = {
  q: '',
  status: 'all',
  regionId: undefined,
  cityId: undefined,
  locationStreetId: undefined,
  locationHouseNumberId: undefined,
  tourId: undefined,
  locationYear: undefined,
  locationTourStatus: undefined,
} satisfies Partial<WasteManagementSearchParams>;
export type LocationFilters = Pick<WasteManagementSearchParams, keyof typeof filterDefaults>;
const toFilters = (search?: WasteManagementSearchParams): LocationFilters => ({
  q: search?.q ?? '',
  status: search?.status ?? 'all',
  regionId: search?.regionId,
  cityId: search?.cityId,
  locationStreetId: search?.locationStreetId,
  locationHouseNumberId: search?.locationHouseNumberId,
  tourId: search?.tourId,
  locationYear: search?.locationYear,
  locationTourStatus: search?.locationTourStatus,
});

type AddressData = Pick<
  WasteMasterDataLocationsTableProps,
  'regions' | 'cities' | 'streets' | 'houseNumbers'
>;
type AddressFilterKey = 'regionId' | 'cityId' | 'locationStreetId' | 'locationHouseNumberId';

const createAddressLookups = ({ regions, cities, streets, houseNumbers }: AddressData) => {
  const regionsById = new Map(regions.map(({ id, name }) => [id, name]));
  const citiesById = new Map(cities.map((city) => [city.id, city]));
  const streetsById = new Map(streets.map((street) => [street.id, street]));
  const housesById = new Map(houseNumbers.map((house) => [house.id, house]));
  const labelForCity = (id: string) => {
    const city = citiesById.get(id);
    return (
      city &&
      [city.name, city.postalCode, city.regionId && regionsById.get(city.regionId)]
        .filter(Boolean)
        .join(' · ')
    );
  };
  const labelForStreet = (id: string) => {
    const street = streetsById.get(id);
    return street && [street.name, labelForCity(street.cityId)].filter(Boolean).join(' · ');
  };
  const labelForHouseNumber = (id: string) => {
    const house = housesById.get(id);
    return house && [house.number, labelForStreet(house.streetId)].filter(Boolean).join(' · ');
  };
  return { citiesById, streetsById, housesById, labelForCity, labelForStreet, labelForHouseNumber };
};

const getAddressScope = (
  filters: LocationFilters,
  { citiesById, streetsById }: ReturnType<typeof createAddressLookups>
) => {
  const matchesCity = (id: string) =>
    !filters.regionId || citiesById.get(id)?.regionId === filters.regionId;
  const matchesStreet = (id: string) => {
    const city = streetsById.get(id)?.cityId;
    if (filters.cityId) return city === filters.cityId;
    return !filters.regionId || (city !== undefined && matchesCity(city));
  };
  return { matchesCity, matchesStreet };
};

const getAddressOptions = (
  { regions, cities, streets, houseNumbers }: AddressData,
  filterScope: LocationFilters,
  addresses: ReturnType<typeof createAddressLookups>
) => {
  const { matchesCity, matchesStreet } = getAddressScope(filterScope, addresses);
  return [
    {
      key: 'regionId',
      field: 'regionId',
      choices: regions,
      label: (id: string) => regions.find((region) => region.id === id)?.name,
    },
    {
      key: 'cityId',
      field: 'cityId',
      choices: cities.filter(({ id }) => matchesCity(id)),
      label: addresses.labelForCity,
    },
    {
      key: 'locationStreetId',
      field: 'streetId',
      choices: streets.filter(({ id }) => matchesStreet(id)),
      label: addresses.labelForStreet,
    },
    {
      key: 'locationHouseNumberId',
      field: 'houseNumberId',
      choices: houseNumbers.filter(({ streetId }) =>
        filterScope.locationStreetId
          ? streetId === filterScope.locationStreetId
          : matchesStreet(streetId)
      ),
      label: addresses.labelForHouseNumber,
    },
  ] as const;
};

const getFilterChips = (
  applied: LocationFilters,
  addressOptions: ReturnType<typeof getAddressOptions>,
  props: Pick<WasteMasterDataLocationsTableProps, 'onApplyFilters' | 'availableTours'>,
  pt: ReturnType<typeof usePluginTranslation>
) => {
  return Object.entries({
    q: applied.q,
    status: applied.status === 'all' ? undefined : pt(`filters.status.${applied.status}`),
    ...Object.fromEntries(
      addressOptions.map(({ key, field, label }) => {
        const value = applied[key];
        return [
          key,
          value &&
            `${pt(`masterData.collectionLocations.fields.${field}`)} · ${label(value) ?? value}`,
        ];
      })
    ),
    tourId:
      applied.tourId &&
      (props.availableTours.find((tour) => tour.id === applied.tourId)?.name ?? applied.tourId),
    locationYear:
      applied.locationYear &&
      `${pt('masterData.locationsWorkspace.filters.tourYear')} · ${applied.locationYear}`,
    locationTourStatus:
      applied.locationTourStatus &&
      pt(`masterData.locationsWorkspace.filters.${applied.locationTourStatus}`),
  }).flatMap(([id, label]) =>
    label
      ? [
          {
            id,
            label: String(label),
            clear: () =>
              props.onApplyFilters?.({ [id]: filterDefaults[id as keyof LocationFilters] }),
          },
        ]
      : []
  );
};

const updateAddressFilter = (
  current: LocationFilters,
  key: AddressFilterKey,
  value: string,
  addresses: ReturnType<typeof createAddressLookups>
): LocationFilters => {
  const next = { ...current, [key]: value || undefined };
  if (
    key === 'regionId' &&
    next.cityId &&
    !getAddressScope(next, addresses).matchesCity(next.cityId)
  ) {
    next.cityId = undefined;
  }
  if (
    key !== 'locationHouseNumberId' &&
    key !== 'locationStreetId' &&
    next.locationStreetId &&
    !getAddressScope(next, addresses).matchesStreet(next.locationStreetId)
  ) {
    next.locationStreetId = undefined;
  }
  if (key !== 'locationHouseNumberId' && next.locationHouseNumberId) {
    const house = addresses.housesById.get(next.locationHouseNumberId);
    if (
      !house ||
      (next.locationStreetId
        ? house.streetId !== next.locationStreetId
        : !getAddressScope(next, addresses).matchesStreet(house.streetId))
    ) {
      next.locationHouseNumberId = undefined;
    }
  }
  return next;
};

export const useLocationFilterDraft = (props: WasteMasterDataLocationsTableProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const [draft, setDraft] = useState<LocationFilters | null>(null);
  const [resetQuery, setResetQuery] = useState(false);
  const [direction, setDirection] = useState(props.sortDirection);
  const [sort, setSort] = useState(props.sortMode);
  const applied = toFilters(props.search);
  const edit = (patch: Partial<LocationFilters>) => {
    setDraft((current) => current && { ...current, ...patch });
  };
  const filterScope = draft ?? applied;
  const { regions, cities, streets, houseNumbers } = props;
  const addresses = useMemo(
    () => createAddressLookups({ regions, cities, streets, houseNumbers }),
    [regions, cities, streets, houseNumbers]
  );
  const tours = props.availableTours.filter((tour) =>
    matchesLocationTourFilters(tour, filterScope.locationYear, filterScope.locationTourStatus)
  );
  const addressOptions = getAddressOptions(props, filterScope, addresses);
  const chips = getFilterChips(applied, addressOptions, props, pt);
  const setAddress = (key: AddressFilterKey, value: string) => {
    setDraft((current) => current && updateAddressFilter(current, key, value, addresses));
  };
  const year = draft?.locationYear;
  const invalidYear = year !== undefined && (!Number.isInteger(year) || year < 2000 || year > 2100);

  const apply = () => {
    if (!draft) return;
    const { q, ...filters } = draft;
    props.onApplyFilters?.({
      ...filters,
      ...(resetQuery ? { q } : {}),
      locationSortMode: sort,
      locationSortDirection: direction,
    });
    setDraft(null);
  };
  const open = () => {
    setResetQuery(false);
    setDraft(applied);
    setSort(props.sortMode);
    setDirection(props.sortDirection);
  };
  const reset = () => {
    setResetQuery(true);
    setDraft(filterDefaults);
  };
  return {
    applied,
    draft,
    setDraft,
    open,
    reset,
    apply,
    direction,
    setDirection,
    sort,
    setSort,
    edit,
    tours,
    addressOptions,
    chips,
    setAddress,
    year,
    invalidYear,
  };
};
