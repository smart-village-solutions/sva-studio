import type { Dispatch, SetStateAction } from 'react';
import type { WasteTourRecord } from '@sva/plugin-sdk';

import type { WasteManagementMasterDataOverview, WasteManagementSchedulingOverview } from './waste-management.api.js';
import { WastePanelTableTopBar } from './waste-management.table-frame.js';
import { WasteToursTable } from './waste-management.tours.table.js';
import { WasteToursToolbar } from './waste-management.tours.toolbar.js';

type WasteToursContentBodyProps = {
  readonly filtersOpen: boolean;
  readonly selectedTourIds: readonly string[];
  readonly setFiltersOpen: Dispatch<SetStateAction<boolean>>;
  readonly setBulkDeleteOpen: Dispatch<SetStateAction<boolean>>;
  readonly tours: readonly WasteTourRecord[];
  readonly fractions: readonly { readonly id: string; readonly name: string }[];
  readonly masterDataOverview: WasteManagementMasterDataOverview | null;
  readonly schedulingOverview: WasteManagementSchedulingOverview | null;
  readonly assignmentContextLoading: boolean;
  readonly allVisibleSelected: boolean;
  readonly someVisibleSelected: boolean;
  readonly saving: boolean;
  readonly page: number;
  readonly pageSize: number;
  readonly query: string;
  readonly status: 'all' | 'active' | 'inactive';
  readonly onOpenCreateDialog: () => void;
  readonly onPageChange: (page: number) => void;
  readonly onSyncPageChange?: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
  readonly onQueryChange: (value: string) => void;
  readonly onStatusChange: (value: 'all' | 'active' | 'inactive') => void;
  readonly toggleSelectAllVisible: (checked: boolean) => void;
  readonly toggleSelectedTour: (tourId: string, checked: boolean) => void;
  readonly onOpenCalendar: (tour: WasteTourRecord) => void;
  readonly onOpenEditDialog: (tour: WasteTourRecord) => void;
  readonly onOpenCreateAssignmentsDialog: (tour: WasteTourRecord) => void;
  readonly onOpenEditAssignmentsDialog: (tour: WasteTourRecord, linkId: string) => void;
  readonly onToggleTourStatus: (tour: WasteTourRecord, nextActive: boolean) => Promise<void>;
  readonly setTourPendingDelete: Dispatch<SetStateAction<WasteTourRecord | null>>;
};

export const WasteToursContentBody = (props: WasteToursContentBodyProps) => (
  <>
    <WastePanelTableTopBar>
      <WasteToursToolbar
        filtersOpen={props.filtersOpen}
        selectedCount={props.selectedTourIds.length}
        query={props.query}
        status={props.status}
        onOpenCreateDialog={props.onOpenCreateDialog}
        onToggleFiltersOpen={() => props.setFiltersOpen((current) => !current)}
        onOpenBulkDelete={() => props.setBulkDeleteOpen(true)}
        onQueryChange={props.onQueryChange}
        onStatusChange={props.onStatusChange}
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
      page={props.page}
      pageSize={props.pageSize}
      onPageChange={props.onPageChange}
      onSyncPageChange={props.onSyncPageChange}
      onPageSizeChange={props.onPageSizeChange}
      onToggleSelectAllVisible={props.toggleSelectAllVisible}
      onToggleSelectedTour={props.toggleSelectedTour}
      onOpenCalendar={props.onOpenCalendar}
      onOpenEditDialog={props.onOpenEditDialog}
      onOpenCreateAssignmentsDialog={props.onOpenCreateAssignmentsDialog}
      onOpenEditAssignmentsDialog={props.onOpenEditAssignmentsDialog}
      onToggleTourStatus={props.onToggleTourStatus}
      onRequestDeleteTour={props.setTourPendingDelete}
    />
  </>
);
