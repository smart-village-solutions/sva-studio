import { SearchableMultiSelect } from '@sva/studio-ui-react';

import type { EventCategoryOption } from './events.types.js';

export type EventsCategoryMultiselectProps = Readonly<{
  availableCategories: readonly EventCategoryOption[];
  disabled?: boolean;
  emptyText: string;
  errorMessage?: string;
  helpText: string;
  inputId?: string;
  inputPlaceholder: string;
  loading: boolean;
  loadingText: string;
  onChange: (value: string[]) => void;
  removeLabel: (name: string) => string;
  searchLabel: string;
  unavailableText: string;
  value: string[];
}>;

export function EventsCategoryMultiselect({
  availableCategories,
  disabled = false,
  emptyText,
  errorMessage,
  helpText,
  inputId = 'event-category',
  inputPlaceholder,
  loading,
  loadingText,
  onChange,
  removeLabel,
  searchLabel,
  unavailableText,
  value,
}: EventsCategoryMultiselectProps) {
  return (
    <SearchableMultiSelect
      disabled={disabled}
      emptyText={emptyText}
      errorMessage={errorMessage}
      helpText={helpText}
      id={inputId}
      loading={loading}
      loadingText={loadingText}
      onValueChange={onChange}
      options={availableCategories.map((category) => ({
        label: category.name,
        value: category.name,
      }))}
      placeholder={inputPlaceholder}
      removeLabel={removeLabel}
      searchLabel={searchLabel}
      unavailableText={unavailableText}
      value={value}
    />
  );
}
