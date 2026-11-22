import { usePluginTranslation } from '@sva/plugin-sdk';
import { Badge } from '@sva/studio-ui-react';
import { TourAssignmentsTable } from './waste-management.tours-assignments-table.js';
import type { TourAssignmentLocationOption } from './waste-management.tours.locations.js';
import type {
  TourAssignmentSortDirection,
  TourAssignmentSortField,
} from './waste-management.tours.view-model.js';
import { WastePanelTableBottomBar } from './waste-management.table-frame.js';

const TourAssignmentSelectionCounts = ({
  selectedCount,
  visibleCount,
  hiddenSelectedCount,
}: {
  readonly selectedCount: number;
  readonly visibleCount: number;
  readonly hiddenSelectedCount: number;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium">{pt('tours.assignments.workspace.availableTitle')}</p>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">
          {pt('tours.assignments.workspace.selectedCount', {
            value: selectedCount,
          })}
        </Badge>
        <Badge variant="outline">
          {pt('tours.assignments.workspace.visibleCount', {
            value: visibleCount,
          })}
        </Badge>
        {hiddenSelectedCount > 0 ? (
          <Badge variant="outline">
            {pt('tours.assignments.workspace.hiddenSelectedCount', {
              value: hiddenSelectedCount,
            })}
          </Badge>
        ) : null}
      </div>
    </div>
  );
};

export const TourAssignmentsPageSelection = ({
  loading,
  selectedLocationIds,
  filteredLocationsCount,
  hiddenSelectedCount,
  locations,
  page,
  pageSize,
  pageCount,
  onPageChange,
  onPageSizeChange,
  allVisibleSelected,
  someVisibleSelected,
  sortField,
  sortDirection,
  onSortChange,
  onToggleSelectAll,
  onToggleLocation,
}: {
  readonly loading: boolean;
  readonly selectedLocationIds: readonly string[];
  readonly filteredLocationsCount: number;
  readonly hiddenSelectedCount: number;
  readonly locations: readonly TourAssignmentLocationOption[];
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
  readonly allVisibleSelected: boolean;
  readonly someVisibleSelected: boolean;
  readonly sortField: TourAssignmentSortField;
  readonly sortDirection: TourAssignmentSortDirection;
  readonly onSortChange: (field: TourAssignmentSortField) => void;
  readonly onToggleSelectAll: (value: boolean) => void;
  readonly onToggleLocation: (locationId: string, checked: boolean) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-background/70 p-4">
      <TourAssignmentSelectionCounts
        selectedCount={selectedLocationIds.length}
        visibleCount={filteredLocationsCount}
        hiddenSelectedCount={hiddenSelectedCount}
      />

      <div className="min-w-0 rounded-lg border border-border-subtle">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">
            {pt('tours.table.loadingAssignments')}
          </div>
        ) : locations.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            {pt('tours.assignments.workspace.noLocations')}
          </div>
        ) : (
          <>
            <TourAssignmentsTable
              locations={locations}
              selectedLocationIds={selectedLocationIds}
              allVisibleSelected={allVisibleSelected}
              someVisibleSelected={someVisibleSelected}
              sortField={sortField}
              sortDirection={sortDirection}
              onSortChange={onSortChange}
              onToggleSelectAll={onToggleSelectAll}
              onToggleLocation={onToggleLocation}
            />
            <WastePanelTableBottomBar
              pt={pt}
              page={page}
              pageSize={pageSize}
              pageCount={pageCount}
              totalItems={filteredLocationsCount}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
            />
          </>
        )}
      </div>
    </div>
  );
};
