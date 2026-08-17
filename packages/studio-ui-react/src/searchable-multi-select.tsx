import * as React from 'react';

import {
  SearchableMultiSelectOptions,
  SearchableMultiSelectSelection,
  SearchableMultiSelectTrigger,
} from './searchable-multi-select.parts.js';

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
  if (normalizedSearch.length === 0) return true;
  return [option.label, ...(option.keywords ?? [])].some((candidate) =>
    candidate.toLocaleLowerCase().includes(normalizedSearch)
  );
};

const useSelectionState = (
  options: readonly SearchableMultiSelectOption[],
  value: readonly string[],
  onValueChange: (value: string[]) => void
) => {
  const normalizedOptions = React.useMemo(() => normalizeOptions(options), [options]);
  const normalizedValue = React.useMemo(() => normalizeValues(value), [value]);
  const selectedValues = React.useMemo(() => new Set(normalizedValue), [normalizedValue]);
  const optionByValue = React.useMemo(
    () => new Map(normalizedOptions.map((option) => [option.value, option])),
    [normalizedOptions]
  );
  const toggleValue = React.useCallback(
    (optionValue: string) => {
      const nextValue = selectedValues.has(optionValue)
        ? normalizedValue.filter((selectedValue) => selectedValue !== optionValue)
        : [...normalizedValue, optionValue];
      onValueChange(nextValue);
    },
    [normalizedValue, onValueChange, selectedValues]
  );
  const removeValue = React.useCallback(
    (optionValue: string) => {
      onValueChange(normalizedValue.filter((selectedValue) => selectedValue !== optionValue));
    },
    [normalizedValue, onValueChange]
  );

  return {
    normalizedOptions,
    normalizedValue,
    optionByValue,
    removeValue,
    selectedValues,
    toggleValue,
  };
};

const useOpenState = (
  rootRef: React.RefObject<HTMLDivElement | null>,
  triggerRef: React.RefObject<HTMLButtonElement | null>
) => {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const close = React.useCallback(
    (focusTrigger = false) => {
      setOpen(false);
      setSearchValue('');
      if (focusTrigger) triggerRef.current?.focus();
    },
    [triggerRef]
  );

  React.useEffect(() => {
    if (open) searchInputRef.current?.focus();
  }, [open]);
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [close, open, rootRef]);

  return { close, open, searchInputRef, searchValue, setOpen, setSearchValue };
};

export function SearchableMultiSelect(props: SearchableMultiSelectProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const selection = useSelectionState(props.options, props.value, props.onValueChange);
  const dropdown = useOpenState(rootRef, triggerRef);
  const filteredOptions = selection.normalizedOptions.filter((option) =>
    optionMatchesSearch(option, dropdown.searchValue)
  );
  const interactionDisabled = Boolean(props.disabled || props.loading || props.errorMessage);

  return (
    <div
      ref={rootRef}
      className="relative space-y-3"
      onBlurCapture={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) dropdown.close();
      }}
      onKeyDownCapture={(event) => {
        if (event.key === 'Escape' && dropdown.open) {
          event.preventDefault();
          dropdown.close(true);
        }
      }}
    >
      <div className="space-y-2">
        <SearchableMultiSelectTrigger
          disabled={interactionDisabled}
          id={props.id}
          open={dropdown.open}
          optionByValue={selection.optionByValue}
          placeholder={props.placeholder}
          triggerRef={triggerRef}
          value={selection.normalizedValue}
          onToggle={() => (dropdown.open ? dropdown.close() : dropdown.setOpen(true))}
        />
        {dropdown.open ? (
          <SearchableMultiSelectOptions
            emptyText={props.emptyText}
            id={props.id}
            options={filteredOptions}
            placeholder={props.placeholder}
            searchInputRef={dropdown.searchInputRef}
            searchLabel={props.searchLabel}
            searchValue={dropdown.searchValue}
            selectedValues={selection.selectedValues}
            onSearchValueChange={dropdown.setSearchValue}
            onToggleValue={selection.toggleValue}
          />
        ) : null}
        <p className="text-sm text-foreground">
          {props.loading ? props.loadingText : props.helpText}
        </p>
        {props.errorMessage ? (
          <p className="text-sm text-destructive">{props.errorMessage}</p>
        ) : null}
      </div>
      <SearchableMultiSelectSelection
        disabled={props.disabled ?? false}
        loading={props.loading}
        errorMessage={props.errorMessage}
        optionByValue={selection.optionByValue}
        removeLabel={props.removeLabel}
        unavailableText={props.unavailableText}
        value={selection.normalizedValue}
        onRemoveValue={selection.removeValue}
      />
    </div>
  );
}
