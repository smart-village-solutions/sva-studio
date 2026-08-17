import { X } from 'lucide-react';
import type * as React from 'react';

import { Badge } from './badge.js';
import { Button } from './button.js';
import { Checkbox } from './checkbox.js';
import { Input } from './input.js';
import type { SearchableMultiSelectOption } from './searchable-multi-select.js';
import { cn } from './utils.js';

type TriggerProps = Readonly<{
  disabled: boolean;
  id: string;
  onToggle: () => void;
  open: boolean;
  optionByValue: ReadonlyMap<string, SearchableMultiSelectOption>;
  placeholder: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  value: readonly string[];
}>;

export function SearchableMultiSelectTrigger({
  disabled,
  id,
  onToggle,
  open,
  optionByValue,
  placeholder,
  triggerRef,
  value,
}: TriggerProps) {
  const labels = value.map(
    (selectedValue) => optionByValue.get(selectedValue)?.label ?? selectedValue
  );
  return (
    <Button
      ref={triggerRef}
      id={id}
      type="button"
      variant="secondary"
      className="h-10 w-full justify-between px-3 text-sm font-normal"
      aria-controls={open ? `${id}-options` : undefined}
      aria-expanded={open}
      aria-haspopup="true"
      disabled={disabled}
      onClick={onToggle}
    >
      <span className={cn('truncate', labels.length === 0 ? 'text-muted-foreground' : undefined)}>
        {labels.length > 0 ? labels.join(', ') : placeholder}
      </span>
      <span aria-hidden="true" className="text-xs text-muted-foreground">
        {open ? '▲' : '▼'}
      </span>
    </Button>
  );
}

type OptionsProps = Readonly<{
  emptyText: string;
  id: string;
  onSearchValueChange: (value: string) => void;
  onToggleValue: (value: string) => void;
  options: readonly SearchableMultiSelectOption[];
  placeholder: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  searchLabel: string;
  searchValue: string;
  selectedValues: ReadonlySet<string>;
}>;

export function SearchableMultiSelectOptions(props: OptionsProps) {
  return (
    <div
      id={`${props.id}-options`}
      className="absolute left-0 right-0 z-20 mt-2 rounded-lg border border-border bg-popover p-2 shadow-shell"
    >
      <Input
        ref={props.searchInputRef}
        id={`${props.id}-search`}
        value={props.searchValue}
        onChange={(event) => props.onSearchValueChange(event.currentTarget.value)}
        placeholder={props.placeholder}
        aria-label={props.searchLabel}
      />
      <fieldset className="mt-2 max-h-64 space-y-1 overflow-y-auto">
        <legend className="sr-only">{props.searchLabel}</legend>
        {props.options.length > 0 ? (
          props.options.map((option, index) => {
            const optionId = `${props.id}-option-${index}`;
            return (
              <label
                key={option.value}
                htmlFor={optionId}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-popover-foreground hover:bg-muted"
              >
                <Checkbox
                  id={optionId}
                  checked={props.selectedValues.has(option.value)}
                  onChange={() => props.onToggleValue(option.value)}
                />
                <span>{option.label}</span>
              </label>
            );
          })
        ) : (
          <p className="px-3 py-4 text-sm text-muted-foreground">{props.emptyText}</p>
        )}
      </fieldset>
    </div>
  );
}

type SelectionProps = Readonly<{
  disabled: boolean;
  errorMessage?: string;
  loading: boolean;
  onRemoveValue: (value: string) => void;
  optionByValue: ReadonlyMap<string, SearchableMultiSelectOption>;
  removeLabel: (label: string) => string;
  unavailableText: string;
  value: readonly string[];
}>;

export function SearchableMultiSelectSelection(props: SelectionProps) {
  if (props.value.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {props.value.map((selectedValue) => {
        const option = props.optionByValue.get(selectedValue);
        const unavailable = !props.loading && !props.errorMessage && !option;
        const label = option?.label ?? selectedValue;
        return (
          <Badge
            key={selectedValue}
            variant="outline"
            className={cn(
              'flex items-center gap-2 px-3 py-1',
              unavailable ? 'border-dashed' : undefined
            )}
          >
            <span>{label}</span>
            {unavailable ? (
              <span className="text-xs text-muted-foreground">({props.unavailableText})</span>
            ) : null}
            <button
              type="button"
              className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={props.removeLabel(label)}
              disabled={props.disabled}
              onClick={() => props.onRemoveValue(selectedValue)}
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </Badge>
        );
      })}
    </div>
  );
}
