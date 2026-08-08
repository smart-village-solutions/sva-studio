import type { ChangeEvent } from 'react';

import { Input } from './input.js';
import { Select } from './select.js';
import { StudioField } from './studio-primitives.js';

export type MainserverPrincipalType = 'organization' | 'user';

export type MainserverPrincipalOption = Readonly<{
  value: MainserverPrincipalType;
  label: string;
}>;

export type MainserverPrincipalControlModel =
  | Readonly<{
      kind: 'fixed';
      value: MainserverPrincipalType;
      label: string;
    }>
  | Readonly<{
      kind: 'selectable';
      value: MainserverPrincipalType;
      options: readonly MainserverPrincipalOption[];
    }>;

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
  dataProviderLabel: string;
  dataProviderUnavailableLabel: string;
}>;

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
  dataProvider,
  dataProviderLabel,
  dataProviderUnavailableLabel,
}: MainserverPrincipalControlProps) => {
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextValue = event.target.value;
    if (nextValue === 'organization' || nextValue === 'user') {
      onChange(nextValue);
    }
  };

  return (
    <div className="space-y-4">
      <StudioField id={id} label={label} description={description}>
        {options.length > 1 ? (
          <Select id={id} value={value} onChange={handleChange}>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        ) : (
          <Input id={id} readOnly value={resolveOptionLabel(options, value)} />
        )}
      </StudioField>

      {dataProvider !== undefined ? (
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
