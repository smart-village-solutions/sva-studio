import type { Dispatch, SetStateAction } from 'react';
import type { WasteTourRecord } from '@sva/plugin-sdk';

import type {
  WasteManagementMasterDataOverview,
  WasteManagementSchedulingOverview,
} from './waste-management.api.js';
import { WastePanelTableTopBar } from './waste-management.table-frame.js';
import type {
  WasteToursSortDirection,
  WasteToursSortField,
} from './waste-management.tours.table.parts.js';
import { WasteToursTable } from './waste-management.tours.table.js';
import { WasteToursToolbar } from './waste-management.tours.toolbar.js';

export type WasteToursFilterViewModel = {
  readonly filterDialogOpen: boolean;
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
  readonly onOpenFilterDialog: () => void;
  readonly onFilterDialogOpenChange: (open: boolean) => void;
  readonly onDraftQueryChange: (value: string) => void;
  readonly onDraftStatusChange: (value: 'all' | 'active' | 'inactive') => void;
  readonly onDraftTourWasteFractionIdChange: (value: string | undefined) => void;
  readonly onDraftFirstDateFromChange: (value: string | undefined) => void;
  readonly onDraftFirstDateToChange: (value: string | undefined) => void;
  readonly onDraftEndDateFromChange: (value: string | undefined) => void;
  readonly onDraftEndDateToChange: (value: string | undefined) => void;
  readonly onApplyFilters: () => void;
  readonly onResetFilters: () => void;
};

export type WasteToursTableViewModel = {
  readonly selectedTourIds: readonly string[];
  readonly tours: readonly WasteTourRecord[];
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
  readonly onPageChange: (page: number) => void;
  readonly onSyncPageChange?: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
  readonly onSortChange: (field: WasteToursSortField) => void;
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

type WasteToursContentBodyProps = {
  readonly fractions: readonly { readonly id: string; readonly name: string }[];
  readonly onOpenCreateDialog: () => void;
  readonly setBulkDeleteOpen: Dispatch<SetStateAction<boolean>>;
  readonly filters: WasteToursFilterViewModel;
  readonly table: WasteToursTableViewModel;
  /** Transitional compatibility for focused body consumers; production uses `table`. */
  readonly tours?: readonly WasteTourRecord[];
  readonly onSortChange?: (field: WasteToursSortField) => void;
  readonly setTourPendingDelete?: Dispatch<SetStateAction<WasteTourRecord | null>>;
};

export const WasteToursContentBody = ({
  fractions,
  onOpenCreateDialog,
  setBulkDeleteOpen,
  filters,
  table,
}: WasteToursContentBodyProps) => (
  <section className="overflow-hidden rounded-none border-y border-border bg-card shadow-shell">
    <WastePanelTableTopBar>
      <WasteToursToolbar
        filterDialogOpen={filters.filterDialogOpen}
        selectedCount={table.selectedTourIds.length}
        query={filters.query}
        status={filters.status}
        fractions={fractions}
        tourWasteFractionId={filters.tourWasteFractionId}
        firstDateFrom={filters.firstDateFrom}
        firstDateTo={filters.firstDateTo}
        endDateFrom={filters.endDateFrom}
        endDateTo={filters.endDateTo}
        draftQuery={filters.draftQuery}
        draftStatus={filters.draftStatus}
        draftTourWasteFractionId={filters.draftTourWasteFractionId}
        draftFirstDateFrom={filters.draftFirstDateFrom}
        draftFirstDateTo={filters.draftFirstDateTo}
        draftEndDateFrom={filters.draftEndDateFrom}
        draftEndDateTo={filters.draftEndDateTo}
        hasActiveFilters={filters.hasActiveFilters}
        onOpenCreateDialog={onOpenCreateDialog}
        onOpenFilterDialog={filters.onOpenFilterDialog}
        onFilterDialogOpenChange={filters.onFilterDialogOpenChange}
        onOpenBulkDelete={() => setBulkDeleteOpen(true)}
        onDraftQueryChange={filters.onDraftQueryChange}
        onDraftStatusChange={filters.onDraftStatusChange}
        onDraftTourWasteFractionIdChange={filters.onDraftTourWasteFractionIdChange}
        onDraftFirstDateFromChange={filters.onDraftFirstDateFromChange}
        onDraftFirstDateToChange={filters.onDraftFirstDateToChange}
        onDraftEndDateFromChange={filters.onDraftEndDateFromChange}
        onDraftEndDateToChange={filters.onDraftEndDateToChange}
        onApplyFilters={filters.onApplyFilters}
        onResetFilters={filters.onResetFilters}
      />
    </WastePanelTableTopBar>
    <WasteToursTable
      {...table}
      fractions={fractions}
      onToggleSelectAllVisible={table.toggleSelectAllVisible}
      onToggleSelectedTour={table.toggleSelectedTour}
      onRequestDeleteTour={table.setTourPendingDelete}
    />
  </section>
);
