import { SearchableMultiSelect } from '@sva/studio-ui-react';

import type { NewsCategoryOption } from './news.types.js';

export type NewsCategoryMultiselectProps = Readonly<{
  availableCategories: readonly NewsCategoryOption[];
  disabled?: boolean;
  emptyText: string;
  errorMessage?: string;
  helpText: string;
  inputPlaceholder: string;
  loading: boolean;
  loadingText: string;
  onChange: (value: string[]) => void;
  removeLabel: (name: string) => string;
  searchLabel: string;
  unavailableText: string;
  value: string[];
}>;

export function NewsCategoryMultiselect({
  availableCategories,
  disabled = false,
  emptyText,
  errorMessage,
  helpText,
  inputPlaceholder,
  loading,
  loadingText,
  onChange,
  removeLabel,
  searchLabel,
  unavailableText,
  value,
}: NewsCategoryMultiselectProps) {
  return (
    <SearchableMultiSelect
      disabled={disabled}
      emptyText={emptyText}
      errorMessage={errorMessage}
      helpText={helpText}
      id="news-category"
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
