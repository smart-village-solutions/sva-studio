import { useMemo, useRef, useState } from 'react';
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
import { useWasteToursAnnualTransfer } from './waste-management.tours-annual-transfer.js';
import { WasteToursStatusBulkDialog } from './waste-management.tours-status-bulk-dialog.js';
export { WasteToursEmptyState } from './waste-management.tours.empty-state.js';
export const WasteToursContent = (props: WasteToursContentProps) => {
  const annualTransfer = useWasteToursAnnualTransfer(props);
  const {
    assignmentContextLoading,
    message,
    tours,
    allTours = tours,
    fractions,
    masterDataOverview,
    schedulingOverview,
    onOpenCreateDialog,
    onOpenEditDialog,
    onOpenDuplicateDialog,
    onOpenCreateAssignmentsDialog,
    onOpenEditAssignmentsDialog,
    onOpenCalendar,
    onOpenEditFraction,
    onDeleteTour,
    onDeleteTours,
    onUpdateTourValidityBulk,
    onUpdateTourStatusBulk,
    canDuplicateTour = false,
    canManageScheduling = false,
    search,
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
  const [tourPendingStatusChange, setTourPendingStatusChange] = useState<
    (typeof tours)[number] | null
  >(null);
  const deleteFocusFallbackRef = useRef<HTMLElement | null>(null);
  const { sortedTours, sortField, setSortField, sortDirection, setSortDirection } =
    useWasteToursContentSorting(tours, masterDataOverview?.locationTourLinks);
  const availableTourIds = useMemo(() => allTours.map((tour) => tour.id), [allTours]);
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
    bulkStatusOpen,
    setBulkStatusOpen,
    allVisibleSelected,
    someVisibleSelected,
    allFilteredSelected,
    someFilteredSelected,
    hiddenSelectedCount,
    toggleSelectAllVisible,
    toggleSelectAllFiltered,
    clearSelection,
    toggleSelectedTour,
  } = useWasteToursSelectionState({
    tours: sortedTours,
    availableTourIds,
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
    allFilteredSelected,
    someFilteredSelected,
    hiddenSelectedCount,
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
    toggleSelectAllFiltered,
    clearSelection,
    toggleSelectedTour,
    onOpenCalendar,
    onOpenStatusDialog: setTourPendingStatusChange,
    onOpenEditFraction,
    onOpenEditDialog,
    onOpenDuplicateDialog,
    onOpenCreateAssignmentsDialog,
    onOpenEditAssignmentsDialog,
    canDuplicateTour,
    canManageScheduling,
    search,
    setTourPendingDelete,
  };
  return (
    <div className="space-y-4">
      <StatusNotice message={message} />
      <WasteToursContentBody
        setBulkDeleteOpen={setBulkDeleteOpen}
        setBulkValidityOpen={setBulkValidityOpen}
        setBulkStatusOpen={setBulkStatusOpen}
        fractions={fractions}
        onOpenCreateDialog={onOpenCreateDialog}
        onOpenAnnualTransfer={annualTransfer.open}
        filters={filters}
        table={table}
        focusFallbackRef={deleteFocusFallbackRef}
        focusFallbackLabel={pt('tabs.tours.title')}
      />
      {annualTransfer.dialog}
      <WasteToursBulkValidityDialog
        open={bulkValidityOpen}
        tours={allTours}
        selectedTourIds={selectedTourIds}
        saving={saving}
        onOpenChange={setBulkValidityOpen}
        onUpdate={onUpdateTourValidityBulk}
        onUpdated={() => {
          setSelectedTourIds([]);
          setBulkValidityOpen(false);
        }}
      />
      {bulkStatusOpen ? (
        <WasteToursStatusBulkDialog
          open
          selectedTourIds={selectedTourIds}
          saving={saving}
          onOpenChange={setBulkStatusOpen}
          onSubmit={onUpdateTourStatusBulk}
          onUpdated={() => {
            clearSelection();
            setBulkStatusOpen(false);
          }}
        />
      ) : null}
      {tourPendingStatusChange ? (
        <WasteToursStatusBulkDialog
          open
          selectedTourIds={[tourPendingStatusChange.id]}
          tourName={tourPendingStatusChange.name}
          saving={saving}
          onOpenChange={(open) => {
            if (!open) {
              setTourPendingStatusChange(null);
            }
          }}
          onSubmit={onUpdateTourStatusBulk}
          onUpdated={() => setTourPendingStatusChange(null)}
        />
      ) : null}
      <WasteToursDeleteDialogs
        tourPendingDelete={tourPendingDelete}
        bulkDeleteOpen={bulkDeleteOpen}
        selectedTourIds={selectedTourIds}
        onCancelSingle={() => setTourPendingDelete(null)}
        onCancelBulk={() => setBulkDeleteOpen(false)}
        onDeleteTour={onDeleteTour}
        onDeleteTours={onDeleteTours}
        onAfterBulkDelete={(failedIds) => {
          setSelectedTourIds(failedIds);
          setBulkDeleteOpen(failedIds.length > 0);
        }}
        fallbackFocusRef={deleteFocusFallbackRef}
      />
    </div>
  );
};
