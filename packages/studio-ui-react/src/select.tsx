import * as React from 'react';
import * as Popover from '@radix-ui/react-popover';

import {
  visibleSelectOptionCount,
  type SearchableSelectOption,
} from './searchable-select-option-list.js';
import { SearchableSelectPopover } from './searchable-select-popover.js';
import { useSearchableSelectState } from './searchable-select.js';
import { cn } from './utils.js';

const emptyOptions: readonly SearchableSelectOption[] = [];

const SelectLabelsContext = React.createContext<Readonly<{
  empty: string;
  options: string;
  search: string;
}> | null>(null);
export const StudioSelectLabelsProvider = SelectLabelsContext.Provider;

const readOptions = (select: HTMLSelectElement): SearchableSelectOption[] =>
  Array.from(select.options).flatMap((option) => {
    const group = option.closest('optgroup');
    if (option.hidden || group?.hidden) return [];
    return [
      {
        value: option.value,
        label: option.label || option.text,
        disabled: option.disabled || group?.disabled,
        description: group?.label,
        keywords: group?.label ? [group.label] : undefined,
      },
    ];
  });

const readLabel = (select: HTMLSelectElement) => {
  const labelledBy = select.getAttribute('aria-labelledby')?.split(/\s+/);
  const referencedLabel = labelledBy
    ?.map((id) => select.ownerDocument.getElementById(id)?.textContent)
    .join(' ')
    .trim();
  const nativeLabel = Array.from(select.labels ?? [], (label) => {
    const copy = label.cloneNode(true) as HTMLLabelElement;
    copy.querySelectorAll('select').forEach((control) => control.remove());
    return copy.textContent?.trim();
  })
    .join(' ')
    .trim();
  return referencedLabel || select.getAttribute('aria-label') || nativeLabel;
};

const Select = React.forwardRef<HTMLSelectElement, React.ComponentPropsWithoutRef<'select'>>(
  ({ className, id: providedId, onClick, onKeyDown, onPointerDown, ...props }, ref) => {
    const labels = React.useContext(SelectLabelsContext);
    const generatedId = React.useId();
    const id = providedId ?? generatedId;
    const selectRef = React.useRef<HTMLSelectElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [open, setOpen] = React.useState(false);
    const [options, setOptions] = React.useState(emptyOptions);
    const value = String(props.value ?? (open ? selectRef.current?.value : '') ?? '');
    const state = useSearchableSelectState({ options, value, setOpen });
    const setSelectRef = React.useCallback(
      (select: HTMLSelectElement | null) => {
        selectRef.current = select;
        if (typeof ref === 'function') return ref(select);
        if (ref) ref.current = select;
      },
      [ref]
    );

    const close = (settings?: { focusTrigger?: boolean }) => {
      if (settings?.focusTrigger) selectRef.current?.focus();
      return state.close(settings);
    };

    React.useLayoutEffect(() => {
      if (!open || !selectRef.current) return;
      if (selectRef.current.matches(':disabled')) {
        state.close();
        return;
      }
      setOptions(readOptions(selectRef.current));
    }, [open, props.children, props.disabled, state.close]);

    const openSearch = (event: React.SyntheticEvent<HTMLSelectElement>, toggle = true) => {
      const select = event.currentTarget;
      if (
        !labels ||
        event.defaultPrevented ||
        select.multiple ||
        select.size > 1 ||
        select.options.length <= visibleSelectOptionCount ||
        select.matches(':disabled')
      )
        return;

      const nextOptions = readOptions(select);
      if (nextOptions.length <= visibleSelectOptionCount) return;

      event.preventDefault();
      if (!toggle) return;
      if (open) {
        close({ focusTrigger: true });
        return;
      }

      setOptions(nextOptions);
      state.openWithActiveOption(nextOptions, select.value);
    };

    const chooseValue = (nextValue: string) => {
      const select = selectRef.current;
      if (!select || select.matches(':disabled') || select.value === nextValue) return;
      const option = Array.from(select.options).find(
        (candidate) =>
          candidate.value === nextValue &&
          !candidate.disabled &&
          !candidate.closest('optgroup')?.disabled
      );
      if (!option) return;

      select.selectedIndex = option.index;
      const EventConstructor = select.ownerDocument.defaultView?.Event ?? Event;
      select.dispatchEvent(new EventConstructor('input', { bubbles: true }));
      select.dispatchEvent(new EventConstructor('change', { bubbles: true }));
    };

    return (
      <Popover.Root
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) close();
        }}
      >
        <Popover.Anchor asChild>
          <select
            {...props}
            ref={setSelectRef}
            id={id}
            className={cn(
              'animate-input-glow flex h-11 min-h-11 w-full rounded-md border border-input bg-surface-inset px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-action-disabled disabled:text-action-disabled-foreground disabled:opacity-100',
              className
            )}
            aria-controls={open ? `${id}-listbox` : props['aria-controls']}
            aria-expanded={open ? true : props['aria-expanded']}
            onPointerDown={(event) => {
              onPointerDown?.(event);
              if (event.button === 0) openSearch(event);
            }}
            onClick={(event) => {
              onClick?.(event);
              openSearch(event, event.detail === 0);
            }}
            onKeyDown={(event) => {
              onKeyDown?.(event);
              if (['ArrowDown', 'ArrowUp', 'Enter', ' ', 'F4'].includes(event.key))
                openSearch(event);
            }}
          />
        </Popover.Anchor>
        {open && labels && selectRef.current ? (
          <SearchableSelectPopover
            activeIndex={state.activeIndex}
            close={close}
            emptyText={labels.empty}
            filteredOptions={state.filteredOptions}
            id={id}
            inputRef={inputRef}
            label={readLabel(selectRef.current) || labels.options}
            onValueChange={chooseValue}
            searchInputId={`${id}-search-input`}
            searchPlaceholder={labels.search}
            searchValue={state.effectiveSearchValue}
            selectedValue={value}
            setActiveIndex={state.setActiveIndex}
            setSearch={state.setSearch}
          />
        ) : null}
      </Popover.Root>
    );
  }
);
Select.displayName = 'Select';

export { Select };
