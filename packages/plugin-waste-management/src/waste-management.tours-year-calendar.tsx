import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@sva/studio-ui-react';
import { usePluginTranslation } from '@sva/plugin-sdk';
import { useEffect, useState } from 'react';

import type { WasteManagementSchedulingOverview } from './waste-management.api.js';
import { calculateTourOccurrencesForYear } from './waste-management.tours.presentation.js';
import type { WasteTourRecord } from '@sva/core';

const TourYearCalendarMonth = ({
  monthIndex,
  year,
  highlighted,
}: {
  readonly monthIndex: number;
  readonly year: number;
  readonly highlighted: ReadonlySet<number>;
}) => {
  const first = new Date(year, monthIndex, 1);
  const startWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  return (
    <section className="space-y-2 rounded-lg border border-border/70 p-3">
      <h3 className="text-sm font-semibold">{new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(new Date(year, monthIndex, 1))}</h3>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((day) => (
          <div key={`${monthIndex}-${day}`}>{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {Array.from({ length: startWeekday }).map((_, index) => (
          <div key={`empty-${monthIndex}-${index}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
          const active = highlighted.has(day);
          return (
            <div key={`${monthIndex}-${day}`} className={`rounded px-1 py-2 ${active ? 'bg-primary text-primary-foreground' : 'border border-border/50'}`}>
              {day}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export const TourYearCalendarDialog = ({
  open,
  tour,
  scheduling,
  onOpenChange,
}: {
  readonly open: boolean;
  readonly tour: WasteTourRecord | null;
  readonly scheduling: WasteManagementSchedulingOverview | null;
  readonly onOpenChange: (open: boolean) => void;
}) => {
  const pt = usePluginTranslation('wasteManagement');
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  useEffect(() => {
    if (open) {
      setYear(currentYear);
    }
  }, [open, currentYear]);

  const dates = tour && scheduling ? calculateTourOccurrencesForYear(tour, year, scheduling) : [];
  const months = Array.from({ length: 12 }, (_, monthIndex) => ({
    monthIndex,
    highlighted: new Set(
      dates.filter((value) => Number(value.slice(5, 7)) === monthIndex + 1).map((value) => Number(value.slice(8, 10)))
    ),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{pt('tours.yearCalendar.title')}</DialogTitle>
          <DialogDescription>{tour ? pt('tours.yearCalendar.description', { value: tour.name }) : pt('tours.yearCalendar.descriptionFallback')}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" onClick={() => setYear((current) => current - 1)}>{pt('tours.yearCalendar.actions.previousYear')}</Button>
          <Badge>{pt('tours.yearCalendar.meta.year', { value: year })}</Badge>
          <Button type="button" variant="outline" onClick={() => setYear((current) => current + 1)}>{pt('tours.yearCalendar.actions.nextYear')}</Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {months.map((month) => (
            <TourYearCalendarMonth
              key={month.monthIndex}
              monthIndex={month.monthIndex}
              year={year}
              highlighted={month.highlighted}
            />
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{pt('tours.yearCalendar.meta.dateListTitle')}</p>
          <div className="flex flex-wrap gap-2">
            {dates.length ? dates.map((date) => <Badge key={date} variant="outline">{date}</Badge>) : <p className="text-sm text-muted-foreground">{pt('tours.yearCalendar.meta.noDates')}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
