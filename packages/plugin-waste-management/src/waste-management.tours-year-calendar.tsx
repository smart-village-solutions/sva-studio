import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@sva/studio-ui-react';
import { isWasteTourValidityApplicable, usePluginTranslation } from '@sva/plugin-sdk';
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import type { WasteManagementSchedulingOverview } from './waste-management.api.js';
import { calculateTourOccurrenceEntriesForYear } from './waste-management.tours.presentation.js';
import type { WasteTourRecord } from '@sva/plugin-sdk';
import type { WasteManagementSearchParams } from './search-params.js';
import {
  TourYearCalendarDay,
  type CalendarOccurrence,
} from './waste-management.tours-year-calendar-day.js';

const TourYearCalendarMonth = ({
  monthIndex,
  year,
  highlightedDays,
  tourId,
  search,
  canCreateShift,
  tourName,
  pt,
}: {
  readonly monthIndex: number;
  readonly year: number;
  readonly highlightedDays: ReadonlyMap<number, CalendarOccurrence>;
  readonly tourId: string | undefined;
  readonly search: WasteManagementSearchParams | undefined;
  readonly canCreateShift: boolean;
  readonly tourName: string | undefined;
  readonly pt: ReturnType<typeof usePluginTranslation>;
}) => {
  const first = new Date(year, monthIndex, 1);
  const startWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const monthLabel = new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(
    new Date(year, monthIndex, 1)
  );

  return (
    <section className="space-y-3 rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm">
      <h3 className="text-sm font-semibold capitalize tracking-wide">{monthLabel}</h3>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
          <div key={`${monthIndex}-${day}`}>{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {Array.from({ length: startWeekday }).map((_, index) => (
          <div key={`empty-${monthIndex}-${index}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => (
          <TourYearCalendarDay
            key={`${monthIndex}-${day}`}
            day={day}
            monthIndex={monthIndex}
            year={year}
            occurrence={highlightedDays.get(day)}
            tourId={tourId}
            search={search}
            canCreateShift={canCreateShift}
            tourName={tourName}
            pt={pt}
          />
        ))}
      </div>
    </section>
  );
};

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
  pt,
}: Readonly<{ dates: readonly string[]; pt: TourYearCalendarTranslate }>) => (
  <div className="space-y-2 rounded-2xl border border-border/70 bg-card/50 p-4">
    <p className="text-sm font-medium">{pt('tours.yearCalendar.meta.dateListTitle')}</p>
    <div className="flex flex-wrap gap-2">
      {dates.length ? (
        dates.map((date) => (
          <Badge key={date} variant="outline">
            {date}
          </Badge>
        ))
      ) : (
        <p className="text-sm text-muted-foreground">{pt('tours.yearCalendar.meta.noDates')}</p>
      )}
    </div>
  </div>
);

type TourYearCalendarDialogProps = {
  readonly open: boolean;
  readonly tour: WasteTourRecord | null;
  readonly scheduling: WasteManagementSchedulingOverview | null;
  readonly search?: WasteManagementSearchParams;
  readonly canManageScheduling?: boolean;
  readonly onOpenChange: (open: boolean) => void;
};

export const TourYearCalendarDialog = (props: TourYearCalendarDialogProps) => {
  const pt = usePluginTranslation('wasteManagement');
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const canCreateShift = Boolean(
    props.canManageScheduling && props.tour && isWasteTourValidityApplicable(props.tour)
  );

  useEffect(() => {
    if (props.open) {
      setYear(currentYear);
    }
  }, [props.open, currentYear]);

  const occurrenceEntries =
    props.tour && props.scheduling
      ? calculateTourOccurrenceEntriesForYear(props.tour, year, props.scheduling)
      : [];
  const dates = occurrenceEntries.map((entry) => entry.date);
  const months = Array.from({ length: 12 }, (_, monthIndex) => ({
    monthIndex,
    highlightedDays: new Map(
      occurrenceEntries
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

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[min(96vw,1500px)] max-w-none overflow-hidden p-0">
        <div className="flex max-h-[90vh] flex-col">
          <div className="border-b border-border/60 bg-background px-6 py-5">
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
              {months.map((month) => (
                <TourYearCalendarMonth
                  key={month.monthIndex}
                  monthIndex={month.monthIndex}
                  year={year}
                  highlightedDays={month.highlightedDays}
                  tourId={props.tour?.id}
                  search={props.search}
                  canCreateShift={canCreateShift}
                  tourName={props.tour?.name}
                  pt={pt}
                />
              ))}
            </div>

            <TourYearCalendarDateList dates={dates} pt={pt} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
