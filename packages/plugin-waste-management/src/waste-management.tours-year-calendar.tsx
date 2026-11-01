import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@sva/studio-ui-react';
import { resolveEditorLocale, usePluginTranslation } from '@sva/plugin-sdk';
import { isWasteTourValidityApplicable } from '@sva/waste-management-contracts';
import { useEffect, useId, useState, type Dispatch, type SetStateAction } from 'react';

import type { WasteManagementSchedulingOverview } from './waste-management.api.js';
import { calculateTourCalendarForYear } from './waste-management.tours.presentation.js';
import type { WasteTourRecord } from '@sva/waste-management-contracts';
import type { WasteManagementSearchParams } from './search-params.js';
import { TourYearCalendarMonth } from './waste-management.tours-year-calendar-day.js';

type TourYearCalendarTranslate = ReturnType<typeof usePluginTranslation>;

const TourYearCalendarControls = ({
  pt,
  setYear,
  year,
}: Readonly<{
  pt: TourYearCalendarTranslate;
  setYear: Dispatch<SetStateAction<number>>;
  year: number;
}>) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <Button type="button" variant="secondary" onClick={() => setYear((current) => current - 1)}>
      {pt('tours.yearCalendar.actions.previousYear')}
    </Button>
    <Badge className="w-fit self-center px-4 py-1 text-sm sm:self-auto">
      {pt('tours.yearCalendar.meta.year', { value: year })}
    </Badge>
    <Button type="button" variant="secondary" onClick={() => setYear((current) => current + 1)}>
      {pt('tours.yearCalendar.actions.nextYear')}
    </Button>
  </div>
);

const TourYearCalendarDateList = ({
  dates,
  complete,
  pt,
}: Readonly<{ dates: readonly string[]; complete: boolean; pt: TourYearCalendarTranslate }>) => (
  <div className="space-y-2 rounded-lg border border-border-subtle bg-card/50 p-4">
    <p className="text-sm font-medium">{pt('tours.yearCalendar.meta.dateListTitle')}</p>
    <div className="flex flex-wrap gap-2">
      {dates.length ? (
        dates.map((date) => (
          <Badge key={date} variant="outline">
            {date}
          </Badge>
        ))
      ) : complete ? (
        <p className="text-sm text-muted-foreground">{pt('tours.yearCalendar.meta.noDates')}</p>
      ) : null}
    </div>
  </div>
);

type TourYearCalendarDialogProps = {
  readonly open: boolean;
  readonly tour: WasteTourRecord | null;
  readonly scheduling: WasteManagementSchedulingOverview | null;
  readonly schedulingLoadState?: 'loading' | 'ready' | 'error';
  readonly search?: WasteManagementSearchParams;
  readonly canManageScheduling?: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

const calendarMonths = (entries: ReturnType<typeof calculateTourCalendarForYear>['entries']) =>
  Array.from({ length: 12 }, (_, monthIndex) => ({
    monthIndex,
    highlightedDays: new Map(
      entries
        .filter((entry) => Number(entry.date.slice(5, 7)) === monthIndex + 1)
        .map(
          (entry) =>
            [
              Number(entry.date.slice(8, 10)),
              { shifted: entry.shifted, originalDate: entry.originalDate },
            ] as const
        )
    ),
  }));

const initialCalendarYear = (tour: WasteTourRecord | null, currentYear: number): number => {
  const startYear =
    tour?.firstDate && /^\d{4}-/.test(tour.firstDate)
      ? Number(tour.firstDate.slice(0, 4))
      : currentYear;
  return startYear <= currentYear && (!tour?.endDate || tour.endDate >= `${currentYear}-01-01`)
    ? currentYear
    : startYear;
};

const TourYearCalendarStatus = ({ id, statusKey, loading, reasons, pt }: Readonly<{
  id: string;
  statusKey: string | null;
  loading: boolean;
  reasons: readonly string[];
  pt: TourYearCalendarTranslate;
}>) => (
            <div
              id={id}
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="space-y-1 text-sm"
            >
              {statusKey ? (
                <p className="font-medium">{pt(`tours.yearCalendar.meta.${statusKey}`)}</p>
              ) : null}
              {!loading
                ? reasons.map((reason) => (
                    <p key={reason} className="text-muted-foreground">
                      {pt(`tours.yearCalendar.meta.${reason}`)}
                    </p>
                  ))
                : null}
            </div>
);

const calendarStatusKey = (loading: boolean, complete: boolean, entryCount: number) =>
  loading ? 'loading' : complete ? null : entryCount ? 'partial' : 'unavailable';

export const TourYearCalendarDialog = (props: TourYearCalendarDialogProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const locale = resolveEditorLocale();
  const startYear = initialCalendarYear(props.tour, new Date().getFullYear());
  const [year, setYear] = useState(startYear);
  const canCreateShift = Boolean(
    props.canManageScheduling && props.tour && isWasteTourValidityApplicable(props.tour)
  );

  useEffect(() => {
    if (props.open) setYear(startYear);
  }, [props.open, startYear]);

  const statusId = useId();
  const loading = props.schedulingLoadState === 'loading';
  const calendar =
    props.tour && props.scheduling && !loading && props.schedulingLoadState !== 'error'
      ? calculateTourCalendarForYear(props.tour, year, props.scheduling)
      : null;
  const occurrenceEntries = calendar?.entries ?? [];
  const complete = Boolean(calendar && calendar.issues.length === 0);
  const statusKey = calendarStatusKey(loading, complete, occurrenceEntries.length);
  const reasons = props.schedulingLoadState === 'error' ? ['loadError'] : (calendar?.issues ?? []);
  const dates = occurrenceEntries.map((entry) => entry.date);
  const months = calendarMonths(occurrenceEntries);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[min(96vw,1500px)] max-w-none overflow-hidden p-0">
        <div className="flex max-h-[90vh] flex-col">
          <div className="border-b border-border-subtle bg-background px-6 py-5">
            <DialogHeader className="space-y-2">
              <DialogTitle>{pt('tours.yearCalendar.title')}</DialogTitle>
              <DialogDescription>
                {props.tour
                  ? pt('tours.yearCalendar.description', { value: props.tour.name })
                  : pt('tours.yearCalendar.descriptionFallback')}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            <TourYearCalendarControls year={year} setYear={setYear} pt={pt} />

            <TourYearCalendarStatus id={statusId} statusKey={statusKey}
              loading={loading} reasons={reasons} pt={pt} />
            <div
              aria-describedby={statusId}
              className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3"
            >
              {months.map((month) => (
                <TourYearCalendarMonth
                  key={month.monthIndex}
                  monthIndex={month.monthIndex}
                  year={year}
                  highlightedDays={month.highlightedDays}
                  emptyMessage={
                    complete
                      ? pt(
                          `tours.yearCalendar.meta.${calendar?.outsideValidityMonths[month.monthIndex] ? 'outsideValidity' : 'noDatesInMonth'}`
                        )
                      : undefined
                  }
                  tourId={props.tour?.id}
                  search={props.search}
                  canCreateShift={canCreateShift}
                  tourName={props.tour?.name}
                  locale={locale}
                  pt={pt}
                />
              ))}
            </div>

            <TourYearCalendarDateList dates={dates} complete={complete} pt={pt} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
