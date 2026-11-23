import { usePluginTranslation } from '@sva/plugin-sdk';
import { Checkbox, Select } from '@sva/studio-ui-react';
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
import {
  LocationTableActions,
  WasteMasterDataActiveTourBanner,
} from './waste-management.master-data-locations-table.views.js';
import { WastePanelTableTopBar } from './waste-management.table-frame.js';

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

const LocationFilterSummary = ({
  search,
  regionName,
  cityName,
  locationYear,
  locationTourStatus,
  selectedTour,
  onTourFilterChange,
}: Pick<
  WasteLocationsToolbarProps,
  | 'search'
  | 'regionName'
  | 'cityName'
  | 'locationYear'
  | 'locationTourStatus'
  | 'onTourFilterChange'
> & {
  selectedTour: WasteMasterDataLocationsTableProps['availableTours'][number] | undefined;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <>
      {search?.q ? (
        <span>
          {pt('filters.searchLabel')} · {search.q}
        </span>
      ) : null}
      {search && search.status !== 'all' ? (
        <span>{pt(`filters.status.${search.status}`)}</span>
      ) : null}
      {regionName ? (
        <span>
          {pt('masterData.collectionLocations.fields.regionId')} · {regionName}
        </span>
      ) : null}
      {cityName ? (
        <span>
          {pt('masterData.collectionLocations.fields.cityId')} · {cityName}
        </span>
      ) : null}
      {locationYear ? (
        <span>
          {pt('masterData.locationsWorkspace.filters.tourYear')} · {locationYear}
        </span>
      ) : null}
      {locationTourStatus ? (
        <span>{pt(`masterData.locationsWorkspace.filters.${locationTourStatus}`)}</span>
      ) : null}
      <WasteMasterDataActiveTourBanner
        selectedTour={selectedTour}
        onTourFilterChange={onTourFilterChange}
      />
    </>
  );
};

export const WasteMasterDataLocationsTableToolbar = (props: WasteLocationsToolbarProps) => {
  const { availableTours, visibleTours, selectedTourId, filtersOpen } = props;
  const tours = visibleTours ?? availableTours;
  const selectedTour = tours.find((tour) => tour.id === selectedTourId);
  return (
    <WastePanelTableTopBar
      actions={<LocationTableActions {...props} />}
      activeFilters={<LocationFilterSummary {...props} selectedTour={selectedTour} />}
    >
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <WasteLocationsQueryControl {...props} />
          <WasteLocationsResetControl {...props} />
          <WasteLocationsFiltersToggle {...props} />
          <WasteLocationsYearControl {...props} />
          <WasteLocationsStatusControl {...props} />
          <WasteLocationsSortControl {...props} />
        </div>
        {filtersOpen ? <WasteLocationsFilters {...props} visibleTours={tours} /> : null}
      </div>
    </WastePanelTableTopBar>
  );
};
