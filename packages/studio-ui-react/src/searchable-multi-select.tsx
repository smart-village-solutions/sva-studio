import { X } from 'lucide-react';
import * as React from 'react';

import { Badge } from './badge.js';
import { Button } from './button.js';
import { Checkbox } from './checkbox.js';
import { Input } from './input.js';
import { cn } from './utils.js';

export type SearchableMultiSelectOption = Readonly<{
  label: string;
  value: string;
  keywords?: readonly string[];
}>;

export type SearchableMultiSelectProps = Readonly<{
  disabled?: boolean;
  emptyText: string;
  errorMessage?: string;
  helpText: string;
  id: string;
  loading: boolean;
  loadingText: string;
  onValueChange: (value: string[]) => void;
  options: readonly SearchableMultiSelectOption[];
  placeholder: string;
  removeLabel: (label: string) => string;
  searchLabel: string;
  unavailableText: string;
  value: readonly string[];
}>;

const normalizeValue = (value: string) => value.trim();

const normalizeValues = (values: readonly string[]) =>
  Array.from(new Set(values.map(normalizeValue).filter((value) => value.length > 0)));

const normalizeOptions = (options: readonly SearchableMultiSelectOption[]) => {
  const uniqueOptions = new Map<string, SearchableMultiSelectOption>();

  for (const option of options) {
    const value = normalizeValue(option.value);
    const label = option.label.trim();
    if (value.length > 0 && label.length > 0 && !uniqueOptions.has(value)) {
      uniqueOptions.set(value, { ...option, label, value });
    }
  }

  return Array.from(uniqueOptions.values());
};

const optionMatchesSearch = (option: SearchableMultiSelectOption, searchValue: string) => {
  const normalizedSearch = searchValue.trim().toLocaleLowerCase();
  if (normalizedSearch.length === 0) {
    return true;
  }

  return [option.label, ...(option.keywords ?? [])].some((candidate) =>
    candidate.toLocaleLowerCase().includes(normalizedSearch)
  );
};

export function SearchableMultiSelect({
  disabled = false,
  emptyText,
  errorMessage,
  helpText,
  id,
  loading,
  loadingText,
  onValueChange,
  options,
  placeholder,
  removeLabel,
  searchLabel,
  unavailableText,
  value,
}: SearchableMultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const normalizedOptions = React.useMemo(() => normalizeOptions(options), [options]);
  const normalizedValue = React.useMemo(() => normalizeValues(value), [value]);
  const selectedValues = React.useMemo(() => new Set(normalizedValue), [normalizedValue]);
  const optionByValue = React.useMemo(
    () => new Map(normalizedOptions.map((option) => [option.value, option])),
    [normalizedOptions]
  );
  const filteredOptions = React.useMemo(
    () => normalizedOptions.filter((option) => optionMatchesSearch(option, searchValue)),
    [normalizedOptions, searchValue]
  );
  const panelId = `${id}-options`;
  const searchInputId = `${id}-search`;
  const selectedLabels = normalizedValue.map(
    (selectedValue) => optionByValue.get(selectedValue)?.label ?? selectedValue
  );

  const close = React.useCallback((focusTrigger = false) => {
    setOpen(false);
    setSearchValue('');
    if (focusTrigger) {
      triggerRef.current?.focus();
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      searchInputRef.current?.focus();
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

  const toggleValue = React.useCallback(
    (optionValue: string) => {
      if (selectedValues.has(optionValue)) {
        onValueChange(normalizedValue.filter((selectedValue) => selectedValue !== optionValue));
        return;
      }

      onValueChange([...normalizedValue, optionValue]);
    },
    [normalizedValue, onValueChange, selectedValues]
  );

  const removeValue = React.useCallback(
    (optionValue: string) => {
      onValueChange(normalizedValue.filter((selectedValue) => selectedValue !== optionValue));
    },
    [normalizedValue, onValueChange]
  );

  const interactionDisabled = disabled || loading || Boolean(errorMessage);

  return (
    <div
      ref={rootRef}
      className="relative space-y-3"
      onBlurCapture={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
          close();
        }
      }}
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          close(true);
        }
      }}
    >
      <div className="space-y-2">
        <Button
          ref={triggerRef}
          id={id}
          type="button"
          variant="secondary"
          className="h-10 w-full justify-between px-3 text-sm font-normal"
          aria-controls={open ? panelId : undefined}
          aria-expanded={open}
          aria-haspopup="true"
          disabled={interactionDisabled}
          onClick={() => (open ? close() : setOpen(true))}
        >
          <span
            className={cn(
              'truncate',
              selectedLabels.length === 0 ? 'text-muted-foreground' : undefined
            )}
          >
            {selectedLabels.length > 0 ? selectedLabels.join(', ') : placeholder}
          </span>
          <span aria-hidden="true" className="text-xs text-muted-foreground">
            {open ? '▲' : '▼'}
          </span>
        </Button>

        {open ? (
          <div
            id={panelId}
            className="absolute left-0 right-0 z-20 mt-2 rounded-lg border border-border bg-popover p-2 shadow-shell"
          >
            <Input
              ref={searchInputRef}
              id={searchInputId}
              value={searchValue}
              onChange={(event) => setSearchValue(event.currentTarget.value)}
              placeholder={placeholder}
              aria-label={searchLabel}
            />
            <fieldset className="mt-2 max-h-64 space-y-1 overflow-y-auto">
              <legend className="sr-only">{searchLabel}</legend>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, index) => {
                  const optionId = `${id}-option-${index}`;
                  return (
                    <label
                      key={option.value}
                      htmlFor={optionId}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-popover-foreground hover:bg-muted"
                    >
                      <Checkbox
                        id={optionId}
                        checked={selectedValues.has(option.value)}
                        onChange={() => toggleValue(option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })
              ) : (
                <p className="px-3 py-4 text-sm text-muted-foreground">{emptyText}</p>
              )}
            </fieldset>
          </div>
        ) : null}

        <p className="text-sm text-foreground">{loading ? loadingText : helpText}</p>
        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
      </div>

      {normalizedValue.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {normalizedValue.map((selectedValue) => {
            const option = optionByValue.get(selectedValue);
            const unavailable = !loading && !errorMessage && !optionByValue.has(selectedValue);
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
                  <span className="text-xs text-muted-foreground">({unavailableText})</span>
                ) : null}
                <button
                  type="button"
                  className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={removeLabel(label)}
                  disabled={disabled}
                  onClick={() => removeValue(selectedValue)}
                >
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </Badge>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
