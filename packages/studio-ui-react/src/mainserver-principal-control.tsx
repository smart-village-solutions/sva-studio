import type { ChangeEvent } from 'react';

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
  description?: string;
  value: MainserverPrincipalType;
  options: readonly MainserverPrincipalOption[];
  onChange: (value: MainserverPrincipalType) => void;
  dataProvider?: Readonly<{ id?: string; name?: string }> | null;
  dataProviderLabel?: string;
  dataProviderUnavailableLabel?: string;
}> &
  ContextSelection;

const resolveOptionLabel = (
  options: readonly MainserverPrincipalOption[],
  value: MainserverPrincipalType
) => options.find((option) => option.value === value)?.label ?? value;

export const MainserverPrincipalControl = ({
  id,
  label,
  description,
  value,
  options,
  onChange,
  contextOptions = [],
  onContextChange,
  dataProvider,
  dataProviderLabel,
  dataProviderUnavailableLabel,
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
    </div>
  );
};
