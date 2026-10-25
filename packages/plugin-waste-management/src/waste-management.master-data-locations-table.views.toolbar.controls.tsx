import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconFilter, IconSortAZ, IconSortZA } from '@tabler/icons-react';
import { Button, Checkbox, Input, Select } from '@sva/studio-ui-react';
import { useEffect, useState } from 'react';
import type { WasteMasterDataLocationsTableProps } from './waste-management.master-data-locations-table.types.js';

export const WasteLocationsSortControl = ({
  sortMode,
  sortDirection,
  onSortModeChange,
  onSortDirectionChange,
}: Pick<
  WasteMasterDataLocationsTableProps,
  'sortMode' | 'sortDirection' | 'onSortModeChange' | 'onSortDirectionChange'
>) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div
      role="group"
      className="flex min-h-10 flex-wrap items-center gap-3 rounded-lg border border-border/70 px-3 py-2"
      aria-label={pt('masterData.locationsWorkspace.sorting.label')}
    >
      <span className="text-sm text-muted-foreground">
        {pt(
          sortMode === 'addressWithRegion'
            ? 'masterData.locationsWorkspace.sorting.criteriaWithRegion'
            : 'masterData.locationsWorkspace.sorting.criteria'
        )}
      </span>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={sortMode === 'addressWithRegion'}
          onChange={(event) =>
            onSortModeChange(event.currentTarget.checked ? 'addressWithRegion' : 'address')
          }
        />
        <span>{pt('masterData.locationsWorkspace.sorting.includeRegion')}</span>
      </label>
      <Button
        type="button"
        size="sm"
        variant="tertiary"
        aria-label={pt('masterData.locationsWorkspace.sorting.directionLabel', {
          direction: pt(
            sortDirection === 'asc'
              ? 'masterData.locationsWorkspace.sorting.ascending'
              : 'masterData.locationsWorkspace.sorting.descending'
          ),
        })}
        onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
      >
        {sortDirection === 'asc' ? (
          <IconSortAZ aria-hidden="true" className="h-4 w-4" />
        ) : (
          <IconSortZA aria-hidden="true" className="h-4 w-4" />
        )}
        {pt(
          sortDirection === 'asc'
            ? 'masterData.locationsWorkspace.sorting.ascending'
            : 'masterData.locationsWorkspace.sorting.descending'
        )}
      </Button>
    </div>
  );
};

export const WasteLocationsQueryControl = ({ search, onQueryChange }: Pick<
  WasteMasterDataLocationsTableProps,
  'search' | 'onQueryChange'
>) => {
  const pt = usePluginTranslation('wasteManagement');
  const [query, setQuery] = useState(search?.q ?? '');
  useEffect(() => setQuery(search?.q ?? ''), [search?.q]);
  if (!search || !onQueryChange) return null;
  const commitQuery = () => {
    if (query !== search.q) onQueryChange(query);
  };
  return (
    <label className="flex min-w-56 flex-col gap-1 text-sm">
      <span>{pt('masterData.locationsWorkspace.filters.locationSearch')}</span>
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onBlur={commitQuery}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        placeholder={pt('masterData.locationsWorkspace.filters.locationSearchPlaceholder')}
      />
    </label>
  );
};

export const WasteLocationsResetControl = ({ search, onResetFilters }: Pick<
  WasteMasterDataLocationsTableProps,
  'search' | 'onResetFilters'
>) => {
  const pt = usePluginTranslation('wasteManagement');
  if (!search || !onResetFilters) return null;
  const active =
    search.q || search.regionId || search.cityId || search.tourId ||
    search.status !== 'all' || search.locationYear || search.locationTourStatus;
  return active ? (
    <Button type="button" variant="tertiary" onClick={onResetFilters}>
      {pt('masterData.locationsWorkspace.filters.resetFilters')}
    </Button>
  ) : null;
};

export const WasteLocationsYearControl = ({
  availableTours,
  locationYear,
  onLocationYearChange,
}: Pick<
  WasteMasterDataLocationsTableProps,
  'availableTours' | 'locationYear' | 'onLocationYearChange'
>) => {
  const pt = usePluginTranslation('wasteManagement');
  if (!onLocationYearChange) return null;
  const currentYear = new Date().getFullYear();
  const years = availableTours.flatMap((tour) =>
    [tour.firstDate, tour.endDate, ...(tour.customDates ?? []).map((item) => item.date)].flatMap(
      (date) => (date ? [Number(date.slice(0, 4))] : [])
    )
  );
  const firstYear = Math.max(2000, Math.min(currentYear - 1, locationYear ?? currentYear, ...years));
  const lastYear = Math.min(2100, Math.max(currentYear + 2, locationYear ?? currentYear, ...years));
  return (
    <label className="flex items-center gap-2 text-sm">
      <span>{pt('masterData.locationsWorkspace.filters.tourYear')}</span>
      <Select
        aria-label={pt('masterData.locationsWorkspace.filters.tourYear')}
        value={locationYear ?? ''}
        onChange={(event) =>
          onLocationYearChange(event.target.value ? Number(event.target.value) : undefined)
        }
      >
        <option value="">{pt('masterData.locationsWorkspace.filters.allYears')}</option>
        {Array.from({ length: lastYear - firstYear + 1 }, (_, offset) => firstYear + offset).map(
          (year) => <option key={year} value={year}>{year}</option>
        )}
      </Select>
    </label>
  );
};

export const WasteLocationsStatusControl = ({
  locationTourStatus,
  onLocationTourStatusChange,
}: Pick<
  WasteMasterDataLocationsTableProps,
  'locationTourStatus' | 'onLocationTourStatusChange'
>) => {
  const pt = usePluginTranslation('wasteManagement');
  if (!onLocationTourStatusChange) return null;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span>{pt('masterData.locationsWorkspace.filters.tourStatus')}</span>
      <Select
        aria-label={pt('masterData.locationsWorkspace.filters.tourStatus')}
        value={locationTourStatus ?? ''}
        onChange={(event) => {
          const value = event.target.value;
          onLocationTourStatusChange(
            value === 'draft' || value === 'published' || value === 'archived'
              ? value
              : undefined
          );
        }}
      >
        <option value="">{pt('masterData.locationsWorkspace.filters.allStatuses')}</option>
        <option value="draft">{pt('masterData.locationsWorkspace.filters.draft')}</option>
        <option value="published">{pt('masterData.locationsWorkspace.filters.published')}</option>
        <option value="archived">{pt('masterData.locationsWorkspace.filters.archived')}</option>
      </Select>
    </label>
  );
};

export const WasteLocationsFiltersToggle = ({
  filtersOpen,
  onToggleFiltersOpen,
}: Readonly<{ filtersOpen: boolean; onToggleFiltersOpen: () => void }>) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <Button
      type="button"
      variant="secondary"
      className="h-10 rounded-lg border-border/70 px-3"
      aria-expanded={filtersOpen}
      aria-controls="waste-locations-filters"
      onClick={onToggleFiltersOpen}
    >
      <IconFilter aria-hidden="true" className="h-4 w-4" />
      {pt('masterData.locationsWorkspace.filters.filtersTitle')}
    </Button>
  );
};
