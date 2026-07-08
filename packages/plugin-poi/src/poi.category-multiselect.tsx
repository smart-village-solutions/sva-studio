import * as React from 'react';
import { Badge, Input } from '@sva/studio-ui-react';

import type { PoiCategoryOption } from './poi.types.js';

export type PoiCategoryMultiselectProps = Readonly<{
  availableCategories: readonly PoiCategoryOption[];
  disabled?: boolean;
  errorMessage?: string;
  helpText: string;
  inputId?: string;
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

export function PoiCategoryMultiselect({
  availableCategories,
  disabled = false,
  errorMessage,
  helpText,
  inputId,
  inputPlaceholder,
  loading,
  loadingText,
  onChange,
  removeLabel,
  searchLabel,
  value,
}: PoiCategoryMultiselectProps) {
  const [draftValue, setDraftValue] = React.useState('');
  const normalizedValue = dedupeCategoryNames(value);
  const datalistId = React.useId();

  const suggestionNames = availableCategories
    .map((category) => category.name.trim())
    .filter((name) => name.length > 0 && normalizedValue.includes(name) === false);

  const filteredSuggestionNames =
    draftValue.trim().length === 0
      ? suggestionNames
      : suggestionNames.filter((name) => name.toLocaleLowerCase().includes(draftValue.trim().toLocaleLowerCase()));

  const trySelectSuggestedCategory = React.useCallback(
    (rawValue: string) => {
      const nextName = normalizeName(rawValue);
      if (nextName.length === 0) {
        return false;
      }

      const matchingSuggestion = suggestionNames.find(
        (name) => name.toLocaleLowerCase() === nextName.toLocaleLowerCase()
      );
      if (!matchingSuggestion) {
        return false;
      }

      onChange(dedupeCategoryNames([...normalizedValue, matchingSuggestion]));
      setDraftValue('');
      return true;
    },
    [normalizedValue, onChange, suggestionNames]
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
      <div className="space-y-2">
        <Input
          id={inputId}
          aria-label={searchLabel}
          list={datalistId}
          disabled={disabled || loading}
          placeholder={inputPlaceholder}
          value={draftValue}
          onChange={(event) => {
            const nextValue = event.currentTarget.value;
            if (trySelectSuggestedCategory(nextValue)) {
              return;
            }

            setDraftValue(nextValue);
          }}
          onBlur={() => addCategory()}
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

      {normalizedValue.length > 0 ? (
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
      ) : null}
    </div>
  );
}
