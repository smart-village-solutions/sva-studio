import type { WasteTourRecord } from '@sva/waste-management-contracts';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button, Checkbox, StudioEmptyState } from '@sva/studio-ui-react';

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
    <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-muted/30 px-4 py-3">
      <span className="text-sm text-muted-foreground">
        {pt('masterData.locationsWorkspace.filters.activeTour')}
      </span>
      <span className="text-sm font-medium">{selectedTour.name}</span>
      <Button
        type="button"
        size="sm"
        variant="tertiary"
        className="ml-auto"
        onClick={() => onTourFilterChange('')}
      >
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
    <thead className="bg-muted/20 text-left text-[13px] text-foreground">
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
