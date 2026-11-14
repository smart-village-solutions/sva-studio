import * as React from 'react';

import {
  formatDatePickerValue,
  parseDatePickerValue,
  readDatePickerInput,
} from './date-picker-value.js';
import type { DatePickerProps } from './date-picker.js';

export function useDatePickerDraft(
  props: DatePickerProps,
  forwardedRef: React.ForwardedRef<HTMLInputElement>
) {
  const { value, locale, labels, required, min, max, id } = props;
  const [input, setInput] = React.useState(
    () => formatDatePickerValue(value, locale) || value || ''
  );
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
      setInput(formatDatePickerValue(value, locale) || value || '');
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
  // Editor forms may use noValidate. A partial date must never turn into a saved empty date.
  React.useEffect(() => {
    const input = inputRef.current;
    const form = input?.form;
    if (!input || !form) return;
    const validate = (event: Event) => {
      if (
        input.disabled ||
        input.readOnly ||
        !input.validity.customError ||
        input.value.trim() === ''
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setTouched(true);
      input.focus();
      input.reportValidity();
    };
    form.addEventListener('submit', validate, true);
    return () => form.removeEventListener('submit', validate, true);
  }, []);
  const changeInput = (next: string) => {
    const parsed = readDatePickerInput(next, locale, { required, min, max });
    setInput(next);
    emittedValue.current = props.controlOnly && parsed.error ? next : parsed.value;
    props.onChange(parsed.value, parsed.error, next);
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
      'aria-describedby': [
        props.controlOnly ? `${id}-format` : `${id}-description`,
        error ? (props.controlOnly ? `${id}-input-error` : `${id}-error`) : null,
      ]
        .filter(Boolean)
        .join(' '),
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => changeInput(event.target.value),
      onInvalid: () => setTouched(true),
    } satisfies React.ComponentPropsWithRef<'input'>,
  };
}
