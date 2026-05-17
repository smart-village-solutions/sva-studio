import { IconCalendarMonth, IconEdit, IconListDetails, IconTrash } from '@tabler/icons-react';
import type { WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { Badge, Button, Checkbox, cn } from '@sva/studio-ui-react';

const formatDisplayDate = (value: string) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeZone: 'UTC' }).format(parsed);
};

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
}: {
  readonly tourId: string;
  readonly fractionNames: readonly string[];
}) => (
  <td className="w-[176px] px-3 py-3">
    {fractionNames.length ? (
      <div className="flex flex-wrap gap-2">
        {fractionNames.map((fractionName) => (
          <Badge
            key={`${tourId}-${fractionName}`}
            variant="outline"
            className="rounded-md border-[#E9E7E1] bg-[#F3F1EC] px-2.5 py-1 text-xs font-medium text-[#6B7C8F]"
          >
            {fractionName}
          </Badge>
        ))}
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
        {firstDate ? <p>{pt('tours.meta.startDate', { value: formatDisplayDate(firstDate) })}</p> : null}
        {endDate ? <p>{pt('tours.meta.endDate', { value: formatDisplayDate(endDate) })}</p> : null}
        {!firstDate && !endDate ? <span className="text-muted-foreground">—</span> : null}
      </div>
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
  onOpenCreateAssignmentsDialog,
  onOpenEditAssignmentsDialog,
  onRequestDeleteTour,
}: {
  readonly tour: WasteTourRecord;
  readonly assignmentId?: string;
  readonly onOpenCalendar: (tour: WasteTourRecord) => void;
  readonly onOpenEditDialog: (tour: WasteTourRecord) => void;
  readonly onOpenCreateAssignmentsDialog: (tour: WasteTourRecord) => void;
  readonly onOpenEditAssignmentsDialog: (tour: WasteTourRecord, linkId: string) => void;
  readonly onRequestDeleteTour: (tour: WasteTourRecord) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <td className="px-3 py-3">
      <div className="flex justify-end gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
          aria-label={pt('tours.actions.openCalendar')}
          onClick={() => onOpenCalendar(tour)}
        >
          <IconCalendarMonth aria-hidden="true" className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
          aria-label={pt('tours.actions.openAssignments')}
          onClick={() => {
            if (assignmentId) {
              onOpenEditAssignmentsDialog(tour, assignmentId);
              return;
            }
            onOpenCreateAssignmentsDialog(tour);
          }}
        >
          <IconListDetails aria-hidden="true" className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-foreground"
          aria-label={pt('tours.actions.edit')}
          onClick={() => onOpenEditDialog(tour)}
        >
          <IconEdit aria-hidden="true" className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 rounded-md px-0 text-muted-foreground hover:text-destructive"
          aria-label={pt('tours.actions.delete')}
          onClick={() => onRequestDeleteTour(tour)}
        >
          <IconTrash aria-hidden="true" className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </td>
  );
};
