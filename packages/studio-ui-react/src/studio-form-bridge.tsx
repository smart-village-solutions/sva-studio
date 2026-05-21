import * as React from 'react';
import type { FieldError } from 'react-hook-form';

import { cn } from './utils.js';

export type StudioFormFieldError = Readonly<{
  field: string;
  message: string;
}>;

export type StudioFormFieldErrorProps = Readonly<{
  error: FieldError | undefined;
}>;

export function getStudioFieldError(error: FieldError | undefined): string | undefined {
  return typeof error?.message === 'string' ? error.message : undefined;
}

export function StudioFormFieldError({ error }: StudioFormFieldErrorProps) {
  return getStudioFieldError(error) ?? null;
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
  title = 'Bitte korrigieren Sie die markierten Felder.',
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
      <p className="font-medium">{title}</p>
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
