import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconFilter, IconRoute, IconSortAZ, IconSortZA, IconTrash } from '@tabler/icons-react';
import { Button, Checkbox, Select, cn } from '@sva/studio-ui-react';
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
  availableTours,
  selectedTourId,
  allFilteredLocationsSelected,
  onTourFilterChange,
  onToggleSelectAll,
}: Pick<
  WasteMasterDataLocationsTableProps,
  | 'availableTours'
  | 'selectedTourId'
  | 'allFilteredLocationsSelected'
  | 'onTourFilterChange'
  | 'onToggleSelectAll'
>) => {
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
            {availableTours.map((tour) => (
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
  | 'onOpenCreateRegion'
  | 'onOpenCreateCity'
  | 'onOpenCreateStreet'
  | 'onOpenCreateHouseNumber'
  | 'onOpenCreateLocation'
  | 'selectedCollectionLocationsCount'
  | 'availableTours'
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
  readonly onRequestDeleteSelected: () => void;
  readonly filtersOpen: boolean;
  readonly onToggleFiltersOpen: () => void;
};

export const WasteMasterDataLocationsTableToolbar = ({
  selectedCollectionLocationsCount,
  availableTours,
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

  return (
    <div className="flex w-full flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
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
          <WasteLocationsSortControl
            sortMode={sortMode}
            sortDirection={sortDirection}
            onSortModeChange={onSortModeChange}
            onSortDirectionChange={onSortDirectionChange}
          />
        </div>
        {filtersOpen ? (
          <WasteLocationsFilters
            availableTours={availableTours}
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
