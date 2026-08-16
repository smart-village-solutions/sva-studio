import type { WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';

import type {
  WasteManagementMasterDataOverview,
  WasteManagementSchedulingOverview,
} from './waste-management.api.js';
import { resolveTourAssignmentItems } from './waste-management.tours.locations.js';
import {
  formatTourRecurrence,
  resolveTourShiftDetails,
} from './waste-management.tours.presentation.js';
import {
  WasteToursRowActionsCell,
  WasteToursRowDatesCell,
  WasteToursRowFractionCell,
  WasteToursRowSelectionCell,
  WasteToursRowShiftCell,
  WasteToursRowStatusCell,
} from './waste-management.tours.table-row.parts.js';
import type { WasteManagementSearchParams } from './search-params.js';

const WasteToursRowSummaryCell = ({ name }: { readonly name: string }) => (
  <td className="w-[150px] px-3 py-3">
    <p className="font-semibold">{name}</p>
  </td>
);

const WasteToursRowAssignmentCountCell = ({
  assignmentContextLoading,
  assignmentCount,
  pt,
  tourId,
}: {
  readonly assignmentContextLoading: boolean;
  readonly assignmentCount: number;
  readonly pt: ReturnType<typeof usePluginTranslation>;
  readonly tourId: string;
}) => (
  <td className="w-[94px] px-3 py-3">
    {assignmentContextLoading ? (
      <span className="text-sm text-muted-foreground">{pt('tours.table.loadingAssignments')}</span>
    ) : (
      <span data-testid={`tour-assignment-count-${tourId}`} className="text-sm">
        {assignmentCount}
      </span>
    )}
  </td>
);

export const WasteToursTableRow = ({
  tour,
  fractionsById,
  masterDataOverview,
  schedulingOverview,
  assignmentContextLoading,
  selected,
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
  readonly tour: WasteTourRecord;
  readonly fractionsById: ReadonlyMap<string, string>;
  readonly masterDataOverview: WasteManagementMasterDataOverview | null;
  readonly schedulingOverview: WasteManagementSchedulingOverview | null;
  readonly assignmentContextLoading: boolean;
  readonly selected: boolean;
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
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const assignmentItems = resolveTourAssignmentItems(pt, masterDataOverview, tour);
  const recurrenceValue = formatTourRecurrence(
    pt,
    tour.recurrence,
    tour.customRecurrenceName,
    tour.customRecurrenceIntervalDays
  );
  const recurrenceLabel =
    recurrenceValue === '—' ? pt('tours.table.noRecurrence') : recurrenceValue;
  const fractions = tour.wasteFractionIds.flatMap((fractionId) => {
    const name = fractionsById.get(fractionId);
    return name ? [{ id: fractionId, name }] : [];
  });
  const shiftDetails = resolveTourShiftDetails(tour, schedulingOverview);
  const firstAssignmentId = assignmentItems[0]?.id;

  return (
    <tr className="animate-row-hover border-b border-border/60 align-top text-[14px] text-foreground hover:bg-muted/20 last:border-b-0">
      <WasteToursRowSelectionCell
        tour={tour}
        selected={selected}
        onToggleSelectedTour={onToggleSelectedTour}
      />
      <WasteToursRowSummaryCell name={tour.name} />
      <WasteToursRowFractionCell
        tourId={tour.id}
        fractionNames={fractions.map((fraction) => fraction.name)}
        fractionIds={fractions.map((fraction) => fraction.id)}
        onOpenEditFraction={onOpenEditFraction}
      />
      <td className="w-[132px] px-3 py-3 text-sm">{recurrenceLabel}</td>
      <WasteToursRowDatesCell firstDate={tour.firstDate} endDate={tour.endDate} />
      <WasteToursRowShiftCell
        tourId={tour.id}
        tourName={tour.name}
        shiftDetails={shiftDetails}
        canManageScheduling={canManageScheduling}
        search={search}
      />
      <WasteToursRowAssignmentCountCell
        assignmentContextLoading={assignmentContextLoading}
        assignmentCount={assignmentItems.length}
        pt={pt}
        tourId={tour.id}
      />
      <WasteToursRowStatusCell
        tour={tour}
        disabled={assignmentContextLoading || saving}
        onToggleTourStatus={onToggleTourStatus}
      />
      <WasteToursRowActionsCell
        tour={tour}
        assignmentId={firstAssignmentId}
        onOpenCalendar={onOpenCalendar}
        onOpenEditDialog={onOpenEditDialog}
        onOpenDuplicateDialog={onOpenDuplicateDialog}
        onOpenCreateAssignmentsDialog={onOpenCreateAssignmentsDialog}
        onOpenEditAssignmentsDialog={onOpenEditAssignmentsDialog}
        canDuplicateTour={canDuplicateTour}
        onRequestDeleteTour={onRequestDeleteTour}
      />
    </tr>
  );
};
