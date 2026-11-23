import type { WasteTourRecord } from '@sva/waste-management-contracts';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconPlus as Plus, IconRoute, IconTrash } from '@tabler/icons-react';
import { Button, Checkbox, StudioEmptyState, cn } from '@sva/studio-ui-react';
import { formatTourSelectionLabel } from './waste-management.tours.presentation.js';

export const WasteMasterDataActiveTourBanner = ({
  selectedTour,
  onTourFilterChange,
}: {
  readonly selectedTour?: WasteTourRecord;
  readonly onTourFilterChange: (tourId: string) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  if (!selectedTour) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">
        {pt('masterData.locationsWorkspace.filters.activeTour')}
      </span>
      <span className="text-sm font-medium">{formatTourSelectionLabel(pt, selectedTour)}</span>
      <Button type="button" size="sm" variant="tertiary" onClick={() => onTourFilterChange('')}>
        {pt('masterData.locationsWorkspace.filters.clearTour')}
      </Button>
    </div>
  );
};

export const WasteMasterDataLocationsHeader = ({
  allFilteredLocationsSelected,
  someFilteredLocationsSelected,
  onToggleSelectAll,
}: {
  readonly allFilteredLocationsSelected: boolean;
  readonly someFilteredLocationsSelected: boolean;
  readonly onToggleSelectAll: (checked: boolean) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <thead className="bg-surface-inset text-left text-[13px] text-foreground">
      <tr className="border-b border-border/70">
        <th scope="col" className="w-12 px-3 py-3">
          <Checkbox
            aria-label={pt('masterData.locationsWorkspace.table.selectAllRows', {
              label: pt('masterData.locationsWorkspace.table.label'),
            })}
            checked={allFilteredLocationsSelected}
            indeterminate={!allFilteredLocationsSelected && someFilteredLocationsSelected}
            onChange={(event) => onToggleSelectAll(event.currentTarget.checked)}
          />
        </th>
        <th scope="col" className="w-[150px] px-3 py-3">
          {pt('masterData.locationsWorkspace.table.region')}
        </th>
        <th scope="col" className="w-[150px] px-3 py-3">
          {pt('masterData.locationsWorkspace.table.city')}
        </th>
        <th scope="col" className="w-[220px] px-3 py-3">
          {pt('masterData.locationsWorkspace.table.street')}
        </th>
        <th scope="col" className="w-[128px] px-3 py-3">
          {pt('masterData.locationsWorkspace.table.houseNumbers')}
        </th>
        <th scope="col" className="w-[220px] px-3 py-3">
          {pt('masterData.locationsWorkspace.table.tours')}
        </th>
        <th scope="col" className="w-[92px] px-3 py-3">
          {pt('masterData.locationsWorkspace.table.status')}
        </th>
        <th scope="col" className="w-[144px] px-3 py-3 text-right">
          {pt('masterData.locationsWorkspace.table.actions')}
        </th>
      </tr>
    </thead>
  );
};
export const WasteMasterDataLocationsEmptyState = () => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="p-6">
      <StudioEmptyState>
        <div className="space-y-2 text-left">
          <p className="font-medium">{pt('masterData.locationsWorkspace.emptyTitle')}</p>
          <p>{pt('masterData.locationsWorkspace.emptyBody')}</p>
        </div>
      </StudioEmptyState>
    </div>
  );
};

export { WasteMasterDataLocationsTableToolbar } from './waste-management.master-data-locations-table.views.toolbar.js';
export { WasteMasterDataLocationsRow } from './waste-management.master-data-locations-table.views.row.js';

export const LocationTableActions = ({
  selectedCollectionLocationsCount,
  onOpenBulkAssignments,
  onRequestDeleteSelected,
  onOpenCreateLocation,
}: {
  readonly selectedCollectionLocationsCount: number;
  readonly onOpenBulkAssignments: () => void;
  readonly onRequestDeleteSelected: () => void;
  readonly onOpenCreateLocation: () => void;
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
      <Button type="button" onClick={onOpenCreateLocation}>
        <Plus aria-hidden="true" className="h-4 w-4" />
        {pt('masterData.locationsWorkspace.actions.createLocation')}
      </Button>
    </>
  );
};
