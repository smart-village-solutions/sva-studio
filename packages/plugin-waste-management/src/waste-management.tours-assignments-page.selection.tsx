import { useMemo, useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Badge } from '@sva/studio-ui-react';

import { defaultWastePageSize } from './pagination-search-params.js';
import { TourAssignmentsTable } from './waste-management.tours-assignments-table.js';
import type { TourAssignmentLocationOption } from './waste-management.tours.locations.js';
import {
  createTourAssignmentSelectionSummary,
  orderTourAssignmentLocations,
  type TourAssignmentSortDirection,
  type TourAssignmentSortField,
  type TourAssignmentSortOptions,
} from './waste-management.tours.view-model.js';
import { createPagedItems, WastePanelTableBottomBar } from './waste-management.table-frame.js';

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

type TourAssignmentsPageSelectionProps = {
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
}: TourAssignmentsPageSelectionProps) => {
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

const useDraftTourAssignments = (locations: readonly TourAssignmentLocationOption[]) => {
  const [selectionChanges, setSelectionChanges] = useState<ReadonlyMap<string, boolean>>(
    () => new Map()
  );
  const assignedLocationIds = useMemo(
    () =>
      new Set(
        locations.filter((location) => location.assignedLinkId).map((location) => location.id)
      ),
    [locations]
  );
  const selectedLocationIds = useMemo(
    () =>
      locations
        .map((location) => location.id)
        .filter((id) => selectionChanges.get(id) ?? assignedLocationIds.has(id)),
    [assignedLocationIds, locations, selectionChanges]
  );

  const changeSelection = (locationIds: readonly string[], checked: boolean) => {
    setSelectionChanges((current) => {
      const changes = new Map(current);
      for (const id of locationIds) {
        if (checked === assignedLocationIds.has(id)) {
          changes.delete(id);
        } else {
          changes.set(id, checked);
        }
      }
      return changes;
    });
  };

  return { assignedLocationIds, selectedLocationIds, selectionChanges, changeSelection };
};

type TourAssignmentSelectionInput = Readonly<{
  locations: readonly TourAssignmentLocationOption[];
  filteredLocations: readonly TourAssignmentLocationOption[];
  loading: boolean;
  unavailable: boolean;
  page: number;
  setPage: (page: number) => void;
}>;

export const useTourAssignmentSelection = ({
  locations,
  filteredLocations,
  loading,
  unavailable,
  page,
  setPage,
}: TourAssignmentSelectionInput) => {
  const { assignedLocationIds, selectedLocationIds, selectionChanges, changeSelection } =
    useDraftTourAssignments(locations);
  const [sort, setSort] = useState<Required<TourAssignmentSortOptions>>({
    field: 'cityName',
    direction: 'asc',
  });
  const [pageSize, setPageSize] = useState<number>(defaultWastePageSize);

  const orderedFilteredLocations = useMemo(
    () => orderTourAssignmentLocations(filteredLocations, [...assignedLocationIds], sort),
    [filteredLocations, assignedLocationIds, sort]
  );
  const pagedLocations = createPagedItems({ items: orderedFilteredLocations, page, pageSize });

  const filteredLocationIds = filteredLocations.map((location) => location.id);
  const { allVisibleSelected, someVisibleSelected, hiddenSelectedCount } =
    createTourAssignmentSelectionSummary({
      filteredLocationIds,
      selectedLocationIds,
    });

  const changeSort = (field: TourAssignmentSortField) => {
    setSort((current) => ({
      field,
      direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc',
    }));
    setPage(1);
  };

  const hasChanges =
    loading || unavailable
      ? selectionChanges.size > 0
      : [...selectionChanges].some(([id, checked]) => checked !== assignedLocationIds.has(id));

  return {
    hasChanges,
    selectionChanges,
    selectionProps: {
      loading,
      selectedLocationIds,
      filteredLocationsCount: filteredLocations.length,
      hiddenSelectedCount,
      locations: pagedLocations.items,
      page: pagedLocations.safePage,
      pageSize,
      pageCount: pagedLocations.pageCount,
      onPageChange: setPage,
      onPageSizeChange: (value) => {
        setPageSize(value);
        setPage(1);
      },
      allVisibleSelected,
      someVisibleSelected,
      sortField: sort.field,
      sortDirection: sort.direction,
      onSortChange: changeSort,
      onToggleSelectAll: (checked) => changeSelection(filteredLocationIds, checked),
      onToggleLocation: (id, checked) => changeSelection([id], checked),
    } satisfies TourAssignmentsPageSelectionProps,
  };
};
