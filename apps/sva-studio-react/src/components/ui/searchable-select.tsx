import * as React from 'react';

import { cn } from '@/lib/utils';

import { Button } from './button';
import { Input } from './input';

type SearchableSelectOption = {
  readonly value: string;
  readonly label: string;
  readonly keywords?: readonly string[];
};

type SearchableSelectProps = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly placeholder: string;
  readonly searchPlaceholder: string;
  readonly emptyText: string;
  readonly options: readonly SearchableSelectOption[];
  readonly disabled?: boolean;
  readonly searchValue?: string;
  readonly onSearchValueChange?: (value: string) => void;
  readonly onValueChange: (value: string) => void;
};

const normalizeSearch = (value: string) => value.trim().toLocaleLowerCase();

const matchesOption = (option: SearchableSelectOption, search: string) => {
  const normalizedSearch = normalizeSearch(search);
  if (!normalizedSearch) {
    return true;
  }

  return [option.label, ...(option.keywords ?? [])].some((value) =>
    value.toLocaleLowerCase().includes(normalizedSearch)
  );
};

export const SearchableSelect = ({
  id,
  label,
  value,
  placeholder,
  searchPlaceholder,
  emptyText,
  options,
  disabled = false,
  searchValue,
  onSearchValueChange,
  onValueChange,
}: SearchableSelectProps) => {
  const [open, setOpen] = React.useState(false);
  const [internalSearchValue, setInternalSearchValue] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const listboxId = `${id}-listbox`;
  const searchInputId = `${id}-search-input`;
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const effectiveSearchValue = searchValue ?? internalSearchValue;
  const filteredOptions = React.useMemo(
    () => options.filter((option) => matchesOption(option, effectiveSearchValue)),
    [effectiveSearchValue, options]
  );

  React.useEffect(() => {
    if (!filteredOptions.length) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex((current) => Math.min(current, filteredOptions.length - 1));
  }, [filteredOptions]);

  const setSearch = React.useCallback(
    (nextValue: string) => {
      if (onSearchValueChange) {
        onSearchValueChange(nextValue);
        return;
      }

      setInternalSearchValue(nextValue);
    },
    [onSearchValueChange]
  );

  const close = React.useCallback((options?: { focusTrigger?: boolean }) => {
    setOpen(false);
    setSearch('');
    if (options?.focusTrigger) {
      triggerRef.current?.focus();
    }
  }, [setSearch]);

  const openWithActiveOption = React.useCallback(() => {
    const selectedIndex = filteredOptions.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }, [filteredOptions, value]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    inputRef.current?.focus();
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
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [close, open]);

  const onSearchInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close({ focusTrigger: true });
        return;
      }

      if (!filteredOptions.length) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((current) => Math.min(current + 1, filteredOptions.length - 1));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const activeOption = filteredOptions[activeIndex];
        if (!activeOption) {
          return;
        }

        onValueChange(activeOption.value);
        close({ focusTrigger: true });
      }
    },
    [activeIndex, close, filteredOptions, onValueChange]
  );

  const onTriggerKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openWithActiveOption();
      }
    },
    [openWithActiveOption]
  );

  return (
    <div ref={rootRef} className="relative grid gap-1 text-sm text-foreground">
      <label htmlFor={id}>{label}</label>
      <Button
        ref={triggerRef}
        id={id}
        type="button"
        variant="outline"
        className={cn(
          'h-10 w-full justify-between px-3 text-sm font-normal',
          !selectedOption ? 'text-muted-foreground' : undefined
        )}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : openWithActiveOption())}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="truncate">{selectedOption?.label ?? placeholder}</span>
        <span aria-hidden="true" className="text-xs text-muted-foreground">
          {open ? '▲' : '▼'}
        </span>
      </Button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-lg border border-border bg-popover p-2 shadow-shell">
          <Input
            ref={inputRef}
            id={searchInputId}
            value={effectiveSearchValue}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={onSearchInputKeyDown}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            aria-activedescendant={filteredOptions[activeIndex] ? `${id}-option-${activeIndex}` : undefined}
          />
          <ul id={listboxId} role="listbox" aria-label={label} className="mt-2 max-h-60 space-y-1 overflow-y-auto">
            {filteredOptions.length ? (
              filteredOptions.map((option, index) => {
                const selected = option.value === value;
                const active = index === activeIndex;

                return (
                  <li key={option.value}>
                    <button
                      id={`${id}-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={cn(
                        'w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        active || selected ? 'bg-muted font-medium text-foreground' : 'text-foreground'
                      )}
                      onClick={() => {
                        onValueChange(option.value);
                        close();
                      }}
                    >
                      {option.label}
                    </button>
                  </li>
                );
              })
            ) : (
              <li className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
};
