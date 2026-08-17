import * as React from 'react';

import { cn } from '@/lib/utils';

import { Button } from '@sva/studio-ui-react';
import { Input } from './input';
import { filterSearchableSelectOptions } from './searchable-select';
import type { SearchableSelectOption } from './searchable-select-option-list';

type SearchableMultiSelectBaseProps = {
  readonly id: string;
  readonly label: string;
  readonly values: readonly string[];
  readonly placeholder: string;
  readonly selectedCountText: string;
  readonly searchPlaceholder: string;
  readonly emptyText: string;
  readonly options: readonly SearchableSelectOption[];
  readonly selectedOptions: readonly SearchableSelectOption[];
  readonly removeValueLabel: (label: string) => string;
  readonly disabled?: boolean;
  readonly onValuesChange: (values: readonly string[]) => void;
};

type ControlledSearchProps = {
  readonly searchValue: string;
  readonly onSearchValueChange: (value: string) => void;
};

type UncontrolledSearchProps = {
  readonly searchValue?: undefined;
  readonly onSearchValueChange?: undefined;
};

type SearchableMultiSelectProps = SearchableMultiSelectBaseProps &
  (ControlledSearchProps | UncontrolledSearchProps);

export const SearchableMultiSelect = ({
  id,
  label,
  values,
  placeholder,
  selectedCountText,
  searchPlaceholder,
  emptyText,
  options,
  selectedOptions,
  removeValueLabel,
  disabled = false,
  searchValue,
  onSearchValueChange,
  onValuesChange,
}: SearchableMultiSelectProps) => {
  const [open, setOpen] = React.useState(false);
  const [internalSearchValue, setInternalSearchValue] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const effectiveSearchValue = searchValue ?? internalSearchValue;
  const filteredOptions = React.useMemo(
    () => filterSearchableSelectOptions(options, effectiveSearchValue),
    [effectiveSearchValue, options]
  );
  const selectedValues = React.useMemo(() => new Set(values), [values]);
  const listboxId = `${id}-listbox`;

  const setSearch = React.useCallback(
    (value: string) => {
      if (onSearchValueChange) {
        onSearchValueChange(value);
        return;
      }
      setInternalSearchValue(value);
    },
    [onSearchValueChange]
  );

  const close = React.useCallback(
    (focusTrigger = false) => {
      setOpen(false);
      setSearch('');
      if (focusTrigger) {
        triggerRef.current?.focus();
      }
    },
    [setSearch]
  );

  const toggleValue = React.useCallback(
    (value: string) => {
      onValuesChange(
        selectedValues.has(value)
          ? values.filter((selectedValue) => selectedValue !== value)
          : [...values, value]
      );
    },
    [onValuesChange, selectedValues, values]
  );

  React.useEffect(() => {
    setActiveIndex((current) =>
      filteredOptions.length ? Math.min(current, filteredOptions.length - 1) : 0
    );
  }, [filteredOptions]);

  React.useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        close();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [close, open]);

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = filteredOptions[activeIndex];
      if (option) {
        toggleValue(option.value);
      }
      return;
    }
    if (event.key === 'ArrowDown' && filteredOptions.length) {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, filteredOptions.length - 1));
      return;
    }
    if (event.key === 'ArrowUp' && filteredOptions.length) {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    }
  };

  return (
    <div
      ref={rootRef}
      className="relative grid gap-1 text-sm text-foreground"
      onBlurCapture={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
          close();
        }
      }}
    >
      <label htmlFor={id}>{label}</label>
      <Button
        ref={triggerRef}
        id={id}
        type="button"
        variant="secondary"
        className={cn(
          'h-10 w-full justify-between px-3 text-sm font-normal',
          values.length ? undefined : 'text-muted-foreground'
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
        <span className="truncate">{values.length ? selectedCountText : placeholder}</span>
        <span aria-hidden="true" className="text-xs text-muted-foreground">
          {open ? '▲' : '▼'}
        </span>
      </Button>

      {selectedOptions.length ? (
        <ul className="mt-1 flex flex-wrap gap-2" aria-label={selectedCountText}>
          {selectedOptions.map((option) => (
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
      ) : null}

      {open ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-lg border border-border bg-popover p-2 shadow-shell">
          <Input
            ref={inputRef}
            id={`${id}-search-input`}
            value={effectiveSearchValue}
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
          <ul
            id={listboxId}
            role="listbox"
            aria-label={label}
            aria-multiselectable="true"
            className="mt-2 max-h-60 space-y-1 overflow-y-auto"
          >
            {filteredOptions.length ? (
              filteredOptions.map((option, index) => {
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
        </div>
      ) : null}
    </div>
  );
};
