import { usePluginTranslation } from '@sva/plugin-sdk';
import { IconRoute, IconTrash } from '@tabler/icons-react';
import { Button, Checkbox, StudioEmptyState, cn } from '@sva/studio-ui-react';

import type { WasteMasterDataLocationsTableProps } from './waste-management.master-data-locations-table.types.js';

export const locationSortColumns = [
  ['region', 'region'],
  ['city', 'city'],
  ['street', 'street'],
  ['houseNumber', 'houseNumbers'],
  ['tourCount', 'tours'],
  ['status', 'status'],
] as const;

export const WasteMasterDataLocationsHeader = ({
  allFilteredLocationsSelected,
  someFilteredLocationsSelected,
  onToggleSelectAll,
  sortMode,
  sortDirection,
  onSort,
}: Pick<WasteMasterDataLocationsTableProps, 'sortMode' | 'sortDirection'> & {
  readonly onSort: WasteMasterDataLocationsTableProps['onApplyFilters'];
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
        {locationSortColumns.map(([mode, column]) => {
          const active = sortMode === mode;
          const label = pt(`masterData.locationsWorkspace.table.${column}`);
          return (
            <th
              key={mode}
              scope="col"
              className="px-3 py-3"
              aria-sort={
                active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined
              }
            >
              {onSort ? (
                <Button
                  type="button"
                  variant="tertiary"
                  size="sm"
                  title={mode === 'tourCount' ? pt('filters.sortByTourCount') : undefined}
                  onClick={() =>
                    onSort({
                      locationSortMode: mode,
                      locationSortDirection: active && sortDirection === 'asc' ? 'desc' : 'asc',
                    })
                  }
                >
                  {label}{' '}
                  <span aria-hidden="true">
                    {active ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
                  </span>
                </Button>
              ) : (
                label
              )}
            </th>
          );
        })}
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
