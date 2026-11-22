import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconRoute, IconTrash, IconPlus as Plus } from '@tabler/icons-react';
import { Button, Checkbox, Select, cn } from '@sva/studio-ui-react';
import type { WasteMasterDataLocationsTableProps } from './waste-management.master-data-locations-table.types.js';
import {
  WasteLocationsFiltersToggle,
  WasteLocationsQueryControl,
  WasteLocationsResetControl,
  WasteLocationsSortControl,
  WasteLocationsStatusControl,
  WasteLocationsYearControl,
} from './waste-management.master-data-locations-table.views.toolbar.controls.js';
import { formatTourSelectionLabel } from './waste-management.tours.presentation.js';
import { WasteMasterDataActiveTourBanner } from './waste-management.master-data-locations-table.views.js';
import { WastePanelTableTopBar } from './waste-management.table-frame.js';

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
        className="h-11 rounded-md border-border/70 px-3"
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
          'h-11 rounded-md border border-destructive/15 px-3 text-destructive hover:bg-destructive/5',
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
      className="rounded-lg border border-border-subtle bg-muted/[0.08] px-3 py-3"
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
                {formatTourSelectionLabel(pt, tour)}
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
  readonly regionName?: string;
  readonly cityName?: string;
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
  regionName,
  cityName,
}: WasteLocationsToolbarProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const tours = visibleTours ?? availableTours;
  const selectedTour = tours.find((tour) => tour.id === selectedTourId);
  return (
    <WastePanelTableTopBar
      actions={
        <>
          <WasteLocationsBulkActions
            selectedCollectionLocationsCount={selectedCollectionLocationsCount}
            onOpenBulkAssignments={onOpenBulkAssignments}
            onRequestDeleteSelected={onRequestDeleteSelected}
          />
          <Button type="button" onClick={onOpenCreateLocation}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            {pt('masterData.locationsWorkspace.actions.createLocation')}
          </Button>
        </>
      }
      activeFilters={
        <>
          {search?.q ? <span>{pt('filters.searchLabel')} · {search.q}</span> : null}
          {search && search.status !== 'all' ? <span>{pt(`filters.status.${search.status}`)}</span> : null}
          {regionName ? <span>{pt('masterData.collectionLocations.fields.regionId')} · {regionName}</span> : null}
          {cityName ? <span>{pt('masterData.collectionLocations.fields.cityId')} · {cityName}</span> : null}
          {locationYear ? <span>{pt('masterData.locationsWorkspace.filters.tourYear')} · {locationYear}</span> : null}
          {locationTourStatus ? <span>{pt(`masterData.locationsWorkspace.filters.${locationTourStatus}`)}</span> : null}
          <WasteMasterDataActiveTourBanner
            selectedTour={selectedTour}
            onTourFilterChange={onTourFilterChange}
          />
        </>
      }
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <WasteLocationsQueryControl search={search} onQueryChange={onQueryChange} />
          <WasteLocationsResetControl search={search} onResetFilters={onResetFilters} />
          <WasteLocationsFiltersToggle
            filtersOpen={filtersOpen}
            onToggleFiltersOpen={onToggleFiltersOpen}
          />
          <WasteLocationsYearControl
            availableTours={availableTours}
            locationYear={locationYear}
            onLocationYearChange={onLocationYearChange}
          />
          <WasteLocationsStatusControl
            locationTourStatus={locationTourStatus}
            onLocationTourStatusChange={onLocationTourStatusChange}
          />
          <WasteLocationsSortControl
            sortMode={sortMode}
            sortDirection={sortDirection}
            onSortModeChange={onSortModeChange}
            onSortDirectionChange={onSortDirectionChange}
          />
        </div>
        {filtersOpen ? (
          <WasteLocationsFilters
            visibleTours={tours}
            selectedTourId={selectedTourId}
            allFilteredLocationsSelected={allFilteredLocationsSelected}
            onTourFilterChange={onTourFilterChange}
            onToggleSelectAll={onToggleSelectAll}
          />
        ) : null}
      </div>
    </WastePanelTableTopBar>
  );
};
