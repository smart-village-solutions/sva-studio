import type { PublicWasteCalendarEntry } from '../lib/public-waste-contract.js';
import { startOfMonth, toMonthKey } from './public-waste-calendar-panel-dates.js';

const toDateKey = (value: Date): string =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
const isSameMonth = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();

const getWeekdayOffset = (value: Date): number => (value.getDay() + 6) % 7;
export const groupEntriesByMonth = (entries: readonly PublicWasteCalendarEntry[]) =>
  Array.from(
    entries
      .reduce<Map<string, PublicWasteCalendarEntry[]>>((groups, entry) => {
        const monthKey = entry.date.slice(0, 7);
        const bucket = groups.get(monthKey);
        if (bucket) {
          bucket.push(entry);
        } else {
          groups.set(monthKey, [entry]);
        }
        return groups;
      }, new Map())
      .entries()
  );

export const partitionListEntries = (
  entries: readonly PublicWasteCalendarEntry[],
  nextPickupDate: string | null
): Readonly<{
  upcomingEntries: readonly PublicWasteCalendarEntry[];
  pastEntries: readonly PublicWasteCalendarEntry[];
}> => {
  if (!nextPickupDate) {
    return { upcomingEntries: [], pastEntries: entries };
  }

  return entries.reduce<{
    upcomingEntries: PublicWasteCalendarEntry[];
    pastEntries: PublicWasteCalendarEntry[];
  }>(
    (result, entry) => {
      if (entry.date >= nextPickupDate) {
        result.upcomingEntries.push(entry);
      } else {
        result.pastEntries.push(entry);
      }
      return result;
    },
    { upcomingEntries: [], pastEntries: [] }
  );
};

export const groupEntriesByDay = (entries: readonly PublicWasteCalendarEntry[]) =>
  Array.from(
    entries
      .reduce<Map<string, PublicWasteCalendarEntry[]>>((groups, entry) => {
        const bucket = groups.get(entry.date);
        if (bucket) {
          bucket.push(entry);
        } else {
          groups.set(entry.date, [entry]);
        }
        return groups;
      }, new Map())
      .entries()
  );

export const buildMonthCells = (
  visibleMonth: Date,
  entriesByDate: ReadonlyMap<string, readonly PublicWasteCalendarEntry[]>
): readonly {
  readonly date: Date;
  readonly dateKey: string;
  readonly inMonth: boolean;
  readonly entries: readonly PublicWasteCalendarEntry[];
}[] => {
  const monthStart = startOfMonth(visibleMonth);
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - getWeekdayOffset(monthStart));

  return Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(calendarStart);
    cellDate.setDate(calendarStart.getDate() + index);
    const dateKey = toDateKey(cellDate);

    return {
      date: cellDate,
      dateKey,
      inMonth: isSameMonth(cellDate, visibleMonth),
      entries: entriesByDate.get(dateKey) ?? [],
    };
  });
};

export const buildYearMonthCells = (
  visibleMonth: Date,
  entriesByDate: ReadonlyMap<string, readonly PublicWasteCalendarEntry[]>
): readonly (
  | {
      readonly kind: 'day';
      readonly date: Date;
      readonly dateKey: string;
      readonly entries: readonly PublicWasteCalendarEntry[];
    }
  | {
      readonly kind: 'placeholder';
      readonly id: string;
    }
)[] => {
  const monthStart = startOfMonth(visibleMonth);
  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0
  ).getDate();
  const leadingPlaceholders = getWeekdayOffset(monthStart);
  const dayCells = Array.from({ length: daysInMonth }, (_, index) => {
    const cellDate = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index + 1);
    const dateKey = toDateKey(cellDate);

    return {
      kind: 'day' as const,
      date: cellDate,
      dateKey,
      entries: entriesByDate.get(dateKey) ?? [],
    };
  });
  const totalCells = leadingPlaceholders + dayCells.length;
  const trailingPlaceholders = (7 - (totalCells % 7 || 7)) % 7;

  return [
    ...Array.from({ length: leadingPlaceholders }, (_, index) => ({
      kind: 'placeholder' as const,
      id: `leading-${toMonthKey(visibleMonth)}-${index}`,
    })),
    ...dayCells,
    ...Array.from({ length: trailingPlaceholders }, (_, index) => ({
      kind: 'placeholder' as const,
      id: `trailing-${toMonthKey(visibleMonth)}-${index}`,
    })),
  ];
};
