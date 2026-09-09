import * as Popover from '@radix-ui/react-popover';
import { CalendarDays } from 'lucide-react';
import * as React from 'react';

import { Button } from './button.js';
import { DatePickerCalendar } from './date-picker-calendar.js';
import {
  initialDatePickerMonth,
  type DatePickerError,
  type DatePickerLocale,
} from './date-picker-value.js';
import { Input } from './input.js';
import { StudioField } from './studio-primitives.js';
import { useDatePickerDraft } from './use-date-picker-draft.js';

export type DatePickerLabels = Readonly<{
  openCalendar: string;
  calendar: string;
  navigation: string;
  previousMonth: string;
  nextMonth: string;
  formatHint: string;
  today: string;
  selected: string;
  errors: Readonly<Record<DatePickerError, string>>;
}>;

export type DatePickerProps = Readonly<{
  id: string;
  label: string;
  value: string | null;
  onChange: (value: string | null, error: DatePickerError | null) => void;
  onValidationChange?: (error: DatePickerError | null) => void;
  onBlur?: () => void;
  locale: DatePickerLocale;
  labels: DatePickerLabels;
  name?: string;
  required?: boolean;
  min?: string;
  max?: string;
  disabled?: boolean;
  readOnly?: boolean;
  error?: string;
}>;

export const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  function DatePicker(props, forwardedRef) {
    const { id, label, labels, disabled, readOnly, required } = props;
    const draft = useDatePickerDraft(props, forwardedRef);
    const [open, setOpen] = React.useState(false);
    const [month, setMonth] = React.useState(() => draft.selected ?? new Date());
    const changeOpen = (next: boolean) => {
      if (next && (disabled || readOnly)) return;
      if (next) setMonth(initialDatePickerMonth(draft.selected, props.min, props.max));
      setOpen(next);
    };
    return (
      <StudioField
        id={id}
        label={label}
        description={labels.formatHint}
        error={draft.error}
        required={required}
      >
        <Popover.Root open={open && !disabled && !readOnly} onOpenChange={changeOpen}>
          <Popover.Anchor asChild>
            <div className="flex items-center gap-2">
              <Input
                {...draft.inputProps}
                id={id}
                disabled={disabled}
                readOnly={readOnly}
                required={required}
                className="min-w-0 flex-1"
                autoComplete="off"
              />
              {props.name ? (
                <input
                  type="hidden"
                  name={props.name}
                  value={draft.value ?? ''}
                  disabled={disabled}
                />
              ) : null}
              <Popover.Trigger asChild>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  disabled={disabled || readOnly}
                  aria-label={labels.openCalendar}
                >
                  <CalendarDays aria-hidden="true" className="h-4 w-4" />
                </Button>
              </Popover.Trigger>
            </div>
          </Popover.Anchor>
          <DatePickerCalendar
            {...props}
            selected={draft.selected}
            month={month}
            onMonthChange={setMonth}
            onSelect={(value) => {
              draft.select(value);
              setOpen(false);
            }}
          />
        </Popover.Root>
      </StudioField>
    );
  }
);
