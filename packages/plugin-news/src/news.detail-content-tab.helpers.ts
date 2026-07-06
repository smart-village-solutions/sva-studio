import type { FieldError } from 'react-hook-form';
import { getStudioFormFieldProps } from '@sva/studio-ui-react';

export type ContentFieldBindings = ReturnType<typeof getStudioFormFieldProps>;

export const collectSummaryErrors = (
  fields: readonly ContentFieldBindings[]
) => fields.flatMap((field) => (field.summaryError ? [field.summaryError] : []));

export const translateFieldError = (
  error: FieldError | undefined,
  pt: (key: string, variables?: Readonly<Record<string, string | number>>) => string
): FieldError | undefined => {
  if (!error || typeof error.message !== 'string') {
    return error;
  }

  return {
    ...error,
    message: pt(`validation.${error.message}`),
  };
};

export const readNestedFieldError = (value: unknown): FieldError | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return 'message' in value || 'type' in value ? (value as FieldError) : undefined;
};
