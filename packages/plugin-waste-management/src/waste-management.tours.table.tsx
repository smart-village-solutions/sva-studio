import { useMemo } from 'react';
import type { WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';

import type {
  WasteManagementMasterDataOverview,
  WasteManagementSchedulingOverview,
} from './waste-management.api.js';
import {
  WastePanelTableBottomBar,
  createPagedItems,
  usePagedRouteSync,
} from './waste-management.table-frame.js';
import {
  WasteToursTableHeader,
  type WasteToursSortDirection,
  type WasteToursSortField,
} from './waste-management.tours.table.parts.js';
import { WasteToursTableRow } from './waste-management.tours.table-row.js';
import type { WasteManagementSearchParams } from './search-params.js';

type WasteToursTableProps = {
  readonly tours: readonly WasteTourRecord[];
  readonly fractions: readonly { readonly id: string; readonly name: string }[];
  readonly masterDataOverview: WasteManagementMasterDataOverview | null;
  readonly schedulingOverview: WasteManagementSchedulingOverview | null;
  readonly assignmentContextLoading: boolean;
  readonly selectedTourIds: readonly string[];
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
  readonly onToggleSelectAllVisible: (checked: boolean) => void;
  readonly onToggleSelectedTour: (tourId: string, checked: boolean) => void;
  readonly onOpenCalendar: (tour: WasteTourRecord) => void;
  readonly onOpenEditFraction?: (wasteFractionId: string) => void;
  readonly onOpenEditDialog: (tour: WasteTourRecord) => void;
  readonly onOpenDuplicateDialog: (tour: WasteTourRecord) => void;
  readonly onOpenCreateAssignmentsDialog: (tour: WasteTourRecord) => void;
  readonly onOpenEditAssignmentsDialog: (tour: WasteTourRecord, linkId: string) => void;
  readonly canDuplicateTour: boolean;
  readonly canManageScheduling: boolean;
  readonly search?: WasteManagementSearchParams;
  readonly onToggleTourStatus: (tour: WasteTourRecord, nextActive: boolean) => Promise<void>;
  readonly onRequestDeleteTour: (tour: WasteTourRecord) => void;
};

const WasteToursTableBody = ({
  tours,
  fractionsById,
  masterDataOverview,
  schedulingOverview,
  assignmentContextLoading,
  selectedTourIds,
  saving,
  onToggleSelectedTour,
  onOpenCalendar,
  onOpenEditFraction,
  onOpenEditDialog,
  onOpenDuplicateDialog,
  onOpenCreateAssignmentsDialog,
  onOpenEditAssignmentsDialog,
  canDuplicateTour,
  canManageScheduling,
  search,
  onToggleTourStatus,
  onRequestDeleteTour,
}: {
  readonly tours: readonly WasteTourRecord[];
  readonly fractionsById: ReadonlyMap<string, string>;
  readonly masterDataOverview: WasteManagementMasterDataOverview | null;
  readonly schedulingOverview: WasteManagementSchedulingOverview | null;
  readonly assignmentContextLoading: boolean;
  readonly selectedTourIds: readonly string[];
  readonly saving: boolean;
  readonly onToggleSelectedTour: (tourId: string, checked: boolean) => void;
  readonly onOpenCalendar: (tour: WasteTourRecord) => void;
  readonly onOpenEditFraction?: (wasteFractionId: string) => void;
  readonly onOpenEditDialog: (tour: WasteTourRecord) => void;
  readonly onOpenDuplicateDialog: (tour: WasteTourRecord) => void;
  readonly onOpenCreateAssignmentsDialog: (tour: WasteTourRecord) => void;
  readonly onOpenEditAssignmentsDialog: (tour: WasteTourRecord, linkId: string) => void;
  readonly canDuplicateTour: boolean;
  readonly canManageScheduling: boolean;
  readonly search?: WasteManagementSearchParams;
  readonly onToggleTourStatus: (tour: WasteTourRecord, nextActive: boolean) => Promise<void>;
  readonly onRequestDeleteTour: (tour: WasteTourRecord) => void;
}) => (
  <tbody>
    {tours.map((tour) => (
      <WasteToursTableRow
        key={tour.id}
        tour={tour}
        fractionsById={fractionsById}
        masterDataOverview={masterDataOverview}
        schedulingOverview={schedulingOverview}
        assignmentContextLoading={assignmentContextLoading}
        selected={selectedTourIds.includes(tour.id)}
        saving={saving}
        onToggleSelectedTour={onToggleSelectedTour}
        onOpenCalendar={onOpenCalendar}
        onOpenEditFraction={onOpenEditFraction}
        onOpenEditDialog={onOpenEditDialog}
        onOpenDuplicateDialog={onOpenDuplicateDialog}
        onOpenCreateAssignmentsDialog={onOpenCreateAssignmentsDialog}
        onOpenEditAssignmentsDialog={onOpenEditAssignmentsDialog}
        canDuplicateTour={canDuplicateTour}
        canManageScheduling={canManageScheduling}
        search={search}
        onToggleTourStatus={onToggleTourStatus}
        onRequestDeleteTour={onRequestDeleteTour}
      />
    ))}
  </tbody>
);

export const WasteToursTable = (props: WasteToursTableProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const pagedTours = useMemo(
    () => createPagedItems({ items: props.tours, page: props.page, pageSize: props.pageSize }),
    [props.page, props.pageSize, props.tours]
  );
  const fractionsById = useMemo(
    () => new Map(props.fractions.map((fraction) => [fraction.id, fraction.name] as const)),
    [props.fractions]
  );
  usePagedRouteSync({
    page: props.page,
    safePage: pagedTours.safePage,
    onPageChange: props.onPageChange,
    onSyncPageChange: props.onSyncPageChange,
  });

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
          <caption className="sr-only">{pt('tours.table.caption')}</caption>
          <WasteToursTableHeader
            allVisibleSelected={props.allVisibleSelected}
            someVisibleSelected={props.someVisibleSelected}
            onToggleSelectAllVisible={props.onToggleSelectAllVisible}
            sortField={props.sortField}
            sortDirection={props.sortDirection}
            onSortChange={props.onSortChange}
          />
          <WasteToursTableBody
            tours={pagedTours.items}
            fractionsById={fractionsById}
            masterDataOverview={props.masterDataOverview}
            schedulingOverview={props.schedulingOverview}
            assignmentContextLoading={props.assignmentContextLoading}
            selectedTourIds={props.selectedTourIds}
            saving={props.saving}
            onToggleSelectedTour={props.onToggleSelectedTour}
            onOpenCalendar={props.onOpenCalendar}
            onOpenEditFraction={props.onOpenEditFraction}
            onOpenEditDialog={props.onOpenEditDialog}
            onOpenDuplicateDialog={props.onOpenDuplicateDialog}
            onOpenCreateAssignmentsDialog={props.onOpenCreateAssignmentsDialog}
            onOpenEditAssignmentsDialog={props.onOpenEditAssignmentsDialog}
            canDuplicateTour={props.canDuplicateTour}
            canManageScheduling={props.canManageScheduling}
            search={props.search}
            onToggleTourStatus={props.onToggleTourStatus}
            onRequestDeleteTour={props.onRequestDeleteTour}
          />
        </table>
      </div>
      <WastePanelTableBottomBar
        pt={pt}
        page={pagedTours.safePage}
        pageSize={props.pageSize}
        pageCount={pagedTours.pageCount}
        totalItems={pagedTours.totalItems}
        onPageChange={props.onPageChange}
        onPageSizeChange={props.onPageSizeChange}
      />
    </>
  );
};
