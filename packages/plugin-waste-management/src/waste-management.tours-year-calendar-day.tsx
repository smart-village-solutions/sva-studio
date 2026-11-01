import { useId } from 'react';
import { usePluginTranslation } from '@sva/plugin-sdk';

import type { WasteManagementSearchParams } from './search-params.js';
import { WasteTourShiftCreateLink } from './waste-management.tour-shift-create-link.js';

export type CalendarOccurrence = Readonly<{ shifted: boolean; originalDate: string | null }>;

const formatCalendarDate = (value: string, locale: string): string => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(parsed);
};

const resolveCalendarDayClassName = (active: boolean, shifted: boolean): string => {
  if (!active) return 'border-transparent bg-transparent text-foreground';
  return shifted
    ? 'border-input bg-card font-semibold text-foreground'
    : 'border-primary bg-primary font-semibold text-primary-foreground';
};

type CalendarDayProps = {
  readonly layout?: 'grid' | 'list';
  readonly day: number;
  readonly monthIndex: number;
  readonly year: number;
  readonly occurrence?: CalendarOccurrence;
  readonly tourId?: string;
  readonly search?: WasteManagementSearchParams;
  readonly canCreateShift: boolean;
  readonly tourName?: string;
  readonly locale: string;
  readonly pt: ReturnType<typeof usePluginTranslation>;
};

const CalendarShiftLink = ({ occurrence, canCreateShift, search, tourId, originalDate,
  tourName, locale, pt }: Pick<CalendarDayProps,
  'occurrence' | 'canCreateShift' | 'search' | 'tourId' | 'tourName' | 'locale' | 'pt'
> & Readonly<{ originalDate: string }>) => {
  if (!occurrence || occurrence.shifted || !canCreateShift || !search || !tourId) return null;
  return (
        <WasteTourShiftCreateLink
          search={search}
          tourId={tourId}
          originalDate={originalDate}
          label={pt('tours.actions.shiftDateAccessible', {
            date: formatCalendarDate(originalDate, locale),
            name: tourName ?? '',
          })}
          unstyled
          showExternalIcon={false}
          className="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="sr-only">{pt('tours.actions.shiftDate')}</span>
        </WasteTourShiftCreateLink>
  );
};

export const TourYearCalendarDay = ({
  day,
  monthIndex,
  year,
  occurrence,
  tourId,
  search,
  canCreateShift,
  tourName,
  locale,
  pt,
  layout = 'grid',
}: CalendarDayProps) => {
  const descriptionId = useId();
  const shifted = occurrence?.shifted ?? false;
  const active = occurrence !== undefined;
  const originalDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const shiftedLabel =
    shifted && occurrence?.originalDate
      ? pt('tours.yearCalendar.meta.shiftedReplacementFor', {
          value: formatCalendarDate(occurrence.originalDate, locale),
        })
      : null;
  const shiftedDescriptionId = shiftedLabel ? descriptionId : undefined;
  return (
    <div
      role={shiftedLabel ? 'group' : undefined}
      aria-label={shiftedLabel ? formatCalendarDate(originalDate, locale) : undefined}
      aria-describedby={shiftedDescriptionId}
      data-shifted={active ? String(shifted) : undefined}
      tabIndex={shiftedLabel ? 0 : undefined}
      className={`group relative flex min-h-11 items-center ${layout === 'list' ? 'flex-col justify-center gap-1 px-3 py-2' : 'min-w-11 justify-center p-1'} rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${resolveCalendarDayClassName(active, shifted)}`}
    >
      {layout === 'list' ? formatCalendarDate(originalDate, locale) : day}
      <CalendarShiftLink occurrence={occurrence} canCreateShift={canCreateShift} search={search}
        tourId={tourId} originalDate={originalDate} tourName={tourName} locale={locale} pt={pt} />
      {shiftedLabel ? (
        <>
          <span
            id={shiftedDescriptionId}
            className={layout === 'list' ? 'text-xs text-muted-foreground' : 'sr-only'}
          >
            {shiftedLabel}
          </span>
          {layout === 'grid' ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border-subtle bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md group-hover:block group-focus:block"
            >
              {shiftedLabel}
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

export const TourYearCalendarMonth = ({
  monthIndex,
  year,
  highlightedDays,
  emptyMessage,
  tourId,
  search,
  canCreateShift,
  tourName,
  locale,
  pt,
}: Omit<CalendarDayProps, 'day' | 'occurrence' | 'layout'> & Readonly<{
  highlightedDays: ReadonlyMap<number, CalendarOccurrence>;
  emptyMessage: string | undefined;
}>) => {
  const dayProps = { monthIndex, year, tourId, search, canCreateShift, tourName, locale, pt };
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const startWeekday = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
    first
  );
  const weekdayLabels = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2026, 0, 5 + index))
    )
  );

  return (
    <section className="space-y-3 rounded-lg border border-border-subtle bg-surface-inset p-4">
      <h3 className="text-sm font-semibold capitalize tracking-wide">{monthLabel}</h3>
      <div className="hidden sm:block" data-year-calendar-layout="grid">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {weekdayLabels.map((day) => (
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
              {...dayProps}
              occurrence={highlightedDays.get(day)}
            />
          ))}
        </div>
      </div>
      <ul className="space-y-2 sm:hidden" data-year-calendar-layout="list">
        {highlightedDays.size
          ? Array.from(highlightedDays.entries())
              .sort(([left], [right]) => left - right)
              .map(([day, occurrence]) => (
                <li key={day}>
                  <TourYearCalendarDay
                    day={day}
                    {...dayProps}
                    occurrence={occurrence}
                    layout="list"
                  />
                </li>
              ))
          : null}
      </ul>
      {!highlightedDays.size && emptyMessage ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : null}
    </section>
  );
};
