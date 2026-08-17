import { SearchableMultiSelect } from '@sva/studio-ui-react';

import type { GenericItemCategoryOption } from './generic-items.api-types.js';

export type GenericItemsCategoryMultiselectProps = Readonly<{
  availableCategories: readonly GenericItemCategoryOption[];
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

export function GenericItemsCategoryMultiselect({
  availableCategories,
  disabled = false,
  emptyText,
  errorMessage,
  helpText,
  inputId = 'generic-item-category',
  inputPlaceholder,
  loading,
  loadingText,
  onChange,
  removeLabel,
  searchLabel,
  unavailableText,
  value,
}: GenericItemsCategoryMultiselectProps) {
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
