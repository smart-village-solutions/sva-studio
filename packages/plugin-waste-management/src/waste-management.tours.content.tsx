import type { WasteTourRecord } from '@sva/plugin-sdk';

import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import { useWasteTabPanelActions } from './waste-management.tab-panel-actions.js';
import { WasteToursContentBody } from './waste-management.tours.content.body.js';
import {
  WasteToursDeleteDialogs,
  type WasteToursContentProps,
  useWasteToursSelectionState,
} from './waste-management.tours.content.parts.js';
import { WasteToursEmptyState } from './waste-management.tours.empty-state.js';

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
  } = useWasteToursSelectionState({ tours, page, pageSize, query, status });

  useWasteTabPanelActions(null);

  return (
    <div className="space-y-4">
      <StatusNotice message={message} />
      <WasteToursContentBody
        filtersOpen={filtersOpen}
        setFiltersOpen={setFiltersOpen}
        setBulkDeleteOpen={setBulkDeleteOpen}
        tours={tours}
        fractions={fractions}
        masterDataOverview={masterDataOverview}
        schedulingOverview={schedulingOverview}
        assignmentContextLoading={assignmentContextLoading}
        selectedTourIds={selectedTourIds}
        allVisibleSelected={allVisibleSelected}
        someVisibleSelected={someVisibleSelected}
        saving={saving}
        page={page}
        pageSize={pageSize}
        query={query}
        status={status}
        onOpenCreateDialog={onOpenCreateDialog}
        onPageChange={onPageChange}
        onSyncPageChange={onSyncPageChange}
        onPageSizeChange={onPageSizeChange}
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
