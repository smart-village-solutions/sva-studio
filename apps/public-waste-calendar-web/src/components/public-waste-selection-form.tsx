import React from 'react';
import { IconSearch } from '@tabler/icons-react';

import type { PublicWasteSelectableEntry } from '../lib/public-waste-contract.js';
import { PublicWasteSelectionResults } from './public-waste-selection-results.js';

export type PublicWasteSelectionPathItem = {
  readonly step: string;
  readonly label: string;
};

const normalizeSearchValue = (value: string): string =>
  value
    .trim()
    .toLocaleLowerCase('de-DE')
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss');

const sortOptions = (
  options: readonly PublicWasteSelectableEntry[]
): readonly PublicWasteSelectableEntry[] =>
  [...options].sort((left, right) => left.label.localeCompare(right.label, 'de'));

const useSelectionNavigation = (
  input: Readonly<{
    activeOptionIndex: number;
    comboboxId: string;
    filteredOptions: readonly PublicWasteSelectableEntry[];
    onSelectOption: (optionId: string) => void;
    searchQuery: string;
    setActiveOptionIndex: React.Dispatch<React.SetStateAction<number>>;
    setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  }>
) => {
  const activateOption = (index: number) => {
    const option = input.filteredOptions[index];
    if (!option) {
      return;
    }

    input.setActiveOptionIndex(index);
    document
      .getElementById(`${input.comboboxId}-option-${option.id}`)
      ?.scrollIntoView?.({ block: 'nearest' });
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && (input.searchQuery.length > 0 || input.activeOptionIndex >= 0)) {
      event.preventDefault();
      input.setSearchQuery('');
      input.setActiveOptionIndex(-1);
      return;
    }

    if (input.filteredOptions.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      activateOption(Math.min(input.activeOptionIndex + 1, input.filteredOptions.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      activateOption(
        input.activeOptionIndex <= 0
          ? input.filteredOptions.length - 1
          : input.activeOptionIndex - 1
      );
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      activateOption(event.key === 'Home' ? 0 : input.filteredOptions.length - 1);
      return;
    }

    if (event.key === 'Enter' && input.activeOptionIndex >= 0) {
      event.preventDefault();
      const activeOption = input.filteredOptions[input.activeOptionIndex];
      if (activeOption) {
        input.onSelectOption(activeOption.id);
      }
    }
  };

  return { activateOption, handleSearchKeyDown };
};

export function PublicWasteSelectionForm(
  props: Readonly<{
    nextStepLabel: string;
    options: readonly PublicWasteSelectableEntry[];
    selectionPath: readonly PublicWasteSelectionPathItem[];
    onEditStep: (stepIndex: number) => void;
    onSelectOption: (optionId: string) => void;
  }>
) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [canScrollDown, setCanScrollDown] = React.useState(false);
  const [activeOptionIndex, setActiveOptionIndex] = React.useState(-1);
  const resultsRef = React.useRef<HTMLDivElement>(null);
  const comboboxId = React.useId();
  const resultsId = `${comboboxId}-results`;
  const statusId = `${comboboxId}-status`;
  const sortedOptions = React.useMemo(() => sortOptions(props.options), [props.options]);
  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = normalizeSearchValue(searchQuery);
    if (!normalizedQuery) {
      return sortedOptions;
    }
    return sortedOptions.filter((option) =>
      normalizeSearchValue(option.label).includes(normalizedQuery)
    );
  }, [searchQuery, sortedOptions]);

  React.useEffect(() => {
    setSearchQuery('');
    setActiveOptionIndex(-1);
  }, [props.nextStepLabel, props.options]);

  const { activateOption, handleSearchKeyDown } = useSelectionNavigation({
    activeOptionIndex,
    comboboxId,
    filteredOptions,
    onSelectOption: props.onSelectOption,
    searchQuery,
    setActiveOptionIndex,
    setSearchQuery,
  });

  const updateScrollHint = React.useCallback(() => {
    const results = resultsRef.current;
    setCanScrollDown(
      results !== null && results.scrollHeight - results.scrollTop - results.clientHeight > 1
    );
  }, []);

  React.useLayoutEffect(() => {
    updateScrollHint();
    const results = resultsRef.current;
    if (!results || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(updateScrollHint);
    observer.observe(results);
    return () => observer.disconnect();
  }, [filteredOptions, updateScrollHint]);

  return (
    <section className="selection-panel" aria-label="Standortauswahl">
      <div className="selection-intro">
        <h2 className="section-title">Standort wählen</h2>
        <p className="body-copy">Stellen Sie Ihren Abholort Schritt für Schritt zusammen.</p>
      </div>
      {props.selectionPath.length === 0 ? null : (
        <div className="selection-path" aria-label="Auswahlpfad">
          {props.selectionPath.map((entry, index) => (
            <button
              key={`${entry.step}-${entry.label}`}
              type="button"
              className="selection-path-chip"
              aria-label={`${entry.step} ändern`}
              onClick={() => props.onEditStep(index)}
            >
              <span className="selection-path-chip-step">{entry.step}</span>
              <strong className="selection-path-chip-label">{entry.label}</strong>
              <span className="selection-path-chip-action">Ändern</span>
            </button>
          ))}
        </div>
      )}
      <div className="selection-step-card">
        <div className="selection-step-card-header">
          <span className="selection-step-kicker">Aktiver Schritt</span>
          <h3 className="selection-step-title">{`${props.nextStepLabel} wählen`}</h3>
          <p className="selection-step-copy">Wählen Sie jetzt einen Eintrag aus der Liste.</p>
        </div>
        <div className="selection-combobox">
          <div className="selection-search-panel">
            <label className="sr-only" htmlFor={`selection-search-${props.nextStepLabel}`}>
              {`${props.nextStepLabel} suchen`}
            </label>
            <div className="selection-search-shell">
              <IconSearch size={18} stroke={1.75} aria-hidden="true" />
              <input
                id={`selection-search-${props.nextStepLabel}`}
                className="selection-search-input"
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-controls={resultsId}
                aria-describedby={statusId}
                aria-expanded="true"
                aria-haspopup="listbox"
                aria-activedescendant={
                  activeOptionIndex >= 0 && filteredOptions[activeOptionIndex]
                    ? `${comboboxId}-option-${filteredOptions[activeOptionIndex].id}`
                    : undefined
                }
                autoComplete="off"
                placeholder={`${props.nextStepLabel} suchen`}
                value={searchQuery}
                autoFocus
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setActiveOptionIndex(-1);
                }}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
            <p
              id={statusId}
              className="selection-search-meta"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {searchQuery.trim().length === 0
                ? `${filteredOptions.length} ${filteredOptions.length === 1 ? 'Eintrag' : 'Einträge'}`
                : `${filteredOptions.length} Treffer`}
            </p>
          </div>
        </div>
        <PublicWasteSelectionResults
          activeOptionIndex={activeOptionIndex}
          canScrollDown={canScrollDown}
          comboboxId={comboboxId}
          filteredOptions={filteredOptions}
          nextStepLabel={props.nextStepLabel}
          onActivateOption={activateOption}
          onScroll={updateScrollHint}
          onSelectOption={props.onSelectOption}
          resultsId={resultsId}
          resultsRef={resultsRef}
          searchQuery={searchQuery}
        />
      </div>
    </section>
  );
}
