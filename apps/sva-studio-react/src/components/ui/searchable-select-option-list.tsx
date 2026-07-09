import { cn } from '@/lib/utils';

export type SearchableSelectOption = {
  readonly value: string;
  readonly label: string;
  readonly keywords?: readonly string[];
};

const toOptionId = (id: string, index: number) => `${id}-option-${index}`;

export const getSearchableSelectOptionId = toOptionId;

export const SearchableSelectOptionList = ({
  activeIndex,
  close,
  emptyText,
  filteredOptions,
  id,
  label,
  onValueChange,
  selectedValue,
}: Readonly<{
  activeIndex: number;
  close: (options?: { focusTrigger?: boolean }) => void;
  emptyText: string;
  filteredOptions: readonly SearchableSelectOption[];
  id: string;
  label: string;
  onValueChange: (value: string) => void;
  selectedValue: string;
}>) => (
  <ul id={`${id}-listbox`} role="listbox" aria-label={label} className="mt-2 max-h-60 space-y-1 overflow-y-auto">
    {filteredOptions.length ? (
      filteredOptions.map((option, index) => {
        const selected = option.value === selectedValue;
        const active = index === activeIndex;

        return (
          <li key={option.value} role="presentation">
            <button
              id={toOptionId(id, index)}
              type="button"
              role="option"
              aria-selected={selected}
              className={cn(
                'w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                active || selected ? 'bg-muted font-medium text-foreground' : 'text-foreground'
              )}
              onClick={() => {
                onValueChange(option.value);
                close({ focusTrigger: true });
              }}
            >
              {option.label}
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
