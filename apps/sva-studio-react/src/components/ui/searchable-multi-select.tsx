import * as React from 'react';

import { filterSearchableSelectOptions } from './searchable-select';
import {
  SearchableMultiSelectPopover,
  SearchableMultiSelectTrigger,
  SearchableMultiSelectValues,
} from './searchable-multi-select-presentation';
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

const useSearchableMultiSelectState = ({
  onSearchValueChange,
  onValuesChange,
  options,
  searchValue,
  values,
}: Pick<
  SearchableMultiSelectProps,
  'onSearchValueChange' | 'onValuesChange' | 'options' | 'searchValue' | 'values'
>) => {
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

  const onSearchKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
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
    },
    [activeIndex, close, filteredOptions, toggleValue]
  );

  return {
    activeIndex,
    close,
    effectiveSearchValue,
    filteredOptions,
    inputRef,
    onSearchKeyDown,
    open,
    rootRef,
    selectedValues,
    setOpen,
    setSearch,
    toggleValue,
    triggerRef,
  };
};

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
  const state = useSearchableMultiSelectState({
    onSearchValueChange,
    onValuesChange,
    options,
    searchValue,
    values,
  });
  const listboxId = `${id}-listbox`;
  const labelId = `${id}-label`;
  return (
    <div
      ref={state.rootRef}
      className="relative grid gap-1 text-sm text-foreground"
      onBlurCapture={(event) => {
        if (!state.rootRef.current?.contains(event.relatedTarget as Node | null)) {
          state.close();
        }
      }}
    >
      <span id={labelId}>{label}</span>
      <SearchableMultiSelectTrigger
        close={state.close}
        disabled={disabled}
        id={id}
        labelId={labelId}
        listboxId={listboxId}
        open={state.open}
        placeholder={placeholder}
        selectedCountText={selectedCountText}
        setOpen={state.setOpen}
        triggerRef={state.triggerRef}
        valueCount={values.length}
      />
      <SearchableMultiSelectValues
        disabled={disabled}
        options={selectedOptions}
        removeValueLabel={removeValueLabel}
        selectedCountText={selectedCountText}
        toggleValue={state.toggleValue}
      />
      {state.open ? (
        <SearchableMultiSelectPopover
          activeIndex={state.activeIndex}
          emptyText={emptyText}
          filteredOptions={state.filteredOptions}
          id={id}
          inputRef={state.inputRef}
          label={label}
          listboxId={listboxId}
          onSearchKeyDown={state.onSearchKeyDown}
          searchPlaceholder={searchPlaceholder}
          searchValue={state.effectiveSearchValue}
          selectedValues={state.selectedValues}
          setSearch={state.setSearch}
          toggleValue={state.toggleValue}
        />
      ) : null}
    </div>
  );
};
