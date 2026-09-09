import * as React from 'react';

import type { DatePickerProps } from './date-picker.js';
import {
  formatDatePickerValue,
  parseDatePickerValue,
  readDatePickerInput,
} from './date-picker-value.js';

export function useDatePickerDraft(
  props: DatePickerProps,
  forwardedRef: React.ForwardedRef<HTMLInputElement>
) {
  const { value, locale, labels, required, min, max, id } = props;
  const [input, setInput] = React.useState(() => formatDatePickerValue(value, locale));
  const [touched, setTouched] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const emittedValue = React.useRef(value);
  const previousLocale = React.useRef(locale);
  const ref = React.useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof forwardedRef === 'function') return forwardedRef(node);
      if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef]
  );
  React.useEffect(() => {
    if (value !== emittedValue.current || locale !== previousLocale.current) {
      setInput(formatDatePickerValue(value, locale));
      setTouched(false);
    }
    emittedValue.current = value;
    previousLocale.current = locale;
  }, [value, locale]);
  const result = readDatePickerInput(input, locale, { required, min, max });
  const validationMessage = result.error ? labels.errors[result.error] : '';
  const error = props.error || (touched ? validationMessage : '');
  React.useEffect(() => {
    inputRef.current?.setCustomValidity(validationMessage);
  }, [validationMessage]);
  React.useEffect(() => {
    props.onValidationChange?.(result.error);
  }, [props.onValidationChange, result.error]);
  const changeInput = (next: string) => {
    const parsed = readDatePickerInput(next, locale, { required, min, max });
    setInput(next);
    emittedValue.current = parsed.value;
    props.onChange(parsed.value, parsed.error);
  };
  const blur = () => {
    setTouched(true);
    if (result.value) setInput(formatDatePickerValue(result.value, locale));
    props.onBlur?.();
  };
  return {
    value: result.value,
    error,
    selected: result.value ? parseDatePickerValue(result.value) : undefined,
    select: (next: string) => {
      changeInput(formatDatePickerValue(next, locale));
      setTouched(true);
    },
    inputProps: {
      ref,
      type: 'text',
      value: input,
      onBlur: blur,
      'aria-required': required || undefined,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': [`${id}-description`, error ? `${id}-error` : null]
        .filter(Boolean)
        .join(' '),
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => changeInput(event.target.value),
      onInvalid: () => setTouched(true),
    } satisfies React.ComponentPropsWithRef<'input'>,
  };
}
