import { useId } from 'react';
import { formatCalendarDate, usePluginTranslation } from '@sva/plugin-sdk';
import { Alert, AlertDescription, AlertTitle, Radio, cn } from '@sva/studio-ui-react';
import type {
  WasteTourMergeConflict,
  WasteTourMergePreview,
  WasteTourRecord,
} from '@sva/waste-management-contracts';
import { IconAlertCircle, IconAlertTriangle } from '@tabler/icons-react';

import { formatTourRecurrence } from './waste-management.tours.presentation.js';

type Translate = ReturnType<typeof usePluginTranslation>;
type TourOption = Pick<
  WasteTourRecord,
  | 'id'
  | 'name'
  | 'recurrence'
  | 'customRecurrenceName'
  | 'customRecurrenceIntervalDays'
  | 'firstDate'
  | 'endDate'
  | 'locationCount'
>;

const shortId = (tour: TourOption) => tour.id.slice(0, 8);
const pointCount = (pt: Translate, tour: TourOption) =>
  tour.locationCount === undefined
    ? pt('tours.merge.pointCountUnknown')
    : pt(tour.locationCount === 1 ? 'tours.merge.pointCountOne' : 'tours.merge.pointCount', {
        count: tour.locationCount,
      });
const tourLabel = (pt: Translate, tour: TourOption) =>
  pt('tours.merge.tourLabel', {
    name: tour.name,
    points: pointCount(pt, tour),
    id: shortId(tour),
  });

const validityLabel = (pt: Translate, tour: TourOption) => {
  const start = tour.firstDate && formatCalendarDate(tour.firstDate);
  const end = tour.endDate && formatCalendarDate(tour.endDate);
  if (start && end) return pt('tours.merge.validityRange', { start, end });
  if (start) return pt('tours.merge.validityFrom', { start });
  if (end) return pt('tours.merge.validityUntil', { end });
  return pt('tours.merge.validityUnknown');
};

const recurrenceLabel = (pt: Translate, tour: TourOption) =>
  tour.recurrence || tour.customRecurrenceName
    ? formatTourRecurrence(
        pt,
        tour.recurrence,
        tour.customRecurrenceName,
        tour.customRecurrenceIntervalDays
      )
    : pt('tours.table.noRecurrence');

export const MergeAlert = ({
  title,
  warning = false,
  children,
}: {
  title: string;
  warning?: boolean;
  children: React.ReactNode;
}) => (
  <Alert
    className={
      warning ? 'border-warning/30 bg-warning/5' : 'border-destructive/30 bg-destructive/5'
    }
  >
    {warning ? (
      <IconAlertTriangle aria-hidden className="absolute h-5 w-5 text-warning" />
    ) : (
      <IconAlertCircle aria-hidden className="absolute h-5 w-5 text-destructive" />
    )}
    <AlertTitle>{title}</AlertTitle>
    <AlertDescription>{children}</AlertDescription>
  </Alert>
);

export const MergeImpact = ({
  pt,
  preview,
  target,
}: {
  pt: Translate;
  preview: WasteTourMergePreview;
  target: TourOption;
}) => {
  const sources = preview.tours.filter((tour) => tour.id !== target.id);
  return (
    <section
      aria-label={pt('tours.merge.impact')}
      className="space-y-3 rounded-lg border border-border-subtle bg-muted/30 p-4 text-sm"
      aria-live="polite"
    >
      <h3 className="font-semibold">{pt('tours.merge.impact')}</h3>
      <div className="space-y-1">
        <h4 className="font-medium">{pt('tours.merge.keepsPublishing')}</h4>
        <p>{tourLabel(pt, target)}</p>
        <p className="text-muted-foreground">
          {pt('tours.merge.total', {
            existing: target.locationCount ?? 0,
            added: preview.addedCount,
            total: preview.totalCount,
          })}
          {preview.sharedCount > 0
            ? ' ' +
              (preview.sharedLocationLabel
                ? pt('tours.merge.sharedNamed', { location: preview.sharedLocationLabel })
                : pt(preview.sharedCount === 1 ? 'tours.merge.sharedOne' : 'tours.merge.shared', {
                    count: preview.sharedCount,
                  }))
            : null}
        </p>
      </div>
      <div className="space-y-1">
        <h4 className="font-medium">{pt('tours.merge.archives')}</h4>
        <ul>
          {sources.map((tour) => (
            <li key={tour.id}>{tourLabel(pt, tour)}</li>
          ))}
        </ul>
        <p className="text-muted-foreground">
          {pt(sources.length === 1 ? 'tours.merge.archiveEffectOne' : 'tours.merge.archiveEffect')}
        </p>
      </div>
      <p className="text-muted-foreground">{pt('tours.merge.planningEffect')}</p>
    </section>
  );
};

export const MergeTargetOptions = ({
  pt,
  options,
  hidden,
  targetId,
  saving,
  onSelect,
}: {
  pt: Translate;
  options: readonly TourOption[];
  hidden: ReadonlySet<string>;
  targetId: string | undefined;
  saving: boolean;
  onSelect: (id: string) => void;
}) => {
  const groupId = useId();
  return (
    <fieldset className="min-w-0 space-y-2" aria-describedby={`${groupId}-help`} disabled={saving}>
      <legend className="font-medium">{pt('tours.merge.choose')}</legend>
      <p id={`${groupId}-help`} className="text-sm text-muted-foreground">
        {pt('tours.merge.chooseHelp')}
      </p>
      {options.map((tour) => (
        <label
          key={tour.id}
          className={cn(
            'flex min-h-14 cursor-pointer items-center gap-1 rounded-md border border-border-subtle pr-3',
            tour.id === targetId && 'border-primary bg-primary/5'
          )}
        >
          <Radio
            name={groupId}
            value={tour.id}
            checked={tour.id === targetId}
            onChange={() => {
              onSelect(tour.id);
            }}
          />
          <span className="min-w-0 break-words py-2">
            <span className="block text-sm font-medium">{tour.name}</span>
            <span className="block text-sm text-muted-foreground">
              {pt('tours.merge.optionDetails', {
                points: pointCount(pt, tour),
                recurrence: recurrenceLabel(pt, tour),
                validity: validityLabel(pt, tour),
                id: shortId(tour),
              })}
              {hidden.has(tour.id) ? pt('tours.merge.hiddenSuffix') : null}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
};

export const MergeConflicts = ({
  pt,
  options,
  target,
  conflicts,
}: {
  pt: Translate;
  options: readonly TourOption[];
  target: TourOption | undefined;
  conflicts: readonly WasteTourMergeConflict[];
}) => (
  <MergeAlert title={pt('tours.merge.rejected')}>
    <ul className="space-y-1">
      {conflicts.map(({ tourId, reason }) => {
        const tour = options.find((option) => option.id === tourId);
        return tour ? (
          <li key={`${tourId}-${reason}`}>
            {pt(`tours.merge.conflicts.${reason}`, {
              tour: tourLabel(pt, tour),
              turnus: recurrenceLabel(pt, tour),
              targetTurnus: target ? recurrenceLabel(pt, target) : '',
            })}
          </li>
        ) : null;
      })}
    </ul>
  </MergeAlert>
);

export const MergeHiddenTours = ({
  pt,
  hidden,
  resolvedTargetId,
}: {
  pt: Translate;
  hidden: readonly TourOption[];
  resolvedTargetId?: string;
}) => (
  <MergeAlert
    warning
    title={pt(hidden.length === 1 ? 'tours.merge.hiddenOne' : 'tours.merge.hidden')}
  >
    <ul className="space-y-1">
      {hidden.map((tour) => (
        <li key={tour.id}>
          {pt(
            !resolvedTargetId
              ? 'tours.merge.hiddenSelected'
              : tour.id === resolvedTargetId
                ? 'tours.merge.hiddenTarget'
                : 'tours.merge.hiddenSource',
            { tour: tourLabel(pt, tour) }
          )}
        </li>
      ))}
    </ul>
  </MergeAlert>
);
