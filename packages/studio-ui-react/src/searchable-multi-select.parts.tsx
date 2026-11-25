import { IconChevronDown, IconX as X } from '@tabler/icons-react';
import type * as React from 'react';

import { Badge } from './badge.js';
import { Button } from './button.js';
import { Checkbox } from './checkbox.js';
import { Input } from './input.js';
import type { SearchableMultiSelectOption } from './searchable-multi-select.js';
import { cn } from './utils.js';

type TriggerProps = Readonly<{
  describedBy?: string;
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
  describedBy,
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
      className="h-10 w-full justify-between bg-surface-inset px-3 text-sm font-normal"
      aria-describedby={describedBy}
      aria-controls={open ? `${id}-options` : undefined}
      aria-expanded={open}
      aria-haspopup="dialog"
      disabled={disabled}
      onClick={onToggle}
    >
      <span className={cn('truncate', labels.length === 0 ? 'text-muted-foreground' : undefined)}>
        {labels.length > 0 ? labels.join(', ') : placeholder}
      </span>
      <IconChevronDown
        aria-hidden="true"
        className={cn('h-4 w-4 shrink-0 text-muted-foreground', open && 'rotate-180')}
      />
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
  panelRef: React.RefObject<HTMLDivElement | null>;
  searchLabel: string;
  searchValue: string;
  showSearch: boolean;
  selectedValues: ReadonlySet<string>;
}>;

export function SearchableMultiSelectOptions(props: OptionsProps) {
  return (
    <div
      ref={props.panelRef}
      id={`${props.id}-options`}
      role="dialog"
      tabIndex={-1}
      aria-label={props.placeholder}
      className="absolute left-0 right-0 z-20 mt-2 rounded-lg border border-border bg-popover p-2 shadow-shell"
    >
      {props.showSearch ? (
        <Input
          id={`${props.id}-search`}
          value={props.searchValue}
          onChange={(event) => props.onSearchValueChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) event.preventDefault();
          }}
          placeholder={props.placeholder}
          aria-label={props.searchLabel}
        />
      ) : null}
      <fieldset className={cn('max-h-60 space-y-1 overflow-y-auto', props.showSearch && 'mt-2')}>
        <legend className="sr-only">{props.searchLabel}</legend>
        {props.options.length > 0 ? (
          props.options.map((option, index) => {
            const optionId = `${props.id}-option-${index}`;
            return (
              <label
                key={option.value}
                htmlFor={optionId}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-popover-foreground hover:bg-muted"
                onMouseDown={(event) => {
                  if (event.target !== event.currentTarget.control) event.preventDefault();
                }}
              >
                <Checkbox
                  id={optionId}
                  aria-label={option.label}
                  checked={props.selectedValues.has(option.value)}
                  onChange={() => props.onToggleValue(option.value)}
                />
                {option.leadingVisual}
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
            {option?.leadingVisual}
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
