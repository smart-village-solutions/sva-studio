import { useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';

import { StatusNotice } from './waste-management.page.support.js';
import { useWasteTabPanelActions } from './waste-management.tab-panel-actions.js';
import {
  WasteToursContentBody,
  type WasteToursFilterViewModel,
  type WasteToursTableViewModel,
} from './waste-management.tours.content.body.js';
import {
  WasteToursDeleteDialogs,
  useWasteToursSelectionState,
} from './waste-management.tours.content.parts.js';
import {
  applyWasteToursFilters,
  resetWasteToursFilters,
  updateWasteToursSorting,
} from './waste-management.tours.content.helpers.js';
import type { WasteToursContentProps } from './waste-management.tours.view-model.js';
import { WasteToursBulkValidityDialog } from './waste-management.tours-bulk-validity.js';
import { useWasteToursContentSorting } from './waste-management.tours.content.sorting.js';

export { WasteToursEmptyState } from './waste-management.tours.empty-state.js';

export const WasteToursContent = (props: WasteToursContentProps) => {
  const {
    assignmentContextLoading,
    message,
    tours,
    fractions,
    masterDataOverview,
    schedulingOverview,
    onOpenCreateDialog,
    onOpenEditDialog,
    onOpenDuplicateDialog,
    onOpenCreateAssignmentsDialog,
    onOpenEditAssignmentsDialog,
    onOpenCalendar,
    onToggleTourStatus,
    onDeleteTour,
    onDeleteTours,
    onUpdateTourValidityBulk,
    canDuplicateTour = false,
    saving = false,
    page,
    pageSize,
    query,
    status,
    tourValidityPeriod,
    tourWasteFractionId,
    firstDateFrom,
    firstDateTo,
    endDateFrom,
    endDateTo,
    onPageChange,
    onSyncPageChange,
    onPageSizeChange,
    onQueryChange,
    onStatusChange,
    onFiltersChange,
  } = props;
  const pt = usePluginTranslation('wasteManagement');
  const { sortedTours, sortField, setSortField, sortDirection, setSortDirection } =
    useWasteToursContentSorting(tours, masterDataOverview?.locationTourLinks);
  const [tourPendingStatusChange, setTourPendingStatusChange] = useState<{
    readonly tour: (typeof tours)[number];
    readonly nextActive: boolean;
  } | null>(null);
  const {
    selectedTourIds,
    setSelectedTourIds,
    filterDialogOpen,
    setFilterDialogOpen,
    draftQuery,
    setDraftQuery,
    draftStatus,
    setDraftStatus,
    draftTourValidityPeriod,
    setDraftTourValidityPeriod,
    draftTourWasteFractionId,
    setDraftTourWasteFractionId,
    draftFirstDateFrom,
    setDraftFirstDateFrom,
    draftFirstDateTo,
    setDraftFirstDateTo,
    draftEndDateFrom,
    setDraftEndDateFrom,
    draftEndDateTo,
    setDraftEndDateTo,
    hasActiveFilters,
    syncDraftFilters,
    tourPendingDelete,
    setTourPendingDelete,
    bulkDeleteOpen,
    setBulkDeleteOpen,
    bulkValidityOpen,
    setBulkValidityOpen,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelectAllVisible,
    toggleSelectedTour,
  } = useWasteToursSelectionState({
    tours: sortedTours,
    page,
    pageSize,
    query,
    status,
    tourValidityPeriod,
    tourWasteFractionId,
    firstDateFrom,
    firstDateTo,
    endDateFrom,
    endDateTo,
  });

  useWasteTabPanelActions(null);

  const filters: WasteToursFilterViewModel = {
    filterDialogOpen,
    query,
    status,
    tourValidityPeriod,
    tourWasteFractionId,
    firstDateFrom,
    firstDateTo,
    endDateFrom,
    endDateTo,
    draftQuery,
    draftStatus,
    draftTourValidityPeriod,
    draftTourWasteFractionId,
    draftFirstDateFrom,
    draftFirstDateTo,
    draftEndDateFrom,
    draftEndDateTo,
    hasActiveFilters,
    onOpenFilterDialog: () => {
      syncDraftFilters();
      setFilterDialogOpen(true);
    },
    onFilterDialogOpenChange: setFilterDialogOpen,
    onDraftQueryChange: setDraftQuery,
    onDraftStatusChange: setDraftStatus,
    onDraftTourValidityPeriodChange: setDraftTourValidityPeriod,
    onDraftTourWasteFractionIdChange: setDraftTourWasteFractionId,
    onDraftFirstDateFromChange: setDraftFirstDateFrom,
    onDraftFirstDateToChange: setDraftFirstDateTo,
    onDraftEndDateFromChange: setDraftEndDateFrom,
    onDraftEndDateToChange: setDraftEndDateTo,
    onApplyFilters: () =>
      applyWasteToursFilters({
        onFiltersChange,
        onQueryChange,
        onStatusChange,
        setFilterDialogOpen,
        draftQuery,
        draftStatus,
        draftTourValidityPeriod,
        draftTourWasteFractionId,
        draftFirstDateFrom,
        draftFirstDateTo,
        draftEndDateFrom,
        draftEndDateTo,
      }),
    onResetFilters: () =>
      resetWasteToursFilters({ onFiltersChange, onQueryChange, onStatusChange }),
  };
  const table: WasteToursTableViewModel = {
    selectedTourIds,
    tours: sortedTours,
    masterDataOverview,
    schedulingOverview,
    assignmentContextLoading,
    allVisibleSelected,
    someVisibleSelected,
    saving,
    sortField,
    sortDirection,
    page,
    pageSize,
    onPageChange,
    onSyncPageChange,
    onPageSizeChange,
    onSortChange: (field) =>
      updateWasteToursSorting({ field, sortField, setSortField, setSortDirection }),
    toggleSelectAllVisible,
    toggleSelectedTour,
    onOpenCalendar,
    onOpenEditDialog,
    onOpenDuplicateDialog,
    onOpenCreateAssignmentsDialog,
    onOpenEditAssignmentsDialog,
    canDuplicateTour,
    onToggleTourStatus: (tour, nextActive) => {
      setTourPendingStatusChange({ tour, nextActive });
      return Promise.resolve();
    },
    setTourPendingDelete,
  };

  return (
    <div className="space-y-4">
      <StatusNotice message={message} />
      <WasteToursContentBody
        setBulkDeleteOpen={setBulkDeleteOpen}
        setBulkValidityOpen={setBulkValidityOpen}
        fractions={fractions}
        onOpenCreateDialog={onOpenCreateDialog}
        filters={filters}
        table={table}
      />
      <WasteToursBulkValidityDialog
        open={bulkValidityOpen}
        tours={sortedTours}
        selectedTourIds={selectedTourIds}
        saving={saving}
        onOpenChange={setBulkValidityOpen}
        onUpdate={onUpdateTourValidityBulk}
        onUpdated={() => {
          setSelectedTourIds([]);
          setBulkValidityOpen(false);
        }}
      />
      <WasteToursDeleteDialogs
        tourPendingDelete={tourPendingDelete}
        tourPendingStatusChange={tourPendingStatusChange}
        bulkDeleteOpen={bulkDeleteOpen}
        selectedTourIds={selectedTourIds}
        onCancelSingle={() => setTourPendingDelete(null)}
        onCancelStatusChange={() => setTourPendingStatusChange(null)}
        onCancelBulk={() => setBulkDeleteOpen(false)}
        onDeleteTour={onDeleteTour}
        onConfirmStatusChange={() => {
          if (!tourPendingStatusChange) {
            return Promise.resolve();
          }

          return Promise.resolve(
            onToggleTourStatus(tourPendingStatusChange.tour, tourPendingStatusChange.nextActive)
          ).finally(() => setTourPendingStatusChange(null));
        }}
        onDeleteTours={onDeleteTours}
        onAfterBulkDelete={() => {
          setSelectedTourIds([]);
          setBulkDeleteOpen(false);
        }}
      />
    </div>
  );
};
