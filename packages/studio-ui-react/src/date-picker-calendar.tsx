import * as Popover from '@radix-ui/react-popover';
import { de, enGB, enUS } from 'react-day-picker/locale';

import { Calendar } from './calendar.js';
import type { DatePickerProps } from './date-picker.js';
import { parseDatePickerValue, toDatePickerValue } from './date-picker-value.js';

const locales = { 'de-DE': de, 'en-GB': enGB, 'en-US': enUS } as const;

export function DatePickerCalendar({
  locale,
  labels,
  min,
  max,
  selected,
  month,
  onMonthChange,
  onSelect,
}: Pick<DatePickerProps, 'locale' | 'labels' | 'min' | 'max'> &
  Readonly<{
    selected: Date | undefined;
    month: Date;
    onMonthChange: (month: Date) => void;
    onSelect: (value: string) => void;
  }>) {
  const dateLabel = new Intl.DateTimeFormat(locale, { dateStyle: 'full' });
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const minimum = min ? parseDatePickerValue(min) : undefined;
  const maximum = max ? parseDatePickerValue(max) : undefined;
  return (
    <Popover.Portal>
      <Popover.Content
        align="start"
        sideOffset={4}
        collisionPadding={8}
        aria-label={labels.calendar}
        className="z-50 w-auto max-w-[calc(100vw-1rem)] rounded-md border border-border bg-popover text-popover-foreground shadow-md"
      >
        <Calendar
          mode="single"
          required
          autoFocus
          locale={locales[locale]}
          selected={selected}
          month={month}
          onMonthChange={onMonthChange}
          disabled={[
            ...(minimum ? [{ before: minimum }] : []),
            ...(maximum ? [{ after: maximum }] : []),
          ]}
          labels={{
            labelNext: () => labels.nextMonth,
            labelPrevious: () => labels.previousMonth,
            labelNav: () => labels.navigation,
            labelGrid: (date) => monthLabel.format(date),
            labelDayButton: (date, modifiers) =>
              [
                dateLabel.format(date),
                modifiers.today ? labels.today : null,
                modifiers.selected ? labels.selected : null,
              ]
                .filter(Boolean)
                .join(', '),
          }}
          onSelect={(date) => onSelect(toDatePickerValue(date))}
        />
      </Popover.Content>
    </Popover.Portal>
  );
}
