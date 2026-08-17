import { IconCalendarMonth, IconCopy, IconTrash } from '@tabler/icons-react';
import type { WasteTourRecord } from '@sva/plugin-sdk';
import { usePluginTranslation } from '@sva/plugin-sdk';
import {
  Checkbox,
  StudioStatusBadge,
  StudioTableActionButton,
  StudioTableValueAction,
} from '@sva/studio-ui-react';

export const formatTourDisplayDate = (value: string) => {
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
            <span key={`${tourId}-${fractionId ?? fractionName}`} className="text-sm">
              {fractionId && onOpenEditFraction ? (
                <StudioTableValueAction onClick={() => onOpenEditFraction(fractionId)}>
                  {fractionName}
                </StudioTableValueAction>
              ) : (
                fractionName
              )}
            </span>
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
          <p>{pt('tours.meta.startDate', { value: formatTourDisplayDate(firstDate) })}</p>
        ) : null}
        {endDate ? (
          <p>{pt('tours.meta.endDate', { value: formatTourDisplayDate(endDate) })}</p>
        ) : null}
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
      <div className="flex items-start justify-center">
        <button
          type="button"
          aria-label={
            tour.active
              ? pt('tours.actions.deactivateStatus', { value: tour.name })
              : pt('tours.actions.activateStatus', { value: tour.name })
          }
          disabled={disabled}
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => {
            void onToggleTourStatus(tour, !tour.active);
          }}
        >
          <StudioStatusBadge editable tone={tour.active ? 'success' : 'neutral'}>
            {tour.active ? pt('tours.table.active') : pt('tours.table.inactive')}
          </StudioStatusBadge>
        </button>
      </div>
    </td>
  );
};

export const WasteToursRowActionsCell = ({
  tour,
  onOpenCalendar,
  onOpenDuplicateDialog,
  canDuplicateTour,
  onRequestDeleteTour,
}: {
  readonly tour: WasteTourRecord;
  readonly onOpenCalendar: (tour: WasteTourRecord) => void;
  readonly onOpenDuplicateDialog: (tour: WasteTourRecord) => void;
  readonly canDuplicateTour: boolean;
  readonly onRequestDeleteTour: (tour: WasteTourRecord) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');

  return (
    <td className="px-3 py-3">
      <div className="flex justify-end gap-1.5">
        <StudioTableActionButton
          label={pt('tours.actions.openCalendar')}
          icon={<IconCalendarMonth aria-hidden="true" className="h-4 w-4" />}
          onClick={() => onOpenCalendar(tour)}
        />
        {canDuplicateTour ? (
          <StudioTableActionButton
            label={pt('tours.actions.duplicate')}
            icon={<IconCopy aria-hidden="true" className="h-4 w-4" />}
            onClick={() => onOpenDuplicateDialog(tour)}
          />
        ) : null}
        <StudioTableActionButton
          label={pt('tours.actions.delete')}
          icon={<IconTrash aria-hidden="true" className="h-4 w-4" />}
          tone="destructive"
          onClick={() => onRequestDeleteTour(tour)}
        />
      </div>
    </td>
  );
};
