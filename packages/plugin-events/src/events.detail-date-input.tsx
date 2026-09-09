import { useCallback, useRef } from 'react';
import { useController, useFormContext, useWatch } from 'react-hook-form';
import { resolveEditorLocale } from '@sva/plugin-sdk';
import { DatePicker, type DatePickerError, type DatePickerLabels } from '@sva/studio-ui-react';

import type { EventsDetailFormValues } from './events.detail-form.js';
import { indexedId, type EventsContentTranslator } from './events.detail-content-section-fields.js';

export function EventsDateInput({
  index,
  name,
  pt,
}: Readonly<{
  index: number;
  name: 'dateStart' | 'dateEnd';
  pt: EventsContentTranslator;
}>) {
  const { control } = useFormContext<EventsDetailFormValues>();
  const invalid = useRef<DatePickerError | null>(null);
  const onValidationChange = useCallback((error: DatePickerError | null) => {
    invalid.current = error;
  }, []);
  const { field, fieldState } = useController({
    control,
    name: `content.dates.${index}.${name}`,
    rules: {
      validate: () => (invalid.current ? pt(`datePicker.errors.${invalid.current}`) : true),
    },
  });
  const start = useWatch({ control, name: `content.dates.${index}.dateStart` });
  const label = pt(`fields.${name}`);
  const labels: DatePickerLabels = {
    openCalendar: `${label}: ${pt('datePicker.openCalendar')}`,
    calendar: `${label}: ${pt('datePicker.calendar')}`,
    navigation: pt('datePicker.navigation'),
    previousMonth: pt('datePicker.previousMonth'),
    nextMonth: pt('datePicker.nextMonth'),
    formatHint: pt('datePicker.formatHint'),
    today: pt('datePicker.today'),
    selected: pt('datePicker.selected'),
    errors: {
      invalid: pt('datePicker.errors.invalid'),
      required: pt('datePicker.errors.required'),
      min: pt('datePicker.errors.min'),
      max: pt('datePicker.errors.max'),
    },
  };
  return (
    <DatePicker
      ref={field.ref}
      id={indexedId(name === 'dateStart' ? 'event-date-start' : 'event-date-end', index)}
      label={label}
      value={field.value || null}
      labels={labels}
      locale={resolveEditorLocale().startsWith('en') ? 'en-GB' : 'de-DE'}
      min={name === 'dateEnd' ? start || undefined : undefined}
      onBlur={field.onBlur}
      error={fieldState.error?.message}
      onValidationChange={onValidationChange}
      onChange={(value, error) => {
        onValidationChange(error);
        field.onChange(value ?? '');
      }}
    />
  );
}
