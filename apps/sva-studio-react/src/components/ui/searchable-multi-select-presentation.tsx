import * as React from 'react';

import { cn } from '@/lib/utils';

import { Button } from '@sva/studio-ui-react';
import { Input } from './input';
import type { SearchableSelectOption } from './searchable-select-option-list';

export const SearchableMultiSelectTrigger = ({
  close,
  disabled,
  id,
  label,
  listboxId,
  open,
  placeholder,
  selectedCountText,
  setOpen,
  triggerRef,
  valueCount,
}: Readonly<{
  close: () => void;
  disabled: boolean;
  id: string;
  label: string;
  listboxId: string;
  open: boolean;
  placeholder: string;
  selectedCountText: string;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  valueCount: number;
}>) => (
  <Button
    ref={triggerRef}
    id={id}
    type="button"
    variant="secondary"
    className={cn(
      'h-10 w-full justify-between px-3 text-sm font-normal',
      valueCount ? undefined : 'text-muted-foreground'
    )}
    aria-label={label}
    aria-expanded={open}
    aria-haspopup="listbox"
    aria-controls={open ? listboxId : undefined}
    disabled={disabled}
    onClick={() => (open ? close() : setOpen(true))}
    onKeyDown={(event) => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(true);
      }
    }}
  >
    <span className="truncate">{valueCount ? selectedCountText : placeholder}</span>
    <span aria-hidden="true" className="text-xs text-muted-foreground">
      {open ? '▲' : '▼'}
    </span>
  </Button>
);

export const SearchableMultiSelectValues = ({
  disabled,
  options,
  removeValueLabel,
  selectedCountText,
  toggleValue,
}: Readonly<{
  disabled: boolean;
  options: readonly SearchableSelectOption[];
  removeValueLabel: (label: string) => string;
  selectedCountText: string;
  toggleValue: (value: string) => void;
}>) => {
  if (!options.length) {
    return null;
  }
  return (
    <ul className="mt-1 flex flex-wrap gap-2" aria-label={selectedCountText}>
      {options.map((option) => (
        <li key={option.value}>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-auto max-w-full gap-2 rounded-full py-1"
            aria-label={removeValueLabel(option.label)}
            disabled={disabled}
            onClick={() => toggleValue(option.value)}
          >
            <span className="truncate">{option.label}</span>
            <span aria-hidden="true">×</span>
          </Button>
        </li>
      ))}
    </ul>
  );
};

const SearchableMultiSelectOptions = ({
  activeIndex,
  emptyText,
  id,
  label,
  options,
  selectedValues,
  toggleValue,
}: Readonly<{
  activeIndex: number;
  emptyText: string;
  id: string;
  label: string;
  options: readonly SearchableSelectOption[];
  selectedValues: ReadonlySet<string>;
  toggleValue: (value: string) => void;
}>) => (
  <ul
    id={`${id}-listbox`}
    role="listbox"
    aria-label={label}
    aria-multiselectable="true"
    className="mt-2 max-h-60 space-y-1 overflow-y-auto"
  >
    {options.length ? (
      options.map((option, index) => {
        const selected = selectedValues.has(option.value);
        return (
          <li key={option.value} role="presentation">
            <button
              id={`${id}-option-${index}`}
              type="button"
              role="option"
              aria-selected={selected}
              className={cn(
                'w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                index === activeIndex || selected
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-foreground'
              )}
              onClick={() => toggleValue(option.value)}
            >
              {option.label}
            </button>
          </li>
        );
      })
    ) : (
      <li role="presentation" className="px-3 py-2 text-sm text-muted-foreground">
        {emptyText}
      </li>
    )}
  </ul>
);

export const SearchableMultiSelectPopover = ({
  activeIndex,
  emptyText,
  filteredOptions,
  id,
  inputRef,
  label,
  listboxId,
  onSearchKeyDown,
  searchPlaceholder,
  searchValue,
  selectedValues,
  setSearch,
  toggleValue,
}: Readonly<{
  activeIndex: number;
  emptyText: string;
  filteredOptions: readonly SearchableSelectOption[];
  id: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  label: string;
  listboxId: string;
  onSearchKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  searchPlaceholder: string;
  searchValue: string;
  selectedValues: ReadonlySet<string>;
  setSearch: (value: string) => void;
  toggleValue: (value: string) => void;
}>) => (
  <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-lg border border-border bg-popover p-2 shadow-shell">
    <Input
      ref={inputRef}
      id={`${id}-search-input`}
      value={searchValue}
      onChange={(event) => setSearch(event.target.value)}
      onKeyDown={onSearchKeyDown}
      placeholder={searchPlaceholder}
      aria-label={searchPlaceholder}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded="true"
      aria-controls={listboxId}
      aria-activedescendant={
        filteredOptions[activeIndex] ? `${id}-option-${activeIndex}` : undefined
      }
    />
    <SearchableMultiSelectOptions
      activeIndex={activeIndex}
      emptyText={emptyText}
      id={id}
      label={label}
      options={filteredOptions}
      selectedValues={selectedValues}
      toggleValue={toggleValue}
    />
  </div>
);
