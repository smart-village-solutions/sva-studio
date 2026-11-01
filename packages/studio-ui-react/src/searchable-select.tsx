import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { SearchableSelectPopover, SearchableSelectTrigger } from './searchable-select-popover.js';
import {
  filterSearchableSelectOptions,
  findEnabledOptionIndex,
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

export const SearchableSelect = (props: SearchableSelectProps) => {
  const { id, value, options, selectedOption, disabled = false, showLabel = true } = props;
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
  } = useSearchableSelectState({ ...props, setOpen });

  React.useEffect(() => {
    if (disabled && open) close();
  }, [close, disabled, open]);

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen) => (nextOpen ? openWithActiveOption() : close())}
    >
      <div className="relative grid gap-1 text-sm text-foreground">
        {showLabel ? <label htmlFor={id}>{props.label}</label> : null}
        <SearchableSelectTrigger
          close={() => {
            close();
          }}
          {...props}
          disabled={disabled}
          listboxId={listboxId}
          open={open}
          openWithActiveOption={openWithActiveOption}
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
            {...props}
            filteredOptions={filteredOptions}
            id={id}
            inputRef={inputRef}
            searchInputId={searchInputId}
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
