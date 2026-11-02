import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown } from 'lucide-react';
import { cn } from './utils.js';
import { Button } from './button.js';
import { Input } from './input.js';
import {
  findEnabledOptionIndex,
  getSearchableSelectOptionId,
  SearchableSelectOptionList,
  type SearchableSelectOption,
} from './searchable-select-option-list.js';

export const SearchableSelectTrigger = ({
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

type SearchableSelectPopoverProps = Readonly<{
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
}>;

const onSearchInputKeyDown = (
  event: React.KeyboardEvent<HTMLInputElement>,
  {
    activeIndex,
    clearLabel,
    close,
    filteredOptions,
    onValueChange,
    setActiveIndex,
  }: SearchableSelectPopoverProps
) => {
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
};

const SearchableSelectSearchInput = (props: SearchableSelectPopoverProps) => {
  const {
    activeIndex,
    filteredOptions,
    id,
    inputRef,
    searchInputId,
    searchPlaceholder,
    searchValue,
    setSearch,
  } = props;
  return (
    <Input
      ref={inputRef}
      id={searchInputId}
      role="combobox"
      value={searchValue}
      onChange={(event) => setSearch(event.target.value)}
      onKeyDown={(event) => onSearchInputKeyDown(event, props)}
      placeholder={searchPlaceholder}
      aria-label={searchPlaceholder}
      aria-autocomplete="list"
      aria-controls={`${id}-listbox`}
      aria-expanded="true"
      aria-activedescendant={
        filteredOptions[activeIndex] ? getSearchableSelectOptionId(id, activeIndex) : undefined
      }
    />
  );
};

export const SearchableSelectPopover = (props: SearchableSelectPopoverProps) => {
  const {
    activeIndex,
    close,
    emptyText,
    clearLabel,
    filteredOptions,
    id,
    inputRef,
    label,
    onValueChange,
    selectedValue,
  } = props;

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
        <SearchableSelectSearchInput {...props} />
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
