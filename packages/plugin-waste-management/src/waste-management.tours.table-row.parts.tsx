import {
  IconCalendarMonth,
  IconCopy,
  IconEdit,
  IconListDetails,
  IconTrash,
} from '@tabler/icons-react';
import type { WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from '@sva/studio-ui-react';
import { useState, type ReactNode } from 'react';

import type { TourShiftDetail } from './waste-management.tours.presentation.js';
import type { WasteManagementSearchParams } from './search-params.js';
import { WasteTourShiftCreateLink } from './waste-management.tour-shift-create-link.js';

const formatDisplayDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeZone: 'UTC' }).format(parsed);
};

const RowActionButton = ({
  ariaLabel,
  children,
  destructive = false,
  onClick,
}: {
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly destructive?: boolean;
  readonly onClick: () => void;
}) => (
  <Button
    type="button"
    variant="tertiary"
    size="sm"
    className={cn(
      'h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground',
      destructive ? 'hover:text-destructive' : null
    )}
    aria-label={ariaLabel}
    tooltip={ariaLabel}
    onClick={onClick}
  >
    {children}
  </Button>
);

const TourAssignmentsActionButton = ({
  assignmentId,
  tour,
  pt,
  onOpenCreateAssignmentsDialog,
  onOpenEditAssignmentsDialog,
}: {
  readonly assignmentId?: string;
  readonly tour: WasteTourRecord;
  readonly pt: ReturnType<typeof usePluginTranslation>;
  readonly onOpenCreateAssignmentsDialog: (tour: WasteTourRecord) => void;
  readonly onOpenEditAssignmentsDialog: (tour: WasteTourRecord, linkId: string) => void;
}) => (
  <RowActionButton
    ariaLabel={pt('tours.actions.openAssignments')}
    onClick={() => {
      if (assignmentId) {
        onOpenEditAssignmentsDialog(tour, assignmentId);
        return;
      }
      onOpenCreateAssignmentsDialog(tour);
    }}
  >
    <IconListDetails aria-hidden="true" className="h-4 w-4" />
  </RowActionButton>
);

export const WasteToursRowSelectionCell = ({
  tour,
  selected,
  onToggleSelectedTour,
}: {
  readonly tour: WasteTourRecord;
  readonly selected: boolean;
  readonly onToggleSelectedTour: (tourId: string, checked: boolean) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <td className="px-3 py-3">
      <Checkbox
        aria-label={pt('tours.table.selectRow', { value: tour.name })}
        checked={selected}
        onChange={(event) => onToggleSelectedTour(tour.id, event.currentTarget.checked)}
      />
    </td>
  );
};

export const WasteToursRowFractionCell = ({
  tourId,
  fractionNames,
  fractionIds,
  onOpenEditFraction,
}: {
  readonly tourId: string;
  readonly fractionNames: readonly string[];
  readonly fractionIds?: readonly string[];
  readonly onOpenEditFraction?: (wasteFractionId: string) => void;
}) => (
  <td className="w-[176px] px-3 py-3">
    {fractionNames.length ? (
      <div className="flex flex-wrap gap-2">
        {fractionNames.map((fractionName, index) => {
          const fractionId = fractionIds?.[index];
          return (
            <Badge
              key={`${tourId}-${fractionId ?? fractionName}`}
              variant="outline"
              className="rounded-md border-[#E9E7E1] bg-[#F3F1EC] px-2.5 py-1 text-xs font-medium text-[#6B7C8F]"
            >
              {fractionId && onOpenEditFraction ? (
                <button
                  type="button"
                  className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={() => onOpenEditFraction(fractionId)}
                >
                  {fractionName}
                </button>
              ) : (
                fractionName
              )}
            </Badge>
          );
        })}
      </div>
    ) : (
      <span className="text-sm text-muted-foreground">—</span>
    )}
  </td>
);

export const WasteToursRowDatesCell = ({
  firstDate,
  endDate,
}: {
  readonly firstDate?: string | null;
  readonly endDate?: string | null;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <td className="w-[156px] px-3 py-3">
      <div className="space-y-1 text-sm">
        {firstDate ? (
          <p>{pt('tours.meta.startDate', { value: formatDisplayDate(firstDate) })}</p>
        ) : null}
        {endDate ? <p>{pt('tours.meta.endDate', { value: formatDisplayDate(endDate) })}</p> : null}
        {!firstDate && !endDate ? <span className="text-muted-foreground">—</span> : null}
      </div>
    </td>
  );
};

const WasteTourShiftDetailItem = ({ detail }: { readonly detail: TourShiftDetail }) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <li className="rounded-md border border-border/60 p-3">
      <p className="font-medium">{pt(`tours.shiftDetails.sources.${detail.source}`)}</p>
      <p className="mt-1 text-sm">
        {pt('tours.shiftDetails.dateChange', {
          originalDate: formatDisplayDate(detail.originalDate),
          actualDate: formatDisplayDate(detail.actualDate),
        })}
      </p>
      {detail.source === 'holiday' ? (
        <p className="mt-1 text-sm text-muted-foreground">
          {pt('tours.shiftDetails.holidays', { value: detail.holidayNames.join(', ') })}
        </p>
      ) : (
        <div className="mt-1 space-y-1 text-sm text-muted-foreground">
          {detail.description ? <p>{detail.description}</p> : null}
          {detail.reasonType ? <p>{pt(`scheduling.reasonTypes.${detail.reasonType}`)}</p> : null}
          {detail.reasonKey ? (
            <p>{pt('tours.shiftDetails.reasonKey', { value: detail.reasonKey })}</p>
          ) : null}
        </div>
      )}
    </li>
  );
};

export const WasteToursRowShiftCell = ({
  tourId,
  tourName,
  shiftDetails,
  canManageScheduling = false,
  search,
}: {
  readonly tourId: string;
  readonly tourName: string;
  readonly shiftDetails: readonly TourShiftDetail[];
  readonly canManageScheduling?: boolean;
  readonly search?: WasteManagementSearchParams;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const [open, setOpen] = useState(false);
  const count = shiftDetails.length;

  return (
    <td className="w-[168px] px-3 py-3">
      {count > 0 ? (
        <>
          <Button
            type="button"
            variant="tertiary"
            size="sm"
            className="h-auto p-0 text-sm font-medium underline underline-offset-4"
            aria-label={pt('tours.shiftDetails.open', { count, name: tourName })}
            onClick={() => setOpen(true)}
          >
            {pt('tours.meta.shiftCount', { value: count })}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{pt('tours.shiftDetails.title', { name: tourName })}</DialogTitle>
                <DialogDescription>
                  {pt('tours.shiftDetails.description', { value: count })}
                </DialogDescription>
              </DialogHeader>
              <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
                {shiftDetails.map((detail) => (
                  <WasteTourShiftDetailItem key={`${detail.source}-${detail.id}`} detail={detail} />
                ))}
              </ul>
              <DialogFooter>
                {canManageScheduling && search ? (
                  <WasteTourShiftCreateLink
                    search={search}
                    tourId={tourId}
                    label={pt('tours.actions.createAnotherShift')}
                  />
                ) : null}
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  {pt('tours.shiftDetails.close')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : canManageScheduling && search ? (
        <WasteTourShiftCreateLink
          search={search}
          tourId={tourId}
          label={pt('tours.actions.createShift')}
          variant="tertiary"
          className="h-auto p-0 text-sm font-medium underline underline-offset-4"
        />
      ) : (
        <span className="text-sm text-muted-foreground">{pt('tours.table.noShifts')}</span>
      )}
    </td>
  );
};

export const WasteToursRowStatusCell = ({
  tour,
  disabled,
  onToggleTourStatus,
}: {
  readonly tour: WasteTourRecord;
  readonly disabled: boolean;
  readonly onToggleTourStatus: (tour: WasteTourRecord, nextActive: boolean) => Promise<void>;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <td className="w-[92px] px-3 py-3">
      <div className="flex items-center justify-center">
        <button
          type="button"
          role="switch"
          aria-checked={tour.active}
          aria-label={
            tour.active
              ? pt('tours.actions.deactivateStatus', { value: tour.name })
              : pt('tours.actions.activateStatus', { value: tour.name })
          }
          disabled={disabled}
          className={cn(
            'relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border border-transparent transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-60',
            tour.active ? 'bg-primary' : 'bg-muted'
          )}
          onClick={() => {
            void onToggleTourStatus(tour, !tour.active);
          }}
        >
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none inline-block h-[14px] w-[14px] rounded-full bg-background shadow-sm transition-transform',
              tour.active ? 'translate-x-[16px]' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>
    </td>
  );
};

export const WasteToursRowActionsCell = ({
  tour,
  assignmentId,
  onOpenCalendar,
  onOpenEditDialog,
  onOpenDuplicateDialog,
  onOpenCreateAssignmentsDialog,
  onOpenEditAssignmentsDialog,
  canDuplicateTour,
  onRequestDeleteTour,
}: {
  readonly tour: WasteTourRecord;
  readonly assignmentId?: string;
  readonly onOpenCalendar: (tour: WasteTourRecord) => void;
  readonly onOpenEditDialog: (tour: WasteTourRecord) => void;
  readonly onOpenDuplicateDialog: (tour: WasteTourRecord) => void;
  readonly onOpenCreateAssignmentsDialog: (tour: WasteTourRecord) => void;
  readonly onOpenEditAssignmentsDialog: (tour: WasteTourRecord, linkId: string) => void;
  readonly canDuplicateTour: boolean;
  readonly onRequestDeleteTour: (tour: WasteTourRecord) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <td className="px-3 py-3">
      <div className="flex justify-end gap-1.5">
        <RowActionButton
          ariaLabel={pt('tours.actions.openCalendar')}
          onClick={() => onOpenCalendar(tour)}
        >
          <IconCalendarMonth aria-hidden="true" className="h-4 w-4" />
        </RowActionButton>
        <TourAssignmentsActionButton
          assignmentId={assignmentId}
          tour={tour}
          pt={pt}
          onOpenCreateAssignmentsDialog={onOpenCreateAssignmentsDialog}
          onOpenEditAssignmentsDialog={onOpenEditAssignmentsDialog}
        />
        <RowActionButton
          ariaLabel={pt('tours.actions.edit')}
          onClick={() => onOpenEditDialog(tour)}
        >
          <IconEdit aria-hidden="true" className="h-4 w-4" />
        </RowActionButton>
        {canDuplicateTour ? (
          <RowActionButton
            ariaLabel={pt('tours.actions.duplicate')}
            onClick={() => onOpenDuplicateDialog(tour)}
          >
            <IconCopy aria-hidden="true" className="h-4 w-4" />
          </RowActionButton>
        ) : null}
        <RowActionButton
          ariaLabel={pt('tours.actions.delete')}
          destructive
          onClick={() => onRequestDeleteTour(tour)}
        >
          <IconTrash aria-hidden="true" className="h-4 w-4 text-destructive" />
        </RowActionButton>
      </div>
    </td>
  );
};
