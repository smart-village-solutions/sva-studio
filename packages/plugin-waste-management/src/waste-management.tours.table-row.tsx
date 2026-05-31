import type { WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';

import type { WasteManagementMasterDataOverview, WasteManagementSchedulingOverview } from './waste-management.api.js';
import { resolveTourAssignmentItems } from './waste-management.tours.locations.js';
import { formatTourRecurrence } from './waste-management.tours.presentation.js';
import {
  WasteToursRowActionsCell,
  WasteToursRowDatesCell,
  WasteToursRowFractionCell,
  WasteToursRowSelectionCell,
  WasteToursRowStatusCell,
} from './waste-management.tours.table-row.parts.js';

const resolveTourShiftCount = (tour: WasteTourRecord, schedulingOverview: WasteManagementSchedulingOverview | null) =>
  (schedulingOverview?.tourDateShifts ?? []).filter((shift) => shift.tourId === tour.id).length +
  (schedulingOverview?.globalDateShifts ?? []).filter(
    (shift) => shift.tourIds == null || shift.tourIds.length === 0 || shift.tourIds.includes(tour.id)
  ).length;

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
  onOpenEditDialog,
  onOpenDuplicateDialog,
  onOpenCreateAssignmentsDialog,
  onOpenEditAssignmentsDialog,
  canDuplicateTour,
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
  readonly onOpenEditDialog: (tour: WasteTourRecord) => void;
  readonly onOpenDuplicateDialog: (tour: WasteTourRecord) => void;
  readonly onOpenCreateAssignmentsDialog: (tour: WasteTourRecord) => void;
  readonly onOpenEditAssignmentsDialog: (tour: WasteTourRecord, linkId: string) => void;
  readonly canDuplicateTour: boolean;
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
  const recurrenceLabel = recurrenceValue === '—' ? pt('tours.table.noRecurrence') : recurrenceValue;
  const fractionNames = tour.wasteFractionIds
    .map((fractionId) => fractionsById.get(fractionId))
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  const shiftCount = resolveTourShiftCount(tour, schedulingOverview);
  const firstAssignmentId = assignmentItems[0]?.id;

  return (
    <tr className="animate-row-hover border-b border-border/60 align-top text-[14px] text-foreground hover:bg-muted/20 last:border-b-0">
      <WasteToursRowSelectionCell tour={tour} selected={selected} onToggleSelectedTour={onToggleSelectedTour} />
      <td className="w-[150px] px-3 py-3">
        <div className="space-y-1">
          <p className="font-semibold">{tour.name}</p>
          {tour.description ? <p className="text-sm text-muted-foreground">{tour.description}</p> : null}
        </div>
      </td>
      <WasteToursRowFractionCell tourId={tour.id} fractionNames={fractionNames} />
      <td className="w-[132px] px-3 py-3 text-sm">{recurrenceLabel}</td>
      <WasteToursRowDatesCell firstDate={tour.firstDate} endDate={tour.endDate} />
      <td className="w-[168px] px-3 py-3">
        <span className="text-sm text-muted-foreground">
          {shiftCount > 0 ? pt('tours.meta.shiftCount', { value: shiftCount }) : pt('tours.table.noShifts')}
        </span>
      </td>
      <td className="w-[94px] px-3 py-3">
        {assignmentContextLoading ? (
          <span className="text-sm text-muted-foreground">{pt('tours.table.loadingAssignments')}</span>
        ) : (
          <span data-testid={`tour-assignment-count-${tour.id}`} className="text-sm">{assignmentItems.length}</span>
        )}
      </td>
      <WasteToursRowStatusCell tour={tour} disabled={assignmentContextLoading || saving} onToggleTourStatus={onToggleTourStatus} />
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
