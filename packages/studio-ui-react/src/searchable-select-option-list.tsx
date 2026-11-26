import { cn } from './utils.js';

export type SearchableSelectOption = {
  readonly value: string;
  readonly label: string;
  readonly keywords?: readonly string[];
  readonly disabled?: boolean;
  readonly description?: string;
};

// Five 44 px rows and their gaps fit in the 240 px option list.
export const visibleSelectOptionCount = 5;

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

export const findEnabledOptionIndex = (
  options: readonly SearchableSelectOption[],
  start: number,
  direction: 1 | -1
): number => {
  if (options.length === 0) return -1;
  for (let offset = 0; offset < options.length; offset += 1) {
    const index = (start + offset * direction + options.length) % options.length;
    if (!options[index]?.disabled) return index;
  }
  return -1;
};

export const filterSearchableSelectOptions = (
  options: readonly SearchableSelectOption[],
  searchValue: string
) => options.filter((option) => matchesSearchableSelectOption(option, searchValue));

const toOptionId = (id: string, index: number) => `${id}-option-${index}`;

export const getSearchableSelectOptionId = toOptionId;

export const scrollActiveOptionIntoListView = (list: HTMLUListElement, activeIndex: number) => {
  const activeOption = list.querySelectorAll('[role="option"]').item(activeIndex);
  if (!activeOption) return;

  const listBounds = list.getBoundingClientRect();
  const optionBounds = activeOption.getBoundingClientRect();
  if (optionBounds.top < listBounds.top) {
    list.scrollTop += optionBounds.top - listBounds.top;
  } else if (optionBounds.bottom > listBounds.bottom) {
    list.scrollTop += optionBounds.bottom - listBounds.bottom;
  }
};

export const SearchableSelectOptionList = ({
  activeIndex,
  close,
  emptyText,
  filteredOptions,
  id,
  label,
  listRef,
  onKeyDown,
  onValueChange,
  selectedValue,
}: Readonly<{
  activeIndex: number;
  close: (options?: { focusTrigger?: boolean }) => void;
  emptyText: string;
  filteredOptions: readonly SearchableSelectOption[];
  id: string;
  label: string;
  listRef?: React.Ref<HTMLUListElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLUListElement>;
  onValueChange: (value: string) => void;
  selectedValue: string;
}>) => (
  <ul
    ref={listRef}
    id={`${id}-listbox`}
    role="listbox"
    aria-label={label}
    tabIndex={onKeyDown ? 0 : -1}
    onKeyDown={onKeyDown}
    aria-activedescendant={
      onKeyDown && filteredOptions[activeIndex] ? toOptionId(id, activeIndex) : undefined
    }
    className="min-h-0 max-h-60 space-y-1 overflow-y-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    {filteredOptions.length ? (
      filteredOptions.map((option, index) => {
        const selected = option.value === selectedValue;
        const active = index === activeIndex;

        return (
          <li key={option.value} role="presentation">
            <button
              id={toOptionId(id, index)}
              type="button"
              tabIndex={-1}
              role="option"
              aria-selected={selected}
              aria-disabled={option.disabled || undefined}
              disabled={option.disabled}
              className={cn(
                'min-h-11 w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                active || selected ? 'bg-muted font-medium text-foreground' : 'text-foreground'
              )}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onValueChange(option.value);
                close({ focusTrigger: true });
              }}
            >
              <span className="block">{option.label}</span>
              {option.description ? (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {option.description}
                </span>
              ) : null}
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
);
