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
  if (!active) return 'border-border/50 bg-background/80 text-foreground';
  return shifted
    ? 'border-info/60 bg-info/10 font-semibold text-foreground shadow-sm'
    : 'border-primary bg-primary font-semibold text-primary-foreground shadow-sm';
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
}: {
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
}) => {
  const shifted = occurrence?.shifted ?? false;
  const active = occurrence !== undefined;
  const originalDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const shiftedLabel =
    shifted && occurrence?.originalDate
      ? pt('tours.yearCalendar.meta.shiftedReplacementFor', {
          value: formatCalendarDate(occurrence.originalDate, locale),
        })
      : null;
  const shiftedDescriptionId = shiftedLabel
    ? `tour-year-calendar-shift-${tourId ?? 'unknown'}-${originalDate}`
    : undefined;
  return (
    <div
      aria-describedby={shiftedDescriptionId}
      data-shifted={active ? String(shifted) : undefined}
      tabIndex={shiftedLabel ? 0 : undefined}
      className={`group relative rounded-lg border px-1 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${resolveCalendarDayClassName(active, shifted)}`}
    >
      {day}
      {active && !shifted && canCreateShift && search && tourId ? (
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
      ) : null}
      {shiftedLabel ? (
        <>
          <span id={shiftedDescriptionId} className="sr-only">
            {shiftedLabel}
          </span>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border/60 bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md group-hover:block group-focus:block"
          >
            {shiftedLabel}
          </span>
        </>
      ) : null}
    </div>
  );
};
