import * as Popover from '@radix-ui/react-popover';
import { IconCalendarMonth as CalendarDays } from '@tabler/icons-react';
import * as React from 'react';

import { Button } from './button.js';
import { DatePickerCalendar } from './date-picker-calendar.js';
import {
  initialDatePickerMonth,
  type DatePickerError,
  type DatePickerLocale,
} from './date-picker-value.js';
import { Input } from './input.js';
import { StudioField } from './studio-form-fields.js';
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
  onChange: (value: string | null, error: DatePickerError | null, input?: string) => void;
  onValidationChange?: (error: DatePickerError | null) => void;
  onBlur?: () => void;
  locale: DatePickerLocale;
  labels: DatePickerLabels;
  /** Render only the control when an existing StudioField owns label/help/errors. */
  controlOnly?: boolean;
  className?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
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
    React.useEffect(() => {
      if (disabled || readOnly) setOpen(false);
    }, [disabled, readOnly]);
    const [month, setMonth] = React.useState(() => draft.selected ?? new Date());
    const changeOpen = (next: boolean) => {
      if (next && (disabled || readOnly)) return;
      if (next) setMonth(initialDatePickerMonth(draft.selected, props.min, props.max));
      setOpen(next);
    };
    const control = (
      <Popover.Root open={open && !disabled && !readOnly} onOpenChange={changeOpen}>
        <Popover.Anchor asChild>
          <div className="flex items-center gap-2">
            <Input
              {...draft.inputProps}
              aria-label={props['aria-label']}
              aria-describedby={[draft.inputProps['aria-describedby'], props['aria-describedby']]
                .filter(Boolean)
                .join(' ')}
              aria-invalid={props['aria-invalid'] || draft.inputProps['aria-invalid']}
              className={['min-w-0 flex-1', props.className].filter(Boolean).join(' ')}
              id={id}
              disabled={disabled}
              readOnly={readOnly}
              required={required}
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
    );
    if (props.controlOnly)
      return (
        <div className="space-y-1">
          {control}
          <p id={`${id}-format`} className="text-xs text-muted-foreground">
            {labels.formatHint}
          </p>
          {draft.error ? (
            <p id={`${id}-input-error`} className="text-xs text-destructive" role="status">
              {draft.error}
            </p>
          ) : null}
        </div>
      );
    return (
      <StudioField
        id={id}
        label={label}
        description={labels.formatHint}
        error={draft.error}
        required={required}
      >
        {control}
      </StudioField>
    );
  }
);
