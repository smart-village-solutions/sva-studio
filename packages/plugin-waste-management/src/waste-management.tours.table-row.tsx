import type { WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Button } from '@sva/studio-ui-react';

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
  WasteToursRowStatusCell,
} from './waste-management.tours.table-row.parts.js';
import { WasteToursRowShiftCell } from './waste-management.tours.table-row-shift.js';
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
  assignmentId,
  tour,
  onOpenCreateAssignmentsDialog,
  onOpenEditAssignmentsDialog,
}: {
  readonly assignmentContextLoading: boolean;
  readonly assignmentCount: number;
  readonly pt: ReturnType<typeof usePluginTranslation>;
  readonly assignmentId?: string;
  readonly tour: WasteTourRecord;
  readonly onOpenCreateAssignmentsDialog: (tour: WasteTourRecord) => void;
  readonly onOpenEditAssignmentsDialog: (tour: WasteTourRecord, linkId: string) => void;
}) => (
  <td className="w-[94px] px-3 py-3">
    {assignmentContextLoading ? (
      <span className="text-sm text-muted-foreground">{pt('tours.table.loadingAssignments')}</span>
    ) : (
      <Button
        type="button"
        variant="tertiary"
        size="sm"
        className="h-auto p-0 text-sm font-medium underline-offset-4 hover:underline"
        aria-label={pt('tours.actions.openAssignmentsAccessible', {
          name: tour.name,
          count: assignmentCount,
        })}
        data-testid={`tour-assignment-count-${tour.id}`}
        onClick={() => {
          if (assignmentId) {
            onOpenEditAssignmentsDialog(tour, assignmentId);
            return;
          }
          onOpenCreateAssignmentsDialog(tour);
        }}
      >
        {assignmentCount}
      </Button>
    )}
  </td>
);

type WasteToursTableRowProps = {
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
};

export const WasteToursTableRow = (props: WasteToursTableRowProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const { tour } = props;
  const assignmentItems = resolveTourAssignmentItems(pt, props.masterDataOverview, tour);
  const recurrenceValue = formatTourRecurrence(
    pt,
    tour.recurrence,
    tour.customRecurrenceName,
    tour.customRecurrenceIntervalDays
  );
  const recurrenceLabel =
    recurrenceValue === '—' ? pt('tours.table.noRecurrence') : recurrenceValue;
  const fractions = tour.wasteFractionIds.flatMap((fractionId) => {
    const name = props.fractionsById.get(fractionId);
    return name ? [{ id: fractionId, name }] : [];
  });
  const shiftDetails = resolveTourShiftDetails(tour, props.schedulingOverview);
  const firstAssignmentId = assignmentItems[0]?.id;

  return (
    <tr className="animate-row-hover border-b border-border/60 align-top text-[14px] text-foreground hover:bg-muted/20 last:border-b-0">
      <WasteToursRowSelectionCell
        tour={tour}
        selected={props.selected}
        onToggleSelectedTour={props.onToggleSelectedTour}
      />
      <WasteToursRowSummaryCell name={tour.name} />
      <WasteToursRowFractionCell
        tourId={tour.id}
        fractionNames={fractions.map((fraction) => fraction.name)}
        fractionIds={fractions.map((fraction) => fraction.id)}
        onOpenEditFraction={props.onOpenEditFraction}
      />
      <td className="w-[132px] px-3 py-3 text-sm">{recurrenceLabel}</td>
      <WasteToursRowDatesCell firstDate={tour.firstDate} endDate={tour.endDate} />
      <WasteToursRowShiftCell
        tourId={tour.id}
        tourName={tour.name}
        shiftDetails={shiftDetails}
        canManageScheduling={props.canManageScheduling}
        search={props.search}
      />
      <WasteToursRowAssignmentCountCell
        assignmentContextLoading={props.assignmentContextLoading}
        assignmentCount={assignmentItems.length}
        pt={pt}
        assignmentId={firstAssignmentId}
        tour={tour}
        onOpenCreateAssignmentsDialog={props.onOpenCreateAssignmentsDialog}
        onOpenEditAssignmentsDialog={props.onOpenEditAssignmentsDialog}
      />
      <WasteToursRowStatusCell
        tour={tour}
        disabled={props.assignmentContextLoading || props.saving}
        onToggleTourStatus={props.onToggleTourStatus}
      />
      <WasteToursRowActionsCell
        tour={tour}
        onOpenCalendar={props.onOpenCalendar}
        onOpenEditDialog={props.onOpenEditDialog}
        onOpenDuplicateDialog={props.onOpenDuplicateDialog}
        canDuplicateTour={props.canDuplicateTour}
        onRequestDeleteTour={props.onRequestDeleteTour}
      />
    </tr>
  );
};
