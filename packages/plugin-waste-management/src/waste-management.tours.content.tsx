import type { WasteTourRecord } from '@sva/plugin-sdk';

import type { WasteManagementMasterDataOverview, WasteManagementSchedulingOverview } from './waste-management.api.js';
import { StatusNotice, type StatusMessage } from './waste-management.page.support.js';
import { useWasteTabPanelActions } from './waste-management.tab-panel-actions.js';
import { WastePanelTableTopBar } from './waste-management.table-frame.js';
import { WasteToursDeleteDialogs, useWasteToursSelectionState } from './waste-management.tours.content.parts.js';
import { WasteToursEmptyState } from './waste-management.tours.empty-state.js';
import { WasteToursTable } from './waste-management.tours.table.js';
import { WasteToursToolbar } from './waste-management.tours.toolbar.js';

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
  onPageSizeChange,
  onQueryChange,
  onStatusChange,
}: {
  readonly assignmentContextLoading: boolean;
  readonly message: StatusMessage | null;
  readonly tours: readonly WasteTourRecord[];
  readonly fractions: readonly { readonly id: string; readonly name: string }[];
  readonly masterDataOverview: WasteManagementMasterDataOverview | null;
  readonly schedulingOverview: WasteManagementSchedulingOverview | null;
  readonly onOpenCreateDialog: () => void;
  readonly onOpenEditDialog: (tour: WasteTourRecord) => void;
  readonly onOpenCreateAssignmentsDialog: (tour: WasteTourRecord) => void;
  readonly onOpenEditAssignmentsDialog: (tour: WasteTourRecord, linkId: string) => void;
  readonly onOpenCalendar: (tour: WasteTourRecord) => void;
  readonly onToggleTourStatus: (tour: WasteTourRecord, nextActive: boolean) => Promise<void>;
  readonly onDeleteTour: (tour: WasteTourRecord) => Promise<void>;
  readonly onDeleteTours: (tourIds: readonly string[]) => Promise<void>;
  readonly saving?: boolean;
  readonly page: number;
  readonly pageSize: number;
  readonly query: string;
  readonly status: 'all' | 'active' | 'inactive';
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
  readonly onQueryChange: (value: string) => void;
  readonly onStatusChange: (value: 'all' | 'active' | 'inactive') => void;
}) => {
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
      <WastePanelTableTopBar>
        <WasteToursToolbar
          filtersOpen={filtersOpen}
          selectedCount={selectedTourIds.length}
          query={query}
          status={status}
          onOpenCreateDialog={onOpenCreateDialog}
          onToggleFiltersOpen={() => setFiltersOpen((current) => !current)}
          onOpenBulkDelete={() => setBulkDeleteOpen(true)}
          onQueryChange={onQueryChange}
          onStatusChange={onStatusChange}
        />
      </WastePanelTableTopBar>
      <WasteToursTable
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
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        onToggleSelectAllVisible={toggleSelectAllVisible}
        onToggleSelectedTour={toggleSelectedTour}
        onOpenCalendar={onOpenCalendar}
        onOpenEditDialog={onOpenEditDialog}
        onOpenCreateAssignmentsDialog={onOpenCreateAssignmentsDialog}
        onOpenEditAssignmentsDialog={onOpenEditAssignmentsDialog}
        onToggleTourStatus={onToggleTourStatus}
        onRequestDeleteTour={setTourPendingDelete}
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
