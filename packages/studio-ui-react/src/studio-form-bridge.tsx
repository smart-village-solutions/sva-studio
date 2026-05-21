import * as React from 'react';
import type { FieldError } from 'react-hook-form';

import { cn } from './utils.js';

export type StudioFormFieldError = Readonly<{
  field: string;
  message: string;
}>;

export type StudioFieldControlProps = Readonly<{
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}>;

export function getStudioFieldError(error: FieldError | undefined): string | undefined {
  return typeof error?.message === 'string' ? error.message : undefined;
}

export type StudioFormFieldBindings = Readonly<{
  id: string;
  error?: string;
  errorId: string;
  descriptionId: string;
  controlProps: StudioFieldControlProps;
  summaryError?: StudioFormFieldError;
}>;

export type GetStudioFormFieldPropsOptions = Readonly<{
  id: string;
  error: FieldError | undefined;
  descriptionId?: string;
  errorId?: string;
  hasDescription?: boolean;
}>;

export function getStudioFormFieldProps({
  id,
  error,
  descriptionId = `${id}-description`,
  errorId = `${id}-error`,
  hasDescription = false,
}: GetStudioFormFieldPropsOptions): StudioFormFieldBindings {
  const message = getStudioFieldError(error);
  const describedBy = [hasDescription ? descriptionId : undefined, message ? errorId : undefined]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join(' ');

  return {
    id,
    error: message,
    errorId,
    descriptionId,
    controlProps: {
      id,
      'aria-invalid': message ? true : undefined,
      'aria-describedby': describedBy || undefined,
    },
    summaryError: message
      ? {
          field: id,
          message,
        }
      : undefined,
  };
}

export type StudioFormSummaryErrorsProps = Readonly<{
  errors: readonly StudioFormFieldError[];
  title?: string;
  className?: string;
}>;

const focusFieldById = (fieldId: string) => {
  const target = document.getElementById(fieldId);
  if (!(target instanceof HTMLElement)) {
    return;
  }

  target.focus();
};

export function StudioFormSummaryErrors({
  errors,
  title,
  className,
}: StudioFormSummaryErrorsProps) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <section
      role="alert"
      aria-live="assertive"
      className={cn('space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive', className)}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      <ul className="space-y-1">
        {errors.map((error) => (
          <li key={`${error.field}:${error.message}`}>
            <a
              href={`#${error.field}`}
              className="underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={(event) => {
                event.preventDefault();
                focusFieldById(error.field);
              }}
            >
              {error.message}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
