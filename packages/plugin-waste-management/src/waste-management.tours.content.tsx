import { useMemo, useState } from 'react';
import type { WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';

import { StatusNotice } from './waste-management.page.support.js';
import { useWasteTabPanelActions } from './waste-management.tab-panel-actions.js';
import { WasteToursContentBody } from './waste-management.tours.content.body.js';
import {
  WasteToursDeleteDialogs,
  type WasteToursContentProps,
  useWasteToursSelectionState,
} from './waste-management.tours.content.parts.js';
import { WasteToursEmptyState } from './waste-management.tours.empty-state.js';
import { formatTourRecurrence } from './waste-management.tours.presentation.js';
import type { WasteToursSortDirection, WasteToursSortField } from './waste-management.tours.table.parts.js';

export { WasteToursEmptyState };

export const WasteToursContent = ({
  assignmentContextLoading,
  message,
  tours,
  fractions,
  masterDataOverview,
  schedulingOverview,
  onOpenCreateDialog,
  onOpenEditDialog,
  onOpenCreateAssignmentsDialog,
  onOpenEditAssignmentsDialog,
  onOpenCalendar,
  onToggleTourStatus,
  onDeleteTour,
  onDeleteTours,
  saving = false,
  page,
  pageSize,
  query,
  status,
  onPageChange,
  onSyncPageChange,
  onPageSizeChange,
  onQueryChange,
  onStatusChange,
}: WasteToursContentProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const [sortField, setSortField] = useState<WasteToursSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<WasteToursSortDirection>('asc');
  const locationCountByTourId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const link of masterDataOverview?.locationTourLinks ?? []) {
      counts.set(link.tourId, (counts.get(link.tourId) ?? 0) + 1);
    }
    return counts;
  }, [masterDataOverview?.locationTourLinks]);
  const sortedTours = useMemo(() => {
    if (!sortField) {
      return tours;
    }

    const resolveSortValue = (tour: WasteTourRecord): string => {
      switch (sortField) {
        case 'name':
          return tour.name;
        case 'recurrence': {
          const recurrenceValue = formatTourRecurrence(pt, tour.recurrence);
          return recurrenceValue === '—' ? '' : recurrenceValue;
        }
        case 'locations':
          return String(locationCountByTourId.get(tour.id) ?? 0).padStart(6, '0');
        case 'status':
          return tour.active ? 'active' : 'inactive';
        default:
          return '';
      }
    };

    return [...tours].sort((left, right) => {
      const comparison = resolveSortValue(left).localeCompare(resolveSortValue(right), 'de', {
        numeric: true,
        sensitivity: 'base',
      });
      return sortDirection === 'asc' ? comparison : comparison * -1;
    });
  }, [locationCountByTourId, pt, sortDirection, sortField, tours]);
  const {
    selectedTourIds,
    setSelectedTourIds,
    filtersOpen,
    setFiltersOpen,
    tourPendingDelete,
    setTourPendingDelete,
    bulkDeleteOpen,
    setBulkDeleteOpen,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelectAllVisible,
    toggleSelectedTour,
  } = useWasteToursSelectionState({ tours: sortedTours, page, pageSize, query, status });

  useWasteTabPanelActions(null);

  return (
    <div className="space-y-4">
      <StatusNotice message={message} />
      <WasteToursContentBody
        filtersOpen={filtersOpen}
        setFiltersOpen={setFiltersOpen}
        setBulkDeleteOpen={setBulkDeleteOpen}
        tours={sortedTours}
        fractions={fractions}
        masterDataOverview={masterDataOverview}
        schedulingOverview={schedulingOverview}
        assignmentContextLoading={assignmentContextLoading}
        selectedTourIds={selectedTourIds}
        allVisibleSelected={allVisibleSelected}
        someVisibleSelected={someVisibleSelected}
        saving={saving}
        sortField={sortField}
        sortDirection={sortDirection}
        page={page}
        pageSize={pageSize}
        query={query}
        status={status}
        onOpenCreateDialog={onOpenCreateDialog}
        onPageChange={onPageChange}
        onSyncPageChange={onSyncPageChange}
        onPageSizeChange={onPageSizeChange}
        onSortChange={(field) => {
          if (field === sortField) {
            setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
            return;
          }
          setSortField(field);
          setSortDirection('asc');
        }}
        onQueryChange={onQueryChange}
        onStatusChange={onStatusChange}
        toggleSelectAllVisible={toggleSelectAllVisible}
        toggleSelectedTour={toggleSelectedTour}
        onOpenCalendar={onOpenCalendar}
        onOpenEditDialog={onOpenEditDialog}
        onOpenCreateAssignmentsDialog={onOpenCreateAssignmentsDialog}
        onOpenEditAssignmentsDialog={onOpenEditAssignmentsDialog}
        onToggleTourStatus={onToggleTourStatus}
        setTourPendingDelete={setTourPendingDelete}
      />
      <WasteToursDeleteDialogs
        tourPendingDelete={tourPendingDelete}
        bulkDeleteOpen={bulkDeleteOpen}
        selectedTourIds={selectedTourIds}
        onCancelSingle={() => setTourPendingDelete(null)}
        onCancelBulk={() => setBulkDeleteOpen(false)}
        onDeleteTour={onDeleteTour}
        onDeleteTours={onDeleteTours}
        onAfterBulkDelete={() => {
          setSelectedTourIds([]);
          setBulkDeleteOpen(false);
        }}
      />
    </div>
  );
};
