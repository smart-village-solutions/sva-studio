import type { Dispatch, SetStateAction } from 'react';
import type { WasteTourRecord } from '@sva/plugin-sdk';

import type { WasteManagementMasterDataOverview, WasteManagementSchedulingOverview } from './waste-management.api.js';
import { WastePanelTableTopBar } from './waste-management.table-frame.js';
import type { WasteToursSortDirection, WasteToursSortField } from './waste-management.tours.table.parts.js';
import { WasteToursTable } from './waste-management.tours.table.js';
import { WasteToursToolbar } from './waste-management.tours.toolbar.js';

type WasteToursContentBodyProps = {
  readonly filterDialogOpen: boolean;
  readonly selectedTourIds: readonly string[];
  readonly setBulkDeleteOpen: Dispatch<SetStateAction<boolean>>;
  readonly tours: readonly WasteTourRecord[];
  readonly fractions: readonly { readonly id: string; readonly name: string }[];
  readonly masterDataOverview: WasteManagementMasterDataOverview | null;
  readonly schedulingOverview: WasteManagementSchedulingOverview | null;
  readonly assignmentContextLoading: boolean;
  readonly allVisibleSelected: boolean;
  readonly someVisibleSelected: boolean;
  readonly saving: boolean;
  readonly sortField: WasteToursSortField | null;
  readonly sortDirection: WasteToursSortDirection;
  readonly page: number;
  readonly pageSize: number;
  readonly query: string;
  readonly status: 'all' | 'active' | 'inactive';
  readonly tourWasteFractionId: string | undefined;
  readonly firstDateFrom: string | undefined;
  readonly firstDateTo: string | undefined;
  readonly endDateFrom: string | undefined;
  readonly endDateTo: string | undefined;
  readonly draftQuery: string;
  readonly draftStatus: 'all' | 'active' | 'inactive';
  readonly draftTourWasteFractionId: string | undefined;
  readonly draftFirstDateFrom: string | undefined;
  readonly draftFirstDateTo: string | undefined;
  readonly draftEndDateFrom: string | undefined;
  readonly draftEndDateTo: string | undefined;
  readonly hasActiveFilters: boolean;
  readonly onOpenCreateDialog: () => void;
  readonly onOpenFilterDialog: () => void;
  readonly onFilterDialogOpenChange: (open: boolean) => void;
  readonly onPageChange: (page: number) => void;
  readonly onSyncPageChange?: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
  readonly onSortChange: (field: WasteToursSortField) => void;
  readonly onDraftQueryChange: (value: string) => void;
  readonly onDraftStatusChange: (value: 'all' | 'active' | 'inactive') => void;
  readonly onDraftTourWasteFractionIdChange: (value: string | undefined) => void;
  readonly onDraftFirstDateFromChange: (value: string | undefined) => void;
  readonly onDraftFirstDateToChange: (value: string | undefined) => void;
  readonly onDraftEndDateFromChange: (value: string | undefined) => void;
  readonly onDraftEndDateToChange: (value: string | undefined) => void;
  readonly onApplyFilters: () => void;
  readonly onResetFilters: () => void;
  readonly toggleSelectAllVisible: (checked: boolean) => void;
  readonly toggleSelectedTour: (tourId: string, checked: boolean) => void;
  readonly onOpenCalendar: (tour: WasteTourRecord) => void;
  readonly onOpenEditDialog: (tour: WasteTourRecord) => void;
  readonly onOpenDuplicateDialog: (tour: WasteTourRecord) => void;
  readonly onOpenCreateAssignmentsDialog: (tour: WasteTourRecord) => void;
  readonly onOpenEditAssignmentsDialog: (tour: WasteTourRecord, linkId: string) => void;
  readonly canDuplicateTour: boolean;
  readonly onToggleTourStatus: (tour: WasteTourRecord, nextActive: boolean) => Promise<void>;
  readonly setTourPendingDelete: Dispatch<SetStateAction<WasteTourRecord | null>>;
};

export const WasteToursContentBody = (props: WasteToursContentBodyProps) => (
  <section className="overflow-hidden rounded-none border-y border-border bg-card shadow-shell">
    <WastePanelTableTopBar>
      <WasteToursToolbar
        filterDialogOpen={props.filterDialogOpen}
        selectedCount={props.selectedTourIds.length}
        query={props.query}
        status={props.status}
        fractions={props.fractions}
        tourWasteFractionId={props.tourWasteFractionId}
        firstDateFrom={props.firstDateFrom}
        firstDateTo={props.firstDateTo}
        endDateFrom={props.endDateFrom}
        endDateTo={props.endDateTo}
        draftQuery={props.draftQuery}
        draftStatus={props.draftStatus}
        draftTourWasteFractionId={props.draftTourWasteFractionId}
        draftFirstDateFrom={props.draftFirstDateFrom}
        draftFirstDateTo={props.draftFirstDateTo}
        draftEndDateFrom={props.draftEndDateFrom}
        draftEndDateTo={props.draftEndDateTo}
        hasActiveFilters={props.hasActiveFilters}
        onOpenCreateDialog={props.onOpenCreateDialog}
        onOpenFilterDialog={props.onOpenFilterDialog}
        onFilterDialogOpenChange={props.onFilterDialogOpenChange}
        onOpenBulkDelete={() => props.setBulkDeleteOpen(true)}
        onDraftQueryChange={props.onDraftQueryChange}
        onDraftStatusChange={props.onDraftStatusChange}
        onDraftTourWasteFractionIdChange={props.onDraftTourWasteFractionIdChange}
        onDraftFirstDateFromChange={props.onDraftFirstDateFromChange}
        onDraftFirstDateToChange={props.onDraftFirstDateToChange}
        onDraftEndDateFromChange={props.onDraftEndDateFromChange}
        onDraftEndDateToChange={props.onDraftEndDateToChange}
        onApplyFilters={props.onApplyFilters}
        onResetFilters={props.onResetFilters}
      />
    </WastePanelTableTopBar>
    <WasteToursTable
      tours={props.tours}
      fractions={props.fractions}
      masterDataOverview={props.masterDataOverview}
      schedulingOverview={props.schedulingOverview}
      assignmentContextLoading={props.assignmentContextLoading}
      selectedTourIds={props.selectedTourIds}
      allVisibleSelected={props.allVisibleSelected}
      someVisibleSelected={props.someVisibleSelected}
      saving={props.saving}
      sortField={props.sortField}
      sortDirection={props.sortDirection}
      page={props.page}
      pageSize={props.pageSize}
      onPageChange={props.onPageChange}
      onSyncPageChange={props.onSyncPageChange}
      onPageSizeChange={props.onPageSizeChange}
      onSortChange={props.onSortChange}
      onToggleSelectAllVisible={props.toggleSelectAllVisible}
      onToggleSelectedTour={props.toggleSelectedTour}
      onOpenCalendar={props.onOpenCalendar}
      onOpenEditDialog={props.onOpenEditDialog}
      onOpenDuplicateDialog={props.onOpenDuplicateDialog}
      onOpenCreateAssignmentsDialog={props.onOpenCreateAssignmentsDialog}
      onOpenEditAssignmentsDialog={props.onOpenEditAssignmentsDialog}
      canDuplicateTour={props.canDuplicateTour}
      onToggleTourStatus={props.onToggleTourStatus}
      onRequestDeleteTour={props.setTourPendingDelete}
    />
  </section>
);
