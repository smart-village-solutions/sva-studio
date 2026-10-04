import { usePluginTranslation } from '@sva/plugin-sdk';
import { Badge, Button } from '@sva/studio-ui-react';
import { TourAssignmentsTable } from './waste-management.tours-assignments-table.js';
import type { TourAssignmentLocationOption } from './waste-management.tours.locations.js';
import type { TourAssignmentSortDirection } from './waste-management.tours.view-model.js';

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

export const TourAssignmentsDialogSelection = ({
  loading,
  selectedLocationIds,
  filteredLocationsCount,
  hiddenSelectedCount,
  orderedFilteredLocations,
  allVisibleSelected,
  someVisibleSelected,
  includeRegionInSorting,
  sortDirection,
  onResetFilters,
  onIncludeRegionInSortingChange,
  onSortDirectionChange,
  onToggleSelectAll,
  onToggleLocation,
}: {
  readonly loading: boolean;
  readonly selectedLocationIds: readonly string[];
  readonly filteredLocationsCount: number;
  readonly hiddenSelectedCount: number;
  readonly orderedFilteredLocations: readonly TourAssignmentLocationOption[];
  readonly allVisibleSelected: boolean;
  readonly someVisibleSelected: boolean;
  readonly includeRegionInSorting: boolean;
  readonly sortDirection: TourAssignmentSortDirection;
  readonly onResetFilters: () => void;
  readonly onIncludeRegionInSortingChange: (value: boolean) => void;
  readonly onSortDirectionChange: (value: TourAssignmentSortDirection) => void;
  readonly onToggleSelectAll: (value: boolean) => void;
  readonly onToggleLocation: (locationId: string, checked: boolean) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background/70 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <TourAssignmentSelectionCounts
          selectedCount={selectedLocationIds.length}
          visibleCount={filteredLocationsCount}
          hiddenSelectedCount={hiddenSelectedCount}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              onResetFilters();
            }}
          >
            {pt('tours.assignments.actions.resetFilters')}
          </Button>
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto rounded-xl border border-border/60">
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">
            {pt('tours.table.loadingAssignments')}
          </div>
        ) : orderedFilteredLocations.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            {pt('tours.assignments.workspace.noLocations')}
          </div>
        ) : (
          <TourAssignmentsTable
            locations={orderedFilteredLocations}
            selectedLocationIds={selectedLocationIds}
            allVisibleSelected={allVisibleSelected}
            someVisibleSelected={someVisibleSelected}
            includeRegionInSorting={includeRegionInSorting}
            sortDirection={sortDirection}
            onIncludeRegionInSortingChange={onIncludeRegionInSortingChange}
            onSortDirectionChange={onSortDirectionChange}
            onToggleSelectAll={onToggleSelectAll}
            onToggleLocation={onToggleLocation}
          />
        )}
      </div>
    </div>
  );
};
