import { useMemo, useRef, useState } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { StatusNotice } from './waste-management.page.support.js';
import { useWasteTabPanelActions } from './waste-management.tab-panel-actions.js';
import {
  WasteToursContentBody,
  type WasteToursFilterViewModel,
  type WasteToursTableViewModel,
} from './waste-management.tours.content.body.js';
import { useWasteToursSelectionState } from './waste-management.tours.content.parts.js';
import {
  applyWasteToursFilters,
  resetWasteToursFilters,
  setWasteTourFilterCriterion,
  updateWasteToursSorting,
} from './waste-management.tours.content.helpers.js';
import type { WasteToursContentProps } from './waste-management.tours.view-model.js';
import { useWasteToursContentSorting } from './waste-management.tours.content.sorting.js';
import { useWasteToursAnnualTransfer } from './waste-management.tours-annual-transfer.js';
import { WasteToursContentDialogs } from './waste-management.tours.content.dialogs.js';
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
    onOpenAssignments,
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
    useWasteToursContentSorting(tours, masterDataOverview, schedulingOverview, fractions);
  const availableTourIds = useMemo(() => allTours.map((tour) => tour.id), [allTours]);
  const {
    selectedTourIds,
    setSelectedTourIds,
    setFilterDialogOpen,
    setDraftQuery,
    setDraftStatus,
    setDraftTourValidityPeriod,
    setDraftTourWasteFractionId,
    setDraftFirstDateFrom,
    setDraftFirstDateTo,
    setDraftEndDateFrom,
    setDraftEndDateTo,
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
    ...filterDraft
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
    query,
    status,
    tourValidityPeriod,
    tourWasteFractionId,
    firstDateFrom,
    firstDateTo,
    endDateFrom,
    endDateTo,
    ...filterDraft,
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
        ...filterDraft,
      }),
    onSetCriterion: (patch) =>
      setWasteTourFilterCriterion(
        {
          q: query,
          tourStatus: status,
          tourValidityPeriod,
          tourWasteFractionId,
          firstDateFrom,
          firstDateTo,
          endDateFrom,
          endDateTo,
        },
        patch,
        { onFiltersChange, onQueryChange, onStatusChange }
      ),
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
    onCompactSortChange: (field, direction) => {
      setSortField(field);
      setSortDirection(direction);
      if (page !== 1) onPageChange(1);
    },
    onSortChange: (field) => {
      updateWasteToursSorting({ field, sortField, setSortField, setSortDirection });
      if (page !== 1) onPageChange(1);
    },
    toggleSelectAllVisible,
    toggleSelectAllFiltered,
    clearSelection,
    toggleSelectedTour,
    onOpenCalendar,
    onOpenStatusDialog: setTourPendingStatusChange,
    onOpenEditFraction,
    onOpenEditDialog,
    onOpenDuplicateDialog,
    onOpenAssignments,
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
      <WasteToursContentDialogs
        annualTransferDialog={annualTransfer.dialog}
        allTours={allTours}
        saving={saving}
        tourPendingDelete={tourPendingDelete}
        bulkDeleteOpen={bulkDeleteOpen}
        bulkValidityOpen={bulkValidityOpen}
        bulkStatusOpen={bulkStatusOpen}
        tourPendingStatusChange={tourPendingStatusChange}
        selectedTourIds={selectedTourIds}
        setSelectedTourIds={setSelectedTourIds}
        setTourPendingDelete={setTourPendingDelete}
        setBulkDeleteOpen={setBulkDeleteOpen}
        setBulkValidityOpen={setBulkValidityOpen}
        setBulkStatusOpen={setBulkStatusOpen}
        setTourPendingStatusChange={setTourPendingStatusChange}
        onDeleteTour={onDeleteTour}
        onDeleteTours={onDeleteTours}
        onUpdateTourValidityBulk={onUpdateTourValidityBulk}
        onUpdateTourStatusBulk={onUpdateTourStatusBulk}
        fallbackFocusRef={deleteFocusFallbackRef}
      />
    </div>
  );
};
