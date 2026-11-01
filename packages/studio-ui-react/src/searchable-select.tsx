import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown } from 'lucide-react';

import { cn } from './utils.js';

import { Button } from './button.js';
import { Input } from './input.js';
import {
  filterSearchableSelectOptions,
  findEnabledOptionIndex,
  getSearchableSelectOptionId,
  SearchableSelectOptionList,
  type SearchableSelectOption,
} from './searchable-select-option-list.js';

type SearchableSelectBaseProps = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly placeholder: string;
  readonly searchPlaceholder: string;
  readonly emptyText: string;
  readonly clearLabel?: string;
  readonly options: readonly SearchableSelectOption[];
  readonly showLabel?: boolean;
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

export type SearchableSelectProps = SearchableSelectBaseProps &
  (SearchableSelectControlledSearchProps | SearchableSelectUncontrolledSearchProps);

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
    <Popover.Anchor asChild>
      <Button
        ref={triggerRef}
        id={id}
        type="button"
        variant="secondary"
        className={cn(
          'min-h-11 w-full justify-between bg-surface-inset px-3 text-sm font-normal',
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
        <ChevronDown
          aria-hidden="true"
          strokeWidth={1}
          className={cn('h-4 w-4 shrink-0', open && 'rotate-180')}
        />
      </Button>
    </Popover.Anchor>
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
      selectedIndex >= 0 && !filteredOptions[selectedIndex]?.disabled
        ? selectedIndex
        : findEnabledOptionIndex(filteredOptions, 0, 1)
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
  clearLabel,
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
  clearLabel?: string;
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
      if (event.key === 'Tab' && (event.shiftKey || !clearLabel)) {
        if (event.shiftKey) event.preventDefault();
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
    [activeIndex, clearLabel, close, filteredOptions, onValueChange, setActiveIndex]
  );

  return (
    <Popover.Portal>
      <Popover.Content
        align="start"
        sideOffset={8}
        collisionPadding={16}
        aria-label={label}
        className="z-50 max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-border-subtle bg-popover p-2 text-popover-foreground shadow-shell"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          close({ focusTrigger: true });
        }}
        onInteractOutside={(event) => {
          if (document.getElementById(id)?.contains(event.target as Node)) event.preventDefault();
        }}
      >
        <Input
          ref={inputRef}
          id={searchInputId}
          role="combobox"
          value={searchValue}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={onSearchInputKeyDown}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          aria-autocomplete="list"
          aria-controls={`${id}-listbox`}
          aria-expanded="true"
          aria-activedescendant={
            filteredOptions[activeIndex] ? getSearchableSelectOptionId(id, activeIndex) : undefined
          }
        />
        {clearLabel ? (
          <Button
            type="button"
            variant="tertiary"
            className="mt-2 w-full justify-start"
            onKeyDown={(event) => {
              if (event.key === 'Tab' && !event.shiftKey) close({ focusTrigger: true });
            }}
            onClick={() => {
              onValueChange('');
              close({ focusTrigger: true });
            }}
          >
            {clearLabel}
          </Button>
        ) : null}
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
      </Popover.Content>
    </Popover.Portal>
  );
};

export const SearchableSelect = ({
  id,
  label,
  value,
  placeholder,
  searchPlaceholder,
  emptyText,
  clearLabel,
  options,
  showLabel = true,
  disabled = false,
  ariaInvalid,
  describedBy,
  selectedOption,
  searchValue,
  onSearchValueChange,
  onValueChange,
}: SearchableSelectProps) => {
  const [open, setOpen] = React.useState(false);
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
    if (disabled && open) close();
  }, [close, disabled, open]);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen) => (nextOpen ? openWithActiveOption() : close())}
    >
      <div className="relative grid gap-1 text-sm text-foreground">
        {showLabel ? <label htmlFor={id}>{label}</label> : null}
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
            clearLabel={clearLabel}
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
    </Popover.Root>
  );
};
