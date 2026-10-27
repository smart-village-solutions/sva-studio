import type { ChangeEvent } from 'react';
import type { IamMainserverReadiness } from '@sva/core';

import { Input } from './input.js';
import { Select } from './select.js';
import { StudioField } from './studio-form-fields.js';

export type MainserverPrincipalType = 'organization' | 'user';

export type MainserverPrincipalOption = Readonly<{
  value: MainserverPrincipalType;
  label: string;
}>;

export type MainserverPrincipalContextOption = Readonly<{
  value: 'personal' | `organization:${string}`;
  label: string;
}>;

type ContextSelection = Readonly<{
  contextOptions?: readonly MainserverPrincipalContextOption[];
  onContextChange?: (value: MainserverPrincipalContextOption['value']) => void;
  readinessByPrincipal?: Readonly<Record<'organization' | 'user', IamMainserverReadiness>>;
  readinessMessage?: string;
  refreshContext?: () => Promise<void>;
}>;

export type MainserverPrincipalControlModel = (
  | Readonly<{
      kind: 'fixed';
      value: MainserverPrincipalType;
      label: string;
    }>
  | Readonly<{
      kind: 'selectable';
      value: MainserverPrincipalType;
      options: readonly MainserverPrincipalOption[];
    }>
) &
  ContextSelection;

export const isMainserverPrincipalReady = (
  control: MainserverPrincipalControlModel | undefined,
  principal: MainserverPrincipalType
): boolean =>
  !control || control.readinessByPrincipal?.[principal] === 'ready';

export const resolveMainserverPrincipalOptions = (
  control: MainserverPrincipalControlModel | undefined,
  fallback: MainserverPrincipalOption
): readonly MainserverPrincipalOption[] =>
  control?.kind === 'selectable'
    ? control.options
    : [{ value: control?.value ?? fallback.value, label: control?.label ?? fallback.label }];

export type MainserverPrincipalControlProps = Readonly<{
  id: string;
  label: string;
  fixedLabel?: string;
  description?: string;
  value: MainserverPrincipalType;
  options: readonly MainserverPrincipalOption[];
  onChange: (value: MainserverPrincipalType) => void;
  dataProvider?: Readonly<{ id?: string; name?: string }> | null;
  dataProviderLabel?: string;
  dataProviderUnavailableLabel?: string;
  readinessByPrincipal?: ContextSelection['readinessByPrincipal'];
  readinessMessage?: string;
}> &
  ContextSelection;

const resolveOptionLabel = (
  options: readonly MainserverPrincipalOption[],
  value: MainserverPrincipalType
) => options.find((option) => option.value === value)?.label ?? value;

export const MainserverPrincipalControl = ({
  id,
  label,
  fixedLabel,
  description,
  value,
  options,
  onChange,
  contextOptions = [],
  onContextChange,
  dataProvider,
  dataProviderLabel,
  dataProviderUnavailableLabel,
  readinessByPrincipal,
  readinessMessage,
}: MainserverPrincipalControlProps) => {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = event.target.value;
    if (nextValue === 'organization' || nextValue === 'user') {
      onChange(nextValue);
    } else if (contextOptions.some((option) => option.value === nextValue)) {
      onContextChange?.(nextValue as MainserverPrincipalContextOption['value']);
    }
  };

  return (
    <div className="space-y-4">
      {fixedLabel && options.length + contextOptions.length === 1 ? (
        <dl className="flex flex-wrap gap-x-2 text-sm">
          <dt className="text-muted-foreground">{fixedLabel}</dt>
          <dd className="font-medium">{resolveOptionLabel(options, value)}</dd>
        </dl>
      ) : (
        <StudioField id={id} label={label} description={description}>
          {options.length + contextOptions.length > 1 ? (
            <Select id={id} value={value} onChange={handleChange}>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              {contextOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input id={id} readOnly value={resolveOptionLabel(options, value)} />
          )}
        </StudioField>
      )}

      {dataProvider !== undefined && dataProviderLabel && dataProviderUnavailableLabel ? (
        <dl className="rounded-xl border border-border/60 bg-muted/20 p-4 text-sm">
          <div className="space-y-1">
            <dt className="font-medium text-foreground">{dataProviderLabel}</dt>
            <dd className="text-muted-foreground">
              {dataProvider?.name?.trim() ||
                dataProvider?.id?.trim() ||
                dataProviderUnavailableLabel}
            </dd>
          </div>
        </dl>
      ) : null}
      {readinessByPrincipal && readinessByPrincipal[value] !== 'ready' && readinessMessage ? (
        <p role="status" className="text-sm text-destructive" aria-live="polite">
          {readinessMessage}
        </p>
      ) : null}
    </div>
  );
};
