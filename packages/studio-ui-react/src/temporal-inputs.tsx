import {
  fromDatetimeLocalValue,
  isCalendarDate,
  isInstant,
  resolveEditorLocale,
  toDatetimeLocalValue,
  useTemporalTranslation,
} from '@sva/plugin-sdk/temporal';
import * as React from 'react';
import {
  useController,
  useFormContext,
  type FieldValues,
  type FieldPathByValue,
} from 'react-hook-form';

import { DatePicker, type DatePickerLabels, type DatePickerProps } from './date-picker.js';
import { Input } from './input.js';

type DateInputProps = Pick<
  DatePickerProps,
  | 'id'
  | 'disabled'
  | 'readOnly'
  | 'required'
  | 'min'
  | 'max'
  | 'className'
  | 'aria-label'
  | 'aria-describedby'
  | 'aria-invalid'
> & {
  label?: string;
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: () => void;
};

/** A calendar date control for an existing field; its value never contains a time zone. */
export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  { value, onValueChange, label, ...props },
  ref
) {
  const t = useTemporalTranslation();
  const labels: DatePickerLabels = {
    openCalendar:
      label || props['aria-label']
        ? `${label ?? props['aria-label']}: ${t('datePicker.openCalendar')}`
        : t('datePicker.openCalendar'),
    calendar:
      label || props['aria-label']
        ? `${label ?? props['aria-label']}: ${t('datePicker.calendar')}`
        : t('datePicker.calendar'),
    navigation: t('datePicker.navigation'),
    previousMonth: t('datePicker.previousMonth'),
    nextMonth: t('datePicker.nextMonth'),
    formatHint: t('datePicker.formatHint'),
    today: t('datePicker.today'),
    selected: t('datePicker.selected'),
    errors: {
      invalid: t('datePicker.errors.invalid'),
      required: t('datePicker.errors.required'),
      min: t('datePicker.errors.min'),
      max: t('datePicker.errors.max'),
    },
  };
  return (
    <DatePicker
      {...props}
      ref={ref}
      controlOnly
      label={label ?? props['aria-label'] ?? props.id}
      labels={labels}
      locale={resolveEditorLocale().startsWith('en') ? 'en-GB' : 'de-DE'}
      value={value || null}
      onChange={(next, error, input) => onValueChange(error ? (input ?? '') : (next ?? ''))}
    />
  );
});

/** React Hook Form binding: keep canonical values in the form and focus the visible input. */
export function FormDateInput<TValues extends FieldValues>({
  name,
  ...props
}: Omit<DateInputProps, 'value' | 'onValueChange'> & {
  name: FieldPathByValue<TValues, string | undefined>;
}) {
  const { control } = useFormContext<TValues>();
  const t = useTemporalTranslation();
  const { field } = useController({
    name,
    control,
    rules: {
      validate: (fieldValue) => {
        const value = String(fieldValue ?? '');
        return (
          (!value && !props.required) ||
          (isCalendarDate(value) &&
            (!props.min || value >= props.min) &&
            (!props.max || value <= props.max)) ||
          t('datePicker.errors.invalid')
        );
      },
    },
  });
  return (
    <DateInput
      {...props}
      value={String(field.value ?? '')}
      onValueChange={field.onChange}
      onBlur={field.onBlur}
      ref={field.ref}
    />
  );
}

// These controls are also used in noValidate/RHF forms: native constraints still apply.
function useTemporalRef(forwardedRef: React.ForwardedRef<HTMLInputElement>) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;
    if (!input || !form) return;
    const validate = (event: Event) => {
      if (input.disabled || input.readOnly || input.validity.valid) return;
      // noValidate consumers own missing-field summaries; retain native bad-input protection.
      if (input.validity.valueMissing && !input.validity.badInput && !input.validity.customError)
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      input.focus();
      input.reportValidity();
    };
    form.addEventListener('submit', validate, true);
    return () => form.removeEventListener('submit', validate, true);
  }, []);
  return React.useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof forwardedRef === 'function') return forwardedRef(node);
      if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef]
  );
}

type LocalInputProps = Omit<React.ComponentPropsWithRef<'input'>, 'type'>;
/** Wall-clock time, without a date or offset. `any` preserves imported seconds/fractions. */
export const TimeInput = React.forwardRef<HTMLInputElement, LocalInputProps>(
  function TimeInput(props, ref) {
    const inputRef = useTemporalRef(ref);
    return <Input {...props} ref={inputRef} type="time" step={props.step ?? 'any'} />;
  }
);
type LocalDateTimeProps = Pick<
  LocalInputProps,
  | 'id'
  | 'name'
  | 'disabled'
  | 'readOnly'
  | 'required'
  | 'step'
  | 'aria-label'
  | 'aria-describedby'
  | 'aria-invalid'
  | 'className'
> & {
  value: string;
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  label?: string;
  min?: string;
  max?: string;
};
/** Local components: every date part uses the same localized calendar-day control. */
export const LocalDateTimeInput = React.forwardRef<HTMLInputElement, LocalDateTimeProps>(
  function LocalDateTimeInput(
    { id, value, label, onValueChange, onBlur, min, max, ...props },
    ref
  ) {
    const generatedId = React.useId();
    const dateId = id ?? generatedId;
    const timeId = `${dateId}-time`;
    const t = useTemporalTranslation();
    const [day = '', time = ''] = value.split('T');
    const [minDay, minTime] = min?.split('T') ?? [];
    const [maxDay, maxTime] = max?.split('T') ?? [];
    const join = (nextDay: string, nextTime: string) =>
      nextDay || nextTime ? `${nextDay}T${nextTime}` : '';
    const timeLabel =
      label || props['aria-label']
        ? t('datePicker.timeFor', { label: label ?? props['aria-label'] ?? '' })
        : t('datePicker.time');
    return (
      <div
        className={['grid min-w-0 gap-2 sm:grid-cols-2', props.className].filter(Boolean).join(' ')}
      >
        <DateInput
          id={dateId}
          label={label}
          ref={ref}
          value={day}
          required={props.required || Boolean(time)}
          disabled={props.disabled}
          readOnly={props.readOnly}
          min={minDay}
          max={maxDay}
          onBlur={onBlur}
          aria-label={props['aria-label']}
          aria-describedby={props['aria-describedby']}
          aria-invalid={props['aria-invalid'] === true || props['aria-invalid'] === 'true'}
          onValueChange={(next) => onValueChange(join(next, time))}
        />
        <TimeInput
          id={timeId}
          value={time}
          required={props.required || Boolean(day)}
          aria-label={timeLabel}
          aria-describedby={props['aria-describedby']}
          aria-invalid={props['aria-invalid']}
          disabled={props.disabled}
          readOnly={props.readOnly}
          min={day === minDay ? minTime : undefined}
          max={day === maxDay ? maxTime : undefined}
          step={props.step ?? 'any'}
          onBlur={onBlur}
          onChange={(event) => onValueChange(join(day, event.target.value))}
        />
        {props.name ? (
          <input type="hidden" name={props.name} value={value} disabled={props.disabled} />
        ) : null}
      </div>
    );
  }
);

/** Absolute API timestamp, edited in the existing editorial time zone. */
export const InstantInput = React.forwardRef<HTMLInputElement, LocalDateTimeProps>(
  function InstantInput({ value, onValueChange, ...props }, ref) {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const t = useTemporalTranslation();
    const local = isInstant(value) ? toDatetimeLocalValue(value) : value;
    const invalid = Boolean(value) && !isInstant(value);
    React.useEffect(() => {
      inputRef.current?.setCustomValidity(invalid ? t('datePicker.errors.invalidInstant') : '');
    }, [invalid, t]);
    return (
      <LocalDateTimeInput
        {...props}
        ref={(node) => {
          inputRef.current = node;
          if (typeof ref === 'function') return ref(node);
          if (ref) ref.current = node;
        }}
        value={local}
        aria-invalid={invalid || props['aria-invalid']}
        onValueChange={(next) => {
          onValueChange(next ? fromDatetimeLocalValue(next, value) || next : '');
        }}
      />
    );
  }
);
