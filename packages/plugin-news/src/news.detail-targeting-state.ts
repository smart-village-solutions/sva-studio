import * as React from 'react';

import { wasteLocationKeyId } from './news.waste-targeting.js';
import type { NewsWasteTargetOption } from './news.waste-targeting.js';
import type { WasteLocationKey } from './news.types.js';
import type { WasteManagementMasterDataOverview } from '@sva/plugin-sdk';

const pageSize = 25;

type TargetingFilters = Readonly<{
  query: string;
  regionId: string;
  cityId: string;
  streetId: string;
  houseNumberId: string;
}>;

const initialFilters: TargetingFilters = {
  query: '',
  regionId: '',
  cityId: '',
  streetId: '',
  houseNumberId: '',
};

const filterTargetOptions = (
  options: readonly NewsWasteTargetOption[],
  filters: TargetingFilters
) => {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase('de');
  return options.filter(
    (option) =>
      (!filters.regionId || option.regionId === filters.regionId) &&
      (!filters.cityId || option.cityId === filters.cityId) &&
      (!filters.streetId || option.streetId === filters.streetId) &&
      (!filters.houseNumberId || option.houseNumberId === filters.houseNumberId) &&
      (!normalizedQuery || option.label.toLocaleLowerCase('de').includes(normalizedQuery))
  );
};

export const useNewsTargetingEditor = (
  overview: WasteManagementMasterDataOverview,
  options: readonly NewsWasteTargetOption[],
  selected: readonly WasteLocationKey[]
) => {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<readonly WasteLocationKey[]>([]);
  const [filters, setFilters] = React.useState<TargetingFilters>(initialFilters);
  const [page, setPage] = React.useState(1);
  const citiesById = React.useMemo(
    () => new Map(overview.cities.map((city) => [city.id, city] as const)),
    [overview.cities]
  );
  const streetsById = React.useMemo(
    () => new Map(overview.streets.map((street) => [street.id, street] as const)),
    [overview.streets]
  );
  const filteredCities = React.useMemo(
    () => overview.cities.filter((city) => !filters.regionId || city.regionId === filters.regionId),
    [filters.regionId, overview.cities]
  );
  const filteredStreets = React.useMemo(
    () =>
      overview.streets.filter((street) => {
        const city = citiesById.get(street.cityId);
        return (
          (!filters.regionId || city?.regionId === filters.regionId) &&
          (!filters.cityId || street.cityId === filters.cityId)
        );
      }),
    [citiesById, filters.cityId, filters.regionId, overview.streets]
  );
  const filteredHouseNumbers = React.useMemo(
    () =>
      filters.streetId
        ? overview.houseNumbers.filter((houseNumber) => {
            const street = streetsById.get(houseNumber.streetId);
            const city = street ? citiesById.get(street.cityId) : undefined;
            return (
              (!filters.regionId || city?.regionId === filters.regionId) &&
              (!filters.cityId || city?.id === filters.cityId) &&
              (!filters.streetId || houseNumber.streetId === filters.streetId)
            );
          })
        : [],
    [citiesById, filters, overview.houseNumbers, streetsById]
  );
  const filtered = React.useMemo(() => filterTargetOptions(options, filters), [filters, options]);
  const selectedIds = React.useMemo(() => new Set(draft.map(wasteLocationKeyId)), [draft]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((option) => selectedIds.has(option.id));

  React.useEffect(() => setPage(1), [filters]);

  const updateFilters = (next: Partial<TargetingFilters>) => {
    setDraft([]);
    setFilters((current) => ({ ...current, ...next }));
  };
  const openEditor = () => {
    setDraft(selected);
    setOpen(true);
  };
  const toggleOption = (key: WasteLocationKey, checked: boolean) => {
    const id = wasteLocationKeyId(key);
    setDraft((current) =>
      checked
        ? [...current.filter((entry) => wasteLocationKeyId(entry) !== id), key]
        : current.filter((entry) => wasteLocationKeyId(entry) !== id)
    );
  };
  const toggleAllFiltered = (checked: boolean) => {
    const filteredIds = new Set(filtered.map((option) => option.id));
    setDraft((current) =>
      checked
        ? [
            ...current.filter((entry) => !filteredIds.has(wasteLocationKeyId(entry))),
            ...filtered.map((option) => option.key),
          ]
        : current.filter((entry) => !filteredIds.has(wasteLocationKeyId(entry)))
    );
  };

  return {
    open,
    setOpen,
    openEditor,
    draft,
    filters,
    updateFilters,
    citiesById,
    streetsById,
    filteredCities,
    filteredStreets,
    filteredHouseNumbers,
    filtered,
    visible,
    selectedIds,
    allFilteredSelected,
    page: currentPage,
    pageCount,
    setPage,
    toggleOption,
    toggleAllFiltered,
  };
};
