import * as React from 'react';

import { cn } from './utils.js';

export type StudioFieldProps = Readonly<{
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  descriptionId?: string;
  errorId?: string;
  required?: boolean;
  controlProps?: StudioFieldControlProps;
  children: React.ReactNode;
  className?: string;
}>;

export type StudioFieldControlProps = Readonly<{
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
}>;

const mergeDescribedBy = (currentValue: string | undefined, nextValue: string | undefined) => {
  const tokens = [...(currentValue?.split(/\s+/) ?? []), ...(nextValue?.split(/\s+/) ?? [])].filter(
    Boolean
  );
  return tokens.length > 0 ? Array.from(new Set(tokens)).join(' ') : undefined;
};

type StudioFieldChildProps = Readonly<{
  id?: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
  type?: string;
}>;

const isCheckboxElement = (element: React.ReactElement<StudioFieldChildProps>) => {
  if (element.type === 'input' && element.props.type === 'checkbox') {
    return true;
  }
  if (typeof element.type === 'object' && element.type !== null) {
    const componentType = element.type as { displayName?: string };
    return componentType.displayName === 'Checkbox';
  }
  return false;
};

export function StudioField({
  id,
  label,
  description,
  error,
  descriptionId,
  errorId,
  required = false,
  controlProps,
  children,
  className,
}: StudioFieldProps) {
  const childElement = React.isValidElement<StudioFieldChildProps>(children) ? children : null;
  const resolvedControlId = controlProps && childElement ? controlProps.id : id;
  const resolvedDescriptionId = descriptionId ?? `${resolvedControlId}-description`;
  const resolvedErrorId = errorId ?? `${resolvedControlId}-error`;
  const resolvedChildren =
    controlProps && childElement
      ? React.cloneElement(childElement, {
          ...controlProps,
          'aria-describedby': mergeDescribedBy(
            childElement.props['aria-describedby'],
            controlProps['aria-describedby']
          ),
          'aria-invalid': controlProps['aria-invalid'] ?? childElement.props['aria-invalid'],
          id: controlProps.id,
        })
      : children;
  const isCheckboxField = childElement ? isCheckboxElement(childElement) : false;

  return (
    <div className={cn('space-y-1', className)}>
      {isCheckboxField ? (
        <div className="flex items-center gap-3">
          <label htmlFor={resolvedControlId} className="text-sm font-medium leading-none">
            {label}
            {required ? <span aria-hidden="true" className="ml-1 before:content-['*']" /> : null}
          </label>
          {resolvedChildren}
        </div>
      ) : (
        <>
          <label htmlFor={resolvedControlId} className="text-sm font-medium">
            {label}
            {required ? <span aria-hidden="true" className="ml-1 before:content-['*']" /> : null}
          </label>
          {resolvedChildren}
        </>
      )}
      {description ? (
        <p id={resolvedDescriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={resolvedErrorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export type StudioFieldGroupProps = Readonly<{
  children: React.ReactNode;
  columns?: 1 | 2;
  className?: string;
}>;

export function StudioFieldGroup({ children, columns = 1, className }: StudioFieldGroupProps) {
  return (
    <div className={cn(columns === 2 ? 'grid gap-4 md:grid-cols-2' : 'grid gap-4', className)}>
      {children}
    </div>
  );
}

export type StudioFormSummaryProps = Readonly<{
  kind: 'success' | 'error';
  children: React.ReactNode;
  className?: string;
}>;

export function StudioFormSummary({ kind, children, className }: StudioFormSummaryProps) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(kind === 'error' ? 'text-destructive' : 'text-primary', className)}
    >
      {children}
    </p>
  );
}
