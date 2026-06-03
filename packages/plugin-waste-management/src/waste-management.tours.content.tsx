import { useMemo, useState } from 'react';
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
import {
  applyWasteToursFilters,
  createLocationCountByTourId,
  resetWasteToursFilters,
  sortWasteTours,
  updateWasteToursSorting,
} from './waste-management.tours.content.helpers.js';
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
  onOpenDuplicateDialog,
  onOpenCreateAssignmentsDialog,
  onOpenEditAssignmentsDialog,
  onOpenCalendar,
  onToggleTourStatus,
  onDeleteTour,
  onDeleteTours,
  canDuplicateTour = false,
  saving = false,
  page,
  pageSize,
  query,
  status,
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
}: WasteToursContentProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const [sortField, setSortField] = useState<WasteToursSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<WasteToursSortDirection>('asc');
  const [tourPendingStatusChange, setTourPendingStatusChange] = useState<{
    readonly tour: (typeof tours)[number];
    readonly nextActive: boolean;
  } | null>(null);
  const locationCountByTourId = useMemo(
    () => createLocationCountByTourId(masterDataOverview?.locationTourLinks),
    [masterDataOverview?.locationTourLinks],
  );
  const sortedTours = useMemo(
    () => sortWasteTours({ tours, sortField, sortDirection, locationCountByTourId, pt }),
    [locationCountByTourId, pt, sortDirection, sortField, tours],
  );
  const {
    selectedTourIds,
    setSelectedTourIds,
    filterDialogOpen,
    setFilterDialogOpen,
    draftQuery,
    setDraftQuery,
    draftStatus,
    setDraftStatus,
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
    tourWasteFractionId,
    firstDateFrom,
    firstDateTo,
    endDateFrom,
    endDateTo,
  });

  useWasteTabPanelActions(null);

  return (
    <div className="space-y-4">
      <StatusNotice message={message} />
      <WasteToursContentBody
        filterDialogOpen={filterDialogOpen}
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
        tourWasteFractionId={tourWasteFractionId}
        firstDateFrom={firstDateFrom}
        firstDateTo={firstDateTo}
        endDateFrom={endDateFrom}
        endDateTo={endDateTo}
        draftQuery={draftQuery}
        draftStatus={draftStatus}
        draftTourWasteFractionId={draftTourWasteFractionId}
        draftFirstDateFrom={draftFirstDateFrom}
        draftFirstDateTo={draftFirstDateTo}
        draftEndDateFrom={draftEndDateFrom}
        draftEndDateTo={draftEndDateTo}
        hasActiveFilters={hasActiveFilters}
        onOpenCreateDialog={onOpenCreateDialog}
        onOpenFilterDialog={() => {
          syncDraftFilters();
          setFilterDialogOpen(true);
        }}
        onFilterDialogOpenChange={setFilterDialogOpen}
        onPageChange={onPageChange}
        onSyncPageChange={onSyncPageChange}
        onPageSizeChange={onPageSizeChange}
        onSortChange={(field) => updateWasteToursSorting({ field, sortField, setSortField, setSortDirection })}
        onDraftQueryChange={setDraftQuery}
        onDraftStatusChange={setDraftStatus}
        onDraftTourWasteFractionIdChange={setDraftTourWasteFractionId}
        onDraftFirstDateFromChange={setDraftFirstDateFrom}
        onDraftFirstDateToChange={setDraftFirstDateTo}
        onDraftEndDateFromChange={setDraftEndDateFrom}
        onDraftEndDateToChange={setDraftEndDateTo}
        onApplyFilters={() =>
          applyWasteToursFilters({
            onFiltersChange,
            onQueryChange,
            onStatusChange,
            setFilterDialogOpen,
            draftQuery,
            draftStatus,
            draftTourWasteFractionId,
            draftFirstDateFrom,
            draftFirstDateTo,
            draftEndDateFrom,
            draftEndDateTo,
          })}
        onResetFilters={() => resetWasteToursFilters({ onFiltersChange, onQueryChange, onStatusChange })}
        toggleSelectAllVisible={toggleSelectAllVisible}
        toggleSelectedTour={toggleSelectedTour}
        onOpenCalendar={onOpenCalendar}
        onOpenEditDialog={onOpenEditDialog}
        onOpenDuplicateDialog={onOpenDuplicateDialog}
        onOpenCreateAssignmentsDialog={onOpenCreateAssignmentsDialog}
        onOpenEditAssignmentsDialog={onOpenEditAssignmentsDialog}
        canDuplicateTour={canDuplicateTour}
        onToggleTourStatus={(tour, nextActive) => {
          setTourPendingStatusChange({ tour, nextActive });
          return Promise.resolve();
        }}
        setTourPendingDelete={setTourPendingDelete}
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

          return Promise.resolve(onToggleTourStatus(tourPendingStatusChange.tour, tourPendingStatusChange.nextActive)).finally(
            () => setTourPendingStatusChange(null)
          );
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
