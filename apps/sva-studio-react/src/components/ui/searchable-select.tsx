import * as React from 'react';

import { cn } from '@/lib/utils';

import { Button } from '@sva/studio-ui-react';
import { Input } from './input';
import {
  getSearchableSelectOptionId,
  SearchableSelectOptionList,
  type SearchableSelectOption,
} from './searchable-select-option-list';

type SearchableSelectBaseProps = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly placeholder: string;
  readonly searchPlaceholder: string;
  readonly emptyText: string;
  readonly options: readonly SearchableSelectOption[];
  readonly disabled?: boolean;
  readonly ariaInvalid?: boolean;
  readonly describedBy?: string;
  readonly selectedOption?: SearchableSelectOption | null;
  readonly onValueChange: (value: string) => void;
};

type SearchableSelectControlledSearchProps = {
  readonly searchValue: string;
  readonly onSearchValueChange: (value: string) => void;
};

type SearchableSelectUncontrolledSearchProps = {
  readonly searchValue?: undefined;
  readonly onSearchValueChange?: undefined;
};

type SearchableSelectProps = SearchableSelectBaseProps &
  (SearchableSelectControlledSearchProps | SearchableSelectUncontrolledSearchProps);

const normalizeSearch = (value: string) => value.trim().toLocaleLowerCase();
export const matchesSearchableSelectOption = (option: SearchableSelectOption, search: string) => {
  const normalizedSearch = normalizeSearch(search);
  if (!normalizedSearch) {
    return true;
  }

  return [option.label, ...(option.keywords ?? [])].some((value) =>
    value.toLocaleLowerCase().includes(normalizedSearch)
  );
};

const findEnabledOptionIndex = (
  options: readonly SearchableSelectOption[],
  start: number,
  direction: 1 | -1
): number => {
  for (let index = start; index >= 0 && index < options.length; index += direction) {
    if (!options[index]?.disabled) return index;
  }
  return Math.max(0, Math.min(start, options.length - 1));
};

export const filterSearchableSelectOptions = (
  options: readonly SearchableSelectOption[],
  searchValue: string
) => options.filter((option) => matchesSearchableSelectOption(option, searchValue));

const SearchableSelectTrigger = ({
  close,
  disabled,
  ariaInvalid,
  describedBy,
  label,
  listboxId,
  open,
  openWithActiveOption,
  placeholder,
  selectedLabel,
  triggerRef,
  id,
}: Readonly<{
  close: () => void;
  disabled: boolean;
  ariaInvalid?: boolean;
  describedBy?: string;
  id: string;
  label: string;
  listboxId: string;
  open: boolean;
  openWithActiveOption: () => void;
  placeholder: string;
  selectedLabel?: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}>) => {
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
    <Button
      ref={triggerRef}
      id={id}
      type="button"
      variant="secondary"
      className={cn(
        'h-10 w-full justify-between px-3 text-sm font-normal',
        !selectedLabel ? 'text-muted-foreground' : undefined
      )}
      aria-label={label}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={open ? listboxId : undefined}
      aria-invalid={ariaInvalid || undefined}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => (open ? close() : openWithActiveOption())}
      onKeyDown={onTriggerKeyDown}
    >
      <span className="truncate">{selectedLabel ?? placeholder}</span>
      <span aria-hidden="true" className="text-xs text-muted-foreground">
        {open ? '▲' : '▼'}
      </span>
    </Button>
  );
};

const useSearchableSelectState = ({
  onSearchValueChange,
  options,
  searchValue,
  setOpen,
  value,
}: Readonly<{
  onSearchValueChange?: (value: string) => void;
  options: readonly SearchableSelectOption[];
  searchValue?: string;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  value: string;
}>) => {
  const [internalSearchValue, setInternalSearchValue] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(0);
  const effectiveSearchValue = searchValue ?? internalSearchValue;
  const filteredOptions = React.useMemo(
    () => filterSearchableSelectOptions(options, effectiveSearchValue),
    [effectiveSearchValue, options]
  );

  React.useEffect(() => {
    if (!filteredOptions.length) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex((current) =>
      findEnabledOptionIndex(filteredOptions, Math.min(current, filteredOptions.length - 1), 1)
    );
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

  const close = React.useCallback(
    (options?: { focusTrigger?: boolean }) => {
      setOpen(false);
      setSearch('');
      return options;
    },
    [setOpen, setSearch]
  );

  const openWithActiveOption = React.useCallback(() => {
    const selectedIndex = filteredOptions.findIndex((option) => option.value === value);
    setActiveIndex(
      selectedIndex >= 0 ? selectedIndex : findEnabledOptionIndex(filteredOptions, 0, 1)
    );
    setOpen(true);
  }, [filteredOptions, setOpen, value]);

  return {
    activeIndex,
    close,
    effectiveSearchValue,
    filteredOptions,
    openWithActiveOption,
    setActiveIndex,
    setSearch,
  };
};

const SearchableSelectPopover = ({
  activeIndex,
  close,
  emptyText,
  filteredOptions,
  id,
  inputRef,
  label,
  onValueChange,
  searchInputId,
  searchPlaceholder,
  searchValue,
  selectedValue,
  setActiveIndex,
  setSearch,
}: Readonly<{
  activeIndex: number;
  close: (options?: { focusTrigger?: boolean }) => { focusTrigger?: boolean } | undefined;
  emptyText: string;
  filteredOptions: readonly SearchableSelectOption[];
  id: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  label: string;
  onValueChange: (value: string) => void;
  searchInputId: string;
  searchPlaceholder: string;
  searchValue: string;
  selectedValue: string;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  setSearch: (value: string) => void;
}>) => {
  const onSearchInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close({ focusTrigger: true });
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        const activeOption = filteredOptions[activeIndex];
        if (!activeOption || activeOption.disabled) {
          return;
        }

        onValueChange(activeOption.value);
        close({ focusTrigger: true });
        return;
      }

      if (!filteredOptions.length) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((current) => findEnabledOptionIndex(filteredOptions, current + 1, 1));
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((current) => findEnabledOptionIndex(filteredOptions, current - 1, -1));
        return;
      }
    },
    [activeIndex, close, filteredOptions, onValueChange, setActiveIndex]
  );

  return (
    <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-lg border border-border bg-popover p-2 shadow-shell">
      <Input
        ref={inputRef}
        id={searchInputId}
        value={searchValue}
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={onSearchInputKeyDown}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        aria-activedescendant={
          filteredOptions[activeIndex] ? getSearchableSelectOptionId(id, activeIndex) : undefined
        }
      />
      <SearchableSelectOptionList
        activeIndex={activeIndex}
        close={close}
        emptyText={emptyText}
        filteredOptions={filteredOptions}
        id={id}
        label={label}
        onValueChange={onValueChange}
        selectedValue={selectedValue}
      />
    </div>
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
  ariaInvalid,
  describedBy,
  selectedOption,
  searchValue,
  onSearchValueChange,
  onValueChange,
}: SearchableSelectProps) => {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const listboxId = `${id}-listbox`;
  const searchInputId = `${id}-search-input`;
  const effectiveSelectedOption =
    selectedOption ?? options.find((option) => option.value === value) ?? null;
  const {
    activeIndex,
    close,
    effectiveSearchValue,
    filteredOptions,
    openWithActiveOption,
    setActiveIndex,
    setSearch,
  } = useSearchableSelectState({ onSearchValueChange, options, searchValue, setOpen, value });

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
      <SearchableSelectTrigger
        close={() => {
          close();
        }}
        disabled={disabled}
        ariaInvalid={ariaInvalid}
        describedBy={describedBy}
        id={id}
        label={label}
        listboxId={listboxId}
        open={open}
        openWithActiveOption={openWithActiveOption}
        placeholder={placeholder}
        selectedLabel={effectiveSelectedOption?.label}
        triggerRef={triggerRef}
      />

      {open ? (
        <SearchableSelectPopover
          activeIndex={activeIndex}
          close={(options) => {
            const result = close(options);
            if (options?.focusTrigger) {
              triggerRef.current?.focus();
            }
            return result;
          }}
          emptyText={emptyText}
          filteredOptions={filteredOptions}
          id={id}
          inputRef={inputRef}
          label={label}
          onValueChange={onValueChange}
          searchInputId={searchInputId}
          searchPlaceholder={searchPlaceholder}
          searchValue={effectiveSearchValue}
          selectedValue={value}
          setActiveIndex={setActiveIndex}
          setSearch={setSearch}
        />
      ) : null}
    </div>
  );
};
