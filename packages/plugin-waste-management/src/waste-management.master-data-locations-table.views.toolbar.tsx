import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconFilter, IconRoute, IconSortAZ, IconSortZA, IconTrash } from '@tabler/icons-react';
import { Button, Checkbox, Input, Select, cn } from '@sva/studio-ui-react';
import { useEffect, useState } from 'react';
import type { WasteMasterDataLocationsTableProps } from './waste-management.master-data-locations-table.types.js';
import { WasteLocationsCreateMenu } from './waste-management.master-data-locations-table.views.menu.js';

const WasteLocationsBulkActions = ({
  selectedCollectionLocationsCount,
  onOpenBulkAssignments,
  onRequestDeleteSelected,
}: {
  readonly selectedCollectionLocationsCount: number;
  readonly onOpenBulkAssignments: () => void;
  readonly onRequestDeleteSelected: () => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="h-10 rounded-lg border-border/70 px-3"
        disabled={selectedCollectionLocationsCount === 0}
        onClick={onOpenBulkAssignments}
      >
        <IconRoute aria-hidden="true" className="h-4 w-4" />
        {pt('masterData.collectionLocations.bulk.actions.openAssign', {
          value: selectedCollectionLocationsCount,
        })}
      </Button>
      <Button
        type="button"
        variant="tertiary"
        className={cn(
          'h-10 rounded-lg border border-destructive/15 px-3 text-destructive hover:bg-destructive/5',
          selectedCollectionLocationsCount === 0 && 'text-destructive/50'
        )}
        disabled={selectedCollectionLocationsCount === 0}
        onClick={onRequestDeleteSelected}
      >
        <IconTrash aria-hidden="true" className="h-4 w-4" />
        {pt('masterData.collectionLocations.bulk.actions.deleteSelected')}
      </Button>
    </>
  );
};

const WasteLocationsSortControl = ({
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

const WasteLocationsFilters = ({
  visibleTours,
  selectedTourId,
  allFilteredLocationsSelected,
  onTourFilterChange,
  onToggleSelectAll,
}: Pick<
  WasteMasterDataLocationsTableProps,
  'selectedTourId' | 'allFilteredLocationsSelected' | 'onTourFilterChange' | 'onToggleSelectAll'
> & { readonly visibleTours: WasteMasterDataLocationsTableProps['availableTours'] }) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div
      id="waste-locations-filters"
      className="rounded-lg border border-border/60 bg-muted/[0.08] px-3 py-3"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <label className="flex min-w-56 flex-1 flex-col gap-2 text-sm">
          <span className="text-muted-foreground">
            {pt('masterData.locationsWorkspace.filters.tour')}
          </span>
          <Select
            aria-label={pt('masterData.locationsWorkspace.filters.tour')}
            className="h-10 rounded-lg"
            value={selectedTourId ?? ''}
            onChange={(event) => onTourFilterChange(event.target.value)}
          >
            <option value="">{pt('masterData.locationsWorkspace.filters.allTours')}</option>
            {visibleTours.map((tour) => (
              <option key={tour.id} value={tour.id}>
                {tour.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={allFilteredLocationsSelected}
            onChange={(event) => onToggleSelectAll(event.currentTarget.checked)}
          />
          <span>{pt('masterData.collectionLocations.bulk.actions.selectAllFiltered')}</span>
        </label>
      </div>
    </div>
  );
};

type WasteLocationsToolbarProps = Pick<
  WasteMasterDataLocationsTableProps,
  | 'search'
  | 'onQueryChange'
  | 'onResetFilters'
  | 'onOpenCreateRegion'
  | 'onOpenCreateCity'
  | 'onOpenCreateStreet'
  | 'onOpenCreateHouseNumber'
  | 'onOpenCreateLocation'
  | 'selectedCollectionLocationsCount'
  | 'availableTours'
  | 'locationYear'
  | 'onLocationYearChange'
  | 'locationTourStatus'
  | 'onLocationTourStatusChange'
  | 'selectedTourId'
  | 'allFilteredLocationsSelected'
  | 'onOpenBulkAssignments'
  | 'onTourFilterChange'
  | 'onToggleSelectAll'
  | 'sortMode'
  | 'sortDirection'
  | 'onSortModeChange'
  | 'onSortDirectionChange'
> & {
  readonly visibleTours?: WasteMasterDataLocationsTableProps['availableTours'];
  readonly onRequestDeleteSelected: () => void;
  readonly filtersOpen: boolean;
  readonly onToggleFiltersOpen: () => void;
};

export const WasteMasterDataLocationsTableToolbar = ({
  search,
  onQueryChange,
  onResetFilters,
  selectedCollectionLocationsCount,
  availableTours,
  visibleTours,
  locationYear,
  onLocationYearChange,
  locationTourStatus,
  onLocationTourStatusChange,
  filtersOpen,
  selectedTourId,
  allFilteredLocationsSelected,
  onOpenCreateRegion,
  onOpenCreateCity,
  onOpenCreateStreet,
  onOpenCreateHouseNumber,
  onOpenCreateLocation,
  onOpenBulkAssignments,
  onTourFilterChange,
  onToggleSelectAll,
  sortMode,
  sortDirection,
  onSortModeChange,
  onSortDirectionChange,
  onRequestDeleteSelected,
  onToggleFiltersOpen,
}: WasteLocationsToolbarProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const [query, setQuery] = useState(search?.q ?? '');
  useEffect(() => setQuery(search?.q ?? ''), [search?.q]);
  const commitQuery = () => {
    if (search && query !== search.q) onQueryChange?.(query);
  };
  const currentYear = new Date().getFullYear();
  const years = availableTours.flatMap((tour) =>
    [tour.firstDate, tour.endDate, ...(tour.customDates ?? []).map((item) => item.date)].flatMap(
      (date) => (date ? [Number(date.slice(0, 4))] : [])
    )
  );
  const firstYear = Math.max(
    2000,
    Math.min(currentYear - 1, locationYear ?? currentYear, ...years)
  );
  const lastYear = Math.min(2100, Math.max(currentYear + 2, locationYear ?? currentYear, ...years));

  return (
    <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {search && onQueryChange ? (
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
          ) : null}
          {onResetFilters &&
          search &&
          (search.q ||
            search.regionId ||
            search.cityId ||
            search.tourId ||
            search.status !== 'all' ||
            search.locationYear ||
            search.locationTourStatus) ? (
            <Button type="button" variant="tertiary" onClick={onResetFilters}>
              {pt('masterData.locationsWorkspace.filters.resetFilters')}
            </Button>
          ) : null}
          <WasteLocationsBulkActions
            selectedCollectionLocationsCount={selectedCollectionLocationsCount}
            onOpenBulkAssignments={onOpenBulkAssignments}
            onRequestDeleteSelected={onRequestDeleteSelected}
          />
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
          {onLocationYearChange ? (
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
                {Array.from(
                  { length: lastYear - firstYear + 1 },
                  (_, offset) => firstYear + offset
                ).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}
          {onLocationTourStatusChange ? (
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
                <option value="published">
                  {pt('masterData.locationsWorkspace.filters.published')}
                </option>
                <option value="archived">
                  {pt('masterData.locationsWorkspace.filters.archived')}
                </option>
              </Select>
            </label>
          ) : null}
          <WasteLocationsSortControl
            sortMode={sortMode}
            sortDirection={sortDirection}
            onSortModeChange={onSortModeChange}
            onSortDirectionChange={onSortDirectionChange}
          />
        </div>
        {filtersOpen ? (
          <WasteLocationsFilters
            visibleTours={visibleTours ?? availableTours}
            selectedTourId={selectedTourId}
            allFilteredLocationsSelected={allFilteredLocationsSelected}
            onTourFilterChange={onTourFilterChange}
            onToggleSelectAll={onToggleSelectAll}
          />
        ) : null}
      </div>
      <div className="flex justify-end">
        <WasteLocationsCreateMenu
          onOpenCreateRegion={onOpenCreateRegion}
          onOpenCreateCity={onOpenCreateCity}
          onOpenCreateStreet={onOpenCreateStreet}
          onOpenCreateHouseNumber={onOpenCreateHouseNumber}
          onOpenCreateLocation={onOpenCreateLocation}
        />
      </div>
    </div>
  );
};
