import * as React from 'react';
import { Badge, Input } from '@sva/studio-ui-react';

import type { NewsCategoryOption } from './news.types.js';

export type NewsCategoryMultiselectProps = Readonly<{
  availableCategories: readonly NewsCategoryOption[];
  disabled?: boolean;
  errorMessage?: string;
  helpText: string;
  inputPlaceholder: string;
  loading: boolean;
  loadingText: string;
  onChange: (value: string[]) => void;
  removeLabel: (name: string) => string;
  searchLabel: string;
  value: string[];
}>;

const normalizeName = (value: string) => value.trim();

const dedupeCategoryNames = (values: readonly string[]) =>
  Array.from(new Set(values.map(normalizeName).filter((entry) => entry.length > 0)));

const buildSuggestionNames = (availableCategories: readonly NewsCategoryOption[], normalizedValue: readonly string[]) =>
  availableCategories
    .map((category) => category.name.trim())
    .filter((name) => name.length > 0 && normalizedValue.includes(name) === false);

const filterSuggestionNames = (suggestionNames: readonly string[], draftValue: string) => {
  const normalizedDraftValue = draftValue.trim().toLocaleLowerCase();
  if (normalizedDraftValue.length === 0) {
    return suggestionNames;
  }

  return suggestionNames.filter((name) => name.toLocaleLowerCase().includes(normalizedDraftValue));
};

const NewsCategoryInput = ({
  addCategory,
  datalistId,
  disabled,
  draftValue,
  errorMessage,
  filteredSuggestionNames,
  helpText,
  inputPlaceholder,
  loading,
  loadingText,
  searchLabel,
  setDraftValue,
}: Readonly<{
  addCategory: () => void;
  datalistId: string;
  disabled: boolean;
  draftValue: string;
  errorMessage?: string;
  filteredSuggestionNames: readonly string[];
  helpText: string;
  inputPlaceholder: string;
  loading: boolean;
  loadingText: string;
  searchLabel: string;
  setDraftValue: (value: string) => void;
}>) => (
  <div className="space-y-2">
    <Input
      aria-label={searchLabel}
      list={datalistId}
      disabled={disabled || loading}
      placeholder={inputPlaceholder}
      value={draftValue}
      onChange={(event) => setDraftValue(event.currentTarget.value)}
      onBlur={addCategory}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          addCategory();
        }
      }}
    />
    <datalist id={datalistId}>
      {filteredSuggestionNames.map((name) => (
        <option key={name} value={name} />
      ))}
    </datalist>
    <p className="text-sm text-foreground">{loading ? loadingText : helpText}</p>
    {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
  </div>
);

const NewsSelectedCategories = ({
  disabled,
  normalizedValue,
  removeCategory,
  removeLabel,
}: Readonly<{
  disabled: boolean;
  normalizedValue: readonly string[];
  removeCategory: (categoryName: string) => void;
  removeLabel: (name: string) => string;
}>) =>
  normalizedValue.length > 0 ? (
    <div className="flex flex-wrap gap-2">
      {normalizedValue.map((name) => (
        <Badge key={name} variant="outline" className="flex items-center gap-2 px-3 py-1">
          <span>{name}</span>
          <button
            type="button"
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            aria-label={removeLabel(name)}
            disabled={disabled}
            onClick={() => removeCategory(name)}
          >
            x
          </button>
        </Badge>
      ))}
    </div>
  ) : null;

export function NewsCategoryMultiselect({
  availableCategories,
  disabled = false,
  errorMessage,
  helpText,
  inputPlaceholder,
  loading,
  loadingText,
  onChange,
  removeLabel,
  searchLabel,
  value,
}: NewsCategoryMultiselectProps) {
  const [draftValue, setDraftValue] = React.useState('');
  const normalizedValue = dedupeCategoryNames(value);
  const datalistId = React.useId();

  const suggestionNames = React.useMemo(
    () => buildSuggestionNames(availableCategories, normalizedValue),
    [availableCategories, normalizedValue]
  );
  const filteredSuggestionNames = React.useMemo(
    () => filterSuggestionNames(suggestionNames, draftValue),
    [draftValue, suggestionNames]
  );

  const addCategory = React.useCallback(() => {
    const nextName = normalizeName(draftValue);
    if (nextName.length === 0) {
      return;
    }

    const nextValue = dedupeCategoryNames([...normalizedValue, nextName]);
    if (nextValue.length === normalizedValue.length) {
      setDraftValue('');
      return;
    }

    onChange(nextValue);
    setDraftValue('');
  }, [draftValue, normalizedValue, onChange]);

  const removeCategory = React.useCallback(
    (categoryName: string) => {
      onChange(normalizedValue.filter((entry) => entry !== categoryName));
    },
    [normalizedValue, onChange]
  );

  return (
    <div className="space-y-3">
      <NewsCategoryInput
        addCategory={addCategory}
        datalistId={datalistId}
        disabled={disabled}
        draftValue={draftValue}
        errorMessage={errorMessage}
        filteredSuggestionNames={filteredSuggestionNames}
        helpText={helpText}
        inputPlaceholder={inputPlaceholder}
        loading={loading}
        loadingText={loadingText}
        searchLabel={searchLabel}
        setDraftValue={setDraftValue}
      />
      <NewsSelectedCategories
        disabled={disabled}
        normalizedValue={normalizedValue}
        removeCategory={removeCategory}
        removeLabel={removeLabel}
      />
    </div>
  );
}
